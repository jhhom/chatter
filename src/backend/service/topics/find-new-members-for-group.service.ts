import { fromPromise, ok, err } from "neverthrow";

import { UserId, GroupTopicId } from "~/api-contract/subscription/subscription";
import { KyselyDB } from "~/backend/schema";
import { AppError } from "~/api-contract/errors/errors";
import { completeMediaUrl } from "~/backend/service/common/media";

export async function findNewMembersForGroup(
  db: KyselyDB,
  assetServerUrl: string,
  input: {
    requesterUserId: UserId;
    groupTopicId: GroupTopicId;
    searchQueryUsername?: string;
  }
) {
  // The flow of finding contacts that user can add to the group
  // ---------------------------------------------------------
  // 1. Get the list of members in the group
  // 2. Get the list of user's P2P contacts that are not in the group member list

  // 1. ⭐️ GET THE LIST OF MEMBERS IN THE GROUP
  const subscribedUsersResult = await fromPromise(
    db
      .selectFrom("subscriptions")
      .select("subscriptions.userId as subscribedUserId")
      .where("subscriptions.topicId", "=", input.groupTopicId)
      .execute(),
    (e) => new AppError("DATABASE", { cause: e })
  ).map((v) => v.map((id) => id.subscribedUserId));
  if (subscribedUsersResult.isErr()) {
    return err(subscribedUsersResult.error);
  }

  // 2. ⭐️ GET THE LIST OF USER'S P2P CONTACTS THAT ARE NOT IN THE GROUP MEMBER LIST
  const p2pUserIdsResult = await getUserP2PTopicsNotInSubscriptionList(
    db,
    assetServerUrl,
    {
      userId: input.requesterUserId,
      subscriptionList: subscribedUsersResult.value,
      searchQueryUsername: input.searchQueryUsername,
    }
  );
  return p2pUserIdsResult;
}

function getUserP2PTopicsNotInSubscriptionList(
  db: KyselyDB,
  assetServerUrl: string,
  input: {
    userId: UserId;
    subscriptionList: UserId[];
    searchQueryUsername?: string;
  }
) {
  let query = db
    .selectFrom("topics")
    .innerJoin("subscriptions as peer", (join) =>
      join
        .onRef("peer.topicId", "=", "topics.id")
        .on(({ not, eb }) => not(eb("peer.userId", "=", input.userId)))
    )
    .innerJoin("subscriptions as requester", (join) =>
      join
        .onRef("requester.topicId", "=", "topics.id")
        .on("requester.userId", "=", input.userId)
    )
    .innerJoin("users", "users.id", "peer.userId")
    .select([
      "peer.userId",
      "users.fullname as userFullname",
      "users.profilePhotoUrl",
    ]);

  if (input.searchQueryUsername !== undefined) {
    query = query.where(({ and, eb, not }) =>
      and(
        input.searchQueryUsername
          ? [
              eb("topics.id", "like", "p2p%"),
              not(eb("peer.userId", "in", input.subscriptionList)),
              eb("users.fullname", "ilike", `%${input.searchQueryUsername}%`),
            ]
          : [
              eb("topics.id", "like", "p2p%"),
              not(eb("peer.userId", "in", input.subscriptionList)),
            ]
      )
    );
  } else {
    query = query
      .where("topics.id", "like", "p2p%")
      .where(({ not, eb }) =>
        not(eb("peer.userId", "in", input.subscriptionList))
      );
  }

  return fromPromise(
    query.execute(),
    (e) => new AppError("DATABASE", { cause: e })
  ).map((v) =>
    v.map((u) => ({
      ...u,
      profilePhotoUrl: u.profilePhotoUrl
        ? completeMediaUrl(assetServerUrl, u.profilePhotoUrl)
        : null,
    }))
  );
}
