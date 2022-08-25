//SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./interfaces/IMemberCard.sol";
import "./interfaces/ICash.sol";

import "hardhat/console.sol";

contract EvenOdd is Ownable, ReentrancyGuard {
    struct Decision {
        uint256 cardId; // CardMemberId of user
        bool isOdd; // true: ODD, false: EVEN
        uint256 amount; // Cash to bet
    }

    struct MatchResult {
        uint256 roll1;
        uint256 roll2;
    }

    // Controllers
    IMemberCard cardManager;
    ICash cashManager;

    // History of players
    uint256 public latedMatchId;
    mapping(uint256 => MatchResult) public matchResultOf;
    mapping(uint256 => Decision[]) public decisionsOf; // Decisions looked by matchId

    constructor(address cardManagerAddress, address cashManagerAddress)
        payable
    {
        cardManager = IMemberCard(cardManagerAddress);
        cashManager = ICash(cashManagerAddress);

        cashManager.buyCash{value: msg.value}();
    }

    function addCashSupply() external payable onlyOwner {
        cashManager.buyCash{value: msg.value}();
    }

    function destroy() external onlyOwner {
        uint256 contractCash = cashManager.balanceOf(address(this));
        cashManager.transfer(owner(), contractCash);
        selfdestruct(payable(owner()));
    }

    // isOdd: true => ODD, false: EVEN
    // amount: amount of cash to bet
    function bet(bool isOdd, uint256 amount) external nonReentrant {
        _checkMemberCard();
        _checkContractCash(amount);
        _checkUserDoubleBet();

        // This action require approval from user to the contract address
        // The amount of approval token is equal to the amount token user using to bet
        cashManager.transferFrom(_msgSender(), address(this), amount);

        Decision memory newDecision = Decision({
            cardId: cardManager.cardIdOf(_msgSender()),
            isOdd: isOdd,
            amount: amount
        });

        decisionsOf[latedMatchId].push(newDecision);
    }

    // Start rolling
    function play() external onlyOwner {
        _roll();
        _endMatch();
        _nextMatch();
    }

    // Check member Card before User bet
    function _checkMemberCard() private {
        uint256 cardId = cardManager.cardIdOf(_msgSender());
        require(cardId != 0, "User doesn't have member card. Please buy one");

        require(
            cardManager.isExpired(_msgSender()) == false,
            "This card is expired. Please buy a new one"
        );
    }

    // Check cash before User bet
    // amount: token in new decision
    function _checkContractCash(uint256 newAmount) private {
        Decision[] memory currentDecisions = decisionsOf[latedMatchId];

        uint256 cashBetted;
        for (uint256 index = 0; index < currentDecisions.length; index++) {
            Decision memory decision = currentDecisions[index];
            cashBetted += decision.amount;
        }

        uint256 cashToReward = (cashBetted + newAmount) * 2; // winner can win double the amount of cash when he bet

        // Check cash to pay
        // Cash to pay = cash of owner
        // Maximum cash to pay = (cash betted in this match) * 2
        require(
            cashManager.balanceOf(address(this)) >= cashToReward,
            "Contract are not enough cash to reward if you win this match"
        );
    }

    // Check if user betted multiple times
    function _checkUserDoubleBet() private {
        uint256 cardId = cardManager.cardIdOf(_msgSender());
        Decision[] memory decisions = decisionsOf[latedMatchId];

        for (uint256 index = 0; index < decisions.length; ++index) {
            require(decisions[index].cardId != cardId, "You've betted before");
        }
    }

    // Random rolling
    function _roll() private onlyOwner {
        uint256 randomHash1 = block.difficulty *
            5 +
            block.timestamp -
            block.number /
            2;
        uint256 randomHash2 = (block.timestamp - 3) *
            block.difficulty +
            (block.number * 2 + 6) /
            4;

        matchResultOf[latedMatchId].roll1 = uint256(randomHash1 % 6) + 1;
        matchResultOf[latedMatchId].roll2 = uint256(randomHash2 % 6) + 1;
    }

    function _endMatch() private onlyOwner {
        Decision[] memory decisions = decisionsOf[latedMatchId];

        for (uint256 index = 0; index < decisions.length; ++index) {
            Decision memory decision = decisions[index];
            address userAddress = cardManager.ownerOf(decision.cardId);

            bool isOdd = (matchResultOf[latedMatchId].roll1 +
                matchResultOf[latedMatchId].roll2) %
                2 ==
                1;

            if (decision.isOdd == isOdd) {
                cashManager.transfer(userAddress, decision.amount * 2); // Winners win double of the amount of token they bet
            }
        }
    }

    function _nextMatch() private onlyOwner {
        ++latedMatchId;
    }
}
