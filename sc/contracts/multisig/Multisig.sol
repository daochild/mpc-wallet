// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {Signable} from "./Signable.sol";
import {ITimelock} from "../interfaces/ITimelock.sol";
import {Status, Proposal, Transaction, GRACE_PERIOD, TIME_FOR_SIGNING} from "../types.sol";

contract Multisig is Signable {
    /// @notice The total number of proposals
    uint256 public proposalCount;
    address public timelock;

    mapping(uint256 => Proposal) public proposals;
    mapping(address => mapping(uint256 => bool)) public votedBy;

    error TimelockZero();
    error WrongArraysLength();
    error WrongStatus();
    error AlreadySigned();
    error PayFromStorage();
    error OnlyAdmin();
    error AdminCallFailed();

    event ProposalInitialized(uint256 id, address proposer);
    event Signed(uint256 id, address signer);
    event Executed(uint256 id);
    event Cancelled(uint256 id);

    constructor(address _timelock, address[] memory _accounts) Signable(_accounts) {
        require(_timelock != address(0), TimelockZero());

        timelock = _timelock;
    }

    function createAndSign(
        address[] memory targets,
        uint256[] memory values,
        string[] memory signatures,
        bytes[] memory calldatas,
        string memory description,
        address callFrom // Pass SAFE STORAGE address if want interact with it
    ) external onlySigner {
        require(
            targets.length == values.length &&
            targets.length == signatures.length &&
            targets.length == calldatas.length,
            WrongArraysLength()
        );

        Proposal memory proposal;
        proposal.targets = targets;
        proposal.values = values;
        proposal.signatures = signatures;
        proposal.calldatas = calldatas;
        proposal.description = description;
        proposal.proposer = msg.sender;
        proposal.callFrom = callFrom;
        proposal.signs = 1;
        proposal.initiatedAt = block.timestamp;

        proposalCount++;

        uint256 proposalId = proposalCount;
        proposals[proposalId] = proposal;

        emit ProposalInitialized(proposalId, msg.sender);
        emit Signed(proposalId, msg.sender);
    }

    function sign(uint256 _proposalId) external onlySigner {
        require(getStatus(_proposalId) == Status.INITIALIZED, WrongStatus());
        require(!votedBy[msg.sender][_proposalId], AlreadySigned());

        votedBy[msg.sender][_proposalId] = true;

        Proposal storage proposal = proposals[_proposalId];
        proposal.signs++;
        if (proposal.signs == requiredSigns()) {
            proposal.status = Status.QUEUED; // block status
            proposal.eta = ITimelock(timelock).delay() + block.timestamp;
            Transaction memory txn;
            for (uint256 i; i < proposal.targets.length; i++) {
                txn.target = proposal.targets[i];
                txn.value = proposal.values[i];
                txn.signature = proposal.signatures[i];
                txn.data = proposal.calldatas[i];
                txn.eta = proposal.eta;
                txn.hash = keccak256(
                    abi.encode(_proposalId, i, txn.target, txn.value, txn.signature, txn.data, txn.eta)
                );
                txn.callFrom = proposal.callFrom;

                ITimelock(timelock).queueTransaction(txn);
            }
        }

        emit Signed(_proposalId, msg.sender);
    }

    // _paidFromStorage - if call withdraw or ether should be paid from storage contract
    function execute(uint256 _proposalId, bool _paidFromStorage) public payable onlySigner {
        if (_paidFromStorage) {
            require(msg.value == 0, PayFromStorage());
        }

        require(getStatus(_proposalId) == Status.QUEUED, WrongStatus());

        Proposal storage proposal = proposals[_proposalId];
        proposal.status = Status.EXECUTED; // block status
        Transaction memory txn;
        for (uint256 i; i < proposal.targets.length; i++) {
            txn.target = proposal.targets[i];
            txn.value = proposal.values[i];
            txn.signature = proposal.signatures[i];
            txn.data = proposal.calldatas[i];
            txn.eta = proposal.eta;
            txn.hash = keccak256(abi.encode(_proposalId, i, txn.target, txn.value, txn.signature, txn.data, txn.eta));
            txn.callFrom = proposal.callFrom;

            ITimelock(timelock).executeTransaction{value: (_paidFromStorage) ? 0 : txn.value}(txn);
        }

        emit Executed(_proposalId);
    }

    function cancel(uint256 _proposalId) external onlySigner {
        Status status = getStatus(_proposalId);

        require(status == Status.INITIALIZED || status == Status.QUEUED, WrongStatus());

        Proposal storage proposal = proposals[_proposalId];
        proposal.status = Status.CANCELLED;

        Transaction memory txn;
        for (uint256 i; i < proposal.targets.length; i++) {
            txn.target = proposal.targets[i];
            txn.value = proposal.values[i];
            txn.signature = proposal.signatures[i];
            txn.data = proposal.calldatas[i];
            txn.eta = proposal.eta;
            txn.hash = keccak256(abi.encode(_proposalId, i, txn.target, txn.value, txn.signature, txn.data, txn.eta));
            txn.callFrom = proposal.callFrom;

            ITimelock(timelock).cancelTransaction(txn);
        }

        emit Cancelled(_proposalId);
    }

    function getActions(
        uint256 _proposalId
    )
        external
        view
        returns (
            address[] memory targets,
            uint256[] memory values,
            string[] memory signatures,
            bytes[] memory calldatas
        )
    {
        Proposal storage p = proposals[_proposalId];
        return (p.targets, p.values, p.signatures, p.calldatas);
    }

    function getStatus(uint256 _proposalId) public view returns (Status) {
        Proposal memory p = proposals[_proposalId];

        if (p.status == Status.CANCELLED) {
            return Status.CANCELLED;
        }
        if (p.status == Status.EXECUTED) {
            return Status.EXECUTED;
        }
        if (p.signs > 0) {
            if (p.eta != 0) {
                if (p.eta + GRACE_PERIOD <= block.timestamp) {
                    return Status.CANCELLED;
                }
            } else {
                if (p.initiatedAt + TIME_FOR_SIGNING < block.timestamp) {
                    return Status.CANCELLED;
                }
            }

            if (requiredSigns() == p.signs) {
                return Status.QUEUED;
            }

            return Status.INITIALIZED;
        }

        return Status.EMPTY;
    }

    // @dev method should be called only from timelock contract.
    // Use this one for changes admin data.
    function adminCall(bytes memory data) public {
        require(msg.sender == timelock, OnlyAdmin());

        (bool success, ) = address(this).call(data);

        require(success, AdminCallFailed());
    }
}
