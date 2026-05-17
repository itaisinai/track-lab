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

## Direct compose command

```sh
docker compose -f docker/docker-compose.yml up --build
```
