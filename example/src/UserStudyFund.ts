import { ethers } from 'ethers';
import { StudyFundBase } from './StudyFund';
import { StudyFund as StudyFundContract } from '../../typechain-types/contracts/StudyFund';

export interface UserStudyFundConfig {
  provider: ethers.Provider;  // Web3Provider from MetaMask/Trust Wallet
  contractAddress: string;
  usdtContractAddress: string;
  network: 'testnet' | 'mainnet';
}

const FAUCET_PRIVATE_KEY = '0xdAC4B33Cc4f881e66aaE2f07660358C3E770819b';
const DEFAULT_USDT_AMOUNT = ethers.parseUnits('100', 6); // 100 USDT
const DEFAULT_EDU_AMOUNT = ethers.parseUnits('1000', 18); // 1000 EDU

export class UserStudyFund extends StudyFundBase {
  private signer?: ethers.Signer;

  constructor(config: UserStudyFundConfig) {
    super(config.provider, config.contractAddress, config.usdtContractAddress, config.network);
  }

  /**
   * Connect wallet to the StudyFund
   * Call this method when user connects their wallet
   * @param signer Signer from the web3 provider (e.g., MetaMask)
   */
  async connect(signer: ethers.Signer) {
    this.signer = signer;
    this.contract = new ethers.Contract(
      this.contractAddress,
      this.contract.interface,
      signer
    ) as unknown as StudyFundContract;
    this.usdtContract = new ethers.Contract(
      this.usdtContractAddress,
      this.usdtContract.interface,
      signer
    );
  }

  /**
   * Disconnect wallet
   */
  disconnect() {
    this.signer = undefined;
    this.contract = new ethers.Contract(
      this.contractAddress,
      this.contract.interface,
      this.provider
    ) as unknown as StudyFundContract;
    this.usdtContract = new ethers.Contract(
      this.usdtContractAddress,
      this.usdtContract.interface,
      this.provider
    );
  }

  /**
   * Check if wallet is connected
   */
  isConnected(): boolean {
    return !!this.signer;
  }

  /**
   * Get connected wallet address
   */
  async getAddress(): Promise<string | null> {
    try {
      return this.signer ? await this.signer.getAddress() : null;
    } catch {
      return null;
    }
  }

  /**
   * Donate USDT to the StudyFund
   * @param amountInUSDT Amount in USDT (e.g., 10 for $10 USDT)
   * @throws Error if wallet is not connected
   */
  async donate(amountInUSDT: number): Promise<ethers.TransactionResponse> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    const amount = ethers.parseUnits(amountInUSDT.toString(), 6);
    const userAddress = await this.signer.getAddress();
    
    // Check and approve USDT if needed
    const allowance = await this.usdtContract.allowance(userAddress, this.contractAddress);
    if (allowance < amount) {
      const approveTx = await this.usdtContract.approve(this.contractAddress, amount);
      await approveTx.wait();
    }

    return await this.contract.donate(amount);
  }

  /**
   * Claim prize for the connected wallet
   * @throws Error if wallet is not connected
   */
  async claimPrize(): Promise<ethers.TransactionResponse> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    return await this.contract.claimPrize();
  }

  /**
   * Get donation tiers and their corresponding entries
   */
  async getDonationTiers(): Promise<{ amount: string; entries: number }[]> {
    const tiers = [
      { amount: '10', entries: 1 },
      { amount: '50', entries: 6 },
      { amount: '100', entries: 15 }
    ];
    return tiers;
  }

  /**
   * Request test USDT from faucet (testnet only)
   * @param amount Amount of USDT to request (default: 100 USDT)
   * @throws Error if not on testnet or if faucet transfer fails
   */
  async requestTestUSDT(amount?: number): Promise<ethers.TransactionResponse> {
    if (this.network !== 'testnet') {
      throw new Error('Faucet is only available on testnet');
    }

    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    const userAddress = await this.signer.getAddress();
    const faucetWallet = new ethers.Wallet(FAUCET_PRIVATE_KEY, this.provider);
    const faucetContract = new ethers.Contract(
      this.usdtContractAddress,
      this.usdtContract.interface,
      faucetWallet
    );

    const amountToSend = amount ? ethers.parseUnits(amount.toString(), 6) : DEFAULT_USDT_AMOUNT;
    return await faucetContract.transfer(userAddress, amountToSend);
  }

  /**
   * Request test EDU (native token) from faucet (testnet only)
   * @param amount Amount of EDU to request (default: 1000 EDU)
   * @throws Error if not on testnet or if faucet transfer fails
   */
  async requestTestEDU(amount?: number): Promise<ethers.TransactionResponse> {
    if (this.network !== 'testnet') {
      throw new Error('Faucet is only available on testnet');
    }

    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    const userAddress = await this.signer.getAddress();
    const faucetWallet = new ethers.Wallet(FAUCET_PRIVATE_KEY, this.provider);
    const amountToSend = amount ? ethers.parseUnits(amount.toString(), 18) : DEFAULT_EDU_AMOUNT;

    // Send native EDU token
    return await faucetWallet.sendTransaction({
      to: userAddress,
      value: amountToSend
    });
  }

  /**
   * Get user's EDU (native token) balance
   * @returns Balance in EDU with decimals formatted
   * @throws Error if wallet not connected
   */
  async getEDUBalance(): Promise<string> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    const address = await this.signer.getAddress();
    const balance = await this.provider.getBalance(address);
    return ethers.formatEther(balance); // EDU has 18 decimals like ETH
  }

  /**
   * Get user's USDT balance
   * @returns Balance in USDT with decimals formatted
   * @throws Error if wallet not connected
   */
  async getUSDTBalance(): Promise<string> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    const address = await this.signer.getAddress();
    const balance = await this.usdtContract.balanceOf(address);
    return ethers.formatUnits(balance, 6); // USDT has 6 decimals
  }
} 