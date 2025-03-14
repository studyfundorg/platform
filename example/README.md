# StudyFund TypeScript Integration

This package provides TypeScript wrappers for the StudyFund smart contract, making it easy to interact with the contract from both backend and frontend applications.

## Prerequisites

- ethers.js v6 or higher
- TypeScript support
- Access to OpenCampus network (mainnet or testnet)

## Installation

1. Copy the following files into your project:
   - `StudyFund.ts` (base and admin operations)
   - `UserStudyFund.ts` (user operations with wallet support)

The required contract artifacts are already included in the example folder:
   - `artifacts/contracts/StudyFund.sol/StudyFund.json`
   - `typechain-types/contracts/StudyFund.ts`

## Usage

### Frontend Usage with Privy Embedded Wallet

```typescript
import { UserStudyFund } from './UserStudyFund';
import { ethers } from 'ethers';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useState, useEffect, useMemo } from 'react';

function StudyFundComponent() {
  const { ready, authenticated, user, login } = usePrivy();
  const { wallets } = useWallets();
  const [signer, setSigner] = useState<ethers.Signer | null>(null);

  // Create StudyFund instance with useMemo to prevent unnecessary re-creation
  const studyFund = useMemo(() => {
    const provider = new ethers.JsonRpcProvider(process.env.REACT_APP_RPC_URL);
    return new UserStudyFund({
      provider,
      network: 'testnet',
      contractAddress: process.env.REACT_APP_CONTRACT_ADDRESS!,
      usdtContractAddress: process.env.REACT_APP_USDT_ADDRESS!
    });
  }, []);  // Empty dependency array means this only runs once

  useEffect(() => {
    // Connect wallet when authenticated
    const connectWallet = async () => {
      if (ready && authenticated && wallets.length > 0) {
        try {
          // Get the embedded wallet from Privy
          const embeddedWallet = wallets.find(wallet => wallet.walletClientType === 'privy');
          
          if (embeddedWallet) {
            // Create an ethers signer from the Privy wallet
            const provider = new ethers.BrowserProvider(embeddedWallet.provider);
            const newSigner = await provider.getSigner();
            
            // Connect the signer to StudyFund
            await studyFund.connect(newSigner);
            setSigner(newSigner);
            console.log('Wallet connected successfully');
          }
        } catch (error) {
          console.error('Failed to connect wallet:', error);
        }
      }
    };

    connectWallet();
  }, [ready, authenticated, wallets, studyFund]);

  // Request test tokens
  const requestTestTokens = async () => {
    try {
      if (!studyFund.isConnected()) {
        throw new Error('Wallet not connected');
      }

      // Request USDT (ERC20) and EDU (native token)
      const usdtTx = await studyFund.requestTestUSDT(50); // Request 50 USDT
      await usdtTx.wait();
      
      const eduTx = await studyFund.requestTestEDU(500); // Request 500 EDU (native token)
      await eduTx.wait();
      
      console.log('Test tokens received!');
    } catch (error) {
      console.error('Failed to get test tokens:', error);
    }
  };

  // Make a donation
  const donate = async () => {
    try {
      if (!studyFund.isConnected()) {
        throw new Error('Wallet not connected');
      }
      const tx = await studyFund.donate(10); // Donate 10 USDT
      await tx.wait();
      console.log('Donation successful!');
    } catch (error) {
      console.error('Donation failed:', error);
    }
  };

  return (
    <div>
      {!authenticated ? (
        <button onClick={() => login()}>Login with Privy</button>
      ) : (
        <>
          <button onClick={requestTestTokens}>Request Test Tokens</button>
          <button onClick={donate}>Donate 10 USDT</button>
        </>
      )}
    </div>
  );
}
```

### Checking Balances with Privy

```typescript
import { UserStudyFund } from './UserStudyFund';
import { ethers } from 'ethers';
import { useState, useEffect, useMemo } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';

const WalletBalance = () => {
  const { ready, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const [balances, setBalances] = useState({ edu: '0', usdt: '0' });

  // Create StudyFund instance with useMemo
  const studyFund = useMemo(() => {
    const provider = new ethers.JsonRpcProvider(process.env.REACT_APP_RPC_URL);
    return new UserStudyFund({
      provider,
      network: 'testnet',
      contractAddress: process.env.REACT_APP_CONTRACT_ADDRESS!,
      usdtContractAddress: process.env.REACT_APP_USDT_ADDRESS!
    });
  }, []); // Empty dependency array ensures this only runs once

  useEffect(() => {
    // Connect wallet when authenticated
    const connectWallet = async () => {
      if (ready && authenticated && wallets.length > 0) {
        try {
          const embeddedWallet = wallets.find(wallet => wallet.walletClientType === 'privy');
          
          if (embeddedWallet) {
            const provider = new ethers.BrowserProvider(embeddedWallet.provider);
            const signer = await provider.getSigner();
            await studyFund.connect(signer);
            
            // Update balances after connecting
            updateBalances();
          }
        } catch (error) {
          console.error('Failed to connect wallet:', error);
        }
      }
    };

    connectWallet();
  }, [ready, authenticated, wallets, studyFund]);

  const updateBalances = async () => {
    try {
      if (!studyFund.isConnected()) {
        throw new Error('Wallet not connected');
      }

      const [edu, usdt] = await Promise.all([
        studyFund.getEDUBalance(),
        studyFund.getUSDTBalance()
      ]);

      setBalances({
        edu: edu || '0',
        usdt: usdt || '0'
      });
    } catch (error) {
      console.error('Failed to fetch balances:', error);
    }
  };

  return (
    <div>
      <button onClick={updateBalances} disabled={!authenticated}>Refresh Balances</button>
      <div>EDU Balance: {balances.edu}</div>
      <div>USDT Balance: {balances.usdt}</div>
    </div>
  );
};
```

### Backend/Admin Usage

```typescript
import { AdminStudyFund } from './StudyFund';

// Initialize admin operations
const adminStudyFund = new AdminStudyFund({
  network: 'testnet', // or 'mainnet'
  privateKey: 'admin-private-key',
  contractAddress: 'deployed-contract-address',
  usdtContractAddress: 'usdt-contract-address'
});

// Select winners
async function selectWinners() {
  try {
    const tx = await adminStudyFund.selectWinners();
    await tx.wait();
    console.log('Winners selected!');
  } catch (error) {
    console.error('Winner selection failed:', error);
  }
}

// Award scholarship
async function awardScholarship() {
  try {
    const tx = await adminStudyFund.awardScholarship('recipient-address', 2000);
    await tx.wait();
    console.log('Scholarship awarded!');
  } catch (error) {
    console.error('Scholarship award failed:', error);
  }
}
```

## Available Methods

### User Operations (UserStudyFund)
- `connect(signer: Signer)`: Connect a wallet
- `disconnect()`: Disconnect the wallet
- `isConnected()`: Check if wallet is connected
- `getAddress()`: Get connected wallet address
- `getEDUBalance()`: Get user's EDU (native token) balance
- `getUSDTBalance()`: Get user's USDT balance
- `donate(amountInUSDT: number)`: Make a donation
- `claimPrize()`: Claim available prizes
- `getDonationTiers()`: Get available donation tiers
- `requestTestUSDT(amount?: number)`: Request test USDT (ERC20) from faucet (testnet only, default: 100 USDT)
- `requestTestEDU(amount?: number)`: Request test EDU (native token) from faucet (testnet only, default: 1000 EDU)

### Admin Operations (AdminStudyFund)
- `selectWinners()`: Select winners for the current round
- `awardScholarship(recipient: string, amount: number)`: Award scholarship to a recipient
- `depositToReserve(amount: number)`: Deposit USDT to the reserve
- `withdrawFromReserve(amount: number)`: Withdraw USDT from the reserve
- `setPrizeAmount(amount: number)`: Set prize amount for winners
- `setMaxWinners(count: number)`: Set maximum number of winners per round

## Example Frontend Integration (React)

```typescript
import { UserStudyFund } from './UserStudyFund';
import { ethers } from 'ethers';
import { useState, useEffect } from 'react';

const WalletBalance = () => {
  const [studyFund, setStudyFund] = useState<UserStudyFund>();
  const [balances, setBalances] = useState({ edu: '0', usdt: '0' });

  useEffect(() => {
    if (window.ethereum) {
      const provider = new ethers.BrowserProvider(window.ethereum);
      setStudyFund(new UserStudyFund({
        provider,
        network: 'testnet',
        contractAddress: process.env.REACT_APP_CONTRACT_ADDRESS!,
        usdtContractAddress: process.env.REACT_APP_USDT_ADDRESS!
      }));
    }
  }, []);

  const updateBalances = async () => {
    try {
      if (!studyFund?.isConnected()) {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        await studyFund?.connect(signer);
      }

      const [edu, usdt] = await Promise.all([
        studyFund?.getEDUBalance(),
        studyFund?.getUSDTBalance()
      ]);

      setBalances({
        edu: edu || '0',
        usdt: usdt || '0'
      });
    } catch (error) {
      console.error('Failed to fetch balances:', error);
    }
  };

  return (
    <div>
      <button onClick={updateBalances}>Refresh Balances</button>
      <div>EDU Balance: {balances.edu}</div>
      <div>USDT Balance: {balances.usdt}</div>
    </div>
  );
};