import { ilike } from "drizzle-orm";
import { fromPromise } from "neverthrow";

import { users } from "~/backend/drizzle/schema";
import { AppPgDatabase } from "~/backend/drizzle/db";

import { completeMediaUrl } from "~/backend/service/topics/use-cases/send-message/media";
import { AppError } from "~/api-contract/errors/errors";
import { ServiceResult } from "~/api-contract/types";

export async function findUsers(
  ctx: {
    db: AppPgDatabase;
  },
  input: {
    email: string | undefined;
  }
): ServiceResult<"users/find_users_to_add_as_contact"> {
  let sql = ctx.db.select().from(users);
  if (input.email && input.email !== "") {
    sql.where(ilike(users.email, `%${input.email}%`));
  }
  const r = await fromPromise(
    sql,
    (e) => new AppError("DATABASE", { cause: e })
  ).map((v) =>
    v.map((u) => ({
      ...u,
      profilePhotoUrl: u.profilePhotoUrl
        ? completeMediaUrl(u.profilePhotoUrl)
        : null,
    }))
  );
  return r;
}
