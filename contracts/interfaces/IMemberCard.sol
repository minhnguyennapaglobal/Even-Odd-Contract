//SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface IMemberCard is IERC721 {
    function buyCard() external;

    function isExpired(address user) external view returns (bool);

    function extendCardPeriod() external;

    function cardIdOf(address user) external returns (uint256);
}
