// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SafeMath} from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import {ISafeStorage} from "../interfaces/ISafeStorage.sol";
import {ITimelock} from "../interfaces/ITimelock.sol";
import {Transaction, GRACE_PERIOD, MINIMUM_DELAY, MAXIMUM_DELAY} from "../types.sol";

contract Timelock is Ownable, ITimelock {
    using SafeMath for uint256;

    address public safeStorage;
    uint256 public delay;

    mapping(bytes32 => bool) public queuedTransactions;

    error DirectEthDeposit();
    error TimelockDelayTooShort();
    error TimelockDelayTooLong();
    error TimelockQueueTransactionDelay();
    error TimelockTransactionNotQueue();
    error TimelockEtaNotReached();
    error TimelockTransactionExpired();
    error TimelockExecutionFailed();
    error TimelockOnlyThisContract();

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

    constructor(address _safeStorage, uint256 _delay) {
        require(_delay >= MINIMUM_DELAY, TimelockDelayTooShort());
        require(_delay <= MAXIMUM_DELAY, TimelockDelayTooLong());

        safeStorage = _safeStorage;
        delay = _delay;
    }

    fallback() external payable {}

    receive() external payable {
        require(false, DirectEthDeposit());
    }

    function setDelay(uint256 _delay) public onlyThis {
        require(_delay >= MINIMUM_DELAY, TimelockDelayTooShort());
        require(_delay <= MAXIMUM_DELAY, TimelockDelayTooLong());

        delay = _delay;

        emit NewDelay(delay);
    }

    function queueTransaction(Transaction memory _tx) public onlyOwner {
        require(_tx.eta >= _getBlockTimestamp().add(delay), TimelockQueueTransactionDelay());

        queuedTransactions[_tx.hash] = true;

        emit QueueTransaction(_tx.hash, _tx.target, _tx.value, _tx.signature, _tx.data, _tx.eta);
    }

    function cancelTransaction(Transaction memory _tx) public onlyOwner {
        queuedTransactions[_tx.hash] = false;

        emit CancelTransaction(_tx.hash, _tx.target, _tx.value, _tx.signature, _tx.data, _tx.eta);
    }

    function executeTransaction(Transaction memory _tx) public payable onlyOwner returns (bytes memory returnData) {
        require(queuedTransactions[_tx.hash], TimelockTransactionNotQueue());
        require(_getBlockTimestamp() >= _tx.eta, TimelockEtaNotReached());
        require(_getBlockTimestamp() <= _tx.eta.add(GRACE_PERIOD), TimelockTransactionExpired());

        queuedTransactions[_tx.hash] = false;

        bool success;
        if (_tx.callFrom == safeStorage) {
            // solium-disable-next-line security/no-call-value
            (success, returnData) = ISafeStorage(safeStorage).execute{value: msg.value}(
                _tx.target,
                _tx.value,
                _tx.data
            );

            emit ExecuteTransaction(_tx.hash, _tx.target, _tx.value, _tx.signature, _tx.data, _tx.eta);

            return returnData;
        }

        // solium-disable-next-line security/no-call-value
        (success, returnData) = _tx.target.call{value: _tx.value}(_tx.data);
        require(success, TimelockExecutionFailed());

        emit ExecuteTransaction(_tx.hash, _tx.target, _tx.value, _tx.signature, _tx.data, _tx.eta);

        return returnData;
    }

    function _getBlockTimestamp() internal view returns (uint256) {
        // solium-disable-next-line security/no-block-members
        return block.timestamp;
    }

    modifier onlyThis() {
        require(msg.sender == address(this), TimelockOnlyThisContract());
        _;
    }
}
