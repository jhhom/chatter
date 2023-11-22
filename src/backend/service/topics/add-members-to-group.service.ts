import { Insertable } from "kysely";
import { match } from "ts-pattern";

import { KyselyDB, TopicEventLogs } from "~/backend/schema";
import { fromPromise, ok, err, Result } from "neverthrow";
import { GroupTopicId, UserId } from "~/api-contract/subscription/subscription";
import { getGroupMembers } from "~/backend/service/topics/get-group-members.service";
import { getPrecedingMessageDate } from "~/backend/service/topics/common/repo/repo";
import { OnlineUsers } from "~/backend/service/common/online-users";
import { AppError } from "~/api-contract/errors/errors";
import { CONSTRAINTS } from "~/backend/schema";
import { completeMediaUrl } from "~/backend/service/common/media";
import { ServiceResult } from "~/api-contract/types";

export async function addMembersToGroup(
  ctx: { db: KyselyDB; onlineUsers: OnlineUsers; assetServerUrl: string },
  arg: {
    /** user id of the person who add the members */
    adderUserId: UserId;
    groupTopicId: GroupTopicId;
    membersToAdd: UserId[];
  }
): ServiceResult<"group/add_members"> {
  const { db } = ctx;

  const r = await fromPromise(
    db
      .selectFrom("groupTopicMeta")
      .select(["ownerId", "defaultPermissions", "groupName", "profilePhotoUrl"])
      .where("groupTopicMeta.topicId", "=", arg.groupTopicId)
      .executeTakeFirst(),
    (e) => e
  );
  if (r.isErr()) {
    return err(new AppError("DATABASE", { cause: r.error }));
  }

  if (r.value === undefined) {
    return err(new AppError("RESOURCE_NOT_FOUND", { resource: "group" }));
  }

  const grp = r.value;

  const subscriptionCreateResult = await fromPromise(
    db.transaction().execute(async (tx) => {
      await tx
        .insertInto("subscriptions")
        .values(
          arg.membersToAdd.map((m) => ({
            topicId: arg.groupTopicId,
            userId: m,
            permissions: grp.defaultPermissions,
          }))
        )
        .onConflict((oc) =>
          oc
            .constraint(
              CONSTRAINTS.Subscriptions.subscriptions_user_id_topic_id_key
            )
            .doNothing()
        )
        .execute();

      const adderName = (
        await tx
          .selectFrom("users")
          .select("users.fullname")
          .where("users.id", "=", arg.adderUserId)
          .executeTakeFirstOrThrow()
      ).fullname;

      const notifications: {
        isFirstOfDate: boolean;
        sequenceId: number;
        createdAt: Date;
        addedName: string;
        addedUserId: UserId;
        profilePhotoUrl: string | null;
      }[] = [];

      for (const m of arg.membersToAdd) {
        const msg = await tx
          .insertInto("messages")
          .values({
            topicId: arg.groupTopicId,
          })
          .returning([
            "messages.id",
            "messages.sequenceId",
            "messages.createdAt",
          ])
          .executeTakeFirstOrThrow();

        const precedingDate = await getPrecedingMessageDate(tx, {
          topicId: arg.groupTopicId,
          beforeSequenceId: msg.sequenceId,
        });
        if (precedingDate.isErr()) {
          throw precedingDate.error;
        }

        const log: Insertable<TopicEventLogs> = {
          topicEvent: "add_member",
          topicId: arg.groupTopicId,
          actorUserId: arg.adderUserId,
          affectedUserId: m,
          messageId: msg.id,
        };

        const addedUser = await tx
          .selectFrom("users")
          .select(["users.fullname as name", "users.profilePhotoUrl"])
          .where("users.id", "=", m)
          .executeTakeFirstOrThrow();

        await tx.insertInto("topicEventLogs").values(log).execute();

        notifications.push({
          isFirstOfDate: precedingDate.value
            ? new Date(precedingDate.value).toDateString() !=
              new Date(msg.createdAt).toDateString()
            : true,
          sequenceId: msg.sequenceId,
          createdAt: new Date(msg.createdAt),
          addedName: addedUser.name,
          addedUserId: m,
          profilePhotoUrl: addedUser.profilePhotoUrl
            ? completeMediaUrl(ctx.assetServerUrl, addedUser.profilePhotoUrl)
            : null,
        });
      }

      return {
        actorFullname: adderName,
        notifications,
      };
    }),
    (e) => e
  );
  if (subscriptionCreateResult.isErr()) {
    return err(
      new AppError("DATABASE", { cause: subscriptionCreateResult.error })
    );
  }

  // 4. ⭐️ SEND THE TOPIC EVENT TO EVERY ONLINE MEMBER
  const members = await getGroupMembers(ctx, {
    groupTopicId: arg.groupTopicId,
  });
  if (members.isErr()) {
    return err(new AppError("UNKNOWN", { cause: members.error }));
  }

  let statusChanged = false;
  for (const m of members.value) {
    const s = ctx.onlineUsers.addOnlineUserToGroup(m.id, arg.groupTopicId);
    if (s.change) {
      statusChanged = true;
    }
  }

  const grpStatus = ctx.onlineUsers.isGroupTopicOnline(arg.groupTopicId);

  // notify all added members
  for (const m of arg.membersToAdd) {
    const s = ctx.onlineUsers.get(m);

    if (s) {
      s.sockets.next({
        event: "notification.added-to-group",
        payload: {
          groupId: arg.groupTopicId,
          groupName: grp.groupName,
          ownerId: grp.ownerId,
          groupDefaultPermission: grp.defaultPermissions,
          userPermission: grp.defaultPermissions,
          profilePhotoUrl: grp.profilePhotoUrl
            ? completeMediaUrl(ctx.assetServerUrl, grp.profilePhotoUrl)
            : null,
          status: grpStatus.isOnline
            ? {
                online: true,
                latestTyping: null,
              }
            : {
                online: false,
              },
        },
      });
    }
  }

  // notify all the members
  for (const m of members.value) {
    const s = ctx.onlineUsers.get(m.id);

    if (s) {
      for (const n of subscriptionCreateResult.value.notifications) {
        s.sockets.next({
          event: "notification.topic-event",
          payload: {
            event: {
              event: "add_member",
              payload: {
                name: n.addedName,
                online: ctx.onlineUsers.isUserOnline(n.addedUserId),
                profilePhotoUrl: n.profilePhotoUrl,
              },
            },
            topicId: arg.groupTopicId,
            message: match(m.id)
              .with(arg.adderUserId, () => `You added ${n.addedName}`)
              .otherwise(
                () =>
                  `${subscriptionCreateResult.value.actorFullname} added ${n.addedName}`
              ),
            seqId: n.sequenceId,
            createdAt: n.createdAt,
            isFirstOfDate: n.isFirstOfDate,
            actor: arg.adderUserId,
            affected: n.addedUserId,
          },
        });
      }

      if (statusChanged) {
        s.sockets.next({
          event: "notification.on",
          payload: {
            topicId: arg.groupTopicId,
          },
        });
      }
    }
  }

  return ok(
    members.value.map((m) => ({
      ...m,
      online: ctx.onlineUsers.isUserOnline(m.id),
    }))
  );
}
