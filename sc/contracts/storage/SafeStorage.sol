// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {ERC721Holder} from "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Errors} from "../libs/Errors.sol";

contract SafeStorage is Ownable, ERC721Holder, ERC1155Holder {
    event Received(address indexed from, uint256 indexed amount);
    event ReceivedFallback(address indexed from, uint256 indexed amount);

    constructor(address _admin) Ownable(_admin) {
        // solhint-disable-previous-line no-empty-blocks
    }

    fallback() external payable {
        if (msg.value > 0) {
            emit ReceivedFallback(msg.sender, msg.value);
        }
    }

    receive() external payable {
        if (msg.value > 0) {
            emit Received(msg.sender, msg.value);
        }
    }

    struct CallRequest {
        address target;
        uint256 value;
        bytes data;
    }

    function execute(CallRequest calldata request)
        external
        payable
        virtual
        onlyOwner
        returns (bool success, bytes memory result)
    {
        unchecked {
            if (address(this).balance + msg.value < request.value) {
                revert Errors.InsufficientBalance();
            }
        }

        (success, result) = request.target.call{value: request.value}(request.data);

        if (!success) {
             // Next 5 lines from https://ethereum.stackexchange.com/a/83577
             if (result.length < 68) revert();
             assembly {
                 result := add(result, 0x04)
             }
             revert(abi.decode(result, (string)));
         }
     }
}