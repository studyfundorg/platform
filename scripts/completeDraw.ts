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
    console.log("Successfully got currentRaffleId:", currentRaffleId.toString());

    const raffle = await studyFund.raffles(currentRaffleId);
    console.log("Raw raffle data:", raffle);
    
    console.log("\nRaffle Details:");
    console.log("Current Raffle ID:", currentRaffleId.toString());
    console.log("Raffle donations:", ethers.formatUnits(raffle.donations, 6), "USDT");
    console.log("Raffle completed status:", raffle.completed);
    console.log("Raffle end time:", new Date(Number(raffle.endTime) * 1000).toLocaleString());
    console.log("Raffle startTime:", new Date(Number(raffle.startTime) * 1000).toLocaleString());

    // Only try to access winners and runnerUps if they exist
    if (raffle.winners) {
      console.log("Raffle winners:", raffle.winners.length);
    } else {
      console.log("No winners array in raffle data");
    }

    if (raffle.runnerUps) {
      console.log("Raffle runner-ups:", raffle.runnerUps.length);
    } else {
      console.log("No runnerUps array in raffle data");
    }

    // Complete the draw
    console.log("\nCompleting draw...");
    const tx = await studyFund.selectWinners();
    console.log("Transaction sent:", tx.hash);
    
    // Wait for transaction to be mined
    const receipt = await tx.wait();
    console.log("Transaction confirmed in block:", receipt?.blockNumber);

    // Get winners and prizes
    const winners = await studyFund.getRaffleWinners(currentRaffleId);
    console.log("\nWinners:", winners);
    
    if (winners && winners.length > 0) {
      for (let i = 0; i < winners.length; i++) {
        const prize = await studyFund.rafflePrizes(currentRaffleId, winners[i]);
        console.log(`${i + 1}. ${winners[i]} - ${ethers.formatUnits(prize, 6)} USDT`);
      }
    } else {
      console.log("No winners found after draw");
    }

    // Get runner-ups
    const runnerUps = await studyFund.getRaffleRunnerUps(currentRaffleId);
    console.log("\nRunner-ups:", runnerUps);
    
    if (runnerUps && runnerUps.length > 0) {
      for (let i = 0; i < runnerUps.length; i++) {
        console.log(`${i + 1}. ${runnerUps[i]}`);
      }
    } else {
      console.log("No runner-ups found after draw");
    }

  } catch (error) {
    console.error("Error completing draw:", error);
    // Log more details about the error
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 