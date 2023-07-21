import { fromPromise, ok, err, Result } from "neverthrow";
import { KyselyDB, Messages } from "~/backend/schema";
import { completeMediaUrl } from "~/backend/service/common/media";
import { getPrecedingMessageDate } from "~/backend/service/topics/common/repo/repo";
import { AppError, AppErrorUnion } from "~/api-contract/errors/errors";
import { UserId, GroupTopicId } from "~/api-contract/subscription/subscription";
import type { Insertable } from "kysely";

export async function addMessageToGroupTopic(
  db: KyselyDB,
  arg: {
    message: Insertable<Messages>;
    forwarder: UserId;
    forwardedTo: GroupTopicId;
  }
) {
  /**
   * Flow of adding a new message to a Group topic
   *
   * 1. Find out if the user has a subscription to the group, reject the request if the user doesn't
   * 2. Save the media of the message (if the message includes any media)
   * 3. Determine if the message is the first message of the date, by getting the date of the preceding message
   * 4. If message sent includes any media, complete the media URL
   */

  // 1. ⭐️ Find out if the user has a subscription to the group, reject the request if the user doesn't
  const existSubscription = await fromPromise(
    db
      .selectFrom("subscriptions")
      .select("id")
      .where("subscriptions.topicId", "=", arg.forwardedTo)
      .where("subscriptions.userId", "=", arg.forwarder)
      .executeTakeFirst(),
    (e) => new AppError("DATABASE", { cause: e })
  ).map((v) => v !== undefined);
  if (existSubscription.isErr()) {
    return err(existSubscription.error);
  }
  if (!existSubscription.value) {
    return err(
      new AppError("UNKNOWN", { cause: "User is not subscribed to the topic" })
    );
  }

  // 2. ⭐️ Save the media of the message (if the message includes any media)
  const messageResult = await fromPromise(
    db
      .insertInto("messages")
      .values({
        content:
          arg.message.content == null
            ? null
            : {
                ...arg.message.content,
                forwarded: true,
              },
        topicId: arg.forwardedTo,
        authorId: arg.forwarder,
      })
      .returningAll()
      .executeTakeFirstOrThrow(),
    (e) => new AppError("DATABASE", { cause: e })
  );
  if (messageResult.isErr()) {
    return err(messageResult.error);
  }

  // 3. ⭐️ Determine if the message is the first message of the date, by getting the date of the preceding message
  const precedingMessageDate = await getPrecedingMessageDate(db, {
    topicId: arg.forwardedTo,
    beforeSequenceId: messageResult.value.sequenceId,
  });
  if (precedingMessageDate.isErr()) {
    return err(
      new AppError("UNKNOWN", { cause: "Failed to get preceding message" })
    );
  }
  const precedingDate = precedingMessageDate.value;

  const message = messageResult.value;

  // 4. ⭐️ If message sent includes any media, complete the media URL
  if (message.content?.type == "picture" || message.content?.type == "file") {
    message.content.url = completeMediaUrl(message.content.url);
  }

  return ok({
    message: {
      ...message,
      authorId: message.authorId as UserId,
      isFirstOfDate:
        precedingDate == undefined
          ? true
          : precedingDate.toDateString() !=
            new Date(message.createdAt).toDateString(),
    },
  });
}
