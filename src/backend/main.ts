import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { applyWSSHandler } from "@trpc/server/adapters/ws";
import { WebSocketServer } from "ws";

import * as schema from "~/backend/drizzle/schema";

import { appRouter } from "./router";
import { createContextBuilder } from "./router/context";
import { loadConfig } from "./config/config";

const { Pool } = pg;

const config = loadConfig();
if (config.isErr()) {
  throw config.error;
}

const db = drizzle(
  new Pool({
    connectionString: config.value.DATABASE_URL,
  }),
  { schema, logger: false }
);

const wss = new WebSocketServer({
  port: 4001,
});
const handler = applyWSSHandler({
  wss,
  router: appRouter,
  createContext: createContextBuilder(config.value, db),
});

wss.on("connection", (ws) => {
  console.log(`➕➕ Connection (${wss.clients.size})`);
  ws.once("close", () => {
    console.log(`➖➖ Connection (${wss.clients.size})`);
  });
});
console.log("✅ WebSocket Server listening on ws://localhost:4001");

process.on("SIGTERM", () => {
  console.log("SIGTERM");
  handler.broadcastReconnectNotification();
  wss.close();
});
