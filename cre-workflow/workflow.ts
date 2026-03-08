import { ethers } from "ethers";
import axios from "axios";
import * as dotenv from "dotenv";

dotenv.config();

// Define a strict interface for the contract methods we plan to use
interface DeepFakeMarketContract extends ethers.Contract {
    resolveMarket(marketId: bigint, isReal: boolean): Promise<ethers.ContractTransactionResponse>;
    creOracleAddress(): Promise<string>;
}

// Contract ABI
const ABI = [
    "event MarketCreated(uint256 indexed marketId, string mediaUrl)",
    "function resolveMarket(uint256 _marketId, bool _isReal) external",
    "function creOracleAddress() view returns (address)"
];

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const RPC_URL = process.env.RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const HF_API_URL = process.env.HF_API_URL || "https://api-inference.huggingface.co/models/dima806/deepfake_vs_real_image_detection";
const HF_API_TOKEN = process.env.HF_API_TOKEN;

if (!CONTRACT_ADDRESS || !RPC_URL || !PRIVATE_KEY || !HF_API_TOKEN) {
    console.error("Missing required environment variables in cre-workflow.");
    process.exit(1);
}

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

// Cast the contract instance to our strongly-typed interface
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet) as unknown as DeepFakeMarketContract;

/**
 * Call Hugging Face Inference API
 */
async function analyzeMedia(mediaUrl: string): Promise<boolean> {
    try {
        console.log(`Analyzing media at ${mediaUrl} via Hugging Face...`);

        const response = await axios.get(mediaUrl, { responseType: 'arraybuffer' });
        const imageBuffer = response.data;

        const hfResponse = await axios.post(
            HF_API_URL,
            imageBuffer,
            {
                headers: {
                    Authorization: `Bearer ${HF_API_TOKEN}`,
                    "Content-Type": "application/octet-stream",
                },
            }
        );

        const predictions = hfResponse.data;
        console.log("HF Predictions:", predictions);

        // AI model returns an array of label/score pairs. e.g. [{label: "real", score: 0.9}, {label: "fake", score: 0.1}]
        // For this specific 'dima806' model, it usually returns lists of predictions
        // If it's nested (e.g. video frames), flatten it.
        let realPrediction;

        if (Array.isArray(predictions) && Array.isArray(predictions[0])) {
            realPrediction = predictions[0].find((p: any) => p.label.toLowerCase().includes("real"));
        } else if (Array.isArray(predictions)) {
            realPrediction = predictions.find((p: any) => p.label.toLowerCase().includes("real"));
        }

        if (realPrediction && realPrediction.score > 0.5) {
            return true;
        }
        return false;

    } catch (error: any) {
        console.error("Error analyzing media:", error.message || error);
        return false;
    }
}

/**
 * Handle MarketCreated Event
 */
async function onMarketCreated(marketId: bigint, mediaUrl: string) {
    console.log(`\n--- New Market Created ---`);
    console.log(`Market ID: ${marketId}`);
    console.log(`Media URL: ${mediaUrl}`);

    const isReal = await analyzeMedia(mediaUrl);
    console.log(`AI Verdict: The media is ${isReal ? "REAL" : "FAKE"}`);

    console.log(`Submitting cross-chain execution to resolve market on-chain...`);
    try {
        const tx = await contract.resolveMarket(marketId, isReal);
        console.log(`Transaction submitted: ${tx.hash}`);

        const receipt = await tx.wait();
        console.log(`Transaction confirmed in block ${receipt?.blockNumber}. Market resolved!\n`);
    } catch (error: any) {
        console.error(`Failed to resolve market on-chain:`, error.message || error);
    }
}

/**
 * Main function
 */
async function main() {
    console.log("Starting Chainlink CRE AI Workflow...");
    console.log(`Listening for MarketCreated events on ${CONTRACT_ADDRESS}...\n`);

    try {
        const oracleAddr = await contract.creOracleAddress();
        if (oracleAddr.toLowerCase() !== wallet.address.toLowerCase()) {
            console.warn(`WARNING: This wallet (${wallet.address}) is NOT the registered oracle (${oracleAddr}) for the contract! Transaction will fail.`);
        } else {
            console.log(`Verified: We are the registered oracle!`);
        }
    } catch (e: any) {
        console.warn("Could not verify creOracleAddress. Is the contract deployed on this network?", e.message || e);
    }

    contract.on("MarketCreated", onMarketCreated);
}

main().catch(console.error);

process.on('SIGINT', () => {
    console.log("\nShutting down CRE Workflow listening...");
    contract.removeAllListeners();
    process.exit(0);
});
