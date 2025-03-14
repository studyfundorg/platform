# Docker Setup for WeGift Backend

This document provides instructions for running the WeGift backend using Docker and Docker Compose.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

## Configuration

1. Create a `.env` file based on the `.env.example` template:

```bash
cp .env.example .env
```

2. Update the `.env` file with your actual configuration values.

## Running the Application

### Development Mode

To run the application in development mode with hot-reloading:

```bash
docker-compose up
```

This will:
- Build the Docker image if it doesn't exist
- Start the backend service
- Mount your local source code for hot-reloading
- Expose the service on the port specified in your `.env` file (default: 3000)

### Production Mode

To run the application in production mode:

```bash
NODE_ENV=production docker-compose up -d
```

This will:
- Run the application in detached mode
- Use the production-optimized build
- Disable hot-reloading for better performance

## Stopping the Application

To stop the running containers:

```bash
docker-compose down
```

## Rebuilding the Image

If you make changes to the Dockerfile or need to rebuild the image:

```bash
docker-compose build
```

## Viewing Logs

To view the logs from the running containers:

```bash
docker-compose logs -f
```

## Troubleshooting

### Container not starting

Check the logs for errors:

```bash
docker-compose logs
```

### Port conflicts

If you have a port conflict, modify the port mapping in the `.env` file or directly in the `docker-compose.yml` file.

### Volume mounting issues

Ensure that the paths in the `volumes` section of `docker-compose.yml` are correct for your environment. 