// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SafeMath} from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import {ISafeStorage} from "../interfaces/ISafeStorage.sol";
import {TimelockLibrary} from "../libs/TimelockLibrary.sol";

contract Timelock is Ownable {
    using SafeMath for uint256;

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

    constructor(address _safeStorage, uint256 _delay) {
        require(_delay >= MINIMUM_DELAY, "Timelock::constructor: Delay must exceed minimum delay.");
        require(_delay <= MAXIMUM_DELAY, "Timelock::constructor: Delay must not exceed maximum delay.");

        safeStorage = _safeStorage;
        delay = _delay;
    }

    fallback() external payable {}

    receive() external payable {
        require(false, "Dont accept direct ether deposit");
    }

    function setDelay(uint256 _delay) public onlyThis {
        require(_delay >= MINIMUM_DELAY, "Timelock::setDelay: Delay must exceed minimum delay.");
        require(_delay <= MAXIMUM_DELAY, "Timelock::setDelay: Delay must not exceed maximum delay.");
        delay = _delay;

        emit NewDelay(delay);
    }

    function queueTransaction(Transaction memory _tx) public onlyOwner {
        require(
            _tx.eta >= _getBlockTimestamp().add(delay),
            "Timelock::queueTransaction: Estimated execution block must satisfy delay."
        );

        queuedTransactions[_tx.hash] = true;

        emit QueueTransaction(_tx.hash, _tx.target, _tx.value, _tx.signature, _tx.data, _tx.eta);
    }

    function cancelTransaction(Transaction memory _tx) public onlyOwner {
        queuedTransactions[_tx.hash] = false;

        emit CancelTransaction(_tx.hash, _tx.target, _tx.value, _tx.signature, _tx.data, _tx.eta);
    }

    function executeTransaction(Transaction memory _tx) public payable onlyOwner returns (bytes memory returnData) {
        require(queuedTransactions[_tx.hash], "Timelock::executeTransaction: Transaction hasn't been queued.");
        require(
            _getBlockTimestamp() >= _tx.eta,
            "Timelock::executeTransaction: Transaction hasn't surpassed time lock."
        );
        require(
            _getBlockTimestamp() <= _tx.eta.add(TimelockLibrary.GRACE_PERIOD),
            "Timelock::executeTransaction: Transaction is stale."
        );

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
        require(success, "Timelock::executeTransaction: Transaction execution reverted.");

        emit ExecuteTransaction(_tx.hash, _tx.target, _tx.value, _tx.signature, _tx.data, _tx.eta);

        return returnData;
    }

    function _getBlockTimestamp() internal view returns (uint256) {
        // solium-disable-next-line security/no-block-members
        return block.timestamp;
    }

    modifier onlyThis() {
        require(msg.sender == address(this), "Timelock: Call must come from this contract.");
        _;
    }
}
