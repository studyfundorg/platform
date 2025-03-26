#!/bin/bash

# Check if webhook URL and secret are provided
if [ -z "$1" ] || [ -z "$2" ]; then
  echo "Usage: ./setup-webhooks.sh <webhook_url> <webhook_secret>"
  echo "Example: ./setup-webhooks.sh https://your-backend-url.com/webhook your-secret-here"
  exit 1
fi

WEBHOOK_URL=$1
WEBHOOK_SECRET=$2
SUBGRAPH_NAME="studyfund/v3"

# Delete existing webhooks
echo "Deleting existing webhooks..."
goldsky subgraph webhook delete donation-webhook -f || true
goldsky subgraph webhook delete raffle-webhook -f || true
goldsky subgraph webhook delete scholarship-webhook -f || true
goldsky subgraph webhook delete donor-webhook -f || true
goldsky subgraph webhook delete raffle-prize-webhook -f || true
goldsky subgraph webhook delete history-webhook -f || true
goldsky subgraph webhook delete claimed-prize-webhook -f || true

# Create webhooks for each entity
echo "Creating webhook for donations..."
goldsky subgraph webhook create $SUBGRAPH_NAME --name donation-webhook --entity donation --url $WEBHOOK_URL --secret $WEBHOOK_SECRET

echo "Creating webhook for raffles..."
goldsky subgraph webhook create $SUBGRAPH_NAME --name raffle-webhook --entity raffle --url $WEBHOOK_URL --secret $WEBHOOK_SECRET

echo "Creating webhook for scholarships..."
goldsky subgraph webhook create $SUBGRAPH_NAME --name scholarship-webhook --entity scholarship --url $WEBHOOK_URL --secret $WEBHOOK_SECRET

echo "Creating webhook for donors..."
goldsky subgraph webhook create $SUBGRAPH_NAME --name donor-webhook --entity donor --url $WEBHOOK_URL --secret $WEBHOOK_SECRET

echo "Creating webhook for raffle prizes..."
goldsky subgraph webhook create $SUBGRAPH_NAME --name raffle-prize-webhook --entity raffle_prize --url $WEBHOOK_URL --secret $WEBHOOK_SECRET

echo "Creating webhook for history events..."
goldsky subgraph webhook create $SUBGRAPH_NAME --name history-webhook --entity history --url $WEBHOOK_URL --secret $WEBHOOK_SECRET

echo "Creating webhook for claimed prizes..."
goldsky subgraph webhook create $SUBGRAPH_NAME --name claimed-prize-webhook --entity claimed_prize --url $WEBHOOK_URL --secret $WEBHOOK_SECRET

echo "Webhook setup completed!"
echo "The webhook secret '$WEBHOOK_SECRET' has been applied to all webhooks."
echo "Make sure to update your backend's environment variables with this webhook secret."
echo ""
echo "To process historical data:"
echo "1. Go to https://app.goldsky.com/dashboard"
echo "2. Select your subgraph 'studyfund/v3'"
echo "3. Go to the 'Webhooks' tab"
echo "4. For each webhook, click on the three dots menu and select 'Process Historical Data'" 