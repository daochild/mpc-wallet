// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

interface ISafeStorage {
    struct CallRequest {
        address target;
        uint256 value;
        bytes data;
    }

    function execute(CallRequest calldata request) external payable returns (bool success, bytes memory result);
}