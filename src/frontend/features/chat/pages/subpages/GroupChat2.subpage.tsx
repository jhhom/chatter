import { useState, useRef, useEffect, useCallback } from "react";
import { ok, err, fromPromise } from "neverthrow";

import type { GroupTopicId } from "~/api-contract/subscription/subscription";

import { useAppStore } from "~/frontend/stores/stores";
import { client } from "~/frontend/external/api-client/client";
import { dexie } from "~/frontend/external/browser/indexed-db";

import { useMessagesStore } from "~/frontend/features/chat/pages/stores/messages/messages.store";
import { useMembersStore } from "~/frontend/features/chat/pages/stores/members/members.store";
import useAsyncEffect from "use-async-effect";

const PAGE_SIZE = 24;
const INITIAL_PAGE_SIZE = 64;

export function GroupChatPage2(props: { contactId: GroupTopicId }) {
  const store = useAppStore((s) => ({
    profile: s.profile,
    grp: s.grp.get(props.contactId),
    p2p: s.p2p,
    get: s.get,
    setContact: s.setContact,
  }));
  const messagesStore = useMessagesStore();
  const membersStore = useMembersStore();

  useEffect(() => {
    console.log("🔥 CURRENT MESSAGES", messagesStore.messages);
  }, [messagesStore.messages]);

  useAsyncEffect(
    async (isMounted) => {
      const memberRetrievalResult = await client["group/members"]({
        groupTopicId: props.contactId,
      });
      if (memberRetrievalResult.isErr()) {
        alert("failed to get group members");
      } else {
        if (!isMounted) {
          return;
        }

        for (const member of memberRetrievalResult.value) {
          membersStore.setMember(member.id, {
            name: member.fullname,
            online: member.online,
            profilePhotoUrl: member.profilePhotoUrl,
          });
        }
      }

      const result = await messagesStore.loadMessages(INITIAL_PAGE_SIZE, -1);
      if (result.isErr()) {
        return;
      }

      if (!isMounted) {
        return;
      }

      messagesStore.setMessages(result.value.earlierMessages);

      console.log("LOADED MESSAGES", messagesStore.get().messages);

      if (messagesStore.get().messages.length !== 0) {
        const messageStatusUpdateResult = await client[
          "topic/update_message_read_status"
        ]({
          sequenceId:
            messagesStore.get().messages[
              messagesStore.get().messages.length - 1
            ].seqId,
          topicId: props.contactId,
        });

        if (messageStatusUpdateResult.isErr()) {
          alert(
            `Failed to update read message id ` +
              messageStatusUpdateResult.error.message
          );
        }

        if (!isMounted) {
          return;
        }

        const userId = store.get().profile.profile?.userId;
        if (userId === undefined) {
          throw new Error(`UserId is undefined`);
        }

        const idbUpdateResult = await fromPromise(
          dexie.messages
            .where("topicId")
            .equals(props.contactId)
            .and((x) => !(x.author == userId))
            .modify({ read: true }),
          (e) => e
        );
        if (idbUpdateResult.isErr()) {
          console.error(idbUpdateResult.error);
        }

        if (!isMounted) {
          return;
        }
      }

      console.log("LOADED MESSAGES 2", messagesStore.get().messages);
    },
    () => {
      // cleanup
    },
    [props.contactId, store.get]
  );

  return (
    <div className="relative flex h-screen">
      <p>Group Chat 2</p>
    </div>
  );
}
