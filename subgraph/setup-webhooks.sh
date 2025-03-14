#!/bin/bash

# Check if webhook URL is provided
if [ -z "$1" ]; then
  echo "Usage: ./setup-webhooks.sh <webhook_url>"
  echo "Example: ./setup-webhooks.sh https://your-backend-url.com/webhook"
  exit 1
fi

WEBHOOK_URL=$1
SUBGRAPH_NAME="studyfund/v1"

# Create webhooks for each entity
echo "Creating webhook for donations..."
goldsky subgraph webhook create $SUBGRAPH_NAME --name donation-webhook --entity donation --url $WEBHOOK_URL

echo "Creating webhook for raffles..."
goldsky subgraph webhook create $SUBGRAPH_NAME --name raffle-webhook --entity raffle --url $WEBHOOK_URL

echo "Creating webhook for scholarships..."
goldsky subgraph webhook create $SUBGRAPH_NAME --name scholarship-webhook --entity scholarship --url $WEBHOOK_URL

echo "Creating webhook for donors..."
goldsky subgraph webhook create $SUBGRAPH_NAME --name donor-webhook --entity donor --url $WEBHOOK_URL

echo "Creating webhook for raffle prizes..."
goldsky subgraph webhook create $SUBGRAPH_NAME --name raffle-prize-webhook --entity raffleprize --url $WEBHOOK_URL

echo "Webhook setup completed!"
echo "Make sure to update your backend's environment variables with the webhook secrets provided by Goldsky." 