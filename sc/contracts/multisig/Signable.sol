// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {Errors} from "../libs/Errors.sol";

contract Signable {
    uint256 public constant MIN_NUM_SIGNERS = 4;
    uint256 public constant MAX_NUM_SIGNERS = 100;
    uint256 public constant TIME_FOR_SIGNING = 1 days;

    uint256 public totalSigners;

    uint256 private _requiredSigns;

    mapping(address => bool) private _signers;

    event SignerChanged(address prev, address next);

    constructor(address[] memory _accounts) {
        if (_accounts.length < MIN_NUM_SIGNERS) revert Errors.NotSigner();

        for (uint256 i; i < _accounts.length; i++) {
            _setSigner(_accounts[i], true);
        }

        totalSigners += _accounts.length;
        _requiredSigns = 3;
    }

    function requiredSigns() public view returns (uint256) {
        if (_requiredSigns > totalSigners) {
            return _requiredSigns;
        }

        return (_requiredSigns < (totalSigners * 3) / 4) ? (totalSigners * 3) / 4 : _requiredSigns;
    }

    // @dev should be called if it is possible as second method in batch transaction
    // on add/remove call.
    function setRequiredSigns(uint256 _signs) public onlyThis {
        uint256 consRS = (totalSigners * 3) / 4;

        if (_signs > totalSigners || _signs < consRS) revert Errors.WrongStatus();

        _requiredSigns = _signs;
    }

    function addSigner(address _account) public onlyThis {
        _signers[_account] = true;
        totalSigners++;

        if (totalSigners > MAX_NUM_SIGNERS) revert Errors.WrongStatus();

        emit SignerChanged(address(0), _account);
    }

    function removeSigner(address _account) public onlyThis {
        _signers[_account] = false;
        totalSigners--;

        if (totalSigners < MIN_NUM_SIGNERS) revert Errors.WrongStatus();

        emit SignerChanged(_account, address(0));
    }

    function flipSignerAddress(address _old, address _new) public onlyThis {
        if (!_signers[_old]) revert Errors.NotSigner();
        if (_old == _new) revert Errors.WrongStatus();
        if (_signers[_new]) revert Errors.AlreadySigned();
        if (_new == address(0)) revert Errors.ZeroAddress();

        _signers[_old] = false;
        _signers[_new] = true;

        emit SignerChanged(_old, _new);
    }

    function _setSigner(address _account, bool _status) private {
        _signers[_account] = _status;
    }

    modifier onlySigner() {
        if (!_signers[msg.sender]) revert Errors.NotSigner();
        _;
    }

    modifier onlyThis() {
        if (msg.sender != address(this)) revert Errors.OnlyTimelock();
        _;
    }
}