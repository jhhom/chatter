import { AppPgDatabase } from "~/backend/drizzle/db";
import { OnlineUsers } from "~/backend/service/common/online-users";
import { and, asc, eq } from "drizzle-orm";
import {
  GroupTopicId,
  UserId,
  subscriptions,
  messages,
  users,
  topicEventLogs,
  topicEventLogMetaRemoveMember,
  topics,
  groupTopicMeta,
} from "~/backend/drizzle/schema";
import { getPrecedingMessageDate } from "../../common/repo";
import { fromPromise, ok, err } from "neverthrow";
import { getGroupMembers } from "../get-group-members/get-group-members";
import { match } from "ts-pattern";
import { ServiceResult } from "~/api-contract/types";
import { AppError } from "~/api-contract/errors/errors";

export async function leaveGroup(
  ctx: { db: AppPgDatabase; onlineUsers: OnlineUsers },
  input: {
    groupTopicId: GroupTopicId;
    memberId: UserId;
  }
): ServiceResult<"group/leave_group"> {
  const r = await fromPromise(
    ctx.db.transaction(async (tx) => {
      const deletedSubscription = (
        await tx
          .delete(subscriptions)
          .where(
            and(
              eq(subscriptions.topicId, input.groupTopicId),
              eq(subscriptions.userId, input.memberId)
            )
          )
          .returning()
      )[0];

      const currentOwner = await tx
        .select({ id: groupTopicMeta.ownerId })
        .from(groupTopicMeta)
        .where(eq(groupTopicMeta.topicId, input.groupTopicId));

      let newOwnerId: UserId | undefined = undefined;
      if (currentOwner.length > 0 && currentOwner[0].id === input.memberId) {
        const newOwner = await tx
          .select({ id: subscriptions.userId })
          .from(subscriptions)
          .where(and(eq(subscriptions.topicId, input.groupTopicId)))
          .orderBy(asc(subscriptions.createdAt))
          .limit(1);

        if (newOwner.length != 0) {
          newOwnerId = newOwner[0].id;
          await tx
            .update(groupTopicMeta)
            .set({ ownerId: newOwnerId })
            .where(eq(groupTopicMeta.topicId, input.groupTopicId));

          await tx
            .update(subscriptions)
            .set({ permissions: "JRWPSDAO" })
            .where(
              and(
                eq(subscriptions.topicId, input.groupTopicId),
                eq(subscriptions.userId, newOwnerId)
              )
            );
        } else {
          await tx.delete(topics).where(eq(topics.id, input.groupTopicId));
          return {
            type: "group-deleted" as const,
          };
        }
      }

      const message = (
        await tx
          .insert(messages)
          .values({
            topicId: input.groupTopicId,
          })
          .returning({
            id: messages.id,
            sequenceId: messages.sequenceId,
            createdAt: messages.createdAt,
          })
      )[0];

      const precedingDate = await getPrecedingMessageDate(tx, {
        topicId: input.groupTopicId,
        beforeSequenceId: message.sequenceId,
      });
      if (precedingDate.isErr()) {
        throw precedingDate.error;
      }

      const createdTopicEventLog = (
        await tx
          .insert(topicEventLogs)
          .values({
            topicEvent: "leave_group",
            topicId: input.groupTopicId,
            actorUserId: input.memberId,
            messageId: message.id,
          })
          .returning()
      )[0];

      await tx.insert(topicEventLogMetaRemoveMember).values({
        id: createdTopicEventLog.id,
        readSeqId: deletedSubscription.readSeqId,
        recvSeqId: deletedSubscription.recvSeqId,
      });

      const memberName = await tx
        .select({ fullname: users.fullname })
        .from(users)
        .where(eq(users.id, input.memberId));
      if (memberName.length == 0) {
        throw new Error("the name of member is not found");
      }

      return {
        type: "group-left" as const,
        newOwnerId,
        memberName: memberName[0].fullname,
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
    const s = ctx.onlineUsers.get(input.memberId);
    if (s) {
      s.sockets.next({
        event: "notification.group-deleted",
        payload: {
          topicId: input.groupTopicId,
        },
      });
    }
    return ok({ type: "group-deleted" as const });
  }

  const groupMembers = await getGroupMembers(ctx, {
    groupTopicId: input.groupTopicId,
  });

  if (groupMembers.isErr()) {
    return err(groupMembers.error);
  }

  const statusChange = ctx.onlineUsers.removeOnlineUserFromGroup(
    input.memberId,
    input.groupTopicId
  );
  if (statusChange.change) {
    const s = ctx.onlineUsers.get(statusChange.toNotify);
    if (s) {
      s.sockets.next({
        event: "notification.off",
        payload: {
          topicId: input.groupTopicId,
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
          topicId: input.groupTopicId,
          message: match(m.id)
            .with(input.memberId, () => `You left the group`)
            .otherwise(() => `${r.value.memberName} left the group`),
          seqId: r.value.message.sequenceId,
          createdAt: new Date(r.value.message.createdAt),
          isFirstOfDate: r.value.isMessageFirstOfDate,
          actor: input.memberId,
          affected: null,
        },
      });
    }
  }

  {
    const s = ctx.onlineUsers.get(input.memberId);
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
          topicId: input.groupTopicId,
          message: `You left the group`,
          seqId: r.value.message.sequenceId,
          createdAt: new Date(r.value.message.createdAt),
          isFirstOfDate: r.value.isMessageFirstOfDate,
          actor: input.memberId,
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
          topicId: input.groupTopicId,
          permissionUpdated: "self",
          updatedPermission: "JRWPSDAO",
        },
      });
    }
  }

  return ok({});
}
