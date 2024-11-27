// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {TimelockLibrary} from "../libs/TimelockLibrary.sol";

interface ITimelock {
    function delay() external view returns (uint256);

    function queueTransaction(TimelockLibrary.Transaction calldata txn) external;

    function cancelTransaction(TimelockLibrary.Transaction calldata txn) external;

    function executeTransaction(TimelockLibrary.Transaction calldata txn) external payable returns (bytes memory);

    function acceptAdmin() external;

    function setPendingAdmin(address pendingAdmin_) external;

    function queuedTransactions(bytes32) external view returns (bool);

    function GRACE_PERIOD() external view returns (uint256);
}
