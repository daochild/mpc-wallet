// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IOwnable} from "../interfaces/IOwnable.sol";
import {ISafeStorage} from "../interfaces/ISafeStorage.sol";
import {TimelockLibrary} from "../libs/TimelockLibrary.sol";
import {Errors} from "../libs/Errors.sol";

contract Timelock is Ownable {

    struct Transaction {
        address callFrom;
        bytes32 hash;
        address target;
        uint256 value;
        string signature;
        bytes data;
        uint256 eta;
    }

    uint256 public constant MINIMUM_DELAY = 6 hours;
    uint256 public constant MAXIMUM_DELAY = 30 days;

    address public safeStorage;
    uint256 public delay;

    mapping(bytes32 => bool) public queuedTransactions;

    event NewAdmin(address indexed newAdmin);
    event NewPendingAdmin(address indexed newPendingAdmin);
    event NewDelay(uint256 indexed newDelay);
    event CancelTransaction(
        bytes32 indexed hash,
        address indexed target,
        uint256 value,
        string signature,
        bytes data,
        uint256 eta
    );
    event ExecuteTransaction(
        bytes32 indexed hash,
        address indexed target,
        uint256 value,
        string signature,
        bytes data,
        uint256 eta
    );
    event QueueTransaction(
        bytes32 indexed hash,
        address indexed target,
        uint256 value,
        string signature,
        bytes data,
        uint256 eta
    );

    constructor(address _safeStorage, uint256 _delay) Ownable(msg.sender) {
        if (_delay < MINIMUM_DELAY) revert Errors.DelayTooLow();
        if (_delay > MAXIMUM_DELAY) revert Errors.DelayTooHigh();

        safeStorage = _safeStorage;
        delay = _delay;

        _transferOwnership(IOwnable(_safeStorage).owner());
    }

    fallback() external payable {}

    receive() external payable {
        revert Errors.CallFailed();
    }

    function setDelay(uint256 _delay) public onlyThis {
        if (_delay < MINIMUM_DELAY) revert Errors.DelayTooLow();
        if (_delay > MAXIMUM_DELAY) revert Errors.DelayTooHigh();
        delay = _delay;

        emit NewDelay(delay);
    }

    function queueTransaction(Transaction memory _tx) public onlyOwner {
        if (_tx.eta < _getBlockTimestamp() + delay) revert Errors.ProposalExpired();

        queuedTransactions[_tx.hash] = true;

        emit QueueTransaction(_tx.hash, _tx.target, _tx.value, _tx.signature, _tx.data, _tx.eta);
    }

    function cancelTransaction(Transaction memory _tx) public onlyOwner {
        queuedTransactions[_tx.hash] = false;

        emit CancelTransaction(_tx.hash, _tx.target, _tx.value, _tx.signature, _tx.data, _tx.eta);
    }

    function executeTransaction(Transaction memory _tx) public payable onlyOwner returns (bytes memory returnData) {
        if (!queuedTransactions[_tx.hash]) revert Errors.NotQueued();
        if (_getBlockTimestamp() < _tx.eta) revert Errors.ProposalExpired();
        if (_getBlockTimestamp() > _tx.eta + TimelockLibrary.GRACE_PERIOD) revert Errors.ProposalStale();

        queuedTransactions[_tx.hash] = false;

        bool success;
        if (_tx.callFrom == safeStorage) {
            // solium-disable-next-line security/no-call-value
            (success, returnData) = ISafeStorage(safeStorage).execute{value: msg.value}(
                ISafeStorage.CallRequest({target: _tx.target, value: _tx.value, data: _tx.data})
            );

            emit ExecuteTransaction(_tx.hash, _tx.target, _tx.value, _tx.signature, _tx.data, _tx.eta);

            return returnData;
        }

        // solium-disable-next-line security/no-call-value
        (success, returnData) = _tx.target.call{value: _tx.value}(_tx.data);
        if (!success) revert Errors.CallFailed();

        emit ExecuteTransaction(_tx.hash, _tx.target, _tx.value, _tx.signature, _tx.data, _tx.eta);

        return returnData;
    }

    function _getBlockTimestamp() internal view returns (uint256) {
        // solium-disable-next-line security/no-block-members
        return block.timestamp;
    }

    modifier onlyThis() {
        if (msg.sender != address(this)) revert Errors.OnlyTimelock();
        _;
    }
}