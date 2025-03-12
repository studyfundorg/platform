import { ethers } from "hardhat";

async function main() {
  // Deploy StudyFund contract
  const StudyFund = await ethers.getContractFactory("StudyFund");
  
  // Replace these values with actual addresses and parameters for your network
  const USDT_ADDRESS = "0x..."; // USDT contract address
  const VRF_COORDINATOR = "0x..."; // Chainlink VRF Coordinator address
  const KEY_HASH = "0x..."; // VRF keyhash
  const SUBSCRIPTION_ID = "1"; // Your Chainlink VRF subscription ID

  const studyFund = await StudyFund.deploy(
    USDT_ADDRESS,
    VRF_COORDINATOR,
    KEY_HASH,
    SUBSCRIPTION_ID
  );

  await studyFund.deployed();
  console.log("StudyFund deployed to:", studyFund.address);

  // Deploy ScholarshipNFT contract
  const ScholarshipNFT = await ethers.getContractFactory("ScholarshipNFT");
  const scholarshipNFT = await ScholarshipNFT.deploy();

  await scholarshipNFT.deployed();
  console.log("ScholarshipNFT deployed to:", scholarshipNFT.address);

  // Grant MINTER_ROLE to StudyFund contract
  const MINTER_ROLE = await scholarshipNFT.MINTER_ROLE();
  await scholarshipNFT.grantRole(MINTER_ROLE, studyFund.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });