import { BigInt, Address } from '@graphprotocol/graph-ts';
import {
  DonationReceived,
  RaffleCompleted,
  ScholarshipAwarded,
  PrizesClaimed,
  RunnerUpsSelected
} from '../generated/StudyFund/StudyFund';
import { Donor, Donation, Raffle, RafflePrize, Scholarship, History, ClaimedPrize } from '../generated/schema';

export function handleDonationReceived(event: DonationReceived): void {
  // Get or create donor
  let donorId = event.params.donor.toHexString();
  let donor = Donor.load(donorId);
  
  if (!donor) {
    donor = new Donor(donorId);
    donor.address = donorId;
    donor.totalDonated = BigInt.fromI32(0);
    donor.entries = BigInt.fromI32(0);
    donor.totalRewards = BigInt.fromI32(0);
    donor.unclaimedRewards = BigInt.fromI32(0);
    donor.createdAt = event.block.timestamp;
    donor.updatedAt = event.block.timestamp;
  }
  
  // Update donor data
  donor.totalDonated = donor.totalDonated.plus(event.params.amount);
  donor.entries = donor.entries.plus(event.params.entries);
  donor.updatedAt = event.block.timestamp;
  donor.save();
  
  // Create donation
  let donationId = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  let donation = new Donation(donationId);
  donation.donor = donorId;
  donation.amount = event.params.amount;
  donation.entries = event.params.entries;
  donation.timestamp = event.block.timestamp;
  donation.blockNumber = event.block.number;
  donation.transactionHash = event.transaction.hash.toHexString();
  donation.save();

  // Create history entry
  let historyId = event.transaction.hash.toHexString() + '-' + event.logIndex.toString() + '-history';
  let history = new History(historyId);
  history.donor = donorId;
  history.timestamp = event.block.timestamp;
  history.donation = donationId;
  history.transactionHash = event.transaction.hash.toHexString();
  history.type = "Donation";
  history.amount = event.params.amount;
  history.save();
}

export function handleRaffleCompleted(event: RaffleCompleted): void {
  let raffleId = event.params.raffleId.toString();
  let raffle = Raffle.load(raffleId);
  
  if (!raffle) {
    raffle = new Raffle(raffleId);
    raffle.startTime = BigInt.fromI32(0); // We don't have this info in the event
    raffle.endTime = event.block.timestamp;
    raffle.prizePool = BigInt.fromI32(0); // Will be calculated from prizes
    raffle.donations = BigInt.fromI32(0);
    raffle.winners = [];
    raffle.completed = false;
    raffle.createdAt = event.block.timestamp;
  }
  
  // Update raffle data
  let winners = event.params.winners;
  let prizes = event.params.prizes;
  let winnerAddresses: string[] = [];
  let totalPrizePool = BigInt.fromI32(0);
  
  for (let i = 0; i < winners.length; i++) {
    let winnerAddress = winners[i].toHexString();
    winnerAddresses.push(winnerAddress);
    
    // Create raffle prize
    let prizeId = raffleId + '-' + i.toString() + '-' + winnerAddress;
    let prize = new RafflePrize(prizeId);
    prize.raffle = raffleId;
    prize.winner = winnerAddress;
    prize.amount = prizes[i];
    prize.transactionHash = event.transaction.hash.toHexString();
    prize.save();
    
    totalPrizePool = totalPrizePool.plus(prizes[i]);

    // Create history entry
    let historyId = event.transaction.hash.toHexString() + '-' + i.toString() + '-' + raffleId + '-history';
    let history = new History(historyId);
    history.donor = winnerAddress;
    history.timestamp = event.block.timestamp;
    history.reward = prizeId;
    history.raffle = raffleId;
    history.transactionHash = event.transaction.hash.toHexString();
    history.type = "Reward";
    history.amount = prizes[i];
    history.save();

    const donor = Donor.load(winnerAddress);
    if (donor) {
      donor.totalRewards = donor.totalRewards.plus(prizes[i]);
      donor.unclaimedRewards = donor.unclaimedRewards.plus(prizes[i]);
      donor.save();
    }
  }
  
  raffle.winners = winnerAddresses;
  raffle.prizePool = totalPrizePool;
  raffle.completed = true;
  raffle.completedAt = event.block.timestamp;
  raffle.save();
}

export function handleScholarshipAwarded(event: ScholarshipAwarded): void {
  let scholarshipId = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  let scholarship = new Scholarship(scholarshipId);
  
  scholarship.recipient = event.params.recipient.toHexString();
  scholarship.amount = event.params.amount;
  scholarship.timestamp = event.block.timestamp;
  scholarship.blockNumber = event.block.number;
  scholarship.transactionHash = event.transaction.hash.toHexString();
  
  scholarship.save();
}

export function handlePrizesClaimed(event: PrizesClaimed): void {
  let raffleId = event.params.raffleId.toString();
  let winnerAddress = event.params.winner.toHexString();

  const claimedPrizeId = winnerAddress + '-' + raffleId;
  let claimedPrize = ClaimedPrize.load(claimedPrizeId);
  if (!claimedPrize) {
    claimedPrize = new ClaimedPrize(claimedPrizeId);
    claimedPrize.donor = winnerAddress;
    claimedPrize.amount = event.params.amount;
    claimedPrize.timestamp = event.block.timestamp;
    claimedPrize.transactionHash = event.transaction.hash.toHexString();
    claimedPrize.save();
  }
  
  const donor = Donor.load(winnerAddress);
  if (donor) {
    donor.unclaimedRewards = donor.unclaimedRewards.minus(event.params.amount);
    donor.save();
  }
  
  
}

export function handleRunnerUpsSelected(event: RunnerUpsSelected): void {
  let raffleId = event.params.raffleId.toString();
  let raffle = Raffle.load(raffleId);
  
  if (raffle) {
    let runnerUps = event.params.runnerUps.map<string>(address => address.toHexString());
    raffle.runnerUps = runnerUps;
    raffle.save();
  }
} 