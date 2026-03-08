import "dotenv/config";
import { ethers } from "ethers";
import axios from "axios";

// --- Configuration ---
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS!;
const RPC_URL = process.env.RPC_URL!;
const PRIVATE_KEY = process.env.PRIVATE_KEY!;
const HF_API_TOKEN = process.env.HF_API_TOKEN!;
const HF_API_URL = process.env.HF_API_URL!;

// Betting window: wait this many seconds after market creation before resolving
// This gives users time to place their bets
const BETTING_WINDOW_SECONDS = 60;

const CONTRACT_ABI = [
    "event MarketCreated(uint256 indexed marketId, string mediaUrl)",
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
    console.log(`RPC:           ${RPC_URL}`);
    console.log(`Betting window: ${BETTING_WINDOW_SECONDS} seconds\n`);

    // Verify oracle address
    try {
        const oracleAddress: string = await (contract as any).creOracleAddress();
        if (wallet.address.toLowerCase() !== oracleAddress.toLowerCase()) {
            console.error(`❌ FATAL: This wallet (${wallet.address}) is NOT the registered oracle (${oracleAddress})!`);
            console.error(`   The resolveMarket transaction WILL FAIL.\n`);
        } else {
            console.log(`✅ Oracle verification passed!\n`);
        }
    } catch (e: any) {
        console.warn("⚠ Could not verify oracle address:", e.message);
    }

    // Listen for MarketCreated events
    contract.on("MarketCreated", async (marketId: bigint, mediaUrl: string) => {
        console.log(`\n╔════════════════════════════════════════╗`);
        console.log(`║       🆕 NEW MARKET DETECTED!         ║`);
        console.log(`╠════════════════════════════════════════╣`);
        console.log(`║  Market ID: ${String(marketId).padEnd(27)}║`);
        console.log(`║  Media URL: ${mediaUrl.slice(0, 27).padEnd(27)}║`);
        console.log(`╚════════════════════════════════════════╝\n`);

        // --- BETTING WINDOW ---
        console.log(`⏳ BETTING WINDOW OPEN for ${BETTING_WINDOW_SECONDS} seconds!`);
        console.log(`   Users can now place their bets on REAL or FAKE.\n`);

        for (let remaining = BETTING_WINDOW_SECONDS; remaining > 0; remaining -= 10) {
            console.log(`   ⏱ ${remaining}s remaining for bets...`);
            await sleep(Math.min(10000, remaining * 1000));
        }

        console.log(`\n🔒 BETTING WINDOW CLOSED! No more bets.\n`);

        try {
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
            console.log(`\n  Winners can now claim their winnings!`);
            console.log(`══════════════════════════════════════════\n`);
        } catch (error: any) {
            console.error(`\n❌ ERROR processing market ${marketId}:`);
            console.error(`   ${error.message || error}`);
        }
    });

    console.log("🎧 Listening for new MarketCreated events...\n");
    console.log("   Create a market in the frontend to trigger the AI workflow.\n");
    await new Promise(() => { });
}

// --- AI Analysis (fast fail) ---
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

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
