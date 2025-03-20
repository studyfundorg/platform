// Import the ABI from your contract artifacts
export const studyFundAbi = [
  // Raffle-related functions
  'function currentRaffleId() view returns (uint256)',
  'function raffles(uint256) view returns (uint256 startTime, uint256 endTime, uint256 prizePool, uint256 donations, bool completed, uint256 requestId)',
  'function raffleTotalEntries(uint256) view returns (uint256)',
  'function selectWinners()',
  'function getRaffleWinners(uint256) view returns (address[])',
  'function getRaffleRunnerUps(uint256) view returns (address[])',

  // Events
  'event RaffleCompleted(uint256 indexed raffleId, address[] winners, uint256[] prizes)',
  'event PrizeCalculated(uint256 indexed raffleId, uint256 prizePool, uint256 percentage, uint256 calculatedPrize)',
];
