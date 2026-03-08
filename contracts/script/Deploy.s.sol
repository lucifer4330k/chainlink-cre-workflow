// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/DeepFakeMarket.sol";

contract DeployDeepFakeMarket is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address oracleAddress = vm.envAddress("ORACLE_ADDRESS"); // The wallet used by your CRE workflow

        vm.startBroadcast(deployerPrivateKey);

        DeepFakeMarket market = new DeepFakeMarket(oracleAddress);

        vm.stopBroadcast();
        
        console.log("DeepFakeMarket deployed at:", address(market));
    }
}
