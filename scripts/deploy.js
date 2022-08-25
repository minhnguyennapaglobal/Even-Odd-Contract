const fs = require("fs");
const hardhat = require("hardhat");
const { ethers } = hardhat;

async function main() {
  // Loading accounts
  const accounts = await ethers.getSigners();
  const addresses = accounts.map((item) => item.address);
  const deployer = addresses[0];

  // Get contracts
  const Cash = await ethers.getContractFactory("Cash");
  const MemberCard = await ethers.getContractFactory("MemberCard");
  const EvenOdd = await ethers.getContractFactory("EvenOdd");
  //...

  console.log(`===DEPLOY CONTRACT TO: ${hardhat.network.name}===`);

  cash = await Cash.deploy();
  await cash.deployed();
  console.log("Cash contract deployed to ", cash.address);

  memberCard = await MemberCard.deploy();
  await memberCard.deployed();
  console.log("MemberCard contract deployed to ", memberCard.address);

  evenOdd = await EvenOdd.deploy(memberCard.address, cash.address, { value: ethers.utils.parseEther("100") });
  await evenOdd.deployed();
  console.log("EvenOdd contract deployed to ", evenOdd.address);

  // export deployed contracts to json
  const verifyArguments = {
    deployer: deployer,
    cash: cash.address,
    memberCard: memberCard.address,
    evenOdd: evenOdd.address,
  };

  fs.writeFileSync("../EvenOddDApp/src/assets/contracts/deployInfo.json", JSON.stringify(verifyArguments));
  fs.writeFileSync("deployInfo.json", JSON.stringify(verifyArguments));

  const unlinkTask = [];
  unlinkTask.push(fs.unlink("../EvenOddDApp/src/assets/contracts/Cash.json", (err) => console.error(err)));
  unlinkTask.push(fs.unlink("../EvenOddDApp/src/assets/contracts/MemberCard.json", (err) => console.error(err)));
  unlinkTask.push(fs.unlink("../EvenOddDApp/src/assets/contracts/EvenOdd.json", (err) => console.error(err)));

  await Promise.all(unlinkTask);
  fs.copyFileSync("artifacts/contracts/Cash.sol/Cash.json", "../EvenOddDApp/src/assets/contracts/Cash.json");
  fs.copyFileSync("artifacts/contracts/MemberCard.sol/MemberCard.json", "../EvenOddDApp/src/assets/contracts/MemberCard.json");
  fs.copyFileSync("artifacts/contracts/EvenOdd.sol/EvenOdd.json", "../EvenOddDApp/src/assets/contracts/EvenOdd.json");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
