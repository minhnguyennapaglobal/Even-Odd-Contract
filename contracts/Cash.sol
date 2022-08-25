//SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./interfaces/ICash.sol";

contract Cash is ERC20, ICash {
    constructor() ERC20("Cash", "M") {}

    function buyCash() external payable {
        _mint(_msgSender(), msg.value); // 1 wei = 1 token
    }

    function withdraw(uint256 amount) external payable {
        require(
            balanceOf(_msgSender()) >= amount,
            "Not enough money to convert from your tokens"
        );

        payable(address(_msgSender())).transfer(amount);
        _burn(_msgSender(), amount);
    }
}
