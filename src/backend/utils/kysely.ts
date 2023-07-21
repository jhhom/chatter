import {
  ExpressionBuilder,
  Selectable,
  Simplify,
  sql,
  Expression,
  RawBuilder,
  expressionBuilder,
} from "kysely";

export function jsonArrayFromTableReference<DB, TB extends keyof DB>(
  _: ExpressionBuilder<DB, TB>,
  table: TB
): RawBuilder<Simplify<Selectable<DB[TB]>>[]> {
  return sql<Simplify<Selectable<DB[TB]>>[]>`coalesce(json_agg(${sql.table(
    table as string
  )}.*), '[]')`;
}

/**
 * The PostgreSQL `json_build_object` function.
 *
 * NOTE: This helper is only guaranteed to fully work with the built-in `PostgresDialect`.
 * While the produced SQL is compatibe with all PostgreSQL databases, some 3rd party dialects
 * may not parse the nested results into objects.
 *
 * ### Examples
 *
 * ```ts
 * const result = await db
 *   .selectFrom('person')
 *   .select((eb) => [
 *     'id',
 *     jsonBuildObject({
 *       first: eb.ref('first_name'),
 *       last: eb.ref('last_name'),
 *       full: sql<string>`first_name || ' ' || last_name`
 *     }).as('name')
 *   ])
 *   .execute()
 *
 * result[0].id
 * result[0].name.first
 * result[0].name.last
 * result[0].name.full
 * ```
 *
 * The generated SQL (PostgreSQL):
 *
 * ```sql
 * select "id", json_build_object(
 *   'first', first_name,
 *   'last', last_name,
 *   'full', first_name || ' ' || last_name
 * ) as "name"
 * from "person"
 * ```
 */
export function jsonBuildObject<O extends Record<string, Expression<unknown>>>(
  obj: O
): RawBuilder<
  Simplify<{
    [K in keyof O]: O[K] extends Expression<infer V> ? V : never;
  }>
> {
  return sql`json_build_object(${sql.join(
    Object.keys(obj).flatMap((k) => [sql.lit(k), obj[k]])
  )})`;
}

export function jsonAggArray<O extends Record<string, Expression<unknown>>>(
  obj: O
): RawBuilder<
  Simplify<{
    [K in keyof O]: O[K] extends Expression<infer V> ? V : never;
  }>[]
> {
  return sql`coalesce(json_agg(json_build_object(${sql.join(
    Object.keys(obj).flatMap((k) => [sql.lit(k), obj[k]])
  )})))`;
}
