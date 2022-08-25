const { ethers } = require("hardhat");
const { expect } = require("chai");
const { skipTime } = require("../utils");

const DAY_TIME = 86400; // 1 day = 86400 seconds

describe("Bet Flow", () => {
  beforeEach(async () => {
    [deployer, user1, user2, user3] = await ethers.getSigners();

    const MemberCard = await ethers.getContractFactory("MemberCard");
    memberCard = await MemberCard.deploy();
    console.log(`---> Contract MemberCard is deployed at ${memberCard.address}`);

    const Cash = await ethers.getContractFactory("Cash");
    cash = await Cash.deploy();
    console.log(`---> Contract Cash is deployed at ${cash.address}`);

    const EvenOdd = await ethers.getContractFactory("EvenOdd");
    evenOdd = await EvenOdd.deploy(memberCard.address, cash.address, { value: ethers.utils.parseEther("12") });
    console.log(`---> Contract EvenOdd is deployed at ${evenOdd.address}`);
  });

  it("Play 3 match with 1 user => Transfer token => Withdraw all token", async () => {
    await memberCard.connect(user1).buyCard();
    await cash.connect(user1).buyCash({ value: ethers.utils.parseEther("10") });

    let contractBalance = ethers.utils.parseEther("12");
    let userBalance = ethers.utils.parseEther("10");

    // Match 1
    console.log("Begin match 1");
    await cash.connect(user1).approve(evenOdd.address, ethers.utils.parseEther("2"));
    await evenOdd.connect(user1).bet(true, ethers.utils.parseEther("2"));

    const decision1 = await evenOdd.decisionsOf(0, 0); // Start with matchId = 0
    expect(decision1.cardId, "CardId of user1 must be specified in user's decision").to.equal(await memberCard.cardIdOf(user1.address));
    expect(decision1.isOdd, "User's bet decision must be the same as user's decision").to.equal(true);
    expect(decision1.amount, "User's bet amount must equal to user's decision").to.equal(ethers.utils.parseEther("2"));

    contractBalance = contractBalance.add(decision1.amount);
    userBalance = userBalance.sub(decision1.amount);

    await evenOdd.play();
    const betResult1 = await evenOdd.matchResultOf(0);
    const betResult1IsOdd = betResult1.roll1.add(betResult1.roll2).mod(2) == 1;

    if (betResult1IsOdd == decision1.isOdd) {
      contractBalance = contractBalance.sub(decision1.amount.mul(2));
      userBalance = userBalance.add(decision1.amount.mul(2));
    }

    expect(await cash.balanceOf(evenOdd.address)).to.equal(contractBalance);
    expect(await cash.balanceOf(user1.address)).to.equal(userBalance);

    // Match 2
    console.log("Begin match 2");
    await cash.connect(user1).approve(evenOdd.address, ethers.utils.parseEther("3"));
    await evenOdd.connect(user1).bet(false, ethers.utils.parseEther("3"));

    const decision2 = await evenOdd.decisionsOf(1, 0); // Start with matchId = 0
    expect(decision2.cardId, "CardId of user1 must be specified in user's decision").to.equal(await memberCard.cardIdOf(user1.address));
    expect(decision2.isOdd, "User's bet decision must be the same as user's decision").to.equal(false);
    expect(decision2.amount, "User's bet amount must equal to user's decision").to.equal(ethers.utils.parseEther("3"));

    contractBalance = contractBalance.add(decision2.amount);
    userBalance = userBalance.sub(decision2.amount);

    await evenOdd.play();
    const betResult2 = await evenOdd.matchResultOf(1);
    const betResult2IsOdd = betResult2.roll1.add(betResult2.roll2).mod(2) == 1;

    if (betResult2IsOdd == decision2.isOdd) {
      contractBalance = contractBalance.sub(decision2.amount.mul(2));
      userBalance = userBalance.add(decision2.amount.mul(2));
    }

    expect(await cash.balanceOf(evenOdd.address)).to.equal(contractBalance);
    expect(await cash.balanceOf(user1.address)).to.equal(userBalance);

    // Match 3
    console.log("Begin match 3");
    await cash.connect(user1).approve(evenOdd.address, ethers.utils.parseEther("1"));
    await evenOdd.connect(user1).bet(true, ethers.utils.parseEther("1"));

    const decision3 = await evenOdd.decisionsOf(2, 0); // Start with matchId = 0
    expect(decision3.cardId, "CardId of user1 must be specified in user's decision").to.equal(await memberCard.cardIdOf(user1.address));
    expect(decision3.isOdd, "User's bet decision must be the same as user's decision").to.equal(true);
    expect(decision3.amount, "User's bet amount must equal to user's decision").to.equal(ethers.utils.parseEther("1"));

    contractBalance = contractBalance.add(decision3.amount);
    userBalance = userBalance.sub(decision3.amount);

    await evenOdd.play();
    const betResult3 = await evenOdd.matchResultOf(2);
    const betResult3IsOdd = betResult3.roll1.add(betResult3.roll2).mod(2) == 1;

    if (betResult3IsOdd == decision3.isOdd) {
      contractBalance = contractBalance.sub(decision3.amount.mul(2));
      userBalance = userBalance.add(decision3.amount.mul(2));
    }

    expect(await cash.balanceOf(evenOdd.address)).to.equal(contractBalance);
    expect(await cash.balanceOf(user1.address)).to.equal(userBalance);

    // Transfer token to user2
    console.log("Transfer token");
    await cash.connect(user1).transfer(user2.address, ethers.utils.parseEther("4"));

    userBalance = userBalance.sub(ethers.utils.parseEther("4"));

    expect(await cash.balanceOf(user1.address)).to.equal(userBalance);
    expect(await cash.balanceOf(user2.address)).to.equal(ethers.utils.parseEther("4"));

    // Withdraw token
    console.log("Withdraw token");
    await cash.connect(user1).withdraw(userBalance);
    expect(await cash.balanceOf(user1.address)).to.equal(ethers.utils.parseEther("0"));
  });

  it("Play 1 match with 1 user => Card Expired -> Extend Card Period => Play 1 match more => withdraw all token", async () => {
    const userBalanceBefore = await ethers.provider.getBalance(user1.address);
    await memberCard.connect(user1).buyCard();
    await cash.connect(user1).buyCash({ value: ethers.utils.parseEther("10") });

    let contractBalance = ethers.utils.parseEther("12");
    let userBalance = ethers.utils.parseEther("10");

    // Match 1
    console.log("Match 1");
    await cash.connect(user1).approve(evenOdd.address, ethers.utils.parseEther("2"));
    await evenOdd.connect(user1).bet(true, ethers.utils.parseEther("2"));

    const decision1 = await evenOdd.decisionsOf(0, 0); // Start with matchId = 0
    expect(decision1.cardId, "CardId of user1 must be specified in user's decision").to.equal(await memberCard.cardIdOf(user1.address));
    expect(decision1.isOdd, "User's bet decision must be the same as user's decision").to.equal(true);
    expect(decision1.amount, "User's bet amount must equal to user's decision").to.equal(ethers.utils.parseEther("2"));

    contractBalance = contractBalance.add(decision1.amount);
    userBalance = userBalance.sub(decision1.amount);

    await evenOdd.play();
    const betResult1 = await evenOdd.matchResultOf(0);
    const betResult1IsOdd = betResult1.roll1.add(betResult1.roll2).mod(2) == 1;

    if (betResult1IsOdd == decision1.isOdd) {
      contractBalance = contractBalance.sub(decision1.amount.mul(2));
      userBalance = userBalance.add(decision1.amount.mul(2));
    }

    expect(await cash.balanceOf(evenOdd.address)).to.equal(contractBalance);
    expect(await cash.balanceOf(user1.address)).to.equal(userBalance);

    // Card expired
    console.log("Card expired");
    await skipTime(DAY_TIME + 1);
    expect(await memberCard.connect(user1).isExpired(user1.address), "Card must be expired after 1 day").to.be.true;

    // Extend card period
    console.log("Extend card period");
    await memberCard.connect(user1).extendCardPeriod();
    expect(await memberCard.connect(user1).isExpired(user1.address), "Card must be expired after 1 day").to.be.false;

    // Match 2
    console.log("Match 2");
    await cash.connect(user1).approve(evenOdd.address, ethers.utils.parseEther("5"));
    await evenOdd.connect(user1).bet(false, ethers.utils.parseEther("5"));

    const decision2 = await evenOdd.decisionsOf(1, 0); // Start with matchId = 0
    expect(decision2.cardId, "CardId of user1 must be specified in user's decision").to.equal(await memberCard.cardIdOf(user1.address));
    expect(decision2.isOdd, "User's bet decision must be the same as user's decision").to.equal(false);
    expect(decision2.amount, "User's bet amount must equal to user's decision").to.equal(ethers.utils.parseEther("5"));

    contractBalance = contractBalance.add(decision2.amount);
    userBalance = userBalance.sub(decision2.amount);

    await evenOdd.play();
    const betResult2 = await evenOdd.matchResultOf(1);
    const betResult2IsOdd = betResult2.roll1.add(betResult2.roll2).mod(2) == 1;

    if (betResult2IsOdd == decision2.isOdd) {
      contractBalance = contractBalance.sub(decision2.amount.mul(2));
      userBalance = userBalance.add(decision2.amount.mul(2));
    }

    expect(await cash.balanceOf(evenOdd.address)).to.equal(contractBalance);
    expect(await cash.balanceOf(user1.address)).to.equal(userBalance);

    // Withdraw all token
    console.log("Withdraw all token");
    await cash.connect(user1).withdraw(userBalance);
    const userBalanceAfter = await ethers.provider.getBalance(user1.address);
    const userProfit = userBalance.sub(ethers.utils.parseEther("10"));

    userBalance = userBalance.sub(userBalance);

    expect(await cash.balanceOf(user1.address)).to.equal(userBalance);
    expect(userBalanceAfter.sub(userBalanceBefore), "Balance of user after play 2 match must be decreased").to.closeTo(userProfit, ethers.utils.parseEther("0.01"));
  });

  it("Play 3 match with 3 user", async () => {
    await memberCard.connect(user1).buyCard();
    await memberCard.connect(user2).buyCard();
    await memberCard.connect(user3).buyCard();
    await cash.connect(user1).buyCash({ value: ethers.utils.parseEther("10") });
    await cash.connect(user2).buyCash({ value: ethers.utils.parseEther("10") });
    await cash.connect(user3).buyCash({ value: ethers.utils.parseEther("10") });

    let contractBalance = ethers.utils.parseEther("12");
    let user1Balance = ethers.utils.parseEther("10");
    let user2Balance = ethers.utils.parseEther("10");
    let user3Balance = ethers.utils.parseEther("10");

    // Match 1
    console.log("Begin match 1");
    await cash.connect(user1).approve(evenOdd.address, ethers.utils.parseEther("2"));
    await evenOdd.connect(user1).bet(true, ethers.utils.parseEther("2"));
    await cash.connect(user2).approve(evenOdd.address, ethers.utils.parseEther("1"));
    await evenOdd.connect(user2).bet(true, ethers.utils.parseEther("1"));
    await cash.connect(user3).approve(evenOdd.address, ethers.utils.parseEther("3"));
    await evenOdd.connect(user3).bet(false, ethers.utils.parseEther("3"));

    const decision11 = await evenOdd.decisionsOf(0, 0);
    expect(decision11.cardId, "CardId of user1 must be specified in user's decision").to.equal(await memberCard.cardIdOf(user1.address));
    expect(decision11.isOdd, "User's bet decision must be the same as user's decision").to.equal(true);
    expect(decision11.amount, "User's bet amount must equal to user's decision").to.equal(ethers.utils.parseEther("2"));

    contractBalance = contractBalance.add(decision11.amount);
    user1Balance = user1Balance.sub(decision11.amount);

    const decision12 = await evenOdd.decisionsOf(0, 1);
    expect(decision12.cardId, "CardId of user1 must be specified in user's decision").to.equal(await memberCard.cardIdOf(user2.address));
    expect(decision12.isOdd, "User's bet decision must be the same as user's decision").to.equal(true);
    expect(decision12.amount, "User's bet amount must equal to user's decision").to.equal(ethers.utils.parseEther("1"));

    contractBalance = contractBalance.add(decision12.amount);
    user2Balance = user2Balance.sub(decision12.amount);

    const decision13 = await evenOdd.decisionsOf(0, 2);
    expect(decision13.cardId, "CardId of user1 must be specified in user's decision").to.equal(await memberCard.cardIdOf(user3.address));
    expect(decision13.isOdd, "User's bet decision must be the same as user's decision").to.equal(false);
    expect(decision13.amount, "User's bet amount must equal to user's decision").to.equal(ethers.utils.parseEther("3"));

    contractBalance = contractBalance.add(decision13.amount);
    user3Balance = user3Balance.sub(decision13.amount);

    await evenOdd.play();
    const betResult1 = await evenOdd.matchResultOf(0);
    const betResult1IsOdd = betResult1.roll1.add(betResult1.roll2).mod(2) == 1;

    if (betResult1IsOdd == decision11.isOdd) {
      contractBalance = contractBalance.sub(decision11.amount.mul(2));
      user1Balance = user1Balance.add(decision11.amount.mul(2));
    }

    if (betResult1IsOdd == decision12.isOdd) {
      contractBalance = contractBalance.sub(decision12.amount.mul(2));
      user2Balance = user2Balance.add(decision12.amount.mul(2));
    }

    if (betResult1IsOdd == decision13.isOdd) {
      contractBalance = contractBalance.sub(decision13.amount.mul(2));
      user3Balance = user3Balance.add(decision13.amount.mul(2));
    }

    expect(await cash.balanceOf(evenOdd.address)).to.equal(contractBalance);
    expect(await cash.balanceOf(user1.address)).to.equal(user1Balance);
    expect(await cash.balanceOf(user2.address)).to.equal(user2Balance);
    expect(await cash.balanceOf(user3.address)).to.equal(user3Balance);

    // Match 2
    console.log("Begin match 2");
    await cash.connect(user1).approve(evenOdd.address, ethers.utils.parseEther("3"));
    await evenOdd.connect(user1).bet(false, ethers.utils.parseEther("3"));
    await cash.connect(user2).approve(evenOdd.address, ethers.utils.parseEther("2"));
    await evenOdd.connect(user2).bet(true, ethers.utils.parseEther("2"));
    await cash.connect(user3).approve(evenOdd.address, ethers.utils.parseEther("2"));
    await evenOdd.connect(user3).bet(false, ethers.utils.parseEther("2"));

    const decision21 = await evenOdd.decisionsOf(1, 0);
    expect(decision21.cardId, "CardId of user1 must be specified in user's decision").to.equal(await memberCard.cardIdOf(user1.address));
    expect(decision21.isOdd, "User's bet decision must be the same as user's decision").to.equal(false);
    expect(decision21.amount, "User's bet amount must equal to user's decision").to.equal(ethers.utils.parseEther("3"));

    contractBalance = contractBalance.add(decision21.amount);
    user1Balance = user1Balance.sub(decision21.amount);

    const decision22 = await evenOdd.decisionsOf(1, 1);
    expect(decision22.cardId, "CardId of user1 must be specified in user's decision").to.equal(await memberCard.cardIdOf(user2.address));
    expect(decision22.isOdd, "User's bet decision must be the same as user's decision").to.equal(true);
    expect(decision22.amount, "User's bet amount must equal to user's decision").to.equal(ethers.utils.parseEther("2"));

    contractBalance = contractBalance.add(decision22.amount);
    user2Balance = user2Balance.sub(decision22.amount);

    const decision23 = await evenOdd.decisionsOf(1, 2);
    expect(decision23.cardId, "CardId of user1 must be specified in user's decision").to.equal(await memberCard.cardIdOf(user3.address));
    expect(decision23.isOdd, "User's bet decision must be the same as user's decision").to.equal(false);
    expect(decision23.amount, "User's bet amount must equal to user's decision").to.equal(ethers.utils.parseEther("2"));

    contractBalance = contractBalance.add(decision23.amount);
    user3Balance = user3Balance.sub(decision23.amount);

    await evenOdd.play();
    const betResult2 = await evenOdd.matchResultOf(1);
    const betResult2IsOdd = betResult2.roll1.add(betResult2.roll2).mod(2) == 1;

    if (betResult2IsOdd == decision21.isOdd) {
      contractBalance = contractBalance.sub(decision21.amount.mul(2));
      user1Balance = user1Balance.add(decision21.amount.mul(2));
    }

    if (betResult2IsOdd == decision22.isOdd) {
      contractBalance = contractBalance.sub(decision22.amount.mul(2));
      user2Balance = user2Balance.add(decision22.amount.mul(2));
    }

    if (betResult2IsOdd == decision23.isOdd) {
      contractBalance = contractBalance.sub(decision23.amount.mul(2));
      user3Balance = user3Balance.add(decision23.amount.mul(2));
    }

    expect(await cash.balanceOf(evenOdd.address)).to.equal(contractBalance);
    expect(await cash.balanceOf(user1.address)).to.equal(user1Balance);
    expect(await cash.balanceOf(user2.address)).to.equal(user2Balance);
    expect(await cash.balanceOf(user3.address)).to.equal(user3Balance);

    // Match 3
    console.log("Begin match 3");
    await cash.connect(user1).approve(evenOdd.address, ethers.utils.parseEther("2"));
    await evenOdd.connect(user1).bet(true, ethers.utils.parseEther("2"));
    await cash.connect(user2).approve(evenOdd.address, ethers.utils.parseEther("1"));
    await evenOdd.connect(user2).bet(false, ethers.utils.parseEther("1"));
    await cash.connect(user3).approve(evenOdd.address, ethers.utils.parseEther("1"));
    await evenOdd.connect(user3).bet(true, ethers.utils.parseEther("1"));

    const decision31 = await evenOdd.decisionsOf(2, 0);
    expect(decision31.cardId, "CardId of user1 must be specified in user's decision").to.equal(await memberCard.cardIdOf(user1.address));
    expect(decision31.isOdd, "User's bet decision must be the same as user's decision").to.equal(true);
    expect(decision31.amount, "User's bet amount must equal to user's decision").to.equal(ethers.utils.parseEther("2"));

    contractBalance = contractBalance.add(decision31.amount);
    user1Balance = user1Balance.sub(decision31.amount);

    const decision32 = await evenOdd.decisionsOf(2, 1);
    expect(decision32.cardId, "CardId of user1 must be specified in user's decision").to.equal(await memberCard.cardIdOf(user2.address));
    expect(decision32.isOdd, "User's bet decision must be the same as user's decision").to.equal(false);
    expect(decision32.amount, "User's bet amount must equal to user's decision").to.equal(ethers.utils.parseEther("1"));

    contractBalance = contractBalance.add(decision32.amount);
    user2Balance = user2Balance.sub(decision32.amount);

    const decision33 = await evenOdd.decisionsOf(2, 2);
    expect(decision33.cardId, "CardId of user1 must be specified in user's decision").to.equal(await memberCard.cardIdOf(user3.address));
    expect(decision33.isOdd, "User's bet decision must be the same as user's decision").to.equal(true);
    expect(decision33.amount, "User's bet amount must equal to user's decision").to.equal(ethers.utils.parseEther("1"));

    contractBalance = contractBalance.add(decision33.amount);
    user3Balance = user3Balance.sub(decision33.amount);

    await evenOdd.play();
    const betResult3 = await evenOdd.matchResultOf(2);
    const betResult3IsOdd = betResult3.roll1.add(betResult3.roll2).mod(2) == 1;

    if (betResult3IsOdd == decision31.isOdd) {
      contractBalance = contractBalance.sub(decision31.amount.mul(2));
      user1Balance = user1Balance.add(decision31.amount.mul(2));
    }

    if (betResult3IsOdd == decision32.isOdd) {
      contractBalance = contractBalance.sub(decision32.amount.mul(2));
      user2Balance = user2Balance.add(decision32.amount.mul(2));
    }

    if (betResult3IsOdd == decision33.isOdd) {
      contractBalance = contractBalance.sub(decision33.amount.mul(2));
      user3Balance = user3Balance.add(decision33.amount.mul(2));
    }

    expect(await cash.balanceOf(evenOdd.address)).to.equal(contractBalance);
    expect(await cash.balanceOf(user1.address)).to.equal(user1Balance);
    expect(await cash.balanceOf(user2.address)).to.equal(user2Balance);
    expect(await cash.balanceOf(user3.address)).to.equal(user3Balance);
  });

  it("Match 1 with 3 user => user3 withdraw almost token => Match 2 with 3 user (user3 not enough token)", async () => {
    await memberCard.connect(user1).buyCard();
    await memberCard.connect(user2).buyCard();
    await memberCard.connect(user3).buyCard();
    await cash.connect(user1).buyCash({ value: ethers.utils.parseEther("10") });
    await cash.connect(user2).buyCash({ value: ethers.utils.parseEther("10") });
    await cash.connect(user3).buyCash({ value: ethers.utils.parseEther("10") });

    let contractBalance = ethers.utils.parseEther("12");
    let user1Balance = ethers.utils.parseEther("10");
    let user2Balance = ethers.utils.parseEther("10");
    let user3Balance = ethers.utils.parseEther("10");

    // Match 1
    console.log("Begin match 1");
    await cash.connect(user1).approve(evenOdd.address, ethers.utils.parseEther("2"));
    await evenOdd.connect(user1).bet(true, ethers.utils.parseEther("2"));
    await cash.connect(user2).approve(evenOdd.address, ethers.utils.parseEther("1"));
    await evenOdd.connect(user2).bet(true, ethers.utils.parseEther("1"));
    await cash.connect(user3).approve(evenOdd.address, ethers.utils.parseEther("3"));
    await evenOdd.connect(user3).bet(false, ethers.utils.parseEther("3"));

    const decision11 = await evenOdd.decisionsOf(0, 0);
    expect(decision11.cardId, "CardId of user1 must be specified in user's decision").to.equal(await memberCard.cardIdOf(user1.address));
    expect(decision11.isOdd, "User's bet decision must be the same as user's decision").to.equal(true);
    expect(decision11.amount, "User's bet amount must equal to user's decision").to.equal(ethers.utils.parseEther("2"));

    contractBalance = contractBalance.add(decision11.amount);
    user1Balance = user1Balance.sub(decision11.amount);

    const decision12 = await evenOdd.decisionsOf(0, 1);
    expect(decision12.cardId, "CardId of user1 must be specified in user's decision").to.equal(await memberCard.cardIdOf(user2.address));
    expect(decision12.isOdd, "User's bet decision must be the same as user's decision").to.equal(true);
    expect(decision12.amount, "User's bet amount must equal to user's decision").to.equal(ethers.utils.parseEther("1"));

    contractBalance = contractBalance.add(decision12.amount);
    user2Balance = user2Balance.sub(decision12.amount);

    const decision13 = await evenOdd.decisionsOf(0, 2);
    expect(decision13.cardId, "CardId of user1 must be specified in user's decision").to.equal(await memberCard.cardIdOf(user3.address));
    expect(decision13.isOdd, "User's bet decision must be the same as user's decision").to.equal(false);
    expect(decision13.amount, "User's bet amount must equal to user's decision").to.equal(ethers.utils.parseEther("3"));

    contractBalance = contractBalance.add(decision13.amount);
    user3Balance = user3Balance.sub(decision13.amount);

    await evenOdd.play();
    const betResult1 = await evenOdd.matchResultOf(0);
    const betResult1IsOdd = betResult1.roll1.add(betResult1.roll2).mod(2) == 1;

    if (betResult1IsOdd == decision11.isOdd) {
      contractBalance = contractBalance.sub(decision11.amount.mul(2));
      user1Balance = user1Balance.add(decision11.amount.mul(2));
    }

    if (betResult1IsOdd == decision12.isOdd) {
      contractBalance = contractBalance.sub(decision12.amount.mul(2));
      user2Balance = user2Balance.add(decision12.amount.mul(2));
    }

    if (betResult1IsOdd == decision13.isOdd) {
      contractBalance = contractBalance.sub(decision13.amount.mul(2));
      user3Balance = user3Balance.add(decision13.amount.mul(2));
    }

    expect(await cash.balanceOf(evenOdd.address)).to.equal(contractBalance);
    expect(await cash.balanceOf(user1.address)).to.equal(user1Balance);
    expect(await cash.balanceOf(user2.address)).to.equal(user2Balance);
    expect(await cash.balanceOf(user3.address)).to.equal(user3Balance);

    // User3 withdraw almost token
    console.log("User3 withdraw almost token");
    const user3TokenWithdraw = user3Balance.sub(ethers.utils.parseEther("1"));
    await cash.connect(user3).withdraw(user3TokenWithdraw);

    user3Balance = user3Balance.sub(user3TokenWithdraw);

    expect(await cash.balanceOf(user3.address)).to.equal(user3Balance);

    // Match 2
    console.log("Begin match 2");
    await cash.connect(user1).approve(evenOdd.address, ethers.utils.parseEther("1"));
    await evenOdd.connect(user1).bet(false, ethers.utils.parseEther("1"));
    await cash.connect(user2).approve(evenOdd.address, ethers.utils.parseEther("1"));
    await evenOdd.connect(user2).bet(false, ethers.utils.parseEther("1"));
    await cash.connect(user3).approve(evenOdd.address, ethers.utils.parseEther("5"));

    await expect(evenOdd.connect(user3).bet(false, ethers.utils.parseEther("5"))).revertedWith("ERC20: transfer amount exceeds balance");

    const decision21 = await evenOdd.decisionsOf(1, 0);
    expect(decision21.cardId, "CardId of user1 must be specified in user's decision").to.equal(await memberCard.cardIdOf(user1.address));
    expect(decision21.isOdd, "User's bet decision must be the same as user's decision").to.equal(false);
    expect(decision21.amount, "User's bet amount must equal to user's decision").to.equal(ethers.utils.parseEther("1"));

    contractBalance = contractBalance.add(decision21.amount);
    user1Balance = user1Balance.sub(decision21.amount);

    const decision22 = await evenOdd.decisionsOf(1, 1);
    expect(decision22.cardId, "CardId of user1 must be specified in user's decision").to.equal(await memberCard.cardIdOf(user2.address));
    expect(decision22.isOdd, "User's bet decision must be the same as user's decision").to.equal(false);
    expect(decision22.amount, "User's bet amount must equal to user's decision").to.equal(ethers.utils.parseEther("1"));

    contractBalance = contractBalance.add(decision22.amount);
    user2Balance = user2Balance.sub(decision22.amount);

    await evenOdd.play();
    const betResult2 = await evenOdd.matchResultOf(1);
    const betResult2IsOdd = betResult2.roll1.add(betResult2.roll2).mod(2) == 1;

    if (betResult2IsOdd == decision21.isOdd) {
      contractBalance = contractBalance.sub(decision21.amount.mul(2));
      user1Balance = user1Balance.add(decision21.amount.mul(2));
    }

    if (betResult2IsOdd == decision22.isOdd) {
      contractBalance = contractBalance.sub(decision22.amount.mul(2));
      user2Balance = user2Balance.add(decision22.amount.mul(2));
    }

    expect(await cash.balanceOf(evenOdd.address)).to.equal(contractBalance);
    expect(await cash.balanceOf(user1.address)).to.equal(user1Balance);
    expect(await cash.balanceOf(user2.address)).to.equal(user2Balance);
    expect(await cash.balanceOf(user3.address)).to.equal(user3Balance);
  });

  it("Match 1 with 1 user => 2/3 day time passing => Match 2 with 3 user => 2/3 day time passing => Match 3 with 3 users (user1's card is expired) => User1 extend card period => Match 4 with 3 user => Users withdraw all token", async () => {
    const user1BalanceBefore = await ethers.provider.getBalance(user1.address);
    const user2BalanceBefore = await ethers.provider.getBalance(user2.address);
    const user3BalanceBefore = await ethers.provider.getBalance(user3.address);

    let contractBalance = ethers.utils.parseEther("12");
    let user1Balance = ethers.utils.parseEther("0");
    let user2Balance = ethers.utils.parseEther("0");
    let user3Balance = ethers.utils.parseEther("0");

    await memberCard.connect(user1).buyCard();
    await cash.connect(user1).buyCash({ value: ethers.utils.parseEther("10") });

    user1Balance = user1Balance.add(ethers.utils.parseEther("10"));

    // Match 1
    console.log("begin match 1");
    await cash.connect(user1).approve(evenOdd.address, ethers.utils.parseEther("2"));
    await evenOdd.connect(user1).bet(true, ethers.utils.parseEther("2"));

    const decision11 = await evenOdd.decisionsOf(0, 0); // Start with matchId = 0
    expect(decision11.cardId, "CardId of user1 must be specified in user's decision").to.equal(await memberCard.cardIdOf(user1.address));
    expect(decision11.isOdd, "User's bet decision must be the same as user's decision").to.equal(true);
    expect(decision11.amount, "User's bet amount must equal to user's decision").to.equal(ethers.utils.parseEther("2"));

    contractBalance = contractBalance.add(decision11.amount);
    user1Balance = user1Balance.sub(decision11.amount);

    await evenOdd.play();
    const betResult1 = await evenOdd.matchResultOf(0);
    const betResult1IsOdd = betResult1.roll1.add(betResult1.roll2).mod(2) == 1;

    if (betResult1IsOdd == decision11.isOdd) {
      contractBalance = contractBalance.sub(decision11.amount.mul(2));
      user1Balance = user1Balance.add(decision11.amount.mul(2));
    }

    expect(await cash.balanceOf(evenOdd.address)).to.equal(contractBalance);
    expect(await cash.balanceOf(user1.address)).to.equal(user1Balance);

    // 2/3 day time passing
    console.log("2/3 day time passing");
    await skipTime(Math.round((DAY_TIME * 2) / 3));

    // Match 2
    console.log("Begin match 2");

    await memberCard.connect(user2).buyCard();
    await cash.connect(user2).buyCash({ value: ethers.utils.parseEther("10") });
    await memberCard.connect(user3).buyCard();
    await cash.connect(user3).buyCash({ value: ethers.utils.parseEther("10") });

    user2Balance = user2Balance.add(ethers.utils.parseEther("10"));
    user3Balance = user3Balance.add(ethers.utils.parseEther("10"));

    await cash.connect(user1).approve(evenOdd.address, ethers.utils.parseEther("2"));
    await evenOdd.connect(user1).bet(true, ethers.utils.parseEther("2"));
    await cash.connect(user2).approve(evenOdd.address, ethers.utils.parseEther("1"));
    await evenOdd.connect(user2).bet(true, ethers.utils.parseEther("1"));
    await cash.connect(user3).approve(evenOdd.address, ethers.utils.parseEther("3"));
    await evenOdd.connect(user3).bet(false, ethers.utils.parseEther("3"));

    const decision21 = await evenOdd.decisionsOf(1, 0);
    expect(decision21.cardId, "CardId of user1 must be specified in user's decision").to.equal(await memberCard.cardIdOf(user1.address));
    expect(decision21.isOdd, "User's bet decision must be the same as user's decision").to.equal(true);
    expect(decision21.amount, "User's bet amount must equal to user's decision").to.equal(ethers.utils.parseEther("2"));

    contractBalance = contractBalance.add(decision21.amount);
    user1Balance = user1Balance.sub(decision21.amount);

    const decision22 = await evenOdd.decisionsOf(1, 1);
    expect(decision22.cardId, "CardId of user1 must be specified in user's decision").to.equal(await memberCard.cardIdOf(user2.address));
    expect(decision22.isOdd, "User's bet decision must be the same as user's decision").to.equal(true);
    expect(decision22.amount, "User's bet amount must equal to user's decision").to.equal(ethers.utils.parseEther("1"));

    contractBalance = contractBalance.add(decision22.amount);
    user2Balance = user2Balance.sub(decision22.amount);

    const decision23 = await evenOdd.decisionsOf(1, 2);
    expect(decision23.cardId, "CardId of user1 must be specified in user's decision").to.equal(await memberCard.cardIdOf(user3.address));
    expect(decision23.isOdd, "User's bet decision must be the same as user's decision").to.equal(false);
    expect(decision23.amount, "User's bet amount must equal to user's decision").to.equal(ethers.utils.parseEther("3"));

    contractBalance = contractBalance.add(decision23.amount);
    user3Balance = user3Balance.sub(decision23.amount);

    await evenOdd.play();
    const betResult2 = await evenOdd.matchResultOf(1);
    const betResult2IsOdd = betResult2.roll1.add(betResult2.roll2).mod(2) == 1;

    if (betResult2IsOdd == decision21.isOdd) {
      contractBalance = contractBalance.sub(decision21.amount.mul(2));
      user1Balance = user1Balance.add(decision21.amount.mul(2));
    }

    if (betResult2IsOdd == decision22.isOdd) {
      contractBalance = contractBalance.sub(decision22.amount.mul(2));
      user2Balance = user2Balance.add(decision22.amount.mul(2));
    }

    if (betResult2IsOdd == decision23.isOdd) {
      contractBalance = contractBalance.sub(decision23.amount.mul(2));
      user3Balance = user3Balance.add(decision23.amount.mul(2));
    }

    expect(await cash.balanceOf(evenOdd.address)).to.equal(contractBalance);
    expect(await cash.balanceOf(user1.address)).to.equal(user1Balance);
    expect(await cash.balanceOf(user2.address)).to.equal(user2Balance);
    expect(await cash.balanceOf(user3.address)).to.equal(user3Balance);

    // 2/3 day time passing
    console.log("2/3 day time passing");
    await skipTime(Math.round((DAY_TIME * 2) / 3));

    // Match 3
    console.log("Begin match 3");
    await cash.connect(user1).approve(evenOdd.address, ethers.utils.parseEther("3"));
    await expect(evenOdd.connect(user1).bet(true, ethers.utils.parseEther("3"))).revertedWith("This card is expired. Please buy a new one");
    await cash.connect(user2).approve(evenOdd.address, ethers.utils.parseEther("2"));
    await evenOdd.connect(user2).bet(false, ethers.utils.parseEther("2"));
    await cash.connect(user3).approve(evenOdd.address, ethers.utils.parseEther("2"));
    await evenOdd.connect(user3).bet(false, ethers.utils.parseEther("2"));

    const decision32 = await evenOdd.decisionsOf(2, 0);
    expect(decision32.cardId, "CardId of user1 must be specified in user's decision").to.equal(await memberCard.cardIdOf(user2.address));
    expect(decision32.isOdd, "User's bet decision must be the same as user's decision").to.equal(false);
    expect(decision32.amount, "User's bet amount must equal to user's decision").to.equal(ethers.utils.parseEther("2"));

    contractBalance = contractBalance.add(decision32.amount);
    user2Balance = user2Balance.sub(decision32.amount);

    const decision33 = await evenOdd.decisionsOf(2, 1);
    expect(decision33.cardId, "CardId of user1 must be specified in user's decision").to.equal(await memberCard.cardIdOf(user3.address));
    expect(decision33.isOdd, "User's bet decision must be the same as user's decision").to.equal(false);
    expect(decision33.amount, "User's bet amount must equal to user's decision").to.equal(ethers.utils.parseEther("2"));

    contractBalance = contractBalance.add(decision33.amount);
    user3Balance = user3Balance.sub(decision33.amount);

    await evenOdd.play();
    const betResult3 = await evenOdd.matchResultOf(2);
    const betResult3IsOdd = betResult3.roll1.add(betResult3.roll2).mod(2) == 1;

    if (betResult3IsOdd == decision32.isOdd) {
      contractBalance = contractBalance.sub(decision32.amount.mul(2));
      user2Balance = user2Balance.add(decision32.amount.mul(2));
    }

    if (betResult3IsOdd == decision33.isOdd) {
      contractBalance = contractBalance.sub(decision33.amount.mul(2));
      user3Balance = user3Balance.add(decision33.amount.mul(2));
    }

    expect(await cash.balanceOf(evenOdd.address)).to.equal(contractBalance);
    expect(await cash.balanceOf(user1.address)).to.equal(user1Balance);
    expect(await cash.balanceOf(user2.address)).to.equal(user2Balance);
    expect(await cash.balanceOf(user3.address)).to.equal(user3Balance);

    // User1 extend card period
    console.log("User1 extend card period");
    await memberCard.connect(user1).extendCardPeriod();

    expect(await memberCard.isExpired(user1.address)).to.be.false;

    // Match 4
    console.log("Begin match 4");
    await cash.connect(user1).approve(evenOdd.address, ethers.utils.parseEther("3"));
    await evenOdd.connect(user1).bet(true, ethers.utils.parseEther("3"));
    await cash.connect(user2).approve(evenOdd.address, ethers.utils.parseEther("1"));
    await evenOdd.connect(user2).bet(true, ethers.utils.parseEther("1"));
    await cash.connect(user3).approve(evenOdd.address, ethers.utils.parseEther("1"));
    await evenOdd.connect(user3).bet(true, ethers.utils.parseEther("1"));

    const decision41 = await evenOdd.decisionsOf(3, 0);
    expect(decision41.cardId, "CardId of user1 must be specified in user's decision").to.equal(await memberCard.cardIdOf(user1.address));
    expect(decision41.isOdd, "User's bet decision must be the same as user's decision").to.equal(true);
    expect(decision41.amount, "User's bet amount must equal to user's decision").to.equal(ethers.utils.parseEther("3"));

    contractBalance = contractBalance.add(decision41.amount);
    user1Balance = user1Balance.sub(decision41.amount);

    const decision42 = await evenOdd.decisionsOf(3, 1);
    expect(decision42.cardId, "CardId of user1 must be specified in user's decision").to.equal(await memberCard.cardIdOf(user2.address));
    expect(decision42.isOdd, "User's bet decision must be the same as user's decision").to.equal(true);
    expect(decision42.amount, "User's bet amount must equal to user's decision").to.equal(ethers.utils.parseEther("1"));

    contractBalance = contractBalance.add(decision42.amount);
    user2Balance = user2Balance.sub(decision42.amount);

    const decision43 = await evenOdd.decisionsOf(3, 2);
    expect(decision43.cardId, "CardId of user1 must be specified in user's decision").to.equal(await memberCard.cardIdOf(user3.address));
    expect(decision43.isOdd, "User's bet decision must be the same as user's decision").to.equal(true);
    expect(decision43.amount, "User's bet amount must equal to user's decision").to.equal(ethers.utils.parseEther("1"));

    contractBalance = contractBalance.add(decision43.amount);
    user3Balance = user3Balance.sub(decision43.amount);

    await evenOdd.play();
    const betResult4 = await evenOdd.matchResultOf(3);
    const betResult4IsOdd = betResult4.roll1.add(betResult4.roll2).mod(2) == 1;

    if (betResult4IsOdd == decision41.isOdd) {
      contractBalance = contractBalance.sub(decision41.amount.mul(2));
      user1Balance = user1Balance.add(decision41.amount.mul(2));
    }

    if (betResult4IsOdd == decision42.isOdd) {
      contractBalance = contractBalance.sub(decision42.amount.mul(2));
      user2Balance = user2Balance.add(decision42.amount.mul(2));
    }

    if (betResult4IsOdd == decision43.isOdd) {
      contractBalance = contractBalance.sub(decision43.amount.mul(2));
      user3Balance = user3Balance.add(decision43.amount.mul(2));
    }

    expect(await cash.balanceOf(evenOdd.address)).to.equal(contractBalance);
    expect(await cash.balanceOf(user1.address)).to.equal(user1Balance);
    expect(await cash.balanceOf(user2.address)).to.equal(user2Balance);
    expect(await cash.balanceOf(user3.address)).to.equal(user3Balance);

    // Users withdraw all token
    console.log("Users withdraw all token");

    const user1Profit = (await cash.balanceOf(user1.address)).sub(ethers.utils.parseEther("10"));
    const user2Profit = (await cash.balanceOf(user2.address)).sub(ethers.utils.parseEther("10"));
    const user3Profit = (await cash.balanceOf(user3.address)).sub(ethers.utils.parseEther("10"));

    await cash.connect(user1).withdraw(await cash.balanceOf(user1.address));
    await cash.connect(user2).withdraw(await cash.balanceOf(user2.address));
    await cash.connect(user3).withdraw(await cash.balanceOf(user3.address));

    const user1BalanceAfter = await ethers.provider.getBalance(user1.address);
    const user2BalanceAfter = await ethers.provider.getBalance(user2.address);
    const user3BalanceAfter = await ethers.provider.getBalance(user3.address);

    expect(user1BalanceAfter.sub(user1BalanceBefore)).to.closeTo(user1Profit, ethers.utils.parseEther("0.01"));
    expect(user2BalanceAfter.sub(user2BalanceBefore)).to.closeTo(user2Profit, ethers.utils.parseEther("0.01"));
    expect(user3BalanceAfter.sub(user3BalanceBefore)).to.closeTo(user3Profit, ethers.utils.parseEther("0.01"));
  });
});
