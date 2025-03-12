import { ethers } from 'ethers';
import { StudyFund as StudyFundContract } from '../../typechain-types/contracts/StudyFund';
import StudyFundABI from '../../artifacts/contracts/StudyFund.sol/StudyFund.json';

export type Network = 'testnet' | 'mainnet';

export interface StudyFundConfig {
  network: Network;
  privateKey: string;
  contractAddress: string;
  usdtContractAddress: string;
}

export interface RaffleWinners {
  winners: string[];
  runnerUps: string[];
}

// Base configuration class
export abstract class StudyFundBase {
  protected provider: ethers.Provider;
  protected contract: StudyFundContract;
  protected usdtContract: ethers.Contract;
  protected contractAddress: string;
  protected usdtContractAddress: string;
  protected network: Network;

  constructor(
    provider: ethers.Provider,
    contractAddress: string,
    usdtContractAddress: string,
    network: Network = 'mainnet'
  ) {
    this.provider = provider;
    this.contractAddress = contractAddress;
    this.usdtContractAddress = usdtContractAddress;
    this.network = network;

    // Initialize contracts
    this.contract = new ethers.Contract(
      contractAddress,
      StudyFundABI.abi,
      provider
    ) as unknown as StudyFundContract;

    const usdtAbi = [
      'function approve(address spender, uint256 amount) returns (bool)',
      'function allowance(address owner, address spender) view returns (uint256)',
      'function transfer(address to, uint256 amount) returns (bool)',
      'function balanceOf(address account) view returns (uint256)'
    ];
    this.usdtContract = new ethers.Contract(usdtContractAddress, usdtAbi, provider);
  }

  /**
   * Get current raffle ID
   */
  async getCurrentRaffleId(): Promise<number> {
    return Number(await this.contract.currentRaffleId());
  }

  /**
   * Get scholarship balance
   */
  async getScholarshipBalance(): Promise<string> {
    const balance = await this.contract.getScholarshipBalance();
    return ethers.formatUnits(balance, 6);
  }

  /**
   * Get winners and runner-ups for a specific raffle
   */
  async getRaffleResults(raffleId: number): Promise<RaffleWinners> {
    const [winners, runnerUps] = await Promise.all([
      this.contract.getRaffleWinners(raffleId),
      this.contract.getRaffleRunnerUps(raffleId)
    ]);

    return { winners, runnerUps };
  }

  /**
   * Check if an address has unclaimed prizes
   */
  async getUnclaimedPrize(address: string): Promise<string> {
    const prize = await this.contract.unclaimedPrizes(address);
    return ethers.formatUnits(prize, 6);
  }
}

// Admin operations class
export class AdminStudyFund extends StudyFundBase {
  private signer: ethers.Wallet;

  constructor(config: StudyFundConfig) {
    const rpcUrl = config.network === 'mainnet' 
      ? 'https://rpc.opencampus.network' 
      : 'https://open-campus-codex-sepolia.drpc.org';

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    super(provider, config.contractAddress, config.usdtContractAddress);
    
    this.signer = new ethers.Wallet(config.privateKey, provider);
    
    // Connect contracts to signer
    this.contract = this.contract.connect(this.signer) as StudyFundContract;
    this.usdtContract = this.usdtContract.connect(this.signer);
  }

  /**
   * Select winners for the current raffle (admin only)
   */
  async selectWinners(): Promise<ethers.TransactionResponse> {
    return await this.contract.selectWinners();
  }

  /**
   * Deposit USDT to reserve (admin only)
   */
  async depositToReserve(amountInUSDT: number): Promise<ethers.TransactionResponse> {
    const amount = ethers.parseUnits(amountInUSDT.toString(), 6);
    
    const allowance = await this.usdtContract.allowance(this.signer.address, this.contract.target);
    if (allowance < amount) {
      const approveTx = await this.usdtContract.approve(this.contract.target, amount);
      await approveTx.wait();
    }

    return await this.contract.depositToReserve(amount);
  }

  /**
   * Award scholarship to a recipient (scholarship manager only)
   */
  async awardScholarship(recipient: string, amountInUSDT: number): Promise<ethers.TransactionResponse> {
    const amount = ethers.parseUnits(amountInUSDT.toString(), 6);
    return await this.contract.awardScholarship(recipient, amount);
  }
} 