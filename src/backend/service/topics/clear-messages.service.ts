import { ok, err, fromPromise } from "neverthrow";

import { KyselyDB } from "~/backend/schema";
import { GroupTopicId, UserId } from "~/api-contract/subscription/subscription";
import { IsUserId } from "~/backend/service/common/topics";
import {
  getTopicIdOfP2PTopicBetween,
  existUser,
} from "~/backend/service/topics/common/repo/repo";

import { AppError } from "~/api-contract/errors/errors";
import { ServiceResult } from "~/api-contract/types";
import { sql } from "kysely";

export async function clearMessages(
  db: KyselyDB,
  arg: {
    topicId: UserId | GroupTopicId;
    requesterUserId: UserId;
  }
): ServiceResult<"topic/clear_messages"> {
  if (IsUserId(arg.topicId)) {
    const topicId = await getTopicIdOfP2PTopicBetween(db, {
      topicUser1: arg.topicId,
      topicUser2: arg.requesterUserId,
    });
    if (topicId.isErr()) {
      if (topicId.error.type == "topic not exist") {
        const existResult = await existUser(db, arg.topicId);
        if (existResult.isErr()) {
          return err(new AppError("RESOURCE_NOT_FOUND", { resource: "topic" }));
        }

        if (!existResult.value) {
          return err(new AppError("RESOURCE_NOT_FOUND", { resource: "user" }));
        }

        return ok({});
      }

      return err(new AppError("UNKNOWN", { cause: topicId.error }));
    }

    return fromPromise(
      sql`
        INSERT INTO message_delete_logs
        (message_id, deleted_by, deleted_for)
        ( SELECT id, ${
          arg.requesterUserId
        }, ${"self"} FROM messages WHERE topic_id = ${topicId.value.topicId})
        ON CONFLICT (message_id, deleted_by) WHERE deleted_for = 'self'
        DO NOTHING;
    `.execute(db),
      (e) => new AppError("DATABASE", { cause: e })
    );
  } else {
    const subscriptionIdResult = await fromPromise(
      db
        .selectFrom("subscriptions")
        .select("subscriptions.id")
        .where("subscriptions.topicId", "=", arg.topicId)
        .where("subscriptions.userId", "=", arg.requesterUserId)
        .executeTakeFirst(),
      (e) => e
    );
    if (subscriptionIdResult.isErr()) {
      return err(
        new AppError("RESOURCE_NOT_FOUND", {
          resource: "subscription_id",
        })
      );
    }
    if (subscriptionIdResult.value === undefined) {
      return err(
        new AppError("UNKNOWN", {
          cause: "User is not subscribed to the group",
        })
      );
    }

    return fromPromise(
      sql`
        INSERT INTO message_delete_logs
        (message_id, deleted_by, deleted_for)
        ( SELECT id, ${
          arg.requesterUserId
        }, ${"self"} FROM messages WHERE topic_id = ${arg.topicId})
        ON CONFLICT (message_id, deleted_by)  WHERE deleted_for = 'self'
        DO NOTHING;
    `.execute(db),
      (e) => new AppError("DATABASE", { cause: e })
    );
  }
}
