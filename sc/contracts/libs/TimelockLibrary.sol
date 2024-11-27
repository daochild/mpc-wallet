// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

library TimelockLibrary {
    struct Transaction {
        address callFrom;
        bytes32 hash;
        address target;
        uint256 value;
        string signature;
        bytes data;
        uint256 eta;
    }

    uint256 public constant GRACE_PERIOD = 14 days;
}
