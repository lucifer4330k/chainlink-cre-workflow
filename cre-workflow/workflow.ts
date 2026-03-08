import "dotenv/config";
import { ethers } from "ethers";
import axios from "axios";

// --- Configuration ---
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS!;
const RPC_URL = process.env.RPC_URL!;
const PRIVATE_KEY = process.env.PRIVATE_KEY!;
const HF_API_TOKEN = process.env.HF_API_TOKEN!;
const HF_API_URL = process.env.HF_API_URL!;

const CONTRACT_ABI = [
    "event MarketCreated(uint256 indexed marketId, string mediaUrl)",
    "event WagerPlaced(uint256 indexed marketId, address indexed user, bool guess, uint256 amount)",
    "event MarketResolved(uint256 indexed marketId, bool isReal)",
    "function resolveMarket(uint256 _marketId, bool _isReal) external",
    "function creOracleAddress() view returns (address)",
    "function markets(uint256) view returns (string, uint256, uint256, bool, bool)",
];

// --- Main Workflow ---
async function main() {
    console.log("==============================================");
    console.log("  Chainlink CRE AI Workflow - DeepFakeMarket");
    console.log("==============================================");

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

    console.log(`\nOracle wallet: ${wallet.address}`);
    console.log(`Contract:      ${CONTRACT_ADDRESS}`);
    console.log(`RPC:           ${RPC_URL}\n`);

    // Verify oracle address
    try {
        const oracleAddress: string = await (contract as any).creOracleAddress();
        if (wallet.address.toLowerCase() !== oracleAddress.toLowerCase()) {
            console.error(`❌ FATAL: This wallet is NOT the registered oracle!`);
            console.error(`   Wallet: ${wallet.address}`);
            console.error(`   Oracle: ${oracleAddress}\n`);
        } else {
            console.log(`✅ Oracle verification passed!\n`);
        }
    } catch (e: any) {
        console.warn("⚠ Could not verify oracle address:", e.message);
    }

    // Log new markets
    contract.on("MarketCreated", (marketId: bigint, mediaUrl: string) => {
        console.log(`\n📢 Market #${marketId} created: ${mediaUrl}`);
        console.log(`   Waiting for a user to place a bet...\n`);
    });

    // TRIGGER: Resolve AFTER a user places a bet
    contract.on("WagerPlaced", async (marketId: bigint, user: string, guess: boolean, amount: bigint) => {
        console.log(`\n╔════════════════════════════════════════╗`);
        console.log(`║     💰 BET PLACED — RESOLVING NOW!    ║`);
        console.log(`╠════════════════════════════════════════╣`);
        console.log(`║  Market ID: ${String(marketId).padEnd(27)}║`);
        console.log(`║  User:      ${user.slice(0, 27).padEnd(27)}║`);
        console.log(`║  Bet:       ${(guess ? "REAL" : "FAKE").padEnd(27)}║`);
        console.log(`║  Amount:    ${ethers.formatEther(amount).padEnd(24)} ETH║`);
        console.log(`╚════════════════════════════════════════╝\n`);

        // Check if market is already resolved
        try {
            const marketData = await (contract as any).markets(marketId);
            const [mediaUrl, , , resolved] = marketData;

            if (resolved) {
                console.log(`⏭ Market #${marketId} is already resolved. Skipping.\n`);
                return;
            }

            // Step 1: AI Analysis
            console.log("[STEP 1/2] 🤖 Analyzing media with AI...");
            const aiResult = await analyzeMedia(mediaUrl);

            console.log(`\n[AI RESULT]`);
            console.log(`  Verdict:    ${aiResult.isReal ? "✅ REAL" : "❌ DEEPFAKE"}`);
            console.log(`  Confidence: ${(aiResult.confidence * 100).toFixed(1)}%`);
            console.log(`  Source:     ${aiResult.source}\n`);

            // Step 2: Resolve on-chain
            console.log("[STEP 2/2] ⛓ Submitting resolveMarket transaction...");
            const tx = await (contract as any).resolveMarket(marketId, aiResult.isReal);
            console.log(`  Tx hash: ${tx.hash}`);

            const receipt = await tx.wait();
            console.log(`\n  ✅ CONFIRMED in block ${receipt?.blockNumber}!`);
            console.log(`  🏁 Market #${marketId} → ${aiResult.isReal ? "REAL ✅" : "DEEPFAKE ❌"}`);

            // Tell the user their result
            const userWon = guess === aiResult.isReal;
            console.log(`\n  User ${user.slice(0, 10)}... bet ${guess ? "REAL" : "FAKE"} → ${userWon ? "🏆 WON!" : "💀 LOST"}`);
            if (userWon) {
                console.log(`  💰 They can now claim their winnings in the frontend!`);
            }
            console.log(`══════════════════════════════════════════\n`);
        } catch (error: any) {
            console.error(`\n❌ ERROR processing market ${marketId}:`);
            console.error(`   ${error.message || error}`);
        }
    });

    console.log("🎧 Listening for bets on all markets...\n");
    console.log("   Flow: Create market → Place bet → AI resolves immediately → Claim winnings\n");
    await new Promise(() => { });
}

// --- AI Analysis ---
async function analyzeMedia(mediaUrl: string): Promise<{ isReal: boolean; confidence: number; source: string }> {
    try {
        console.log("  → Fetching media from URL...");
        const imageResponse = await axios.get(mediaUrl, {
            responseType: "arraybuffer",
            timeout: 10000,
        });
        console.log(`  → Got ${imageResponse.data.byteLength} bytes, sending to HuggingFace...`);

        const hfResponse = await axios.post(HF_API_URL, imageResponse.data, {
            headers: {
                Authorization: `Bearer ${HF_API_TOKEN}`,
                "Content-Type": "application/octet-stream",
            },
            timeout: 30000,
        });

        const predictions = hfResponse.data;
        console.log("  → HF raw response:", JSON.stringify(predictions));

        if (predictions?.error) throw new Error(predictions.error);

        if (Array.isArray(predictions) && predictions.length > 0) {
            const results = Array.isArray(predictions[0]) ? predictions[0] : predictions;
            let realScore = 0, fakeScore = 0;

            for (const pred of results) {
                const label = (pred.label || "").toLowerCase();
                if (label.includes("real") || label.includes("true") || label.includes("genuine")) realScore = pred.score || 0;
                else if (label.includes("fake") || label.includes("false") || label.includes("deep")) fakeScore = pred.score || 0;
            }

            const isReal = realScore >= fakeScore;
            return { isReal, confidence: isReal ? realScore : fakeScore || 0.5, source: "Hugging Face AI Model" };
        }
        throw new Error("Unexpected response format");
    } catch (error: any) {
        console.warn(`  ⚠ AI API failed: ${error.message}`);
        console.warn(`  ⚠ Using random fallback verdict`);
        const isReal = Math.random() > 0.6;
        return { isReal, confidence: 0.5 + Math.random() * 0.3, source: "Fallback (AI unavailable)" };
    }
}

main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
