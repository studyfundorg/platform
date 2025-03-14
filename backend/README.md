# StudyFund Subgraph and NestJS Backend

This project consists of a Goldsky subgraph for the StudyFund smart contract and a NestJS backend to handle webhooks and store data in Firebase.

## Prerequisites

- Node.js (v16 or higher)
- npm
- Goldsky CLI (`curl https://goldsky.com | sh`)
- Firebase account with a project set up

## Setup Instructions

### 1. Configure Environment Variables

Copy the `.env.example` file to `.env` and fill in your Firebase credentials and other configuration values:

```bash
cp .env.example .env
```

Edit the `.env` file with your actual values:

```
# Firebase Configuration
FIREBASE_API_KEY=your-api-key
FIREBASE_AUTH_DOMAIN=your-auth-domain
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-storage-bucket
FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
FIREBASE_APP_ID=your-app-id

# Goldsky Webhook Configuration
GOLDSKY_WEBHOOK_SECRET=your-webhook-secret

# Server Configuration
PORT=3000
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Deploy the Subgraph to Goldsky

Before deploying, update the `subgraph/subgraph.yaml` file with your contract address and network information.

```bash
# Login to Goldsky
goldsky login

# Deploy the subgraph
goldsky subgraph deploy studyfund/v1 --from-path ./subgraph
```

### 4. Create a Webhook in Goldsky

After your subgraph is deployed and indexed, you can set up webhooks using the provided script:

```bash
# Make the script executable
chmod +x ./subgraph/setup-webhooks.sh

# Run the setup script with your backend URL and webhook secret
./subgraph/setup-webhooks.sh https://your-backend-url.com/webhook your-webhook-secret
```

This script will create webhooks for all entities (donations, raffles, scholarships, donors, and raffle prizes) using the same webhook secret.

Make sure to:
1. Update the `GOLDSKY_WEBHOOK_SECRET` in your `.env` file with the same secret you used in the setup script
2. Keep your webhook secret secure and never commit it to version control

### 5. Start the NestJS Backend

```bash
# Development mode
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

## Project Structure

- `src/`: NestJS application source code
  - `firebase/`: Firebase integration module
  - `webhook/`: Webhook handling module
- `subgraph/`: Goldsky subgraph definition
  - `schema.graphql`: GraphQL schema for the subgraph
  - `subgraph.yaml`: Subgraph configuration
  - `src/`: Subgraph mapping code

## Testing Webhooks Locally

To test webhooks locally, you can use a tool like ngrok to expose your local server to the internet:

```bash
# Install ngrok
npm install -g ngrok

# Expose your local server
ngrok http 3000
```

Then use the ngrok URL as your webhook URL when creating webhooks in Goldsky.

## Deployment

To deploy the NestJS backend to production, you can use a service like Heroku, AWS, or Google Cloud Platform. Make sure to set the environment variables in your production environment.

<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="200" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://coveralls.io/github/nestjs/nest?branch=master" target="_blank"><img src="https://coveralls.io/repos/github/nestjs/nest/badge.svg?branch=master#9" alt="Coverage" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Installation

```bash
$ npm install
```

## Running the app

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Test

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://kamilmysliwiec.com)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](LICENSE).
