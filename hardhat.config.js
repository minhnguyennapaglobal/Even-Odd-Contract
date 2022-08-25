const { task } = require("hardhat/config");

// Loading env configs for deploying and public contract source
require("dotenv").config();

// Using hardhat-ethers plugin for deploying
// See here: https://hardhat.org/plugins/nomiclabs-hardhat-ethers.html
//           https://hardhat.org/guides/deploying.html
require("@nomiclabs/hardhat-ethers");

// Testing plugins with Waffle
// See here: https://hardhat.org/guides/waffle-testing.html
require("@nomiclabs/hardhat-waffle");

// This plugin runs solhint on the project's sources and prints the report
// See here: https://hardhat.org/plugins/nomiclabs-hardhat-solhint.html
require("@nomiclabs/hardhat-solhint");

// Verify and public source code on etherscan
require("@nomiclabs/hardhat-etherscan");

// Coverage testing
require("solidity-coverage");

// Call internal function
require("hardhat-exposed");

task("deploy", "Run deploy", async () => {
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

task("deploy-exposed", "Run deploy", async () => {
  [deployer, user1, user2] = await ethers.getSigners();

  const MemberCard = await ethers.getContractFactory("$MemberCard");
  memberCard = await MemberCard.deploy();
  console.log(`---> Contract MemberCard is deployed at ${memberCard.address}`);

  const Cash = await ethers.getContractFactory("$Cash");
  cash = await Cash.deploy();
  console.log(`---> Contract Cash is deployed at ${cash.address}`);

  const EvenOdd = await ethers.getContractFactory("$EvenOdd"); // Exposed this contract to test internal functions
  evenOdd = await EvenOdd.deploy(memberCard.address, cash.address);
  console.log(`---> Contract EvenOdd is deployed at ${evenOdd.address}`);

  // Add token to contract
  cash.$_mint(evenOdd.address, ethers.utils.parseEther("10"));
});

const config = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      accounts: { count: 10 },
      mining: { auto: true, interval: 1000 },
    },
    rinkeby: {
      url: process.env.RINKEBY_URL,
      accounts: [process.env.DEPLOY_ACCOUNT],
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  solidity: {
    compilers: [
      {
        version: "0.8.9",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
    deploy: "deploy",
    deployments: "deployments",
  },
  mocha: {
    timeout: 200000,
    useColors: true,
    reporter: "mocha-multi-reporters",
    reporterOptions: {
      configFile: "./mocha-report.json",
    },
  },
  exposed: { prefix: "$" },
};

module.exports = config;
