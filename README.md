# Chatter

Chatter is an instant messaging application (WhatsApp/Telegram clone) with a full-suite of features.

Built with ReactJS and NodeJS.

## Features

**Feature 1 - Notification**

- Feature 1.1 - Online Presence
- Feature 1.2 - Typing Notification

<br/>

**Feature 2 - Send Message**

- Feature 2.1 - Message Read Notification
- Feature 2.2 - Send rich text, multi-line text message
- Feature 2.3 - Send picture
- Feature 2.4 - Send file
- Feature 2.5 - Reply to message
- Feature 2.6 - Forward message
- Feature 2.7 - Delete message

<br/>

**Feature 3 - Group Messaging: Create Group**

- Feature 3.1(a) - Add people to group: Direct invite
- Feature 3.1(b) - Add people to group: Using invite link
- Feature 3.2(a) - Group Activity Notifications (Online)
- Feature 3.2(b) - Group Activity Notifications (Typing)
- Feature 3.3 - Remove member from group
- Feature 3.4 - Leave group

<br/>

**Feature 4 - Permissions**

- Feature 4.1 - General Permissions
- Feature 4.1(a) - Join Permission
- Feature 4.1(b) - Read Permission
- Feature 4.1(c) - Write Permission
- Feature 4.1(d) - Get Notified Permission
- Feature 4.2(a) - Group Messaging Permissions - Share Permission
- Feature 4.2(b) - Delete Permission
- Feature 4.2(c) - Administer Permission

<br/>

**Feature 5 - Add Contact**

## Development instructions

For local development, run:

1. Front-end: Run with `pnpm run dev` (Folder: `src/frontend` and `src/app`)
2. Back-end: Run with `pnpm run dev:server` (Folder: `src/backend`)
3. Asset server: Run with `pnpm run dev:asset` (Folder: `src/asset-server`)

## To seed database

Run `pnpm run scripts:seed-db` from the `src/backend` folder.

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
