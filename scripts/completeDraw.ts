import { ethers } from "hardhat";

async function main() {
  // Contract addresses
  const STUDY_FUND_ADDRESS = "0xBBe02596F093Ea9d4B6c942bB73C03c02B0D15E0";

  // Get the signer
  const [signer] = await ethers.getSigners();
  console.log("Using signer:", signer.address);

  // Get the StudyFund contract
  const StudyFund = await ethers.getContractFactory("StudyFund");
  const studyFund = StudyFund.attach(STUDY_FUND_ADDRESS);

  try {
    // Check if the signer has ADMIN_ROLE
    const ADMIN_ROLE = await studyFund.ADMIN_ROLE();
    const hasAdminRole = await studyFund.hasRole(ADMIN_ROLE, signer.address);
    
    if (!hasAdminRole) {
      throw new Error("Signer does not have ADMIN_ROLE");
    }

    // Get current raffle info before completing
    const currentRaffleId = await studyFund.currentRaffleId();
    const raffle = await studyFund.raffles(currentRaffleId);
    
    console.log("Current Raffle ID:", currentRaffleId.toString());
    console.log("Raffle donations:", ethers.formatUnits(raffle.donations, 6), "USDT");
    console.log("Raffle completed status:", raffle.completed);
    console.log("Raffle end time:", new Date(Number(raffle.endTime) * 1000).toLocaleString());
    console.log("Raffle startTime:", new Date(Number(raffle.startTime) * 1000).toLocaleString());
    console.log("Raffle winners:", raffle.winners.length);
    console.log("Raffle runner-ups:", raffle.runnerUps.length);

    // Complete the draw
    console.log("Completing draw...");
    const tx = await studyFund.selectWinners();
    console.log("Transaction sent:", tx.hash);
    
    // Wait for transaction to be mined
    const receipt = await tx.wait();
    console.log("Transaction confirmed in block:", receipt?.blockNumber);

    // Get winners and prizes
    const winners = await studyFund.getRaffleWinners(currentRaffleId);
    console.log("\nWinners:");
    for (let i = 0; i < winners.length; i++) {
      const prize = await studyFund.rafflePrizes(currentRaffleId, winners[i]);
      console.log(`${i + 1}. ${winners[i]} - ${ethers.formatUnits(prize, 6)} USDT`);
    }

    // Get runner-ups
    const runnerUps = await studyFund.getRaffleRunnerUps(currentRaffleId);
    console.log("\nRunner-ups:");
    for (let i = 0; i < runnerUps.length; i++) {
      console.log(`${i + 1}. ${runnerUps[i]}`);
    }

  } catch (error) {
    console.error("Error completing draw:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 