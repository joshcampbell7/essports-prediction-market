// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.5.0
pragma solidity ^0.8.27;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract Predictable is ERC20, Ownable {
    constructor(
        address recipient,
        address initialOwner
    ) ERC20("Predictable", "PRE") Ownable(initialOwner) {
        _mint(recipient, 10000 * 10 ** decimals());
    }

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }

    function _update(
        address from,
        address to,
        uint256 value
    ) internal override {
        // Allow minting and burning only
        if (from != address(0) && to != address(0)) {
            revert("User transfers disabled");
        }
        super._update(from, to, value);
    }
}
