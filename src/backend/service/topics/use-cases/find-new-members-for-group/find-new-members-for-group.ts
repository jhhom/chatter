import { eq, and, not, like, ilike, notInArray } from "drizzle-orm";
import { fromPromise, ok, err } from "neverthrow";
import { alias } from "drizzle-orm/pg-core";

import {
  GroupTopicId,
  UserId,
  subscriptions,
  users,
  topics,
} from "~/backend/drizzle/schema";
import { AppPgDatabase } from "~/backend/drizzle/db";
import { completeMediaUrl } from "~/backend/service/topics/use-cases/send-message/media";
import { ServiceResult } from "~/api-contract/types";
import { AppError } from "~/api-contract/errors/errors";

export async function findNewMembersForGroup(
  ctx: { db: AppPgDatabase },
  input: {
    requesterUserId: UserId;
    groupTopicId: GroupTopicId;
    searchQueryUsername?: string;
  }
): ServiceResult<"group/find_new_members"> {
  // The flow of finding contacts that user can add to the group
  // ---------------------------------------------------------
  // 1. Get the list of members in the group
  // 2. Get the list of user's P2P contacts that are not in the group member list

  // 1. ⭐️ GET THE LIST OF MEMBERS IN THE GROUP
  const subscribedUsersResult = await fromPromise(
    ctx.db
      .select({ subscribedUserId: subscriptions.userId })
      .from(subscriptions)
      .where(eq(subscriptions.topicId, input.groupTopicId)),
    (e) => new AppError("DATABASE", { cause: e })
  ).map((id) => id.map((id) => id.subscribedUserId));
  if (subscribedUsersResult.isErr()) {
    return err(subscribedUsersResult.error);
  }

  // 2. ⭐️ GET THE LIST OF USER'S P2P CONTACTS THAT ARE NOT IN THE GROUP MEMBER LIST
  const p2pUserIdsResult = await getUserP2PTopicsNotInSubscriptionList(ctx.db, {
    userId: input.requesterUserId,
    subscriptionList: subscribedUsersResult.value,
    searchQueryUsername: input.searchQueryUsername,
  });
  return p2pUserIdsResult;
}

function getUserP2PTopicsNotInSubscriptionList(
  db: AppPgDatabase,
  input: {
    userId: UserId;
    subscriptionList: UserId[];
    searchQueryUsername?: string;
  }
) {
  const requester = alias(subscriptions, "requester");
  const peer = alias(subscriptions, "peer");

  let conditions = and(
    like(topics.id, "p2p%"),
    notInArray(peer.userId, input.subscriptionList)
  );

  if (input.searchQueryUsername) {
    conditions = and(
      like(topics.id, "p2p%"),
      notInArray(peer.userId, input.subscriptionList),
      ilike(users.fullname, `%${input.searchQueryUsername}%`)
    );
  }

  return fromPromise(
    db
      .select({
        userId: peer.userId,
        userFullname: users.fullname,
        profilePhotoUrl: users.profilePhotoUrl,
      })
      .from(topics)
      .innerJoin(
        peer,
        and(eq(peer.topicId, topics.id), not(eq(peer.userId, input.userId)))
      )
      .innerJoin(
        requester,
        and(
          eq(requester.topicId, topics.id),
          eq(requester.userId, input.userId)
        )
      )
      .innerJoin(users, eq(peer.userId, users.id))
      .where(conditions),
    (e) => new AppError("DATABASE", { cause: e })
  ).map((v) =>
    v.map((u) => ({
      ...u,
      profilePhotoUrl: u.profilePhotoUrl
        ? completeMediaUrl(u.profilePhotoUrl)
        : null,
    }))
  );
}
