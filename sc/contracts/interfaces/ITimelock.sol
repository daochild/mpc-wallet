// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {Transaction} from "../types.sol";

interface ITimelock {
    function queueTransaction(Transaction calldata txn) external;

    function cancelTransaction(Transaction calldata txn) external;

    function executeTransaction(Transaction calldata txn) external payable returns (bytes memory);

    function delay() external view returns (uint256);

    function queuedTransactions(bytes32) external view returns (bool);
}
