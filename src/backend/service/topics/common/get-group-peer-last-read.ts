import { and, desc, eq, not, sql } from "drizzle-orm";
import { fromPromise } from "neverthrow";

import { AppPgDatabase } from "~/backend/drizzle/db";
import { UserId, GroupTopicId, subscriptions } from "~/backend/drizzle/schema";

export function getGroupPeersLastReadSeqId(
  db: AppPgDatabase,
  arg: {
    requesterGroupMemberId: UserId;
    topicId: GroupTopicId;
  }
) {
  return fromPromise(
    db
      .select({
        readSeqId: subscriptions.readSeqId,
      })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.topicId, arg.topicId),
          not(eq(subscriptions.userId, arg.requesterGroupMemberId))
        )
      )
      .orderBy(sql`${subscriptions.readSeqId} DESC NULLS LAST`)
      .limit(1),
    (e) => e
  ).map((v) => (v.length === 0 ? null : v[0].readSeqId));
}
