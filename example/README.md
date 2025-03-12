# StudyFund TypeScript Integration

This package provides TypeScript wrappers for the StudyFund smart contract, making it easy to interact with the contract from both backend and frontend applications.

## Prerequisites

- ethers.js v6 or higher
- TypeScript support
- Access to OpenCampus network (mainnet or testnet)
- Contract artifacts from the hardhat project

## Installation

1. Copy the following files into your project:
   - `StudyFund.ts` (base and admin operations)
   - `UserStudyFund.ts` (user operations with web3 wallet support)
2. Ensure you have the required contract artifacts:
   - `artifacts/contracts/StudyFund.sol/StudyFund.json`
   - `typechain-types/contracts/StudyFund.ts`

## Usage

### Frontend Usage with Web3 Wallets (MetaMask, Trust Wallet)

```typescript
import { UserStudyFund } from './UserStudyFund';

// Initialize with Web3Provider
const provider = new ethers.BrowserProvider(window.ethereum);
const studyFund = new UserStudyFund({
  provider,
  network: 'testnet',
  contractAddress: process.env.REACT_APP_CONTRACT_ADDRESS!,
  usdtContractAddress: process.env.REACT_APP_USDT_ADDRESS!
});

// Request test tokens
async function requestTestTokens() {
  try {
    if (!studyFund.isConnected()) {
      const signer = await provider.getSigner();
      await studyFund.connect(signer);
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
}

// Make a donation
async function donate() {
  try {
    if (!studyFund.isConnected()) {
      await requestTestTokens();
    }
    const tx = await studyFund.donate(10); // Donate 10 USDT
    await tx.wait();
    console.log('Donation successful!');
  } catch (error) {
    console.error('Donation failed:', error);
  }
}

// Claim prize
async function claimPrize() {
  try {
    if (!studyFund.isConnected()) {
      await requestTestTokens();
    }
    const tx = await studyFund.claimPrize();
    await tx.wait();
    console.log('Prize claimed successfully!');
  } catch (error) {
    console.error('Prize claim failed:', error);
  }
}
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
- `connect(signer: Signer)`: Connect a web3 wallet
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
- `

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