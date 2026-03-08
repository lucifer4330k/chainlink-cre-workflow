export const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3" as `0x${string}`;

export const CONTRACT_ABI = [
    "function createMarket(string memory _mediaUrl) external",
    "function placeWager(uint256 _marketId, bool _guess) external payable",
    "function resolveMarket(uint256 _marketId, bool _isReal) external",
    "function claimWinnings(uint256 _marketId) external",
    "function markets(uint256) view returns (string, uint256, uint256, bool, bool)",
    "function nextMarketId() view returns (uint256)",
    "function wagers(uint256, address, bool) view returns (uint256)",
    "function hasClaimed(uint256, address) view returns (bool)",
    "function creOracleAddress() view returns (address)",
    "event MarketCreated(uint256 indexed marketId, string mediaUrl)",
    "event WagerPlaced(uint256 indexed marketId, address indexed user, bool guess, uint256 amount)",
    "event MarketResolved(uint256 indexed marketId, bool isReal)",
    "event WinningsClaimed(uint256 indexed marketId, address indexed user, uint256 amount)",
] as const;
