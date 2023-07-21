import { ok, err } from "neverthrow";
import { KyselyDB } from "~/backend/schema";
import { OnlineUsers } from "~/backend/service/common/online-users";
import { GroupTopicId, UserId } from "~/api-contract/subscription/subscription";
import { IsUserId } from "~/backend/service/common/topics";

import {
  updateMessageReadStatusForP2PTopic,
  updateMessageReadStatusOfGroupTopicAndGetSubscribersToNotify,
} from "~/backend/service/topics/update-message-read-status/update-message-read-status.repo";
import { ServiceResult } from "~/api-contract/types";
import { AppError } from "~/api-contract/errors/errors";

export async function updateMessageReadStatus(
  {
    db,
    onlineUsers,
  }: {
    db: KyselyDB;
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
    const result = await updateMessageReadStatusForP2PTopic(db, {
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
    const user = onlineUsers.get(arg.topicId);
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
      await updateMessageReadStatusOfGroupTopicAndGetSubscribersToNotify(db, {
        readSequenceId: arg.readSequenceId,
        updaterUserId: arg.updaterUserId,
        topicId: arg.topicId,
      });
    if (subscribers.isErr()) {
      return err(new AppError("UNKNOWN", { cause: subscribers.error }));
    }

    // 2. SEND NOTIFICATION
    for (const { userId } of subscribers.value) {
      const user = onlineUsers.get(userId);
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
