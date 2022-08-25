const hre = require("hardhat");
const { cash, memberCard, evenOdd } = require("../contracts.json");

async function main() {
  try {
    await hre.run("verify:verify", {
      address: cash,
      constructorArguments: [],
    });

    await hre.run("verify:verify", {
      address: memberCard,
      constructorArguments: [],
    });

    await hre.run("verify:verify", {
      address: evenOdd,
      constructorArguments: [memberCard, cash],
    });
  } catch (err) {
    console.error(err);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
