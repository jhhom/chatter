import { AppPgDatabase } from "~/backend/drizzle/db";
import {
  GroupTopicId,
  UserId,
  topicEventLogs,
  messages,
  subscriptions,
  users,
  topicEventLogMetaRemoveMember,
} from "~/backend/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { fromPromise, err, ok } from "neverthrow";
import { OnlineUsers } from "~/backend/service/common/online-users";
import { alias } from "drizzle-orm/pg-core";
import { match } from "ts-pattern";
import {
  getGroupMembers,
  getPrecedingMessageDate,
} from "~/backend/service/topics/common/repo";
import { ServiceResult } from "~/api-contract/types";
import { AppError } from "~/api-contract/errors/errors";

export async function removeGroupMember(
  ctx: {
    db: AppPgDatabase;
    onlineUsers: OnlineUsers;
  },
  input: {
    /** user id of the person who removed the member */
    removerUserId: UserId;
    groupTopicId: GroupTopicId;
    memberId: UserId;
  }
): ServiceResult<"group/remove_member"> {
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
            topicEvent: "remove_member",
            topicId: input.groupTopicId,
            actorUserId: input.removerUserId,
            affectedUserId: input.memberId,
            messageId: message.id,
          })
          .returning()
      )[0];

      await tx.insert(topicEventLogMetaRemoveMember).values({
        id: createdTopicEventLog.id,
        readSeqId: deletedSubscription.readSeqId,
        recvSeqId: deletedSubscription.recvSeqId,
      });

      const removed = alias(users, "removed");
      const remover = alias(users, "remover");

      const names = await tx
        .select({
          removed: {
            id: removed.id,
            fullname: removed.fullname,
          },
          remover: {
            id: remover.id,
            fullname: remover.fullname,
          },
        })
        .from(removed)
        .where(eq(removed.id, input.memberId))
        .innerJoin(remover, eq(remover.id, input.removerUserId));

      if (names.length == 0) {
        throw new Error("the names of removed and remover are not found");
      }

      return {
        ...names[0],
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

  const groupMembers = await getGroupMembers(ctx, {
    groupTopicId: input.groupTopicId,
  });

  if (groupMembers.isErr()) {
    return err(new AppError("UNKNOWN", { cause: groupMembers.error }));
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
            event: "remove_member",
            payload: {},
          },
          topicId: input.groupTopicId,
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
          actor: input.removerUserId,
          affected: input.memberId,
        },
      });
    }
  }

  const s = ctx.onlineUsers.get(input.memberId);
  if (s) {
    s.sockets.next({
      event: "notification.topic-event",
      payload: {
        event: {
          event: "remove_member",
          payload: {},
        },
        topicId: input.groupTopicId,
        message: `${r.value.remover.fullname} removed you`,
        seqId: r.value.message.sequenceId,
        createdAt: new Date(r.value.logCreatedAt),
        isFirstOfDate: r.value.isMessageFirstOfDate,
        actor: input.removerUserId,
        affected: input.memberId,
      },
    });
  }

  return ok(groupMembers.value);
}
