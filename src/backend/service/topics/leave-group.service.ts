import { KyselyDB } from "~/backend/schema";
import { OnlineUsers } from "~/backend/service/common/online-users";
import { ServiceResult } from "~/api-contract/types";
import { AppError } from "~/api-contract/errors/errors";
import { GroupTopicId, UserId } from "~/api-contract/subscription/subscription";
import { match } from "ts-pattern";
import { groupAdminPermission } from "~/backend/service/common/permissions";
import { getPrecedingMessageDate } from "~/backend/service/topics/common/repo/repo";
import { fromPromise, ok, err } from "neverthrow";
import { getGroupMembers } from "~/backend/service/topics/common/repo/repo";

export async function leaveGroup(
  ctx: { db: KyselyDB; onlineUsers: OnlineUsers },
  arg: {
    groupTopicId: GroupTopicId;
    memberId: UserId;
  }
) {
  const r = await fromPromise(
    ctx.db.transaction().execute(async (tx) => {
      const deletedSubscription = await tx
        .deleteFrom("subscriptions")
        .where("topicId", "=", arg.groupTopicId)
        .where("userId", "=", arg.memberId)
        .returningAll()
        .executeTakeFirstOrThrow();

      const currentOwner = await tx
        .selectFrom("groupTopicMeta")
        .select("ownerId")
        .where("topicId", "=", arg.groupTopicId)
        .executeTakeFirstOrThrow();

      let newOwnerId: UserId | undefined = undefined;
      if (currentOwner.ownerId === arg.memberId) {
        const newOwner = await tx
          .selectFrom("subscriptions")
          .select("userId")
          .where("topicId", "=", arg.groupTopicId)
          .orderBy("createdAt", "asc")
          .limit(1)
          .executeTakeFirst();

        if (newOwner === undefined) {
          await tx
            .deleteFrom("topics")
            .where("topics.id", "=", arg.groupTopicId);
          return {
            type: "group-deleted" as const,
          };
        } else {
          await tx
            .updateTable("groupTopicMeta")
            .set({ ownerId: newOwner.userId })
            .where("topicId", "=", arg.groupTopicId)
            .execute();

          await tx
            .updateTable("subscriptions")
            .set({ permissions: groupAdminPermission() })
            .where("topicId", "=", arg.groupTopicId)
            .where("userId", "=", newOwner.userId)
            .execute();

          newOwnerId = newOwner.userId;
        }
      }

      const message = await tx
        .insertInto("messages")
        .values({ topicId: arg.groupTopicId })
        .returning(["id", "sequenceId", "createdAt"])
        .executeTakeFirstOrThrow();

      const precedingDate = await getPrecedingMessageDate(tx, {
        topicId: arg.groupTopicId,
        beforeSequenceId: message.sequenceId,
      });
      if (precedingDate.isErr()) {
        throw precedingDate.error;
      }

      const topicEventLog = await tx
        .insertInto("topicEventLogs")
        .values({
          topicEvent: "leave_group",
          topicId: arg.groupTopicId,
          actorUserId: arg.memberId,
          messageId: message.id,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      await tx.insertInto("topicEventLogMetaRemoveMember").values({
        id: topicEventLog.id,
        readSeqId: deletedSubscription.readSeqId,
        recvSeqId: deletedSubscription.recvSeqId,
      });

      const memberName = (
        await tx
          .selectFrom("users")
          .select("fullname")
          .where("id", "=", arg.memberId)
          .executeTakeFirstOrThrow()
      ).fullname;

      return {
        type: "group-left" as const,
        newOwnerId,
        memberName: memberName,
        message,
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

  if (r.value.type == "group-deleted") {
    const s = ctx.onlineUsers.get(arg.memberId);
    if (s) {
      s.sockets.next({
        event: "notification.group-deleted",
        payload: {
          topicId: arg.groupTopicId,
        },
      });
    }
    return ok({ type: "group-deleted" as const });
  }

  const groupMembers = await getGroupMembers(ctx.db, {
    groupTopicId: arg.groupTopicId,
  });

  if (groupMembers.isErr()) {
    return err(groupMembers.error);
  }

  const statusChange = ctx.onlineUsers.removeOnlineUserFromGroup(
    arg.memberId,
    arg.groupTopicId
  );
  if (statusChange.change) {
    const s = ctx.onlineUsers.get(statusChange.toNotify);
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
    const s = ctx.onlineUsers.get(m.id);

    if (s) {
      s.sockets.next({
        event: "notification.topic-event",
        payload: {
          event: {
            event: "leave_group",
            payload: {
              newOwnerId: r.value.newOwnerId,
            },
          },
          topicId: arg.groupTopicId,
          message: match(m.id)
            .with(arg.memberId, () => `You left the group`)
            .otherwise(() => `${r.value.memberName} left the group`),
          seqId: r.value.message.sequenceId,
          createdAt: new Date(r.value.message.createdAt),
          isFirstOfDate: r.value.isMessageFirstOfDate,
          actor: arg.memberId,
          affected: null,
        },
      });
    }
  }

  {
    const s = ctx.onlineUsers.get(arg.memberId);
    if (s) {
      s.sockets.next({
        event: "notification.topic-event",
        payload: {
          event: {
            event: "leave_group",
            payload: {
              newOwnerId: r.value.newOwnerId,
            },
          },
          topicId: arg.groupTopicId,
          message: `You left the group`,
          seqId: r.value.message.sequenceId,
          createdAt: new Date(r.value.message.createdAt),
          isFirstOfDate: r.value.isMessageFirstOfDate,
          actor: arg.memberId,
          affected: null,
        },
      });
    }
  }

  if (r.value.newOwnerId) {
    const s = ctx.onlineUsers.get(r.value.newOwnerId);
    if (s) {
      s.sockets.next({
        event: "notification.grp-topic-permission-update",
        payload: {
          topicId: arg.groupTopicId,
          permissionUpdated: "self",
          updatedPermission: "JRWPSDAO",
        },
      });
    }
  }

  return ok({});
}
