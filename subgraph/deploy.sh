#!/bin/bash

# Check if contract address is provided
if [ -z "$1" ]; then
  echo "Usage: ./deploy.sh <contract_address> [network] [start_block]"
  echo "Example: ./deploy.sh 0xBBe02596F093Ea9d4B6c942bB73C03c02B0D15E0 open-campus-codex 33534812"
  exit 1
fi

CONTRACT_ADDRESS=$1
NETWORK=${2:-open-campus-codex}
START_BLOCK=${3:-33534812}

# Ensure we have the latest ABI
echo "Extracting ABI from contract artifacts..."
cd ..
node -e "const fs = require('fs'); const contract = require('./artifacts/contracts/StudyFund.sol/StudyFund.json'); fs.writeFileSync('./subgraph/abis/StudyFund.json', JSON.stringify(contract.abi, null, 2));"
cd subgraph

# Update subgraph.yaml with the provided values
echo "Updating subgraph.yaml with provided values..."
sed -i '' "s/network: .*/network: $NETWORK/g" subgraph.yaml
sed -i '' "s/address: \"0x[0-9a-fA-F]*\"/address: \"$CONTRACT_ADDRESS\"/g" subgraph.yaml
sed -i '' "s/startBlock: [0-9]*/startBlock: $START_BLOCK/g" subgraph.yaml

# Generate code and build the subgraph
echo "Generating code..."
npx graph codegen

echo "Building subgraph..."
npx graph build

# Create a deployment package
echo "Creating deployment package..."
mkdir -p deployment
cp -r build/* deployment/
cp -r abis deployment/

echo "Subgraph prepared for deployment!"
echo ""
echo "To deploy to Goldsky, you need to subscribe to a plan at https://app.goldsky.com/dashboard/settings"
echo "Once subscribed, you can deploy using:"
echo "goldsky subgraph deploy studyfund/v1 --path ./deployment"
echo ""
echo "Your subgraph files are ready in the 'deployment' directory." 