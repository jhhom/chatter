import { PostgresDialect, sql } from "kysely";
import { fromPromise, okAsync } from "neverthrow";

import { errAsync } from "neverthrow";
import { KyselyDB } from "~/backend/schema";
import {
  GroupTopicId,
  TopicId,
  UserId,
} from "~/api-contract/subscription/subscription";

export function findOneUser(
  db: KyselyDB,
  arg: {
    username: string;
  }
) {
  return fromPromise(
    db
      .selectFrom("users")
      .leftJoin("subscriptions", (join) =>
        join
          .onRef("users.id", "=", "subscriptions.userId")
          .on("subscriptions.topicId", "like", "grp%")
      )
      .groupBy("users.id")
      .select([
        "users.id",
        "users.username",
        "users.email",
        "users.fullname",
        "users.passwordHash",
        "users.defaultPermissions",
        "users.profilePhotoUrl",
        (eb) => {
          const topicId = eb.ref("subscriptions.topicId");
          return sql<
            GroupTopicId[]
          >`(ARRAY_REMOVE(ARRAY_AGG(${topicId}), NULL))`.as(
            `subscribedGroupTopicIds`
          );
        },
      ])
      .where("users.username", "=", arg.username)
      .executeTakeFirstOrThrow(),
    (e) => e
  );
}

export function getPermissionInP2PTopic(
  db: KyselyDB,
  arg: {
    peer1: UserId;
    peer2: UserId;
    /**
     * If this is peer1, it will return the permission of `arg.peer1`
     * And vice-versa for `peer2`
     *
     * */
    permissionRequested: "peer1" | "peer2";
  }
) {
  return fromPromise(
    db
      .selectFrom("topics")
      .innerJoin("subscriptions as peer1", (join) =>
        join
          .on("peer1.userId", "=", arg.peer1)
          .on((eb) => eb.not(eb("peer1.userId", "=", arg.peer2)))
      )
      .innerJoin("subscriptions as peer2", (join) =>
        join
          .on("peer2.userId", "=", arg.peer2)
          .on((eb) => eb.not(eb("peer2.userId", "=", arg.peer1)))
      )
      .select(
        arg.permissionRequested == "peer1"
          ? "peer1.permissions"
          : "peer2.permissions"
      )
      .where("topics.topicType", "=", "p2p")
      .whereRef("topics.id", "=", "peer1.topicId")
      .whereRef("topics.id", "=", "peer2.topicId")
      .executeTakeFirst(),
    (e) =>
      ({
        type: "Database error",
        cause: e,
      } as const)
  ).andThen((v) => {
    if (v === undefined) {
      return errAsync({ type: "No topic found" } as const);
    }
    return okAsync(v);
  });
}

export function updateUserLastOnline(
  db: KyselyDB,
  arg: {
    userId: UserId;
    lastOnline: Date | null;
  }
) {
  return fromPromise(
    db
      .updateTable("users")
      .set({
        lastOnline:
          arg.lastOnline === null ? null : arg.lastOnline.toISOString(),
      })
      .where("users.id", "=", arg.userId)
      .execute(),
    (e) => e
  );
}
