const { ethers } = require("hardhat");
const { expect } = require("chai");
const { skipTime } = require("./utils");

const DAY_TIME = 86400; // 1 day = 86400 seconds

describe("Test cases of EvenOdd: ", () => {
  beforeEach(async () => {
    [deployer, user1, user2] = await ethers.getSigners();

    const MemberCard = await ethers.getContractFactory("MemberCard");
    memberCard = await MemberCard.deploy();
    console.log(`---> Contract MemberCard is deployed at ${memberCard.address}`);

    const Cash = await ethers.getContractFactory("Cash");
    cash = await Cash.deploy();
    console.log(`---> Contract Cash is deployed at ${cash.address}`);

    const EvenOdd = await ethers.getContractFactory("EvenOdd");
    evenOdd = await EvenOdd.deploy(memberCard.address, cash.address, { value: ethers.utils.parseEther("10") });
    console.log(`---> Contract EvenOdd is deployed at ${evenOdd.address}`);
  });

  describe("Test contract after deployed", () => {
    it("Check Owner", async () => {
      const owner = await evenOdd.owner();
      expect(owner, "Contract owner should equal to deployer").to.equal(deployer.address);
    });
  });

  describe("Test 'addCashSupply' function", () => {
    it("Only owner can add cash to contract", async () => {
      await expect(evenOdd.addCashSupply({ value: ethers.utils.parseEther("10") }));
      await expect(evenOdd.connect(user1).addCashSupply({ value: ethers.utils.parseEther("10") })).revertedWith("Ownable: caller is not the owner");
    });

    it("Owner add cash to contract successfully", async () => {
      const contractCashBefore = await cash.balanceOf(evenOdd.address);
      await evenOdd.addCashSupply({ value: ethers.utils.parseEther("10") });
      const contractCashAfter = await cash.balanceOf(evenOdd.address);

      expect(contractCashAfter.sub(contractCashBefore), "Contract cash must be increased after owner add cash").to.equal(ethers.utils.parseEther("10"));
    });
  });

  describe("Test 'destroy' function", () => {
    it("Only owner can destroy contract", async () => {
      await expect(evenOdd.connect(user1).destroy()).revertedWith("Ownable: caller is not the owner");
      await expect(evenOdd.destroy());
    });

    it("Owner destroy contract successfully", async () => {
      await evenOdd.destroy();
      const contractCash = await cash.balanceOf(evenOdd.address);
      const ownerCash = await cash.balanceOf(deployer.address);

      expect(contractCash, "Contract cash balance after destroy must be 0").to.equal(0);
      expect(ownerCash, "Owner must received contract cash balance after contract is destroyed").to.equal(ethers.utils.parseEther("10"));
    });
  });

  describe("Test 'bet' function", () => {
    describe("Check MemberCard", () => {
      it("User must have a member card before get to bet", async () => {
        await expect(evenOdd.bet(true, 10)).revertedWith("User doesn't have member card. Please buy one");
      });

      it("Check card expired", async () => {
        await memberCard.connect(user1).buyCard();
        await skipTime(DAY_TIME + 1);

        await expect(evenOdd.connect(user1).bet(true, ethers.utils.parseEther("10"))).revertedWith("This card is expired. Please buy a new one");
      });
    });

    it("Prevent user bet more than contract payable ability", async () => {
      await memberCard.connect(user1).buyCard();
      await cash.connect(user1).buyCash({ value: ethers.utils.parseEther("20") });
      await cash.connect(user1).approve(evenOdd.address, ethers.utils.parseEther("20"));

      await expect(evenOdd.connect(user1).bet(true, ethers.utils.parseEther("20"))).revertedWith("Contract are not enough cash to reward if you win this match");
    });

    it("Check double betting", async () => {
      await memberCard.connect(user1).buyCard();
      await cash.connect(user1).buyCash({ value: ethers.utils.parseEther("10") });
      await cash.connect(user1).approve(evenOdd.address, ethers.utils.parseEther("2"));
      await evenOdd.connect(user1).bet(true, ethers.utils.parseEther("2"));
      await cash.connect(user1).approve(evenOdd.address, ethers.utils.parseEther("2"));
      await expect(evenOdd.connect(user1).bet(true, ethers.utils.parseEther("2"))).revertedWith("You've betted before");
    });

    describe("User pay token when betting", () => {
      it("Check the amount of user's bet token exceeds allowance", async () => {
        await memberCard.connect(user1).buyCard();

        await cash.connect(user1).buyCash({ value: ethers.utils.parseEther("10") });
        await cash.connect(user1).approve(evenOdd.address, ethers.utils.parseEther("2"));

        await expect(evenOdd.connect(user1).bet(true, ethers.utils.parseEther("3"))).revertedWith("transfer amount exceeds allowance");
      });

      it("Check transfer token from user address to contract address when user bet", async () => {
        await memberCard.connect(user1).buyCard();
        await cash.connect(user1).buyCash({ value: ethers.utils.parseEther("10") });
        await cash.connect(user1).approve(evenOdd.address, ethers.utils.parseEther("5"));
        await evenOdd.connect(user1).bet(true, ethers.utils.parseEther("5"));

        expect(await cash.balanceOf(user1.address), "User has 10 ether token, user must have 5 ether token after bet 5 ether token").to.equal(ethers.utils.parseEther("5"));
        expect(await cash.balanceOf(evenOdd.address), "Contract has 10 ether token, contract must have 15 ether token after bet 5 ether token").to.equal(
          ethers.utils.parseEther("15")
        );
      });
    });

    describe("Successfully betting", () => {
      it("Check user can bet", async () => {
        await memberCard.connect(user1).buyCard();
        await cash.connect(user1).buyCash({ value: ethers.utils.parseEther("10") });
        await cash.connect(user1).approve(evenOdd.address, ethers.utils.parseEther("5"));
        await evenOdd.connect(user1).bet(true, ethers.utils.parseEther("5"));

        const cardId = await memberCard.cardIdOf(user1.address);
        const latedMatchId = await evenOdd.latedMatchId();
        const decision = await evenOdd.decisionsOf(latedMatchId, 0);

        expect(decision.cardId, "CardId in match's history is not the same as participant's cardId").to.equal(cardId);
        expect(decision.isOdd, "Value in match's history is not equal to value user bet").to.equal(true);
        expect(decision.amount, "Token user bet stored in match's history is not the same as participant using to bet").to.equal(ethers.utils.parseEther("5"));
        expect(await cash.balanceOf(evenOdd.address), "Contract has 10 ether token, contract must have 15 ether token after bet 5 ether token").to.equal(
          ethers.utils.parseEther("15")
        );
      });
    });
  });

  describe("Check 'play' function", () => {
    it("Only owner can call play function", async () => {
      await expect(evenOdd.play());
      await expect(evenOdd.connect(user1).play()).revertedWith("Ownable: caller is not the owner");
    });

    it("Match id is increased after play", async () => {
      const beforeMatchId = await evenOdd.latedMatchId();

      await memberCard.connect(user1).buyCard();
      await cash.connect(user1).buyCash({ value: ethers.utils.parseEther("10") });
      await cash.connect(user1).approve(evenOdd.address, ethers.utils.parseEther("5"));
      await evenOdd.connect(user1).bet(true, ethers.utils.parseEther("5"));
      await evenOdd.play();

      const afterMatchId = await evenOdd.latedMatchId();
      expect(afterMatchId - beforeMatchId, "MatchId must be increased after each match").to.equal(1);
    });

    it("Can get bet values history of each match", async () => {
      const result = [];

      for (let i = 0; i < 100; i++) {
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 10));
        await evenOdd.play();
        const betResult = await evenOdd.matchResultOf(await evenOdd.latedMatchId());
        const betResultIsOdd = betResult.roll1.add(betResult.roll2).mod(2) == 1;
        result.push(betResultIsOdd);
      }

      const odds = result.filter((item) => item == true);
      expect(odds.length / 100 - 0.5, "Roll is not randomize function").to.lessThanOrEqual(0.25);
    });

    it("Can get user decisions history of each match", async () => {
      await memberCard.connect(user1).buyCard();
      await cash.connect(user1).buyCash({ value: ethers.utils.parseEther("10") });
      await memberCard.connect(user2).buyCard();
      await cash.connect(user2).buyCash({ value: ethers.utils.parseEther("10") });

      await cash.connect(user1).approve(evenOdd.address, ethers.utils.parseEther("2"));
      await evenOdd.connect(user1).bet(false, ethers.utils.parseEther("2"));
      await evenOdd.play();

      // Start with matchId = 0
      const decision00 = await evenOdd.decisionsOf(0, 0); // Decision of user 1
      expect(decision00.cardId, "CardId of user1 must be specified in user's decision").to.equal(await memberCard.cardIdOf(user1.address));
      expect(decision00.isOdd, "User's bet decision must be EVEN").to.equal(false);
      expect(decision00.amount, "User's bet amount must equal to 2 ethers").to.equal(ethers.utils.parseEther("2"));

      await cash.connect(user1).approve(evenOdd.address, ethers.utils.parseEther("3"));
      await evenOdd.connect(user1).bet(true, ethers.utils.parseEther("3"));
      await cash.connect(user2).approve(evenOdd.address, ethers.utils.parseEther("1"));
      await evenOdd.connect(user2).bet(true, ethers.utils.parseEther("1"));
      await evenOdd.play();

      // Next with matchId = 1
      const decision10 = await evenOdd.decisionsOf(1, 0); // Decision of user 1
      expect(decision10.cardId, "CardId of user1 must be specified in user's decision").to.equal(await memberCard.cardIdOf(user1.address));
      expect(decision10.isOdd, "User's bet decision must be ODD").to.equal(true);
      expect(decision10.amount, "User's bet amount must equal to 3 ethers").to.equal(ethers.utils.parseEther("3"));

      const decision11 = await evenOdd.decisionsOf(1, 1); // Decision of user 2
      expect(decision11.cardId, "CardId of user1 must be specified in user's decision").to.equal(await memberCard.cardIdOf(user2.address));
      expect(decision11.isOdd, "User's bet decision must be ODD").to.equal(true);
      expect(decision11.amount, "User's bet amount must equal to 1 ethers").to.equal(ethers.utils.parseEther("1"));
    });

    it("Check user balance after each match", async () => {
      await memberCard.connect(user1).buyCard();
      await cash.connect(user1).buyCash({ value: ethers.utils.parseEther("2") });
      await cash.connect(user1).approve(evenOdd.address, ethers.utils.parseEther("2"));
      await evenOdd.connect(user1).bet(true, ethers.utils.parseEther("2"));

      await memberCard.connect(user2).buyCard();
      await cash.connect(user2).buyCash({ value: ethers.utils.parseEther("2") });
      await cash.connect(user2).approve(evenOdd.address, ethers.utils.parseEther("2"));
      await evenOdd.connect(user2).bet(false, ethers.utils.parseEther("2"));

      await evenOdd.play();
      const betResult = await evenOdd.matchResultOf(0);
      const betResultIsOdd = betResult.roll1.add(betResult.roll2).mod(2) == 1;

      let user1Balance = ethers.BigNumber.from("0");
      let user2Balance = ethers.BigNumber.from("0");

      if (betResultIsOdd == true) {
        user1Balance = user1Balance.add(ethers.utils.parseEther("4"));
      } else {
        user2Balance = user2Balance.add(ethers.utils.parseEther("4"));
      }

      expect(await cash.balanceOf(user1.address)).to.equal(user1Balance);
      expect(await cash.balanceOf(user2.address)).to.equal(user2Balance);
    });
  });
});

// // Exposed EvenOdd contract to test internal functions
// describe("Test cases of $EvenOdd", () => {
//   beforeEach(async () => {
//     [deployer, user1, user2] = await ethers.getSigners();

//     const MemberCard = await ethers.getContractFactory("$MemberCard");
//     memberCard = await MemberCard.deploy();
//     console.log(`---> Contract MemberCard is deployed at ${memberCard.address}`);

//     const Cash = await ethers.getContractFactory("$Cash");
//     cash = await Cash.deploy();
//     console.log(`---> Contract Cash is deployed at ${cash.address}`);

//     const EvenOdd = await ethers.getContractFactory("$EvenOdd"); // Exposed this contract to test internal functions
//     evenOdd = await EvenOdd.deploy(memberCard.address, cash.address);
//     console.log(`---> Contract EvenOdd is deployed at ${evenOdd.address}`);

//     // Add token to contract
//     cash.$_mint(evenOdd.address, ethers.utils.parseEther("10"));
//   });

//   describe("Check '_roll' function", () => {
//     it("Only owner can roll", async () => {
//       await expect(evenOdd.$_roll());
//       await expect(evenOdd.connect(user1).$_roll()).revertedWith("Ownable: caller is not the owner");
//     });

//     it("Check random roll", async () => {
//       const result = [];

//     });
//   });

//   describe("Check '_endMatch' function", () => {
//     it("Only owner can end match", async () => {
//       await expect(evenOdd.$_endMatch());
//       await expect(evenOdd.connect(user1).$_endMatch()).revertedWith("Ownable: caller is not the owner");
//     });

//     it("Check end match", async () => {

//     });
//   });

//   describe("Check '_nextMatch' function", () => {
//     it("only owner can call next match", async () => {
//       await expect(evenOdd.$_nextMatch());
//       await expect(evenOdd.connect(user1).$_nextMatch()).revertedWith("Ownable: caller is not the owner");
//     });

//     it("Check on next match", async () => {
//       const latedMatchIdBefore = await evenOdd.latedMatchId();
//       await evenOdd.$_nextMatch();
//       const latedMatchIdAfter = await evenOdd.latedMatchId();

//       expect(latedMatchIdAfter - latedMatchIdBefore, "latedMatchId must be increased after each match").to.equal(1);
//     });
//   });
// });
