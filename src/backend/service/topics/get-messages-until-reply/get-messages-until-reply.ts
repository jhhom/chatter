import { ok, err } from "neverthrow";
import { KyselyDB } from "~/backend/schema";
import {
  UserId,
  GroupTopicId,
  TopicId,
} from "~/api-contract/subscription/subscription";
import { TopicEvent } from "~/backend/schema";
import { completeMediaUrl } from "~/backend/service/common/media";
import { IsGroupTopicId, IsUserId } from "~/backend/service/common/topics";
import {
  hasMessagesEarlierThan,
  userStatusInTheGroup,
  getGroupLastReadSequenceId,
  existMessage,
  getLastReadSequenceId,
} from "~/backend/service/topics/common/repo/repo";
import {
  Message,
  MessageContent,
} from "~/api-contract/subscription/subscription";
import { AppError } from "~/api-contract/errors/errors";
import { getP2PTopicMessages } from "~/backend/service/topics/get-messages-until-reply/get-p2p-topic-messages";
import { getGroupTopicMessages } from "~/backend/service/topics/get-messages-until-reply/get-group-topic-messages";
import { ServiceResult } from "~/api-contract/types";

export async function getMessagesUntilReply(
  db: KyselyDB,
  assetServerUrl: string,
  arg: {
    requesterUserId: UserId;
    topicId: UserId | GroupTopicId;
    beforeSequenceId: number;
    untilReplySequenceId: number;
  }
): ServiceResult<"topic/get_messages_until_reply"> {
  // The flow of retrieving messages for a topic
  // ----------------------------------------------
  // 1. Get the messages for that topic
  // 2. Check if there is earlier messages
  // 3. Find out the read status of every message

  const existMessageResult = await existMessage(db, {
    topicId: arg.topicId,
    requesterUserId: arg.requesterUserId,
    messageSeqId: arg.untilReplySequenceId,
    beforeSequenceId: arg.beforeSequenceId,
  });
  if (existMessageResult.isErr()) {
    return err(new AppError("UNKNOWN", { cause: existMessageResult.error }));
  }
  if (!existMessageResult.value) {
    return err(new AppError("TOPIC.REPLY_MESSAGE_NOT_EXIST", undefined));
  }

  // 1. ⭐️ GET THE MESSAGES FOR THAT TOPIC
  let topicId: TopicId;
  let messages: ((
    | {
        type: "event_log";
        event: TopicEvent;
        content: Extract<Message, { type: "text" }>;
      }
    | {
        type: "message";
        author: UserId;
        deleted: boolean;
        content: MessageContent;
      }
  ) & {
    sequenceId: number;
    createdAt: Date;
    isFirstOfDate: boolean;
  })[] = [];
  let subscriptionStartSequenceId: number | null = null;

  if (IsUserId(arg.topicId)) {
    const r = await getP2PTopicMessages(db, {
      requesterUserId: arg.requesterUserId,
      topicId: arg.topicId,
      beforeSequenceId: arg.beforeSequenceId,
      untilSequenceId: arg.untilReplySequenceId,
    });
    if (r.isErr()) {
      return err(new AppError("UNKNOWN", { cause: r.error }));
    }
    messages = r.value.messages;
    if (r.value.topicId == null) {
      return ok({ msgs: [], hasEarlierMessages: false });
    }
    topicId = r.value.topicId;
  } else {
    const r = await getGroupTopicMessages(db, {
      requesterUserId: arg.requesterUserId,
      topicId: arg.topicId,
      beforeSequenceId: arg.beforeSequenceId,
      untilSequenceId: arg.untilReplySequenceId,
    });
    if (r.isErr()) {
      return err(new AppError("UNKNOWN", { cause: r.error }));
    }
    messages = r.value.messages;
    if (r.value.topicId == null) {
      return ok({ msgs: [], hasEarlierMessages: false });
    }
    topicId = arg.topicId;
    subscriptionStartSequenceId = r.value.subscriptionStartSeqId;
  }

  if (messages.length == 0) {
    return err(new AppError("TOPIC.REPLY_MESSAGE_NOT_EXIST", undefined));
  }

  // 2. ⭐️ CHECK IF THERE IS EARLIER MESSAGES
  const earliestSequenceId = messages[0].sequenceId;
  const hasEarlierMessagesResult = await hasMessagesEarlierThan(db, {
    topicId,
    beforeSequenceId: earliestSequenceId,
    subscriptionStartSequenceId,
  });
  if (hasEarlierMessagesResult.isErr()) {
    return err(
      new AppError("UNKNOWN", { cause: hasEarlierMessagesResult.error })
    );
  }
  const hasEarlierMessages = hasEarlierMessagesResult.value;

  // 3. ⭐️ FIND OUT THE READ STATUS OF EVERY MESSAGE
  if (IsGroupTopicId(topicId)) {
    const userStatusResult = await userStatusInTheGroup(db, {
      userId: arg.requesterUserId,
      topicId: topicId,
    });
    if (userStatusResult.isErr()) {
      return err(new AppError("UNKNOWN", { cause: userStatusResult.error }));
    }
    if (userStatusResult.value.type == "user is never in the group") {
      return err(
        new AppError("UNKNOWN", {
          cause: new Error("user is never in the group"),
        })
      );
    }
    const userLastReadSeqIdResult = await getGroupLastReadSequenceId(db, {
      userId: arg.requesterUserId,
      topicId,
      status: userStatusResult.value,
    });
    if (userLastReadSeqIdResult.isErr()) {
      return err(
        new AppError("UNKNOWN", { cause: userLastReadSeqIdResult.error })
      );
    }
    return ok({
      msgs: messages.map((m) => {
        if (m.content.type == "picture" || m.content.type == "file") {
          m.content.url = completeMediaUrl(assetServerUrl, m.content.url);
        }
        if (
          m.type == "message" &&
          m.content.replyTo !== null &&
          m.content.replyTo.type == "picture"
        ) {
          m.content.replyTo.url = completeMediaUrl(
            assetServerUrl,
            m.content.replyTo.url
          );
        }
        let read = true;
        if (m.type != "message" || m.author != arg.requesterUserId) {
          read = m.sequenceId <= userLastReadSeqIdResult.value;
        }
        return {
          ...m,
          read,
        };
      }),
      hasEarlierMessages,
    });
  } else {
    const userLastReadSeqIdResult = await getLastReadSequenceId(db, {
      userId: arg.requesterUserId,
      topicId,
    });
    if (userLastReadSeqIdResult.isErr()) {
      return err(
        new AppError("UNKNOWN", { cause: userLastReadSeqIdResult.error })
      );
    }
    const peerLastReadSeqIdResult = await getLastReadSequenceId(db, {
      userId: arg.topicId as UserId,
      topicId,
    });
    if (peerLastReadSeqIdResult.isErr()) {
      return err(
        new AppError("UNKNOWN", { cause: peerLastReadSeqIdResult.error })
      );
    }
    const userLastReadSeqId = userLastReadSeqIdResult.value;
    const peerLastReadSeqId = peerLastReadSeqIdResult.value;

    const messagesWithReadStatus = messages.map((m) => {
      let read = false;
      if (m.type == "message" && m.author == arg.requesterUserId) {
        read = m.sequenceId <= peerLastReadSeqId;
      } else {
        read = m.sequenceId <= userLastReadSeqId;
      }
      return {
        ...m,
        read,
      };
    });

    return ok({
      msgs: messagesWithReadStatus.map((m) => {
        if (m.content.type == "picture" || m.content.type == "file") {
          m.content.url = completeMediaUrl(assetServerUrl, m.content.url);
        }
        if (
          m.type == "message" &&
          m.content.replyTo !== null &&
          m.content.replyTo.type == "picture"
        ) {
          m.content.replyTo.url = completeMediaUrl(
            assetServerUrl,
            m.content.replyTo.url
          );
        }
        return m;
      }),
      hasEarlierMessages,
    });
  }
}
