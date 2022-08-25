//SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "./interfaces/IMemberCard.sol";

contract MemberCard is ERC721, IMemberCard {
    uint256 public latedCardId;

    mapping(uint256 => uint256) public expirationOf;
    mapping(address => uint256) public cardIdOf;

    constructor() ERC721("MemberCard", "MC") {}

    // Actions
    function buyCard() external {
        require(
            cardIdOf[_msgSender()] == 0,
            "This user has already buy a Member Card"
        );

        _mint(_msgSender(), ++latedCardId);
        cardIdOf[_msgSender()] = latedCardId;
        expirationOf[latedCardId] = block.timestamp + 1 days;
    }

    function extendCardPeriod() external {
        uint256 userCardId = cardIdOf[_msgSender()];

        require(userCardId != 0, "This user don't have a member card yet");
        require(
            expirationOf[userCardId] < block.timestamp,
            "This card has not expired yet"
        );

        expirationOf[userCardId] = block.timestamp + 1 days;
    }

    function isExpired(address user) external view returns (bool) {
        uint256 userCardId = cardIdOf[user];
        require(userCardId != 0, "This user don't have a member card yet");

        return expirationOf[userCardId] < block.timestamp;
    }
}
