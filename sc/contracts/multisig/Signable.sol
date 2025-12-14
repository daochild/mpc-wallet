// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {Errors} from "../libs/Errors.sol";

contract Signable {
    uint256 internal constant MIN_NUM_SIGNERS = 4;
    uint256 internal constant MAX_NUM_SIGNERS = 100;
    uint256 internal constant TIME_FOR_SIGNING = 1 days;

    uint256 public totalSigners;

    uint256 private _requiredSigns;

    mapping(address => bool) private _signers;

    event SignerChanged(address prev, address next);

    constructor(address[] memory _accounts) {
        uint256 accountsLength = _accounts.length;
        if (accountsLength < MIN_NUM_SIGNERS) revert Errors.NotSigner();

        for (uint256 i; i < accountsLength;) {
            _setSigner(_accounts[i], true);
            unchecked {
                ++i;
            }
        }

        totalSigners = accountsLength;
        _requiredSigns = 3;
    }

    function requiredSigns() public view returns (uint256) {
        uint256 cachedRequiredSigns = _requiredSigns;
        uint256 cachedTotalSigners = totalSigners;
        
        if (cachedRequiredSigns > cachedTotalSigners) {
            return cachedRequiredSigns;
        }
        
        uint256 threshold = (cachedTotalSigners * 3) / 4;
        return cachedRequiredSigns < threshold ? threshold : cachedRequiredSigns;
    }

    // @dev should be called if it is possible as second method in batch transaction
    // on add/remove call.
    function setRequiredSigns(uint256 _signs) public onlyThis {
        uint256 cachedTotalSigners = totalSigners;
        uint256 consRS = (cachedTotalSigners * 3) / 4;

        if (_signs > cachedTotalSigners || _signs < consRS) revert Errors.WrongStatus();

        _requiredSigns = _signs;
    }

    function addSigner(address _account) public onlyThis {
         _signers[_account] = true;
        uint256 newTotal;
        unchecked {
            newTotal = ++totalSigners;
        }

        if (newTotal > MAX_NUM_SIGNERS) revert Errors.WrongStatus();

        emit SignerChanged(address(0), _account);
    }

    function removeSigner(address _account) public onlyThis {
         _signers[_account] = false;
        uint256 newTotal;
        unchecked {
            newTotal = --totalSigners;
        }

        if (newTotal < MIN_NUM_SIGNERS) revert Errors.WrongStatus();

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