// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

enum Status {
    EMPTY, // zero state
    INITIALIZED, // created with one sign
    CANCELLED, // canceled by consensus
    QUEUED, // approved and send to timelock
    EXECUTED // executed
}

struct Proposal {
    // @dev actual signs
    uint256 signs;
    Status status;
    /// @notice Creator of the proposal
    address proposer;
    /// @notice The timestamp that the proposal will be available for execution, set once the vote succeeds
    uint256 eta;
    /// @notice the ordered list of target addresses for calls to be made
    address[] targets;
    /// @notice The ordered list of values (i.e. msg.value) to be passed to the calls to be made
    uint256[] values;
    /// @notice The ordered list of function signatures to be called
    string[] signatures;
    /// @notice The ordered list of calldata to be passed to each call
    bytes[] calldatas;
    address callFrom;
    string description;
    uint256 initiatedAt;
}

struct Transaction {
    address callFrom;
    bytes32 hash;
    address target;
    uint256 value;
    string signature;
    bytes data;
    uint256 eta;
}

// Multisig constants
uint256 constant MIN_NUM_SIGNERS = 4;
uint256 constant MAX_NUM_SIGNERS = 100;
uint256 constant TIME_FOR_SIGNING = 1 days;

// Timelock constants
uint256 constant GRACE_PERIOD = 14 days;
uint256 constant MINIMUM_DELAY = 6 hours;
uint256 constant MAXIMUM_DELAY = 30 days;
