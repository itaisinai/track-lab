# Docker Setup

Run the app stack with Docker from the repo root:

```sh
yarn dev:docker
```

That command starts the API, worker, and web containers through
`docker/docker-compose.yml`.

## Notes

- The compose file uses the repository root as the build context.
- Local `.env` values are passed into containers through compose.
- Container entrypoints use the `start:docker` and `dev:docker` scripts.
- The PostgreSQL service is available for the Prisma datastore path.
- Set `DATASTORE_PROVIDER=prisma` and
  `DATABASE_URL=postgresql://track_lab:track_lab@postgres:5432/track_lab?schema=public`
  to point the API and worker at PostgreSQL inside Docker.
- Compose runs the Prisma migration service before the API and worker start.

## Direct compose command

```sh
docker compose -f docker/docker-compose.yml up --build
```
