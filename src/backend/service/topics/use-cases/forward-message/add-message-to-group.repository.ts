import { fromPromise, ok, err } from "neverthrow";
import { InferModel, exists, eq } from "drizzle-orm";

import { AppPgDatabase } from "~/backend/drizzle/db";
import {
  topics,
  subscriptions,
  messages,
  UserId,
  GroupTopicId,
} from "~/backend/drizzle/schema";
import { completeMediaUrl } from "~/backend/service/topics/use-cases/send-message/media";
import { getPrecedingMessageDate } from "~/backend/service/topics/common/repo";

export const addMessageToGroupTopic = async (
  db: AppPgDatabase,
  arg: {
    message: InferModel<typeof messages>;
    forwarder: UserId;
    forwardedTo: GroupTopicId;
  }
) => {
  /**
   * Flow of adding a new message to a Group topic
   *
   * 1. Find out if the user has a subscription to the group, reject the request if the user doesn't
   * 2. Save the media of the message (if the message includes any media)
   * 3. Determine if the message is the first message of the date, by getting the date of the preceding message
   * 4. If message sent includes any media, complete the media URL
   */

  // 1. ⭐️ Find out if the user has a subscription to the group, reject the request if the user doesn't
  const existSubscriptionResult = await fromPromise(
    db
      .select({
        exist: exists(
          db.select().from(subscriptions).where(eq(topics.id, arg.forwardedTo))
        ),
      })
      .from(topics),
    (e) => e
  ).map((v) => {
    if (v.length == 0) {
      return ok(false);
    }
    return ok(v[0].exist as boolean);
  });
  if (existSubscriptionResult.isErr()) {
    return err(existSubscriptionResult.error);
  }
  const existSubscription = existSubscriptionResult.value;

  if (!existSubscription) {
    return err(new Error("User is not subscribed to the topic"));
  }

  // 2. ⭐️ Save the media of the message (if the message includes any media)
  const messageResult = await fromPromise(
    db
      .insert(messages)
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
      .returning(),
    (e) => e
  );

  if (messageResult.isErr()) {
    return err(messageResult.error);
  }

  if (messageResult.value.length == 0) {
    return err("No result from created message");
  }

  // 3. ⭐️ Determine if the message is the first message of the date, by getting the date of the preceding message
  const precedingMessageDate = await getPrecedingMessageDate(db, {
    topicId: arg.forwardedTo,
    beforeSequenceId: messageResult.value[0].sequenceId,
  });
  if (precedingMessageDate.isErr()) {
    return err("Failed to get preceding message");
  }
  const precedingDate = precedingMessageDate.value;

  const message = messageResult.value[0];

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
};
