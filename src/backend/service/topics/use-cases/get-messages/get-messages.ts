import { ok, err, fromPromise } from "neverthrow";

import { AppPgDatabase } from "~/backend/drizzle/db";
import {
  UserId,
  GroupTopicId,
  TopicId,
  TopicEventType,
} from "~/backend/drizzle/schema";
import { IsUserId } from "~/backend/service/common/topics";
import {
  getLastReadSequenceId,
  getGroupLastReadSequenceId,
  hasMessagesEarlierThan,
  userStatusInTheGroup,
} from "~/backend/service/topics/common/repo";
import { getGroupPeersLastReadSeqId } from "~/backend/service/topics/common/get-group-peer-last-read";
import { IsGroupTopicId } from "~/backend/service/common/topics";
import type { Message } from "~/backend/drizzle/message-type";
import { completeMediaUrl } from "~/backend/service/topics/use-cases/send-message/media";
import { MessageContent } from "~/backend/router/socket";
import { ServiceResult } from "~/api-contract/types";
import { AppError } from "~/api-contract/errors/errors";

import { getP2PTopicMessages } from "./get-p2p-topic-messages";
import { getGroupTopicMessages } from "./get-group-topic-messages";

export async function getMessages(
  db: AppPgDatabase,
  arg: {
    requesterUserId: UserId;
    topicId: UserId | GroupTopicId;
    beforeSequenceId: number;
    numberOfMessages: number;
  }
): ServiceResult<"topic/messages"> {
  // The flow of retrieving messages for a topic
  // ----------------------------------------------
  // 1. Get the messages for that topic
  // 2. Check if there is earlier messages
  // 3. Find out the read status of every message

  // 1. ⭐️ GET THE MESSAGES FOR THAT TOPIC
  let topicId: TopicId;
  let messages: ((
    | {
        type: "event_log";
        event: TopicEventType;
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
      numberOfMessages: arg.numberOfMessages,
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
      numberOfMessages: arg.numberOfMessages,
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
    return ok({ msgs: [], hasEarlierMessages: false });
  }

  // 2. ⭐️ CHECK IF THERE IS EARLIER MESSAGES
  let hasEarlierMessages = false;
  const earliestSequenceId = messages[0].sequenceId;
  if (messages.length <= arg.numberOfMessages) {
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
    hasEarlierMessages = hasEarlierMessagesResult.value;
  }

  // 3. ⭐️ FIND OUT THE READ STATUS OF EVERY MESSAGE
  if (IsGroupTopicId(topicId)) {
    const userStatusResult = await userStatusInTheGroup(db, {
      userId: arg.requesterUserId,
      topicId: topicId,
    });
    if (userStatusResult.isErr()) {
      return err(new AppError("UNKNOWN", { cause: userStatusResult.error }));
    }
    const peerLastReadSeqIdResult = await getGroupPeersLastReadSeqId(db, {
      topicId,
      requesterGroupMemberId: arg.requesterUserId,
    });
    if (peerLastReadSeqIdResult.isErr()) {
      return err(
        new AppError("UNKNOWN", { cause: peerLastReadSeqIdResult.error })
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
          m.content.url = completeMediaUrl(m.content.url);
        }
        if (
          m.type == "message" &&
          m.content.replyTo !== null &&
          m.content.replyTo.type == "picture"
        ) {
          m.content.replyTo.url = completeMediaUrl(m.content.replyTo.url);
        }
        let read = false;
        if (m.type == "message" && m.author == arg.requesterUserId) {
          read =
            peerLastReadSeqIdResult.value === null
              ? false
              : m.sequenceId <= peerLastReadSeqIdResult.value;
        } else {
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
    const userLastReadSeqIdResult = await getLastReadSequenceId(
      db,
      arg.requesterUserId,
      topicId
    );
    if (userLastReadSeqIdResult.isErr()) {
      return err(
        new AppError("UNKNOWN", { cause: userLastReadSeqIdResult.error })
      );
    }
    const peerLastReadSeqIdResult = await getLastReadSequenceId(
      db,
      arg.topicId as UserId,
      topicId
    );
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
          m.content.url = completeMediaUrl(m.content.url);
        }
        if (
          m.type == "message" &&
          m.content.replyTo !== null &&
          m.content.replyTo.type == "picture"
        ) {
          m.content.replyTo.url = completeMediaUrl(m.content.replyTo.url);
        }
        return m;
      }),
      hasEarlierMessages,
    });
  }
}
