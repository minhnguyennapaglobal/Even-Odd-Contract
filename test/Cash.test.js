const { ethers } = require("hardhat");
const { expect } = require("chai");

describe("Test cases of Cash: ", () => {
  beforeEach(async () => {
    [deployer, user1, user2] = await ethers.getSigners();

    const Cash = await ethers.getContractFactory("Cash");
    cash = await Cash.deploy();
    console.log(`---> Contract Cash is deployed at ${cash.address}`);
  });

  describe("Test 'buyCash' function", () => {
    it("Anyone can buy cash", async () => {
      const user1BalanceBefore = await ethers.provider.getBalance(user1.address);
      await cash.connect(user1).buyCash({ value: ethers.utils.parseEther("10") });
      const user1BalanceAfter = await ethers.provider.getBalance(user1.address);

      expect((user1BalanceBefore - user1BalanceAfter) / 10 ** 18, "User's ethers must be decrease after buy tokens").to.closeTo(10, 0.001);
      expect(await cash.balanceOf(user1.address), "Tokens after buy must be equal to ethers spent").to.equal(ethers.utils.parseEther("10"));

      const user2BalanceBefore = await ethers.provider.getBalance(user2.address);
      await cash.connect(user2).buyCash({ value: ethers.utils.parseEther("10") });
      const user2BalanceAfter = await ethers.provider.getBalance(user2.address);

      expect((user2BalanceBefore - user2BalanceAfter) / 10 ** 18, "User's ethers must be decrease after buy tokens").to.closeTo(10, 0.001);
      expect(await cash.balanceOf(user2.address), "Tokens after buy must be equal to ethers spent").to.equal(ethers.utils.parseEther("10"));
    });
  });

  describe("Test 'buyCash' function", () => {
    it("User can't withdraw tokens with lower remaining tokens", async () => {
      await cash.connect(user1).buyCash({ value: ethers.utils.parseEther("10") });
      await expect(cash.connect(user1).withdraw(ethers.utils.parseEther("12"))).revertedWith("Not enough money to convert from your tokens");
    });

    it("User can withdraw tokens successfully", async () => {
      const userBalanceBefore = await ethers.provider.getBalance(user1.address);
      await cash.connect(user1).buyCash({ value: ethers.utils.parseEther("10") });
      await cash.connect(user1).withdraw(ethers.utils.parseEther("8"));

      const userBalanceAfter = await ethers.provider.getBalance(user1.address);
      const remainingTokens = await cash.balanceOf(user1.address);

      expect((userBalanceBefore - userBalanceAfter) / 10 ** 18, "User buy 10 ether, withdraw 8 ether. In total, user spent 2 ethers").to.closeTo(2, 0.001);
      expect(remainingTokens, "User buy 10 ether token, withdraw 8 ether token, the remaining should be equal to 2 ether token").to.equal(ethers.utils.parseEther("2"));
    });
  });
});
