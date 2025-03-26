# StudyFund Subgraph

This subgraph indexes events from the StudyFund smart contract, including donations, raffles, and scholarships. It provides a comprehensive history of all donor activities including donations, rewards, and scholarships.

## Prerequisites

- Node.js (v16 or higher)
- npm
- Goldsky CLI (`curl https://goldsky.com | sh`)
- Goldsky subscription (for deployment)

## Setup

1. Install dependencies:

```bash
npm install
```

2. Extract the ABI from the contract artifacts:

```bash
# Create the abis directory if it doesn't exist
mkdir -p abis

# Extract the ABI from the contract artifacts
cd ..
node -e "const fs = require('fs'); const contract = require('./artifacts/contracts/StudyFund.sol/StudyFund.json'); fs.writeFileSync('./subgraph/abis/StudyFund.json', JSON.stringify(contract.abi, null, 2));"
cd subgraph
```

3. The `subgraph.yaml` file is already configured for the Open Campus Codex network:

```yaml
dataSources:
  - kind: ethereum
    name: StudyFund
    network: open-campus-codex
    source:
      address: "0xBBe02596F093Ea9d4B6c942bB73C03c02B0D15E0"
      abi: StudyFund
      startBlock: 33534812
```

## Entities

The subgraph tracks the following entities:

- `Donor`: Tracks donor information including total donations, rewards, and entries
- `Donation`: Records individual donations with amount and entries
- `Raffle`: Manages raffle information including winners, runner-ups, and prizes
- `RaffleEntry`: Tracks raffle entries for each donor
- `RafflePrize`: Records prize information for raffle winners
- `Scholarship`: Tracks scholarship awards
- `History`: Comprehensive activity history for each donor including:
  - Donations
  - Rewards
  - Scholarships
  - Transaction timestamps
  - Amounts
  - References to related entities
- `ClaimedPrize`: Records claimed prizes

## Deployment

### Preparing the Subgraph

We've provided a convenient script to prepare your subgraph for deployment. The script will:
1. Extract the ABI from the contract artifacts
2. Update the subgraph.yaml file with your contract address, network, and start block
3. Build the subgraph and create a deployment package

```bash
# Run the deployment script (defaults to Open Campus Codex network)
./deploy.sh 0xBBe02596F093Ea9d4B6c942bB73C03c02B0D15E0 open-campus-codex 33534812
```

This will create a `deployment` directory with all the files needed for deployment.

### Deploying to Goldsky

To deploy to Goldsky, you need to subscribe to a plan at https://app.goldsky.com/dashboard/settings.

Once subscribed, you can deploy using:

```bash
# First, login to Goldsky
goldsky login

# Then deploy the subgraph
goldsky subgraph deploy studyfund/v1 --path ./deployment
```

## Creating Webhooks

After your subgraph is deployed and indexed, you can set up webhooks to receive notifications when new events are indexed:

### Option 1: Using the webhook setup script

We've provided a convenient script to set up webhooks for all entities in your subgraph:

```bash
./setup-webhooks.sh <webhook_url>

# Example:
./setup-webhooks.sh https://your-backend-url.com/webhook
```

This script will create webhooks for donations, raffles, scholarships, donors, raffle prizes, and history events.

### Option 2: Manual webhook setup

You can manually create webhooks to receive notifications when new events are indexed:

```bash
# Create webhook for donations
goldsky subgraph webhook create studyfund/v1 --name donation-webhook --entity donation --url https://your-backend-url.com/webhook

# Create webhook for raffles
goldsky subgraph webhook create studyfund/v1 --name raffle-webhook --entity raffle --url https://your-backend-url.com/webhook

# Create webhook for scholarships
goldsky subgraph webhook create studyfund/v1 --name scholarship-webhook --entity scholarship --url https://your-backend-url.com/webhook

# Create webhook for history events
goldsky subgraph webhook create studyfund/v1 --name history-webhook --entity history --url https://your-backend-url.com/webhook
```

Make sure to update your backend's environment variables with the webhook secret provided by Goldsky when creating the webhook. 