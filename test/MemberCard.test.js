const { ethers } = require("hardhat");
const { expect } = require("chai");
const { skipTime } = require("./utils");

const DAY_TIME = 86400; // 1 day = 86400 seconds

describe("Test cases of MemberCard: ", () => {
  beforeEach(async () => {
    [deployer, user1, user2] = await ethers.getSigners();

    const MemberCard = await ethers.getContractFactory("MemberCard");
    memberCard = await MemberCard.deploy();
    console.log(`---> Contract MemberCard is deployed at ${memberCard.address}`);
  });

  describe("Test 'buyCard' function", () => {
    it("Check double buying card", async () => {
      await memberCard.connect(user1).buyCard();
      await expect(memberCard.connect(user1).buyCard()).revertedWith("This user has already buy a Member Card");
    });

    it("Buy a new card successfully", async () => {
      await memberCard.connect(user1).buyCard();

      const cardId1 = await memberCard.latedCardId();
      const user1CardId = await memberCard.cardIdOf(user1.address);

      expect(cardId1, "The newest cardId must equal to the cardId of latest user buy").to.equal(user1CardId);

      await memberCard.connect(user2).buyCard();

      const cardId2 = await memberCard.latedCardId();
      const user2CardId = await memberCard.cardIdOf(user2.address);

      expect(cardId2, "The newest cardId must equal to the cardId of latest user buy").to.equal(user2CardId);
    });
  });

  describe("Check 'isExpired' function", () => {
    it("Can't check card expired when don't have a card", async () => {
      await expect(memberCard.isExpired(user1.address)).revertedWith("This user don't have a member card yet");
    });

    it("Check user's card expired successfully", async () => {
      await memberCard.connect(user1).buyCard();

      const cardId = await memberCard.latedCardId();
      console.log(await memberCard.expirationOf(cardId));
      // expect(await memberCard.expirationOf(cardId), "Card expiration must be set when buy a new card").to.greaterThan(0);
      expect(await memberCard.isExpired(user1.address), "The new card is not expired soon").to.equal(false);

      await skipTime(DAY_TIME + 1);
      expect(await memberCard.isExpired(user1.address), "The card expire after 1 day").to.equal(true);
    });
  });

  describe("Check 'extendCardPeriod' function", () => {
    it("User don't have card can't extend card period", async () => {
      await expect(memberCard.connect(user1).extendCardPeriod()).revertedWith("This user don't have a member card yet");
    });

    it("User can not extend card period if card is not expired", async () => {
      await memberCard.connect(user1).buyCard();

      await expect(memberCard.connect(user1).extendCardPeriod()).revertedWith("This card has not expired yet");
    });

    it("User extend card period when card is expired successfully", async () => {
      await memberCard.connect(user1).buyCard();
      await skipTime(DAY_TIME);

      await memberCard.connect(user1).extendCardPeriod();
      expect(await memberCard.isExpired(user1.address), "After extend period for the expired card, it must be not expired any more").to.equal(false);
    });
  });
});
