import { KyselyDB } from "~/backend/schema";
import { ServiceResult } from "~/api-contract/types";
import { fromPromise, ok } from "neverthrow";
import { UserId } from "~/api-contract/subscription/subscription";

export async function deleteUser(
  db: KyselyDB,
  userId: UserId
): ServiceResult<"users/delete_user"> {
  await db.transaction().execute(async (tx) => {
    await tx
      .deleteFrom("groupTopicMeta")
      .where("ownerId", "=", userId)
      .execute();
    await tx
      .deleteFrom("messageDeleteLogs")
      .where("deletedBy", "=", userId)
      .execute();
    await tx.deleteFrom("messages").where("authorId", "=", userId).execute();
    await tx.deleteFrom("subscriptions").where("userId", "=", userId).execute();
    await tx
      .deleteFrom("topicEventLogs")
      .where("actorUserId", "=", userId)
      .execute();
    await tx
      .deleteFrom("topicEventLogs")
      .where("affectedUserId", "=", userId)
      .execute();
  });

  return ok({ message: "User is deleted" });
}
