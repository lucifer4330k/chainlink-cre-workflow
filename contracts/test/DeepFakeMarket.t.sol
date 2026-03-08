// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/DeepFakeMarket.sol";

contract DeepFakeMarketTest is Test {
    DeepFakeMarket public market;
    address public oracle = address(0x123);
    address public user1 = address(0x456);
    address public user2 = address(0x789);

    function setUp() public {
        market = new DeepFakeMarket(oracle);
        vm.deal(user1, 10 ether);
        vm.deal(user2, 10 ether);
    }

    function testCreateMarket() public {
        market.createMarket("https://example.com/video.mp4");
        (string memory mediaUrl, uint256 totalTrue, uint256 totalFalse, bool resolved, bool isReal) = market.markets(0);
        assertEq(mediaUrl, "https://example.com/video.mp4");
        assertEq(totalTrue, 0);
        assertEq(totalFalse, 0);
        assertEq(resolved, false);
        assertEq(isReal, false);
    }

    function testPlaceWager() public {
        market.createMarket("https://example.com/video.mp4");
        
        vm.prank(user1);
        market.placeWager{value: 1 ether}(0, true);
        
        vm.prank(user2);
        market.placeWager{value: 2 ether}(0, false);

        (, uint256 totalTrue, uint256 totalFalse, , ) = market.markets(0);
        assertEq(totalTrue, 1 ether);
        assertEq(totalFalse, 2 ether);
    }

    function testResolveAndClaim() public {
        market.createMarket("https://example.com/video.mp4");
        
        vm.prank(user1);
        market.placeWager{value: 1 ether}(0, true);
        
        vm.prank(user2);
        market.placeWager{value: 2 ether}(0, false);

        // Oracle resolves market as true
        vm.prank(oracle);
        market.resolveMarket(0, true);

        (, , , bool resolved, bool isReal) = market.markets(0);
        assertTrue(resolved);
        assertTrue(isReal);

        // User 1 claims
        uint256 initialBalance = address(user1).balance;
        vm.prank(user1);
        market.claimWinnings(0);
        
        // Total pool is 3 ether, user1 should get 3 ether since they were the only true better
        assertEq(address(user1).balance, initialBalance + 3 ether);
        
        // User 2 should fail to claim
        vm.prank(user2);
        vm.expectRevert("No winning wagers");
        market.claimWinnings(0);
    }
}
