// import type { DB } from "~/backend/schema";
import pg from "pg";
import { CamelCasePlugin, Kysely, PostgresDialect } from "kysely";
import { loadConfig } from "~/backend/config/config";
import { WebSocketServer } from "ws";
import { createContextBuilder } from "~/backend/router/context";
import { applyWSSHandler } from "@trpc/server/adapters/ws";
import { type DB } from "~/backend/schema";
import { mainRouter } from "~/backend/router/router";

const Pool = pg.Pool;

const config = loadConfig();
if (config.isErr()) {
  throw config.error;
}

const dialect = new PostgresDialect({
  pool: new Pool({
    connectionString: config.value.DATABASE_URL,
    max: 10,
  }),
});

const db = new Kysely<DB>({
  dialect,
  log(event) {
    if (event.level === "query") {
      console.log(event.query.sql);
      console.log(event.query.parameters);
    }
  },
  plugins: [new CamelCasePlugin()],
});

const wss = new WebSocketServer({
  port: 4001,
});
const handler = applyWSSHandler({
  wss,
  router: mainRouter,
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
