// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

interface ISafeStorage {
    function execute(
        address _receipts,
        uint256 _value,
        bytes memory _data
    ) external payable returns (bool success, bytes memory result);
}
