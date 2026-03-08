// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract DeepFakeMarket {
    address public creOracleAddress;
    uint256 public nextMarketId;
    uint256 public startMarketId; // Markets before this ID are "hidden" after reset

    struct Market {
        string mediaUrl;
        uint256 totalTrueStaked;
        uint256 totalFalseStaked;
        bool resolved;
        bool isReal;
    }

    mapping(uint256 => Market) public markets;
    mapping(uint256 => mapping(address => mapping(bool => uint256))) public wagers;
    mapping(uint256 => mapping(address => bool)) public hasClaimed;

    event MarketCreated(uint256 indexed marketId, string mediaUrl);
    event WagerPlaced(uint256 indexed marketId, address indexed user, bool guess, uint256 amount);
    event MarketResolved(uint256 indexed marketId, bool isReal);
    event WinningsClaimed(uint256 indexed marketId, address indexed user, uint256 amount);
    event MarketsReset(uint256 newStartId);

    modifier onlyOracle() {
        require(msg.sender == creOracleAddress, "Only CRE oracle can call this");
        _;
    }

    constructor(address _creOracleAddress) {
        creOracleAddress = _creOracleAddress;
    }

    receive() external payable {}

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

    function placeWager(uint256 _marketId, bool _guess) external payable {
        require(_marketId < nextMarketId, "Market does not exist");
        require(_marketId >= startMarketId, "Market has been reset");
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

    function resolveMarket(uint256 _marketId, bool _isReal) external onlyOracle {
        require(_marketId < nextMarketId, "Market does not exist");
        Market storage market = markets[_marketId];
        require(!market.resolved, "Market already resolved");

        market.resolved = true;
        market.isReal = _isReal;

        emit MarketResolved(_marketId, _isReal);
    }

    // Winners get bet amount + 50% reward
    function claimWinnings(uint256 _marketId) external {
        require(_marketId < nextMarketId, "Market does not exist");
        Market storage market = markets[_marketId];
        require(market.resolved, "Market not resolved");
        require(!hasClaimed[_marketId][msg.sender], "Already claimed");

        uint256 userStake = wagers[_marketId][msg.sender][market.isReal];
        require(userStake > 0, "No winning wagers");

        hasClaimed[_marketId][msg.sender] = true;

        // Payout = original stake + 50% reward
        uint256 payout = (userStake * 3) / 2;

        if (payout > address(this).balance) {
            payout = address(this).balance;
        }

        (bool success, ) = msg.sender.call{value: payout}("");
        require(success, "Transfer failed");

        emit WinningsClaimed(_marketId, msg.sender, payout);
    }

    // Reset: moves the start pointer forward instead of resetting IDs
    // This avoids collisions with old wager data
    function resetAll() external onlyOracle {
        startMarketId = nextMarketId;
        emit MarketsReset(startMarketId);
    }

    function getHouseBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
