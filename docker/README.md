# Docker Setup

Run the app stack with Docker from the repo root:

```sh
yarn dev:docker
```

That command starts the API, worker, and web containers through
`docker/docker-compose.yml`.

## Notes

- The compose file uses the repository root as the build context.
- Local `.env` values are passed into containers through compose and are the
  single source of truth for the Docker runtime.
- Container entrypoints use the `start:docker` and `dev:docker` scripts.
- The PostgreSQL service is available for the Prisma datastore path.
- Set `DATASTORE_PROVIDER=prisma` and define `DATABASE_URL` in `.env` to point
  the API and worker at PostgreSQL inside Docker.
- Compose runs the Prisma migration service before the API and worker start.
- That migration service also copies existing `track_results` rows from the
  mounted SQLite database into PostgreSQL when the SQLite file is present.

## Direct compose command

```sh
docker compose --env-file .env -f docker/docker-compose.yml up --build
```
