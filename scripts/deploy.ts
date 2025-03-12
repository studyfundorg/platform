import { ethers } from "hardhat";

async function main() {
  console.log("Deploying StudyFund contract...");

  // Get the deployer's address
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Deploy Mock USDT first (for testnet)
  console.log("Deploying Mock USDT...");
  const MockUSDT = await ethers.getContractFactory("MockERC20");
  const usdt = await MockUSDT.deploy("USDT", "USDT", 6);
  await usdt.waitForDeployment();
  const usdtAddress = await usdt.getAddress();
  console.log("Mock USDT deployed to:", usdtAddress);

  // Deploy StudyFund
  console.log("Deploying StudyFund...");
  const StudyFund = await ethers.getContractFactory("StudyFund");
  const studyFund = await StudyFund.deploy(
    usdtAddress,
    deployer.address // reserve wallet
  );
  await studyFund.waitForDeployment();
  const studyFundAddress = await studyFund.getAddress();
  console.log("StudyFund deployed to:", studyFundAddress);

  // Mint some initial USDT to the deployer (for testing)
  const mintAmount = ethers.parseUnits("100000", 6); // 100,000 USDT
  await usdt.mint(deployer.address, mintAmount);
  console.log("Minted", ethers.formatUnits(mintAmount, 6), "USDT to deployer");

  // Setup initial reserve
  const reserveAmount = ethers.parseUnits("10000", 6); // 10,000 USDT
  await usdt.approve(studyFundAddress, reserveAmount);
  await studyFund.depositToReserve(reserveAmount);
  console.log("Deposited", ethers.formatUnits(reserveAmount, 6), "USDT to reserve");

  console.log("\nDeployment Summary:");
  console.log("------------------");
  console.log("Network:", network.name);
  console.log("Mock USDT:", usdtAddress);
  console.log("StudyFund:", studyFundAddress);
  console.log("Reserve Wallet:", deployer.address);
  console.log("Initial Reserve:", ethers.formatUnits(reserveAmount, 6), "USDT");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 