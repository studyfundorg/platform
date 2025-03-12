// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@chainlink/contracts/src/v0.8/vrf/VRFConsumerBaseV2.sol";

contract MockVRFCoordinator {
    uint256 private nonce = 0;
    mapping(uint256 => address) private consumers;

    function requestRandomWords(
        bytes32 /* keyHash */,
        uint64 /* subId */,
        uint16 /* minimumRequestConfirmations */,
        uint32 /* callbackGasLimit */,
        uint32 /* numWords */
    ) external returns (uint256) {
        nonce++;
        consumers[nonce] = msg.sender;
        return nonce;
    }

    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) external {
        VRFConsumerBaseV2(consumers[requestId]).rawFulfillRandomWords(requestId, randomWords);
    }
} 