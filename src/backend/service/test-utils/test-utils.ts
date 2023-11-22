import { seed } from "~/backend/service/test-utils/seed";
import { login } from "~/backend/service/test-utils/login";
import { CamelCasePlugin, Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { DB } from "~/backend/schema";

const testUtil = { login, seed };

const setupDb = (connectionString: string) => {
  const dialect = new PostgresDialect({
    pool: new Pool({
      connectionString,
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

  return db;
};

export { testUtil, setupDb };
