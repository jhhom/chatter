import { fromPromise } from "neverthrow";
import { subscriptions, users, GroupTopicId } from "~/backend/drizzle/schema";
import { AppPgDatabase } from "~/backend/drizzle/db";
import { eq, and, like } from "drizzle-orm";
import { err, ok } from "neverthrow";
import { InferModel, sql } from "drizzle-orm";

export function findOneUser(
  ctx: { db: AppPgDatabase },
  arg: {
    username: string;
  }
) {
  return fromPromise(
    ctx.db
      .select({
        userId: users.id,
        username: users.username,
        email: users.email,
        fullname: users.fullname,
        passwordHash: users.passwordHash,
        defaultPermissions: users.defaultPermissions,
        profilePhotoUrl: users.profilePhotoUrl,
        subscribedGroupTopicIds: sql<
          GroupTopicId[]
        >/* sql */ `(ARRAY_REMOVE(ARRAY_AGG(subscriptions.topic_id), NULL))`,
      })
      .from(users)
      .leftJoin(
        subscriptions,
        and(
          eq(subscriptions.userId, users.id),
          like(subscriptions.topicId, "grp%")
        )
      )
      .groupBy(users.id)
      .where(eq(users.username, arg.username)),
    (e) => e
  ).andThen((v) => {
    if (v.length == 0) {
      return err(new Error("user not found"));
    }
    return ok(v[0]);
  });
}
