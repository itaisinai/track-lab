# Docker Setup

Run the app stack with Docker from the repo root:

```sh
yarn dev:docker
```

That command starts the API, worker, and web containers through
`docker/docker-compose.yml`, plus the one-shot migration service.

## Notes

- The compose file uses the repository root as the build context.
- Local `.env` values are passed into containers through compose and are the
  single source of truth for the Docker runtime.
- When `QUEUE_PROVIDER=sqs`, the API and worker containers also mount the host
  `~/.aws` directory so AWS CLI profiles, SSO cache, and shared credentials are
  available to the SDK.
- Container entrypoints use the `start:docker` and `dev:docker` scripts.
- Set `DATASTORE_PROVIDER=prisma` and define `DATABASE_URL` in `.env` to point
  the API and worker at PostgreSQL. Use your RDS URL with `sslmode=no-verify`
  when connecting to Amazon RDS.
- Compose runs the Prisma migration service before the API and worker start.

## Direct compose command

```sh
docker compose --env-file .env -f docker/docker-compose.yml up --build
```
