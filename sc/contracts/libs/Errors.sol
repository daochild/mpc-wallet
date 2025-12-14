// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

library Errors {
    // Generic access/control
    error ZeroAddress();
    error OnlyTimelock();
    error NotQueued();
    error AlreadyQueued();
    error AlreadySigned();
    error NotSigner();
    error WrongStatus();
    error SigningWindowExpired();
    error PayFromStorage();
    error AdminCallFailed();

    // Proposal validation
    error ArrayLengthMismatch();
    error ProposalExpired();
    error ProposalStale();

    // Timelock delays
    error DelayTooLow();
    error DelayTooHigh();

    // Safe storage
    error InsufficientBalance();

    // Common revert
    error CallFailed();
}
