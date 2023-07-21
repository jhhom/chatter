import { KyselyDB } from "~/backend/schema";
import { GroupTopicId, UserId } from "~/api-contract/subscription/subscription";
import { OnlineUsers } from "~/backend/service/common/online-users";
import { fromPromise, ok, err } from "neverthrow";
import { match } from "ts-pattern";
import { ServiceResult } from "~/api-contract/types";
import { AppError } from "~/api-contract/errors/errors";
import {
  getGroupMembers,
  getPrecedingMessageDate,
} from "~/backend/service/topics/common/repo/repo";

export async function removeGroupMember(
  {
    db,
    onlineUsers,
  }: {
    db: KyselyDB;
    onlineUsers: OnlineUsers;
  },
  arg: {
    /** user id of the person who removed the member */
    removerUserId: UserId;
    groupTopicId: GroupTopicId;
    memberId: UserId;
  }
) {
  const r = await fromPromise(
    db.transaction().execute(async (tx) => {
      const deletedSubscription = await tx
        .deleteFrom("subscriptions")
        .where("topicId", "=", arg.groupTopicId)
        .where("userId", "=", arg.memberId)
        .returning(["readSeqId", "recvSeqId"])
        .executeTakeFirstOrThrow();

      const message = await tx
        .insertInto("messages")
        .values({
          topicId: arg.groupTopicId,
        })
        .returning(["id", "sequenceId", "createdAt"])
        .executeTakeFirstOrThrow();

      const precedingDate = await getPrecedingMessageDate(tx, {
        topicId: arg.groupTopicId,
        beforeSequenceId: message.sequenceId,
      });
      if (precedingDate.isErr()) {
        throw precedingDate.error;
      }

      const createdTopicEventLog = await tx
        .insertInto("topicEventLogs")
        .values({
          topicEvent: "remove_member",
          topicId: arg.groupTopicId,
          actorUserId: arg.removerUserId,
          affectedUserId: arg.memberId,
          messageId: message.id,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      await tx
        .insertInto("topicEventLogMetaRemoveMember")
        .values({
          id: createdTopicEventLog.id,
          readSeqId: deletedSubscription.readSeqId,
          recvSeqId: deletedSubscription.recvSeqId,
        })
        .execute();

      const _names = await tx
        .selectFrom("users as removed")
        .innerJoin("users as remover", (join) =>
          join.on("remover.id", "=", arg.removerUserId)
        )
        .where("removed.id", "=", arg.memberId)
        .select([
          "removed.id as removedId",
          "removed.fullname as removedFullname",
          "remover.id as removerId",
          "remover.fullname as removerFullname",
        ])
        .executeTakeFirstOrThrow();
      const names = {
        removed: {
          id: _names.removedId,
          fullname: _names.removedFullname,
        },
        remover: {
          id: _names.removerId,
          fullname: _names.removerFullname,
        },
      };

      return {
        ...names,
        message,
        logCreatedAt: message.createdAt,
        isMessageFirstOfDate: precedingDate.value
          ? precedingDate.value.toDateString() !=
            new Date(message.createdAt).toDateString()
          : true,
      };
    }),
    (e) => new AppError("UNKNOWN", { cause: e })
  );
  if (r.isErr()) {
    return err(r.error);
  }

  const groupMembers = await getGroupMembers(db, {
    groupTopicId: arg.groupTopicId,
  });

  if (groupMembers.isErr()) {
    return err(new AppError("UNKNOWN", { cause: groupMembers.error }));
  }

  const statusChange = onlineUsers.removeOnlineUserFromGroup(
    arg.memberId,
    arg.groupTopicId
  );
  if (statusChange.change) {
    const s = onlineUsers.get(statusChange.toNotify);
    if (s) {
      s.sockets.next({
        event: "notification.off",
        payload: {
          topicId: arg.groupTopicId,
          lastOnline: new Date(),
        },
      });
    }
  }

  // notify all the members
  for (const m of groupMembers.value) {
    const s = onlineUsers.get(m.id);

    if (s) {
      s.sockets.next({
        event: "notification.topic-event",
        payload: {
          event: {
            event: "remove_member",
            payload: {},
          },
          topicId: arg.groupTopicId,
          message: match(m.id)
            .with(
              r.value.remover.id,
              () => `You removed ${r.value.removed.fullname}`
            )
            .otherwise(
              () =>
                `${r.value.remover.fullname} removed ${r.value.removed.fullname}`
            ),
          seqId: r.value.message.sequenceId,
          createdAt: new Date(r.value.logCreatedAt),
          isFirstOfDate: r.value.isMessageFirstOfDate,
          actor: arg.removerUserId,
          affected: arg.memberId,
        },
      });
    }
  }

  const s = onlineUsers.get(arg.memberId);
  if (s) {
    s.sockets.next({
      event: "notification.topic-event",
      payload: {
        event: {
          event: "remove_member",
          payload: {},
        },
        topicId: arg.groupTopicId,
        message: `${r.value.remover.fullname} removed you`,
        seqId: r.value.message.sequenceId,
        createdAt: new Date(r.value.logCreatedAt),
        isFirstOfDate: r.value.isMessageFirstOfDate,
        actor: arg.removerUserId,
        affected: arg.memberId,
      },
    });
  }

  return ok(groupMembers.value);
}
