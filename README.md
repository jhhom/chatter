## Chatter

Local development, run:

```
pnpm run dev:server
pnpm run dev:asset
pnpm run dev
```

## Deployment units

1. Front-end: Run with `pnpm run dev` (Folder: `src/frontend` and `src/app`)
2. Back-end: Run with `pnpm run dev:server` (Folder: `src/backend`)
3. Asset server: Run with `pnpm run dev:asset` (Folder: `src/asset-server`)

## Configurations

Configurations for the back-end and front-end are specified separately.

There may be duplications for both configurations.

### Configurations specifications

1. Back-end and asset server configuration
   - Configuration values: `config/.env`
   - Configuration schema: `src/config/config.ts`
2. Front-end configuration: `src/frontend/config/config.ts`

### 1. Back-end and asset server

Configurations are specified in `config/.env`

Backend: Configurations are loaded in `src/backend/main.ts`.

Asset server: Configurations are loaded in `src/asset-server/main.ts`

The schema of the configuration is in `src/config/config.ts`

```ts
const config = loadConfig();
```

### 2. Front-end

Configurations are specified in `src/frontend/config/config.ts`

The configuration is imported statically into the application.

The configuration of the port running is at `package.json`.

```
next dev -p 6010
```

## Demo account credentials

Refer `src/backend/scripts/seed.ts`.

## To seed database

Run `pnpm run scripts:seed-db`
