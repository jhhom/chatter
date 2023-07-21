import { ok, err } from "neverthrow";

import { AppPgDatabase } from "~/backend/drizzle/db";
import { OnlineUsers } from "~/backend/service/common/online-users";
import { GroupTopicId } from "~/backend/drizzle/schema";
import { UserId } from "~/backend/drizzle/schema";
import { IsUserId } from "~/backend/service/common/topics";

import {
  db_updateMessageReadStatusForP2PTopic,
  updateMessageReadStatusOfGroupTopicAndGetSubscribersToNotify,
} from "./update-message-read-status.repo";

import { ServiceResult } from "~/api-contract/types";
import { AppError } from "~/api-contract/errors/errors";

export async function updateMessageReadStatus(
  ctx: {
    db: AppPgDatabase;
    onlineUsers: OnlineUsers;
  },
  arg: {
    readSequenceId: number;
    updaterUserId: UserId;
    topicId: GroupTopicId | UserId;
  }
): ServiceResult<"topic/update_message_read_status"> {
  if (IsUserId(arg.topicId)) {
    // 1. UPDATE STATUS
    const result = await db_updateMessageReadStatusForP2PTopic(ctx, {
      readSequenceId: arg.readSequenceId,
      updaterUserId: arg.updaterUserId,
      topicUserId: arg.topicId,
    });
    if (result.isErr()) {
      return err(new AppError("UNKNOWN", { cause: result.error }));
    }

    // the bug:
    // when Carol login from another window, they will call updateMessageReadStatus to tell that they have read the messages
    // Carol from another window would receive this updateMessageReadStatus notification
    // and thus update their read status of the messages in view based on the last read sequence id here
    // how should we solve this?

    // Method 1: I think if the person is Carol, the Carol shouldn't receive read notification
    // because Carol only changes their lastReadSeqId
    // and Carol doesn't care about its own lastReadSeqId at all, it isn't shown in their ChatPanel
    // so, we can skip carol

    // 2. SEND NOTIFICATION
    const user = ctx.onlineUsers.get(arg.topicId);
    if (user != undefined) {
      user.sockets.next({
        event: "read",
        payload: {
          topicId: result.value.topicId,
          topicUserId: arg.updaterUserId,
          lastReadSeqId: arg.readSequenceId,
        },
      });
    }
  } else {
    // 1. UPDATE STATUS
    const subscribers =
      await updateMessageReadStatusOfGroupTopicAndGetSubscribersToNotify(
        { db: ctx.db },
        {
          readSequenceId: arg.readSequenceId,
          updaterUserId: arg.updaterUserId,
          topicId: arg.topicId,
        }
      );
    if (subscribers.isErr()) {
      return err(new AppError("UNKNOWN", { cause: subscribers.error }));
    }

    // 2. SEND NOTIFICATION
    for (const { userId } of subscribers.value) {
      const user = ctx.onlineUsers.get(userId);
      if (user == undefined) {
        continue;
      }
      user.sockets.next({
        event: "read",
        payload: {
          topicId: arg.topicId,
          topicUserId: arg.updaterUserId,
          lastReadSeqId: arg.readSequenceId,
        },
      });
    }
  }

  return ok({});
}

// 1. get topic id
// 2. update the read status of that topic id
