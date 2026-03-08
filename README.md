# DeepFakeMarket 🕵️‍♂️🤖

A decentralized prediction market settled by Chainlink CRE and open-source AI models. Identify deepfakes and earn crypto!

## How it Works

1. **Create a Market**: Anyone can paste a media URL (image or video) to open a prediction pool.
2. **Place Wagers**: Users stake ETH on whether the media is **REAL** or a **DEEPFAKE**.
3. **AI Resolution via Chainlink CRE**: 
   - An off-chain Chainlink CRE workflow listens for market creations.
   - It fetches the media and runs it through a Hugging Face deep learning classification model.
   - The AI verdict is processed off-chain, and an execution transaction is sent back to the smart contract to securely resolve the market.
4. **Claim Winnings**: Winners claim their proportional share of the losing pool!

## Core Architecture

- **Smart Contracts**: `contracts/` - Built with Foundry. Handles all wager logic and secures the prize pools. Contains the `onlyOracle` protected `resolveMarket` function.
- **Chainlink CRE Workflow**: `cre-workflow/` - A Node.js/TypeScript script that acts as the off-chain oracle. It connects web2 AI inference (Hugging Face) to web3 on-chain execution.
- **Frontend App**: `frontend/` - A Next.js 14 Web App with Tailwind CSS and Wagmi/RainbowKit for seamless wallet interactions.

## Chainlink Workflow Implementation Highlight

The magic happens in `cre-workflow/workflow.ts`! By utilizing an event listener, we trigger off-chain compute. 
Instead of trusting a centralized admin, we trust the verifiable output of a machine learning model via an API endpoint, routed securely to the blockchain.

```typescript
// workflow.ts execution logic snippet
const isReal = await analyzeMedia(mediaUrl); // Calls Hugging Face inference API
const tx = await contract.resolveMarket(marketId, isReal); // Trustless on-chain execution
```

## Running the Project Locally

### 1. Smart Contracts
Navigate to `contracts/`
```bash
forge build
# Deploy to testnet:
forge script script/Deploy.s.sol --rpc-url <YOUR_RPC_URL> --broadcast
```

### 2. Off-chain Oracle CRE (AI Brain)
Navigate to `cre-workflow/`
```bash
# Add your environment variables to .env 
npm start
```

### 3. Frontend App
Navigate to `frontend/`
```bash
# Add your contract address to src/lib/contract.ts
npm run dev
```

---
*Built for the Hackathon - Blending AI & Web3 with Chainlink!*
