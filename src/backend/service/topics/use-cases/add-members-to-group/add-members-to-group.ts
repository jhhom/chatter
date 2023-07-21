import { AppPgDatabase } from "~/backend/drizzle/db";
import { fromPromise, ok, err, Result } from "neverthrow";
import {
  GroupTopicId,
  UserId,
  topicEventLogs,
  groupTopicMeta,
  subscriptions,
  messages,
  users,
} from "~/backend/drizzle/schema";
import { getGroupMembers } from "~/backend/service/topics/use-cases/get-group-members/get-group-members";
import { getPrecedingMessageDate } from "~/backend/service/topics/common/repo";
import { OnlineUsers } from "~/backend/service/common/online-users";
import { eq } from "drizzle-orm";
import { match } from "ts-pattern";
import { InferModel } from "drizzle-orm";
import { completeMediaUrl } from "../send-message/media";

import type { ServiceResult } from "~/api-contract/types";
import { AppError } from "~/api-contract/errors/errors";

export async function addMembersToGroup(
  ctx: { db: AppPgDatabase; onlineUsers: OnlineUsers },
  arg: {
    /** user id of the person who add the members */
    adderUserId: UserId;
    groupTopicId: GroupTopicId;
    membersToAdd: UserId[];
  }
): ServiceResult<"group/add_members"> {
  // The flow of group members adding new members to the group
  // ---------------------------------------------------------
  // 1. Get the group default permission, newly added members will have their permission in the group as this default
  // 2. For every member added, create a new subscription for the member to this group
  // 3. Create a topic event log in the group
  // 4. Send the topic event to every online member

  // 1. ⭐️ GET THE GROUP DEFAULT PERMISSION, NEWLY ADDED MEMBERS WILL HAVE THEIR PERMISSION IN THE GROUP AS THIS DEFAULT
  const r = await fromPromise(
    ctx.db
      .select({
        ownerId: groupTopicMeta.ownerId,
        defaultPermissions: groupTopicMeta.defaultPermissions,
        groupName: groupTopicMeta.groupName,
        groupProfilePhotoUrl: groupTopicMeta.profilePhotoUrl,
      })
      .from(groupTopicMeta)
      .where(eq(groupTopicMeta.topicId, arg.groupTopicId)),
    (e) => e
  );
  if (r.isErr()) {
    return err(new AppError("DATABASE", { cause: r.error }));
  }

  if (r.value.length == 0) {
    return err(new AppError("RESOURCE_NOT_FOUND", { resource: "group" }));
  }

  const { defaultPermissions, groupName, groupProfilePhotoUrl, ownerId } =
    r.value[0];

  const subscriptionCreateResult = await fromPromise(
    ctx.db.transaction(async (tx) => {
      // 2. ⭐️ FOR EVERY MEMBER ADDED, CREATE A NEW SUBSCRIPTION FOR THE MEMBER TO THIS GROUP
      await tx
        .insert(subscriptions)
        .values(
          arg.membersToAdd.map((m) => ({
            topicId: arg.groupTopicId,
            userId: m,
            permissions: defaultPermissions,
          }))
        )
        .onConflictDoNothing();

      // 3. ⭐️ CREATE A TOPIC EVENT LOG IN THE GROUP
      const adderName = (
        await tx
          .select({ name: users.fullname })
          .from(users)
          .where(eq(users.id, arg.adderUserId))
      )[0].name;

      let notifications: {
        isFirstOfDate: boolean;
        sequenceId: number;
        createdAt: Date;
        addedName: string;
        addedUserId: UserId;
        profilePhotoUrl: string | null;
      }[] = [];

      for (const m of arg.membersToAdd) {
        const msg = (
          await tx
            .insert(messages)
            .values({
              topicId: arg.groupTopicId,
            })
            .returning({
              id: messages.id,
              sequenceId: messages.sequenceId,
              createdAt: messages.createdAt,
            })
        )[0];

        const precedingDate = await getPrecedingMessageDate(tx, {
          topicId: arg.groupTopicId,
          beforeSequenceId: msg.sequenceId,
        });
        if (precedingDate.isErr()) {
          throw precedingDate.error;
        }

        const log: InferModel<typeof topicEventLogs, "insert"> = {
          topicEvent: "add_member",
          topicId: arg.groupTopicId,
          actorUserId: arg.adderUserId,
          affectedUserId: m,
          messageId: msg.id,
        };

        const addedUsers = await tx
          .select({
            name: users.fullname,
            profilePhotoUrl: users.profilePhotoUrl,
          })
          .from(users)
          .where(eq(users.id, m));
        if (addedUsers.length == 0) {
          throw new Error("No result returned from retrieving added user");
        }
        const addedUser = addedUsers[0];

        await tx.insert(topicEventLogs).values(log);

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
            ? completeMediaUrl(addedUser.profilePhotoUrl)
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
          groupName,
          ownerId,
          groupDefaultPermission: defaultPermissions,
          userPermission: defaultPermissions,
          profilePhotoUrl: groupProfilePhotoUrl
            ? completeMediaUrl(groupProfilePhotoUrl)
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
