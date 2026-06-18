// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract CaRo2 is ERC20, Ownable {
    constructor() ERC20("CaRo2", "CR2") {
        _mint(msg.sender, 1000000 * 10 ** decimals());
        transferOwnership(msg.sender);
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}