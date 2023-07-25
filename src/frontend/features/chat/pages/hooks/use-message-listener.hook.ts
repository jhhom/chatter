import { useMemo, useCallback } from "react";

import type { EventPayload } from "~/api-contract/subscription/subscription";
import type {
  GroupTopicId,
  UserId,
} from "~/api-contract/subscription/subscription";

import type { IChatUI } from "~/frontend/features/chat/pages/types";
import type { ChatMessageDisplaySeq } from "~/frontend/features/chat/pages/stores/messages/get-messages-display-sequences";
import { useMessagesStore } from "~/frontend/features/chat/pages/stores/messages/messages.store";
import { useAppStore } from "~/frontend/stores/stores";

import { client } from "~/frontend/external/api-client/client";
import { dexie } from "~/frontend/external/browser/indexed-db";

export function useMessageListener(
  contactId: UserId | GroupTopicId,
  getTopicMember: (userId: UserId) =>
    | {
        name: string;
        online: boolean;
      }
    | undefined
): (
  chatUiControl: IChatUI
) => (
  payload: EventPayload["message"] | EventPayload["message.from-new-topic"]
) => void {
  const chat = useMessagesStore();
  const profile = useAppStore((s) => s.profile);

  const getReplyMessageAuthor = useCallback(
    (authorId: UserId) => {
      if (authorId == profile?.userId) {
        return "You";
      }
      return getTopicMember(authorId)?.name ?? "";
    },
    [profile?.userId, getTopicMember]
  );

  const makeListener = useMemo(
    () => (chatUiControl: IChatUI) => {
      const listener = (
        e: EventPayload["message"] | EventPayload["message.from-new-topic"]
      ) => {
        if (e.topicId != contactId) {
          return;
        }
        const isUserAtBottomOfScroll =
          chatUiControl.isUserAtTheBottomOfScroll();

        // 1. FIND OUT MESSAGE SEQ
        let precedingMessage:
          | {
              type: "message";
              authorId: UserId;
              seq: ChatMessageDisplaySeq;
              createdAt: Date;
            }
          | {
              type: "event_log";
            }
          | undefined;
        if (chat.messages.length > 0) {
          const lastMsg = chat.messages[chat.messages.length - 1];
          if (lastMsg.type == "message") {
            precedingMessage = {
              authorId: lastMsg.authorId,
              seq: lastMsg.seq,
              createdAt: lastMsg.date,
              type: "message",
            };
          } else {
            precedingMessage = {
              type: "event_log",
            };
          }
        }
        const messageSeq = findMessageSeq(
          { authorId: e.authorId, createdAt: e.createdAt },
          precedingMessage
        );

        // 2. MODIFY LAST MESSAGE SEQ
        //
        // if undefined, means last message seq doesn't change
        if (messageSeq.lastMessageSeq) {
          chat.setLastMessageSeq(messageSeq.lastMessageSeq);
        }

        // 3. ADD NEW MESSAGE TO CHAT UI
        chat.addMessage({
          type: "message",
          authorId: e.authorId,
          authorName: getTopicMember(e.authorId)?.name ?? "",
          seq: messageSeq.messageSeq,
          date: e.createdAt,
          text: {
            ...e.content,
            replyTo:
              e.content.replyTo === null
                ? null
                : {
                    ...e.content.replyTo,
                    authorName:
                      e.content.replyTo === null
                        ? "Not found"
                        : getReplyMessageAuthor(e.content.replyTo.authorId),
                  },
          },
          isFirstOfDate: e.isFirstOfDate,
          read: false,
          userIsAuthor: e.authorId == profile?.userId,
          seqId: e.seqId,
          deleted: false,
        });

        // 4. UPDATE READ STATUS
        setTimeout(async () => {
          const result = await client["topic/update_message_read_status"]({
            sequenceId: e.seqId,
            topicId: contactId,
          });
          if (result.isErr()) {
            return;
          }

          dexie.messages
            .where(["topicId", "seqId"])
            .equals([contactId, e.seqId])
            .modify({ read: true })
            .catch((error) => {
              console.error(error);
            });
        }, 1500);

        // 5. SCROLL TO THE BOTTOM IF USER IS AT THE BOTTOM BEFORE NEW MESSAGE ARRIVES
        if (isUserAtBottomOfScroll || e.authorId == profile?.userId) {
          if (e.content.type == "picture") {
            // for picture, we need wait for slight delay before the DOM updates with the image before we scroll to the bottom
            setTimeout(() => chatUiControl.scrollChatToTheBottom(), 300);
          } else {
            chatUiControl.scrollChatToTheBottom();
          }
        }
      };

      return listener;
    },
    [chat, contactId, getReplyMessageAuthor, getTopicMember, profile?.userId]
  );

  return makeListener;
}

// determine the seq (display sequence) of message
// but before that, we may need to modify the seq of the last message
// if the last message's author is the same, we will need to modify from `last` to `middle`
// or from `single` to `first`
// then add this message as seq `last`
// otherwise, if author is different, the seq will be `single`
// if message array is empty, the new message will be `single`
// create a pure function that takes in as argument the last message, and determine the seq for the new message
// to make it easier to test
// write a vite test for this function too
// put it in the test folder beside here

// function input
// - message authorId
// - last message authorId (can be undefined)
// - last message seq (can be undefined)

// return values
// - this message's seq
// - last message's seq (can be undefined)
const findMessageSeq = (
  message: {
    authorId: UserId;
    createdAt: Date;
  },
  precedingMessage?:
    | {
        type: "message";
        authorId: UserId;
        seq: ChatMessageDisplaySeq;
        createdAt: Date;
      }
    | {
        type: "event_log";
      }
): {
  messageSeq: ChatMessageDisplaySeq;
  lastMessageSeq?: ChatMessageDisplaySeq;
} => {
  if (precedingMessage == undefined) {
    return { messageSeq: "single" };
  }

  if (precedingMessage.type == "event_log") {
    return { messageSeq: "single" };
  }

  if (precedingMessage.authorId != message.authorId) {
    return { messageSeq: "single" };
  }

  if (precedingMessage.seq == "last") {
    return {
      messageSeq: "last",
    };
  } else if (precedingMessage.seq == "single") {
    return {
      messageSeq: "last",
      lastMessageSeq: "first",
    };
  }
  return { messageSeq: "last" };
};
