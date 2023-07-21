import { err, ok } from "neverthrow";
import { AppPgDatabase } from "~/backend/drizzle/db";
import {
  UserId,
  GroupTopicId,
  P2PTopicId,
  TopicId,
} from "~/backend/drizzle/schema";
import {
  getLastMessageOfTopic,
  type LastMessageOfTopic,
} from "~/backend/service/topics/use-cases/get-user-topics/get-last-message-of-topic";

import { getP2PTopics } from "./repo/get-p2p-topics.repo";
import { getGroupTopics } from "./repo/get-grp-topics.repo";
import { getPastGroupTopicsOfUser } from "./repo/get-past-topics.repo";
import { ServiceResult } from "~/api-contract/types";
import { AppError } from "~/api-contract/errors/errors";

export async function getUserTopics(
  ctx: { db: AppPgDatabase },
  input: { userId: UserId }
): ServiceResult<"users/topics"> {
  const p2pTopics = await getP2PTopics(ctx.db, input.userId);
  if (p2pTopics.isErr()) {
    return err(new AppError("UNKNOWN", { cause: p2pTopics.error }));
  }
  const grpTopics = await getGroupTopics(ctx.db, input.userId);
  if (grpTopics.isErr()) {
    return err(new AppError("UNKNOWN", { cause: grpTopics.error }));
  }
  const pastGrpTopics = await getPastGroupTopicsOfUser(ctx.db, input.userId);
  if (pastGrpTopics.isErr()) {
    return err(new AppError("UNKNOWN", { cause: pastGrpTopics.error }));
  }

  let result: (
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
    const lastMessageResult = await getLastMessageOfTopic(ctx.db, {
      topicId,
      requesterUserId: input.userId,
    });
    if (lastMessageResult.isErr()) {
      return err(new AppError("UNKNOWN", { cause: lastMessageResult.error }));
    }
    r.lastMessage = lastMessageResult.value;
  }

  return ok(result);
}
