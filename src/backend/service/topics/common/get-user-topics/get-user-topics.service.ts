import { err, ok } from "neverthrow";
import { KyselyDB } from "~/backend/schema";
import {
  getLastMessageOfTopic,
  type LastMessageOfTopic,
} from "~/backend/service/topics/common/get-user-topics/get-last-message-of-topic.repo";
import {
  getP2PTopics,
  getGroupTopics,
  getPastGroupTopicsOfUser,
} from "~/backend/service/topics/common/get-user-topics/get-user-topics.repo";
import { ServiceResult } from "~/api-contract/types";
import { AppError } from "~/api-contract/errors/errors";
import {
  UserId,
  P2PTopicId,
  GroupTopicId,
  TopicId,
} from "~/api-contract/subscription/subscription";

export async function getUserTopics(
  db: KyselyDB,
  assetServerUrl: string,
  userId: UserId
): ServiceResult<"users/topics"> {
  const p2pTopics = await getP2PTopics(db, assetServerUrl, userId);
  if (p2pTopics.isErr()) {
    return err(new AppError("UNKNOWN", { cause: p2pTopics.error }));
  }
  const grpTopics = await getGroupTopics(db, assetServerUrl, userId);
  if (grpTopics.isErr()) {
    return err(new AppError("UNKNOWN", { cause: grpTopics.error }));
  }
  const pastGrpTopics = await getPastGroupTopicsOfUser(
    db,
    assetServerUrl,
    userId
  );
  if (pastGrpTopics.isErr()) {
    return err(new AppError("UNKNOWN", { cause: pastGrpTopics.error }));
  }

  const result: (
    | {
        topicName: string;
        touchedAt: Date | null;
        profilePhotoUrl: string | null;
        lastMessage: LastMessageOfTopic | null;
      } & (
        | {
            type: "grp";
            topicId: GroupTopicId;
            defaultPermissions: string;
            userPermissions: string;
            ownerId: UserId;
          }
        | {
            type: "p2p";
            p2pTopicId: P2PTopicId;
            topicId: UserId;
            peerPermissions: string;
            userPermissions: string;
            lastOnline: Date | null;
          }
        | {
            type: "past-grp";
            topicId: GroupTopicId;
            memberListSnapshot: {
              userId: UserId;
              name: string;
              profilePhotoUrl: string | null;
            }[];
          }
      )
  )[] = [
    ...p2pTopics.value.map((t) => ({
      ...t,
      lastMessage: null,
      type: "p2p" as const,
    })),
    ...grpTopics.value.map((t) => ({
      ...t,
      lastMessage: null,
      type: "grp" as const,
    })),
    ...pastGrpTopics.value.map((t) => ({
      ...t,
      lastMessage: null,
      type: "past-grp" as const,
    })),
  ];

  for (const r of result) {
    let topicId: TopicId;
    if (r.type == "grp" || r.type == "past-grp") {
      topicId = r.topicId;
    } else {
      topicId = r.p2pTopicId;
    }
    const lastMessageResult = await getLastMessageOfTopic(db, {
      topicId,
      requesterUserId: userId,
    });
    if (lastMessageResult.isErr()) {
      return err(new AppError("UNKNOWN", { cause: lastMessageResult.error }));
    }
    r.lastMessage = lastMessageResult.value;
  }

  return ok(result);
}
