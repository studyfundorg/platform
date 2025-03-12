import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { StudyFund, MockERC20 } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("StudyFund", function () {
  // Test fixture setup
  async function deployStudyFundFixture() {
    const [owner, admin, scholarshipManager, donor1, donor2, student] = await ethers.getSigners();

    // Deploy mock USDT token
    const MockUSDT = await ethers.getContractFactory("MockERC20");
    const usdt = await MockUSDT.deploy("USDT", "USDT", 6);

    // Deploy StudyFund contract
    const StudyFund = await ethers.getContractFactory("StudyFund");
    const studyFund = await StudyFund.deploy(
      await usdt.getAddress(),
      await owner.getAddress() // reserve wallet
    );
    await studyFund.waitForDeployment();

    // Mint some USDT to donors for testing
    const mintAmount = ethers.parseUnits("10000", 6); // 10,000 USDT
    await usdt.mint(donor1.address, mintAmount);
    await usdt.mint(donor2.address, mintAmount);

    // Setup roles
    await studyFund.grantRole(await studyFund.ADMIN_ROLE(), admin.address);
    await studyFund.grantRole(await studyFund.SCHOLARSHIP_MANAGER_ROLE(), scholarshipManager.address);

    return {
      studyFund,
      usdt,
      owner,
      admin,
      scholarshipManager,
      donor1,
      donor2,
      student
    };
  }

  describe("Deployment", function () {
    it("Should set the correct initial state", async function () {
      const { studyFund, owner, usdt } = await loadFixture(deployStudyFundFixture);

      expect(await studyFund.currentRaffleId()).to.equal(1);
      expect(await studyFund.totalDonations()).to.equal(0);
      expect(await studyFund.reserveWallet()).to.equal(owner.address);
      expect(await studyFund.usdt()).to.equal(await usdt.getAddress());
    });

    it("Should set up correct roles", async function () {
      const { studyFund, owner, admin, scholarshipManager } = await loadFixture(
        deployStudyFundFixture
      );

      expect(await studyFund.hasRole(await studyFund.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
      expect(await studyFund.hasRole(await studyFund.ADMIN_ROLE(), admin.address)).to.be.true;
      expect(await studyFund.hasRole(await studyFund.SCHOLARSHIP_MANAGER_ROLE(), scholarshipManager.address)).to.be.true;
    });
  });

  describe("Donations", function () {
    it("Should accept donations and calculate entries correctly", async function () {
      const { studyFund, usdt, donor1 } = await loadFixture(deployStudyFundFixture);

      // Approve USDT spending
      const donationAmount = ethers.parseUnits("50", 6); // 50 USDT
      await usdt.connect(donor1).approve(await studyFund.getAddress(), donationAmount);

      // Make donation
      await expect(studyFund.connect(donor1).donate(donationAmount))
        .to.emit(studyFund, "DonationReceived")
        .withArgs(donor1.address, donationAmount, 6); // 50 USDT should give 6 entries

      // Check donor data
      const donor = await studyFund.donors(donor1.address);
      expect(donor[1].toString()).to.equal("6"); // Convert to string for comparison
    });

    it("Should reject donations below minimum tier", async function () {
      const { studyFund, usdt, donor1 } = await loadFixture(deployStudyFundFixture);

      const donationAmount = ethers.parseUnits("5", 6); // 5 USDT (below minimum)
      await usdt.connect(donor1).approve(await studyFund.getAddress(), donationAmount);

      await expect(studyFund.connect(donor1).donate(donationAmount))
        .to.be.revertedWith("Donation below minimum");
    });
  });

  describe("Raffle Management", function () {
    it("Should select winners when there are entries", async function () {
      const { studyFund, usdt, donor1, admin, owner } = await loadFixture(deployStudyFundFixture);

      // Add funds to reserve first
      const reserveAmount = ethers.parseUnits("10000", 6); // 10,000 USDT
      await usdt.mint(owner.address, reserveAmount);
      await usdt.connect(owner).approve(await studyFund.getAddress(), reserveAmount);
      await studyFund.connect(owner).depositToReserve(reserveAmount);

      // Make a donation first
      const donationAmount = ethers.parseUnits("100", 6); // 100 USDT
      await usdt.connect(donor1).approve(await studyFund.getAddress(), donationAmount);
      await studyFund.connect(donor1).donate(donationAmount);

      // Select winners
      await expect(studyFund.connect(admin).selectWinners())
        .to.emit(studyFund, "RaffleCompleted")
        .to.emit(studyFund, "RunnerUpsSelected")
        .to.emit(studyFund, "PrizeCalculated")
        .withArgs(1, ethers.parseUnits("5000", 6), 45, ethers.parseUnits("2250", 6));

      // Verify raffle completion
      const raffle = await studyFund.raffles(1);
      expect(raffle.completed).to.be.true;
      
      const winners = await studyFund.getRaffleWinners(1);
      const runnerUps = await studyFund.getRaffleRunnerUps(1);
      expect(winners.length).to.equal(5);
      expect(runnerUps.length).to.equal(5);

      // Verify prize distribution
      const totalPrizePool = ethers.parseUnits("5000", 6); // Minimum prize pool
      const firstPrizePct = 45;
      const expectedFirstPrize = (totalPrizePool * BigInt(firstPrizePct)) / BigInt(100);

      // Check if first winner has correct prize allocated
      const firstWinner = winners[0];
      if (firstWinner !== ethers.ZeroAddress) {
        const winnerPrize = await studyFund.rafflePrizes(1, firstWinner);
        console.log("Expected prize:", expectedFirstPrize.toString());
        console.log("Actual prize:", winnerPrize.toString());
        expect(winnerPrize).to.equal(expectedFirstPrize);
      }
    });

    it("Should revert winner selection when no entries exist", async function () {
      const { studyFund, admin } = await loadFixture(deployStudyFundFixture);

      await expect(studyFund.connect(admin).selectWinners())
        .to.be.revertedWith("No entries in raffle");
    });

    it("Should prevent selecting winners for completed raffle", async function () {
      const { studyFund, usdt, donor1, admin, owner } = await loadFixture(deployStudyFundFixture);

      // Add funds to reserve first
      const reserveAmount = ethers.parseUnits("10000", 6); // 10,000 USDT
      await usdt.mint(owner.address, reserveAmount);
      await usdt.connect(owner).approve(await studyFund.getAddress(), reserveAmount);
      await studyFund.connect(owner).depositToReserve(reserveAmount);

      // Make a donation and complete the raffle
      const donationAmount = ethers.parseUnits("100", 6);
      await usdt.connect(donor1).approve(await studyFund.getAddress(), donationAmount);
      await studyFund.connect(donor1).donate(donationAmount);
      await studyFund.connect(admin).selectWinners();

      // Try to select winners again for the new raffle
      await expect(studyFund.connect(admin).selectWinners())
        .to.be.revertedWith("No entries in raffle");
    });
  });

  describe("Scholarship Management", function () {
    it("Should award scholarship when funds are sufficient", async function () {
      const { studyFund, usdt, donor1, scholarshipManager, student } = await loadFixture(
        deployStudyFundFixture
      );

      // Make a large donation to ensure sufficient funds
      const donationAmount = ethers.parseUnits("5000", 6); // 5000 USDT
      await usdt.connect(donor1).approve(await studyFund.getAddress(), donationAmount);
      await studyFund.connect(donor1).donate(donationAmount);

      // Award scholarship
      const scholarshipAmount = ethers.parseUnits("2000", 6); // 2000 USDT
      await expect(studyFund.connect(scholarshipManager).awardScholarship(student.address, scholarshipAmount))
        .to.emit(studyFund, "ScholarshipAwarded")
        .withArgs(student.address, scholarshipAmount);
    });

    it("Should use reserve funds when scholarship balance is below minimum", async function () {
      const { studyFund, usdt, owner, scholarshipManager, student } = await loadFixture(
        deployStudyFundFixture
      );

      // Add funds to reserve
      const reserveAmount = ethers.parseUnits("3000", 6); // 3000 USDT
      await usdt.mint(owner.address, reserveAmount);
      await usdt.connect(owner).approve(await studyFund.getAddress(), reserveAmount);
      await studyFund.connect(owner).depositToReserve(reserveAmount);

      // Award scholarship when main balance is low
      const scholarshipAmount = ethers.parseUnits("2000", 6); // 2000 USDT
      await expect(studyFund.connect(scholarshipManager).awardScholarship(student.address, scholarshipAmount))
        .to.emit(studyFund, "ScholarshipAwarded")
        .withArgs(student.address, scholarshipAmount);
    });
  });

  describe("Reserve Management", function () {
    it("Should allow deposits to reserve", async function () {
      const { studyFund, usdt, admin } = await loadFixture(deployStudyFundFixture);

      const depositAmount = ethers.parseUnits("1000", 6); // 1000 USDT
      await usdt.mint(admin.address, depositAmount);
      await usdt.connect(admin).approve(await studyFund.getAddress(), depositAmount);

      await expect(studyFund.connect(admin).depositToReserve(depositAmount))
        .to.emit(studyFund, "ReserveDeposited")
        .withArgs(admin.address, depositAmount);

      expect(await studyFund.reserveBalance()).to.equal(depositAmount);
    });

    it("Should allow updating reserve wallet", async function () {
      const { studyFund, admin, student } = await loadFixture(deployStudyFundFixture);

      const oldWallet = await studyFund.reserveWallet();
      
      await expect(studyFund.connect(admin).setReserveWallet(student.address))
        .to.emit(studyFund, "ReserveWalletUpdated")
        .withArgs(oldWallet, student.address);

      expect(await studyFund.reserveWallet()).to.equal(student.address);
    });
  });

  describe("Emergency Controls", function () {
    it("Should allow pausing and unpausing by admin", async function () {
      const { studyFund, admin, donor1, usdt } = await loadFixture(deployStudyFundFixture);

      // Pause the contract
      await studyFund.connect(admin).pause();
      expect(await studyFund.paused()).to.be.true;

      // Try to donate while paused
      const donationAmount = ethers.parseUnits("50", 6);
      await usdt.connect(donor1).approve(await studyFund.getAddress(), donationAmount);
      await expect(studyFund.connect(donor1).donate(donationAmount))
        .to.be.revertedWithCustomError(
          studyFund,
          "EnforcedPause");

      // Unpause and verify donation works
      await studyFund.connect(admin).unpause();
      expect(await studyFund.paused()).to.be.false;
      await expect(studyFund.connect(donor1).donate(donationAmount))
        .to.not.be.reverted;
    });
  });

  describe("Raffle Winner Selection", function () {
    it("Should select winners and distribute prizes correctly", async function () {
      const { studyFund, usdt, donor1, donor2, admin, owner } = await loadFixture(
        deployStudyFundFixture
      );

      // First add sufficient funds to reserve
      const reserveAmount = ethers.parseUnits("10000", 6); // 10,000 USDT
      await usdt.mint(owner.address, reserveAmount);
      await usdt.connect(owner).approve(await studyFund.getAddress(), reserveAmount);
      await studyFund.connect(owner).depositToReserve(reserveAmount);

      // Make donations from multiple donors
      const donationAmount1 = ethers.parseUnits("100", 6); // 100 USDT = 15 entries
      const donationAmount2 = ethers.parseUnits("50", 6);  // 50 USDT = 6 entries
      
      await usdt.connect(donor1).approve(await studyFund.getAddress(), donationAmount1);
      await usdt.connect(donor2).approve(await studyFund.getAddress(), donationAmount2);
      
      await studyFund.connect(donor1).donate(donationAmount1);
      await studyFund.connect(donor2).donate(donationAmount2);

      // Select winners
      await expect(studyFund.connect(admin).selectWinners())
        .to.emit(studyFund, "RaffleCompleted")
        .to.emit(studyFund, "RunnerUpsSelected")
        .to.emit(studyFund, "PrizeCalculated")
        .withArgs(1, ethers.parseUnits("5000", 6), 45, ethers.parseUnits("2250", 6));

      // Verify raffle completion
      const raffle = await studyFund.raffles(1);
      expect(raffle.completed).to.be.true;
      
      const winners = await studyFund.getRaffleWinners(1);
      const runnerUps = await studyFund.getRaffleRunnerUps(1);
      expect(winners.length).to.equal(5);
      expect(runnerUps.length).to.equal(5);

      // Verify prize distribution
      const totalPrizePool = ethers.parseUnits("5000", 6); // Minimum prize pool
      const firstPrizePct = 45;
      const expectedFirstPrize = (totalPrizePool * BigInt(firstPrizePct)) / BigInt(100);

      // Check if first winner has correct prize allocated
      const firstWinner = winners[0];
      if (firstWinner !== ethers.ZeroAddress) {
        const winnerPrize = await studyFund.rafflePrizes(1, firstWinner);
        console.log("Expected prize:", expectedFirstPrize.toString());
        console.log("Actual prize:", winnerPrize.toString());
        expect(winnerPrize).to.equal(expectedFirstPrize);
      }
    });

    it("Should allow winners to claim prizes", async function () {
      const { studyFund, usdt, donor1, admin, owner } = await loadFixture(
        deployStudyFundFixture
      );

      // Setup reserve and make donation
      const reserveAmount = ethers.parseUnits("10000", 6);
      await usdt.mint(owner.address, reserveAmount);
      await usdt.connect(owner).approve(await studyFund.getAddress(), reserveAmount);
      await studyFund.connect(owner).depositToReserve(reserveAmount);

      const donationAmount = ethers.parseUnits("100", 6);
      await usdt.connect(donor1).approve(await studyFund.getAddress(), donationAmount);
      await studyFund.connect(donor1).donate(donationAmount);

      // Select winners
      await studyFund.connect(admin).selectWinners();

      // Get first winner
      const winners = await studyFund.getRaffleWinners(1);
      const winner = winners[0];

      if (winner !== ethers.ZeroAddress) {
        const initialBalance = await usdt.balanceOf(winner);
        await studyFund.connect(await ethers.getSigner(winner)).claimPrize();
        const finalBalance = await usdt.balanceOf(winner);
        expect(finalBalance).to.be.gt(initialBalance);
      }
    });
  });
}); 
