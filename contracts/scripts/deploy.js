const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const GreenToken = await hre.ethers.getContractFactory("GreenToken");
  // Minter = deployer by default; transfer later via transferMinter()
  const token = await GreenToken.deploy(deployer.address);
  await token.waitForDeployment();

  const address = await token.getAddress();
  console.log("GreenToken deployed to:", address);
  console.log("\nUpdate your backend .env:");
  console.log(`CONTRACT_ADDRESS=${address}`);
  console.log(`MINTER_PRIVATE_KEY=<deployer_private_key>`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
