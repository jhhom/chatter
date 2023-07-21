import { PgTransaction } from "drizzle-orm/pg-core";
import * as schema from "./schema";
import {
  NodePgDatabase,
  NodePgQueryResultHKT,
} from "drizzle-orm/node-postgres";
import { ExtractTablesWithRelations, SQL } from "drizzle-orm";
import { sql, InferModel, InferColumnsDataTypes, AnyColumn } from "drizzle-orm";

export type AppPgDatabase = NodePgDatabase<typeof schema>;
export type AppPgTransaction = PgTransaction<
  NodePgQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

export function jsonAggBuildObject<T extends Record<string, AnyColumn>>(
  shape: T,
  tableName: string
) {
  const chunks: SQL[] = [];

  Object.entries(shape).forEach(([key, value]) => {
    if (chunks.length > 0) {
      chunks.push(sql.raw(`,`));
    }
    chunks.push(sql.raw(`'${key}',`));
    chunks.push(sql`${value}`);
  });
  return sql<
    InferColumnsDataTypes<T>[]
  >`COALESCE(JSON_AGG(DISTINCT JSONB_BUILD_OBJECT(${sql.fromList(
    chunks
  )})) FILTER (WHERE ${sql.raw(tableName)}.id IS NOT NULL), '[]')`;
}
