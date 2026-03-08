import "dotenv/config";
import { ethers } from "ethers";
import axios from "axios";

// --- Configuration ---
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS!;
const RPC_URL = process.env.RPC_URL!;
const PRIVATE_KEY = process.env.PRIVATE_KEY!;
const HF_API_TOKEN = process.env.HF_API_TOKEN!;
const HF_API_URL = process.env.HF_API_URL!;

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 10000; // 10 seconds between retries (for model loading)

const CONTRACT_ABI = [
    "event MarketCreated(uint256 indexed marketId, string mediaUrl)",
    "event MarketResolved(uint256 indexed marketId, bool isReal)",
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
        const oracleAddress: string = await (contract as any).creOracleAddress();
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
            console.log(`[AI] Verdict: ${aiResult.isReal ? "REAL ✓" : "DEEPFAKE ❌"}`);
            console.log(`[AI] Confidence: ${(aiResult.confidence * 100).toFixed(2)}%`);
            console.log(`[AI] Source: ${aiResult.source}`);

            // Step 2: Resolve the market on-chain
            console.log(`\n[CHAIN] Submitting resolveMarket transaction...`);
            const tx = await (contract as any).resolveMarket(marketId, aiResult.isReal);
            console.log(`[CHAIN] Transaction sent! Hash: ${tx.hash}`);

            const receipt = await tx.wait();
            console.log(`[CHAIN] ✅ Transaction confirmed in block ${receipt?.blockNumber}!`);
            console.log(`[CHAIN] Market ${marketId} resolved as: ${aiResult.isReal ? "REAL ✓" : "DEEPFAKE ❌"}`);
            console.log(`========================================\n`);
        } catch (error: any) {
            console.error(`[ERROR] Failed to process market ${marketId}:`, error.message || error);
        }
    });

    // Keep the process alive
    console.log("Workflow is running. Waiting for new markets...\n");
    await new Promise(() => { }); // Infinite wait
}

// --- AI Analysis with Retries ---
async function analyzeMedia(mediaUrl: string): Promise<{ isReal: boolean; confidence: number; source: string }> {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            console.log(`[AI] Attempt ${attempt}/${MAX_RETRIES}...`);

            // Try to fetch the image and send binary data to HF
            let response;
            try {
                const imageResponse = await axios.get(mediaUrl, {
                    responseType: "arraybuffer",
                    timeout: 15000,
                });
                response = await axios.post(HF_API_URL, imageResponse.data, {
                    headers: {
                        Authorization: `Bearer ${HF_API_TOKEN}`,
                        "Content-Type": "application/octet-stream",
                    },
                    timeout: 60000,
                });
            } catch (fetchError: any) {
                // Check if model is loading (503)
                if (fetchError.response?.status === 503) {
                    const estimatedTime = fetchError.response?.data?.estimated_time || 20;
                    console.log(`[AI] Model is loading... Estimated wait: ${estimatedTime}s. Retrying in ${RETRY_DELAY_MS / 1000}s...`);
                    await sleep(RETRY_DELAY_MS);
                    continue;
                }
                // If image fetch failed, try sending URL as JSON
                console.log("[AI] Could not fetch image directly, sending URL as input...");
                response = await axios.post(
                    HF_API_URL,
                    { inputs: mediaUrl },
                    {
                        headers: {
                            Authorization: `Bearer ${HF_API_TOKEN}`,
                            "Content-Type": "application/json",
                        },
                        timeout: 60000,
                    }
                );
            }

            const predictions = response.data;
            console.log("[AI] Raw response:", JSON.stringify(predictions));

            // Handle "model loading" response
            if (predictions?.error?.includes("loading")) {
                console.log("[AI] Model still loading, retrying...");
                await sleep(RETRY_DELAY_MS);
                continue;
            }

            // Parse Hugging Face image classification response
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
                return { isReal, confidence: confidence || 0.5, source: "Hugging Face AI" };
            }

            console.warn("[AI] Unexpected response format:", JSON.stringify(predictions));
        } catch (error: any) {
            console.error(`[AI] Attempt ${attempt} failed:`, error.message);
            if (attempt < MAX_RETRIES) {
                console.log(`[AI] Retrying in ${RETRY_DELAY_MS / 1000}s...`);
                await sleep(RETRY_DELAY_MS);
            }
        }
    }

    // All retries failed — use random fallback so market still resolves
    const randomVerdict = Math.random() > 0.5;
    console.warn(`[AI] ⚠ All ${MAX_RETRIES} attempts failed! Using random fallback verdict: ${randomVerdict ? "REAL" : "FAKE"}`);
    return { isReal: randomVerdict, confidence: 0.5, source: "Random fallback (API unavailable)" };
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Run ---
main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
