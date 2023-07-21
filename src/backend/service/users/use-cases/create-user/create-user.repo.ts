import { InferModel } from "drizzle-orm";
import { fromPromise, err, ok } from "neverthrow";

import { users } from "~/backend/drizzle/schema";
import { AppPgTransaction } from "~/backend/drizzle/db";

export function createUser(
  ctx: {
    db: AppPgTransaction;
  },
  input: InferModel<typeof users, "insert">
) {
  return fromPromise(
    ctx.db.insert(users).values(input).returning(),
    (e) => e
  ).andThen((v) => {
    if (v.length == 0) {
      return err(new Error("created user not returned"));
    }
    return ok(v[0]);
  });
}
