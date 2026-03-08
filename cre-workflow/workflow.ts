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
    "function resolveMarket(uint256 _marketId, bool _isReal) external",
    "function creOracleAddress() view returns (address)",
    "function markets(uint256) view returns (string, uint256, uint256, bool, bool)",
];

// --- Main Workflow ---
async function main() {
    console.log("Starting Chainlink CRE AI Workflow...");

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

    console.log(`Listening for MarketCreated events on ${CONTRACT_ADDRESS}...`);

    // Verify oracle address
    try {
        const oracleAddress: string = await contract.creOracleAddress();
        if (wallet.address.toLowerCase() !== oracleAddress.toLowerCase()) {
            console.warn(`\nWARNING: This wallet (${wallet.address}) is NOT the registered oracle (${oracleAddress}) for the contract! Transaction will fail.\n`);
        } else {
            console.log(`\nVerified: We are the registered oracle!\n`);
        }
    } catch (e) {
        console.warn("Could not verify oracle address:", e);
    }

    // Listen for MarketCreated events
    contract.on("MarketCreated", async (marketId: bigint, mediaUrl: string) => {
        console.log(`\n========================================`);
        console.log(`NEW MARKET DETECTED!`);
        console.log(`  Market ID: ${marketId}`);
        console.log(`  Media URL: ${mediaUrl}`);
        console.log(`========================================\n`);

        try {
            // Step 1: Call Hugging Face API for AI analysis
            console.log("[AI] Sending media to Hugging Face for deepfake analysis...");
            const aiResult = await analyzeMedia(mediaUrl);
            console.log(`[AI] Analysis complete!`);
            console.log(`[AI] Verdict: ${aiResult.isReal ? "REAL" : "DEEPFAKE"}`);
            console.log(`[AI] Confidence: ${(aiResult.confidence * 100).toFixed(2)}%`);

            // Step 2: Resolve the market on-chain
            console.log(`\n[CHAIN] Submitting resolveMarket transaction...`);
            const tx = await contract.resolveMarket(marketId, aiResult.isReal);
            console.log(`[CHAIN] Transaction sent! Hash: ${tx.hash}`);

            const receipt = await tx.wait();
            console.log(`[CHAIN] Transaction confirmed in block ${receipt?.blockNumber}!`);
            console.log(`[CHAIN] Market ${marketId} resolved as: ${aiResult.isReal ? "REAL" : "DEEPFAKE"}`);
            console.log(`========================================\n`);
        } catch (error: any) {
            console.error(`[ERROR] Failed to process market ${marketId}:`, error.message || error);
        }
    });

    // Keep the process alive
    console.log("Workflow is running. Waiting for new markets...\n");
    await new Promise(() => { }); // Infinite wait
}

// --- AI Analysis ---
async function analyzeMedia(mediaUrl: string): Promise<{ isReal: boolean; confidence: number }> {
    try {
        // Try to fetch the image and send binary data
        let response;
        try {
            const imageResponse = await axios.get(mediaUrl, {
                responseType: "arraybuffer",
                timeout: 15000
            });
            response = await axios.post(HF_API_URL, imageResponse.data, {
                headers: {
                    Authorization: `Bearer ${HF_API_TOKEN}`,
                    "Content-Type": "application/octet-stream",
                },
                timeout: 30000,
            });
        } catch (fetchError) {
            // If we can't fetch the image, send the URL as text input
            console.log("[AI] Could not fetch image directly, sending URL...");
            response = await axios.post(
                HF_API_URL,
                { inputs: mediaUrl },
                {
                    headers: {
                        Authorization: `Bearer ${HF_API_TOKEN}`,
                        "Content-Type": "application/json",
                    },
                    timeout: 30000,
                }
            );
        }

        const predictions = response.data;
        console.log("[AI] Raw predictions:", JSON.stringify(predictions));

        // Parse Hugging Face image classification response
        // Format: [[{label: "Real", score: 0.9}, {label: "Fake", score: 0.1}]]
        if (Array.isArray(predictions) && predictions.length > 0) {
            const results = Array.isArray(predictions[0]) ? predictions[0] : predictions;

            let realScore = 0;
            let fakeScore = 0;

            for (const pred of results) {
                const label = pred.label?.toLowerCase() || "";
                if (label.includes("real") || label.includes("true") || label.includes("genuine")) {
                    realScore = pred.score || 0;
                } else if (label.includes("fake") || label.includes("false") || label.includes("deep")) {
                    fakeScore = pred.score || 0;
                }
            }

            const isReal = realScore >= fakeScore;
            const confidence = isReal ? realScore : fakeScore;

            return { isReal, confidence: confidence || 0.5 };
        }

        // Default fallback
        console.warn("[AI] Unexpected response format, defaulting to REAL");
        return { isReal: true, confidence: 0.5 };
    } catch (error: any) {
        console.error("[AI] Hugging Face API error:", error.message);
        // On API failure, default to a safe verdict
        console.warn("[AI] Defaulting to REAL due to API error");
        return { isReal: true, confidence: 0.5 };
    }
}

// --- Run ---
main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
