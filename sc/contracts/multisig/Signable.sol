// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {MIN_NUM_SIGNERS, MAX_NUM_SIGNERS} from "../types.sol";

contract Signable {
    uint256 public totalSigners;
    uint256 private _requiredSigns;

    mapping(address => bool) private _signers;

    error NotEnoughSigns();
    error NUM_SIGS_CONS();
    error CONS_REQU_SIGNS();
    error NotSigner();
    error AlreadySigner();
    error WrongAddressSet();
    error OnlySigner();
    error OnlyThis();

    event SignerChanged(address prev, address next);

    constructor(address[] memory _accounts) {
        require(_accounts.length >= MIN_NUM_SIGNERS, NotEnoughSigns());

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

        require(_signs <= totalSigners && _signs >= consRS, CONS_REQU_SIGNS());

        _requiredSigns = _signs;
    }

    function addSigner(address _account) public onlyThis {
        _signers[_account] = true;
        totalSigners++;

        require(totalSigners <= MAX_NUM_SIGNERS, NUM_SIGS_CONS());

        emit SignerChanged(address(0), _account);
    }

    function removeSigner(address _account) public onlyThis {
        _signers[_account] = false;
        totalSigners--;

        require(totalSigners >= MIN_NUM_SIGNERS, NUM_SIGS_CONS());

        emit SignerChanged(_account, address(0));
    }

    function flipSignerAddress(address _old, address _new) public onlyThis {
        require(_old != _new || _new != address(0), WrongAddressSet());
        require(_signers[_old], NotSigner());
        require(!_signers[_new], AlreadySigner());

        _signers[_old] = false;
        _signers[_new] = true;

        emit SignerChanged(_old, _new);
    }

    function _setSigner(address _account, bool _status) private {
        _signers[_account] = _status;
    }

    modifier onlySigner() {
        require(_signers[msg.sender], OnlySigner());
        _;
    }

    modifier onlyThis() {
        require(msg.sender == address(this), OnlyThis());
        _;
    }
}
