import { fromPromise, ok, err } from "neverthrow";
import { KyselyDB } from "~/backend/schema";
import { completeMediaUrl } from "~/backend/service/common/media";
import {
  Message,
  Event,
  getMessagesOfTopic,
} from "~/backend/service/topics/get-unread-messages/get-unread-messages.repo";
import { getTopicsOfUser } from "~/backend/service/topics/get-unread-messages/get-unread-messages.repo";
import { AppError } from "~/api-contract/errors/errors";
import {
  GroupTopicId,
  P2PTopicId,
} from "~/api-contract/subscription/subscription";
import { UserId } from "~/api-contract/subscription/subscription";
import { ServiceResult } from "~/api-contract/types";

type TopicMessage = Omit<Message, "type"> & {
  isFirstOfDate: boolean;
  read: boolean;
};
type TopicEventLog = Omit<Event, "type"> & {
  isFirstOfDate: boolean;
  read: boolean;
};

export async function getAllUnreadMessages(
  db: KyselyDB,
  assetServerUrl: string,
  userId: UserId
): ServiceResult<"topic/unread_messages"> {
  // The flow of getting all unread messages of a user
  // ---------------------------------------------------------
  // 1. Get all the topics user is subscribed to and their last read sequence id on each topic
  // 2. For every topic, get all the messages of that topic after the user's last read sequence id
  // 1. ⭐️ GET ALL THE TOPICS USER IS SUBSCRIBED TO AND THEIR LAST READ SEQUENCE ID ON EACH TOPIC
  const topics = await getTopicsOfUser(db, userId);
  if (topics.isErr()) {
    return err(new AppError("UNKNOWN", { cause: topics.error }));
  }
  const { p2pTopics, grpTopics } = topics.value;

  const topicMessages: {
    p2pTopics: {
      topic: {
        id: UserId;
        name: string;
      };
      messages: TopicMessage[];
      eventLogs: TopicEventLog[];
    }[];
    grpTopics: {
      topic: {
        id: GroupTopicId;
        name: string;
      };
      messages: TopicMessage[];
      eventLogs: TopicEventLog[];
    }[];
  } = {
    p2pTopics: [],
    grpTopics: [],
  };

  // 2. ⭐️ GET ALL THE MESSAGES OF THAT TOPIC AFTER THE USER'S LAST READ SEQUENCE ID
  for (const t of p2pTopics) {
    const unread = await getMessagesOfTopic(db, {
      userId: userId,
      topic: {
        type: "p2p",
        id: t.topicId as P2PTopicId,
        peerId: t.topicUserId,
      },
      afterSequenceId: t.lastReadSequenceId ? t.lastReadSequenceId : 0,
    });

    if (unread.isErr()) {
      return err(new AppError("UNKNOWN", { cause: unread.error }));
    }

    topicMessages.p2pTopics.push({
      topic: {
        id: t.topicUserId,
        name: t.topicName,
      },
      messages: unread.value.messages.map((m) => {
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
      eventLogs: unread.value.eventLogs,
    });
  }

  for (const t of grpTopics) {
    const unread = await getMessagesOfTopic(db, {
      userId: userId,
      topic: {
        type: "grp",
        id: t.topicId,
      },
      afterSequenceId: t.lastReadSequenceId ? t.lastReadSequenceId : 0,
    });

    if (unread.isErr()) {
      return err(new AppError("UNKNOWN", { cause: unread.error }));
    }

    topicMessages.grpTopics.push({
      topic: {
        id: t.topicId,
        name: t.topicName,
      },
      messages: unread.value.messages.map((m) => {
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
      eventLogs: unread.value.eventLogs,
    });
  }

  console.log(JSON.stringify(topicMessages));

  return ok(topicMessages);
}
