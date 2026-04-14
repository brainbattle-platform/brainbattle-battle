// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract BrainPointToken is ERC20, Ownable {
    address public minter;

    event MinterUpdated(address indexed oldMinter, address indexed newMinter);

    error NotMinter();
    error InvalidMinter();

    constructor(address initialOwner) ERC20("BrainPoint", "BP") Ownable(initialOwner) {}

    function decimals() public pure override returns (uint8) {
        return 0;
    }

    function setMinter(address newMinter) external onlyOwner {
        if (newMinter == address(0)) {
            revert InvalidMinter();
        }

        address oldMinter = minter;
        minter = newMinter;

        emit MinterUpdated(oldMinter, newMinter);
    }

    function mint(address to, uint256 amount) external {
        if (msg.sender != minter) {
            revert NotMinter();
        }

        _mint(to, amount);
    }
}