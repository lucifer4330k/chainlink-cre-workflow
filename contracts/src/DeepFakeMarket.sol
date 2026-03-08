// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract DeepFakeMarket {
    address public creOracleAddress;
    uint256 public nextMarketId;

    struct Market {
        string mediaUrl;
        uint256 totalTrueStaked;
        uint256 totalFalseStaked;
        bool resolved;
        bool isReal;
    }

    mapping(uint256 => Market) public markets;
    // marketId => user => guess => amount
    mapping(uint256 => mapping(address => mapping(bool => uint256))) public wagers;
    mapping(uint256 => mapping(address => bool)) public hasClaimed;

    event MarketCreated(uint256 indexed marketId, string mediaUrl);
    event WagerPlaced(uint256 indexed marketId, address indexed user, bool guess, uint256 amount);
    event MarketResolved(uint256 indexed marketId, bool isReal);
    event WinningsClaimed(uint256 indexed marketId, address indexed user, uint256 amount);

    modifier onlyOracle() {
        require(msg.sender == creOracleAddress, "Only CRE oracle can call this");
        _;
    }

    // Pass the address of your off-chain CRE wallet
    constructor(address _creOracleAddress) {
        creOracleAddress = _creOracleAddress;
    }

    // Creates a new prediction pool
    function createMarket(string memory _mediaUrl) external {
        uint256 marketId = nextMarketId++;
        markets[marketId] = Market({
            mediaUrl: _mediaUrl,
            totalTrueStaked: 0,
            totalFalseStaked: 0,
            resolved: false,
            isReal: false
        });
        emit MarketCreated(marketId, _mediaUrl);
    }

    // Allows users to send ETH to back their prediction
    function placeWager(uint256 _marketId, bool _guess) external payable {
        require(_marketId < nextMarketId, "Market does not exist");
        Market storage market = markets[_marketId];
        require(!market.resolved, "Market already resolved");
        require(msg.value > 0, "Must wager greater than 0");

        wagers[_marketId][msg.sender][_guess] += msg.value;

        if (_guess) {
            market.totalTrueStaked += msg.value;
        } else {
            market.totalFalseStaked += msg.value;
        }

        emit WagerPlaced(_marketId, msg.sender, _guess, msg.value);
    }

    // CRITICAL. Only callable by the Chainlink CRE workflow
    function resolveMarket(uint256 _marketId, bool _isReal) external onlyOracle {
        require(_marketId < nextMarketId, "Market does not exist");
        Market storage market = markets[_marketId];
        require(!market.resolved, "Market already resolved");

        market.resolved = true;
        market.isReal = _isReal;

        emit MarketResolved(_marketId, _isReal);
    }

    // Allows winners to claim their share of the pool
    function claimWinnings(uint256 _marketId) external {
        require(_marketId < nextMarketId, "Market does not exist");
        Market storage market = markets[_marketId];
        require(market.resolved, "Market not resolved");
        require(!hasClaimed[_marketId][msg.sender], "Already claimed");

        uint256 userStake = wagers[_marketId][msg.sender][market.isReal];
        require(userStake > 0, "No winning wagers");

        hasClaimed[_marketId][msg.sender] = true;

        uint256 winningPool = market.isReal ? market.totalTrueStaked : market.totalFalseStaked;
        uint256 losingPool = market.isReal ? market.totalFalseStaked : market.totalTrueStaked;
        uint256 totalPool = winningPool + losingPool;

        // Calculate payout proportional to user's stake in the winning pool
        uint256 payout = (userStake * totalPool) / winningPool;

        (bool success, ) = msg.sender.call{value: payout}("");
        require(success, "Transfer failed");

        emit WinningsClaimed(_marketId, msg.sender, payout);
    }
}
