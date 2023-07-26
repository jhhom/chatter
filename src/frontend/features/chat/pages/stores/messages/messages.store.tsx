import { createStore, StoreApi } from "zustand";
import { Result, ok, err } from "neverthrow";
import { immer } from "zustand/middleware/immer";

import type {
  UserTopicId as TopicId,
  UserId,
  UserTopicId,
} from "~/api-contract/subscription/subscription";
import { AppErrorUnion } from "~/api-contract/errors/errors";

import {
  type ChatMessageType,
  ChatMessageDisplaySeq,
} from "~/frontend/features/chat/pages/stores/messages/get-messages-display-sequences";
import type { MessagesResultEventLogs } from "~/backend/service/topics/common/repo/repo";
import {
  getMessageDisplaySequences,
  getMessageDisplaySequencesArg,
} from "~/frontend/features/chat/pages/stores/messages/get-messages-display-sequences";

import { client } from "~/frontend/external/api-client/client";
import { dexie } from "~/frontend/external/browser/indexed-db";
import { useAppStore } from "~/frontend/stores/stores";
import React, {
  useEffect,
  useCallback,
  useContext,
  createContext,
} from "react";

type EventLogContent = {
  type: "text";
  content: string;
  forwarded: false;
};

type MessagesStore = Pick<
  ZustandMessagesStore,
  "messages" | "hasEarlierMessages" | "isLoadingMoreMessages"
> & {
  loadMessages: (
    pageSize: number,
    beforeSequenceId: number
  ) => Promise<Result<unknown, AppErrorUnion>>;
  loadMessagesUntilReply: (
    beforeSequenceId: number,
    replyMessageSequenceId: number
  ) => Promise<
    Result<
      unknown,
      { type: "unknown"; cause: unknown } | { type: "message not found" }
    >
  >;
  clearMessages: () => void;
  addMessage: (m: ChatMessageType, authored: boolean) => void;
  setMessage: (idx: number, m: ChatMessageType) => void;
  deleteMessage: (idx: number, deleteFor: "self" | "everyone") => void;
  setLastMessageSeq: (seq: ChatMessageDisplaySeq) => void;
};

type ZustandMessagesStore = {
  messages: ChatMessageType[];
  setMessages: (messages: ChatMessageType[]) => void;
  setMessage: (idx: number, message: ChatMessageType) => void;
  addMessage: (msg: ChatMessageType) => void;
  deleteMessage: (idx: number, deleteFor: "self" | "everyone") => void;
  clearMessages: () => void;
  setLastMessageSeq: (seq: ChatMessageDisplaySeq) => void;
  hasEarlierMessages: boolean;
  setHasEarlierMessages: (hasEarlierMessages: boolean) => void;
  isLoadingMoreMessages: boolean;
  setIsLoadingMoreMessages: (isLoadingMoreMessages: boolean) => void;
};

export const createMessagesStore = () => {
  return createStore(
    immer<ZustandMessagesStore>((set) => ({
      messages: [],
      setMessages: (messages) => {
        set((s) => {
          s.messages = messages;
        });
      },
      setMessage: (idx, message) => {
        set((s) => {
          s.messages[idx] = message;
        });
      },
      addMessage: (msg: ChatMessageType) => {
        set((s) => {
          s.messages.push(msg);
        });
      },
      deleteMessage: (idx, deleteFor) => {
        set((s) => {
          if (deleteFor === "self") {
            if (idx >= s.messages.length) {
              return;
            }

            const deletedMessage = s.messages[idx];
            if (deletedMessage.type === "event_log") {
              return;
            }
            s.messages.splice(idx, 1);

            if (s.messages.length > idx + 1) {
              const nextMessage = s.messages[idx];
              if (nextMessage.type === "message") {
                if (nextMessage.authorId === deletedMessage.authorId) {
                  nextMessage.seq =
                    nextMessage.seq === "middle" ? "first" : "single";
                }

                if (deletedMessage.isFirstOfDate) {
                  s.messages[idx] = {
                    ...nextMessage,
                    isFirstOfDate: true,
                  };
                }
              }
            }
          } else {
            const msg = s.messages[idx];
            if (msg.type === "message") {
              s.messages[idx] = {
                ...msg,
                text: {
                  type: "text",
                  forwarded: false,
                  content: "",
                  replyTo: null,
                },
                deleted: true,
              };
            }
          }
        });
      },
      clearMessages: () => {
        set((s) => {
          s.messages = [];
          s.hasEarlierMessages = false;
          s.isLoadingMoreMessages = false;
        });
      },
      setLastMessageSeq: (seq) => {
        set((s) => {
          const lastMsg = s.messages[s.messages.length - 1];
          if (lastMsg.type === "message") {
            lastMsg.seq = seq;
          }
        });
      },
      hasEarlierMessages: false,
      setHasEarlierMessages(hasEarlierMessages) {
        set((s) => {
          s.hasEarlierMessages = hasEarlierMessages;
        });
      },
      isLoadingMoreMessages: false,
      setIsLoadingMoreMessages(isLoadingMoreMessages) {
        set((s) => {
          s.isLoadingMoreMessages = isLoadingMoreMessages;
        });
      },
    }))
  );
};

type MessagesContext = {
  store: ZustandMessagesStore;
  contact: {
    topic: TopicId;
  } & (
    | {
        type: "p2p";
      }
    | {
        type: "grp";
        getTopicMember: (userId: UserId) =>
          | {
              name: string;
              online: boolean;
            }
          | undefined;
      }
  );
};

export const MessagesContext = createContext<MessagesContext | null>(null);

export function MessagesProvider(props: {
  contact: MessagesContext["contact"];
  children: React.ReactNode;
}) {
  const store = createMessagesStore();

  return (
    <MessagesContext.Provider
      value={{
        store: store.getState(),
        contact: props.contact,
      }}
    >
      {props.children}
    </MessagesContext.Provider>
  );
}

export const useMessagesStore = () => {
  const store = useAppStore((s) => ({
    contact: {
      p2p: s.p2p,
    },
    profile: s.profile,
  }));
  const ctx = useContext(MessagesContext);
  if (ctx === null) {
    throw new Error(
      `MessagesContext is null, did you forgot to wrap its usage under a MessagesProvider?`
    );
  }
  const { store: messagesStore, contact } = ctx;

  useEffect(() => {
    messagesStore.setMessages([]);
    messagesStore.setHasEarlierMessages(false);
    messagesStore.setIsLoadingMoreMessages(false);
  }, [contact.topic, messagesStore]);

  const getTopicMember = useCallback(
    (userId: UserId) => {
      if (contact.type === "p2p") {
        const c = store.contact.p2p.get(userId);
        if (c == undefined) {
          return undefined;
        }
        return {
          name: c.profile.name,
          online: c.status.online,
        };
      } else {
        return contact.getTopicMember(userId);
      }
    },
    [contact, store.contact.p2p]
  );

  const getReplyMessageAuthor = useCallback(
    (authorId: UserId) => {
      if (authorId == store.profile?.userId) {
        return "You";
      }
      return getTopicMember(authorId)?.name ?? "";
    },
    [store.profile?.userId, getTopicMember]
  );

  const _loadMessages = useCallback(
    async (arg: {
      pageSize: number;
      beforeSequenceId: number;
    }): Promise<
      Result<
        {
          messages: getMessageDisplaySequencesArg[];
          hasEarlierMessages: boolean;
        },
        AppErrorUnion
      >
    > => {
      // query messages from IndexedDB cache first, before we query the server
      let cacheMessages = await dexie.messages
        .orderBy("[topicId+seqId]")
        .filter(
          (m) =>
            m.seqId <
              (arg.beforeSequenceId < 0 ? Infinity : arg.beforeSequenceId) &&
            m.topicId === contact.topic
        )
        .reverse()
        .limit(arg.pageSize)
        .toArray();
      cacheMessages = cacheMessages.sort((a, b) => a.seqId - b.seqId);

      arg.pageSize -= cacheMessages.length;

      if (cacheMessages.length != 0) {
        arg.beforeSequenceId = cacheMessages[0].seqId;
      }

      // if IndexedDB don't contain enough messages to fill a page
      // we query the server for the rest of the needed messages
      // and check if there are more messages to be queried
      if (arg.pageSize > 0) {
        const result = await client["topic/messages"]({
          topicId: contact.topic,
          numberOfMessages: arg.pageSize,
          beforeSequenceId: arg.beforeSequenceId,
        });
        if (result.isErr()) {
          return err(result.error);
        }

        const networkMessages = result.value.msgs.map((m) => {
          if (m.type == "message") {
            return {
              topicId: contact.topic,
              content: m.content,
              seqId: m.sequenceId,
              author: m.author,
              createdAt: m.createdAt,
              read: m.read,
              isFirstOfDate: m.isFirstOfDate,
              deleted: m.deleted,
            };
          }
          return {
            topicId: contact.topic,
            content: {
              ...m.content,
              replyTo: null,
            },
            seqId: m.sequenceId,
            author: null,
            createdAt: m.createdAt,
            read: m.read,
            isFirstOfDate: m.isFirstOfDate,
            deleted: false,
          };
        });

        for (const m of networkMessages) {
          const existing = await dexie.messages.get([m.topicId, m.seqId]);
          if (existing === undefined) {
            await dexie.messages.add(m);
          }
        }

        const networkTopicEventLogs = result.value.msgs.filter(
          (m) => m.type == "event_log"
        ) as MessagesResultEventLogs[];

        for (const l of networkTopicEventLogs) {
          const existing = await dexie.topicEventLogs.get([
            contact.topic,
            l.sequenceId,
          ]);
          if (existing === undefined) {
            await dexie.topicEventLogs.add({
              seqId: l.sequenceId,
              topicId: contact.topic,
              topicEvent: l.event,
            });
          }
        }

        const messages: getMessageDisplaySequencesArg[] = cacheMessages
          .concat(networkMessages)
          .map((m) => {
            if (m.author == null) {
              return {
                type: "event_log" as const,
                text: m.content as EventLogContent,
                seqId: m.seqId,
                createdAt: m.createdAt,
                read: m.read,
                isFirstOfDate: m.isFirstOfDate,
              };
            }
            const userIsAuthor = m.author == store.profile?.userId;

            return {
              type: "message" as const,
              authorId: m.author,
              userIsAuthor,
              read: m.read,
              createdAt: m.createdAt,
              content: {
                ...m.content,
                replyTo:
                  m.content.replyTo === null || m.content.replyTo === undefined
                    ? null
                    : {
                        ...m.content.replyTo,
                        authorName: getReplyMessageAuthor(
                          m.content.replyTo.authorId
                        ),
                      },
              },
              seqId: m.seqId,
              isFirstOfDate: m.isFirstOfDate,
              deleted: m.deleted === undefined ? false : m.deleted,
              authorName: userIsAuthor
                ? store.profile?.fullname ?? ""
                : getTopicMember(m.author)?.name ?? "User not found",
            };
          })
          .sort((a, b) => a.seqId - b.seqId);

        return ok({
          hasEarlierMessages: result.value.hasEarlierMessages,
          messages,
        });
      } else {
        const earlierMessageCount = await dexie.messages
          .filter(
            (m) =>
              m.seqId <
                (arg.beforeSequenceId < 0 ? Infinity : arg.beforeSequenceId) &&
              m.topicId === contact.topic
          )
          .count();

        let hasEarlierMessages = earlierMessageCount > 0;
        if (!hasEarlierMessages) {
          const r = await client["topic/has_messages_earlier_than"]({
            topicId: contact.topic,
            beforeSequenceId: arg.beforeSequenceId,
          });
          if (r.isErr()) {
            return err(r.error);
          }
          hasEarlierMessages = r.value;
        }

        const messages: getMessageDisplaySequencesArg[] = cacheMessages
          .map((m) => {
            if (m.author == null) {
              return {
                type: "event_log" as const,
                text: m.content as EventLogContent,
                seqId: m.seqId,
                createdAt: m.createdAt,
                read: m.read,
                isFirstOfDate: m.isFirstOfDate,
              };
            }
            const userIsAuthor = m.author == store.profile?.userId;

            return {
              type: "message" as const,
              authorId: m.author,
              userIsAuthor,
              read: m.read,
              createdAt: m.createdAt,
              content: {
                ...m.content,
                replyTo:
                  m.content.replyTo === null || m.content.replyTo === undefined
                    ? null
                    : {
                        ...m.content.replyTo,
                        authorName: getReplyMessageAuthor(
                          m.content.replyTo.authorId
                        ),
                      },
              },
              seqId: m.seqId,
              isFirstOfDate: m.isFirstOfDate,
              deleted: m.deleted === undefined ? false : m.deleted,
              authorName: userIsAuthor
                ? store.profile?.fullname ?? ""
                : getTopicMember(m.author)?.name ?? "User not found",
            };
          })
          .sort((a, b) => a.seqId - b.seqId);

        return ok({
          messages,
          hasEarlierMessages,
        });
      }
    },
    [
      getReplyMessageAuthor,
      getTopicMember,
      contact,
      store.profile?.fullname,
      store.profile?.userId,
    ]
  );

  const _loadMessagesUntilReply = useCallback(
    async (arg: {
      replyMessageSequenceId: number;
      beforeSequenceId: number;
    }) => {
      // 1. check if cache earliest messages has a sequence id that is before `replyMessageSequenceId` and after `beforeSequenceId`
      //    - if it has, check if the message with `replyMessageSequenceId` exist
      //      - if doesn't exist, return an error
      //      - if exist, return it and all the messages up to it from beforeSequenceId
      //    - if it doesn't, load messages from the

      // how to check whether the reply message should be contained in the cache?
      // if our cache has messages with sequence id earlier than sequence id of the reply message
      // that means that we should have retrieved the reply message into our cache before
      // so that means we need to retrieve that message from our cache
      // otherwise, if the messages in our cache all have sequence id higher than the reply message
      // in other words, there is no message in our cache that is earlier than the reply message seq id
      // this means that we have not fetch the reply message into our cache before
      // and so we need to fetch it from the server
      // how to check if the all messages in our cache under that topic, no one has the sequence id earlier than replyMessageSequenceId
      // easy: we can just try filter for messages with given topic and sequence id equal to or smaller than reply sequence id
      // if the result of the filter is 0, this means that we haven't fetch the reply message into our cache yet

      // 1. Check if cache should contain the reply message
      // ---------------------------------------------------
      // 1.1 filter for messsage with sequence id smaller or equal to reply
      // 1.2 check that the result returned is not undefined or 0 length
      const toFetchFromNetwork = await (async () => {
        const r = await dexie.messages
          .filter(
            (x) =>
              x.topicId == contact.topic &&
              x.seqId <= arg.replyMessageSequenceId
          )
          .limit(1)
          .toArray();
        return r.length == 0;
      })();

      if (arg.beforeSequenceId <= arg.replyMessageSequenceId) {
        return ok({ messages: [], hasEarlierMessages: true });
      }

      // 2. Fetch all the messages from `beforeSequenceId` up to and including the reply message
      if (toFetchFromNetwork) {
        // 2.1.1 Get messages from cache
        let cacheMessages = await dexie.messages
          .orderBy("[topicId+seqId]")
          .filter(
            (m) =>
              m.topicId === contact.topic &&
              m.seqId > arg.replyMessageSequenceId &&
              m.seqId <
                (arg.beforeSequenceId < 0 ? Infinity : arg.beforeSequenceId)
          )
          .reverse()
          .toArray();
        cacheMessages = cacheMessages.sort((a, b) => a.seqId - b.seqId);

        if (cacheMessages.length != 0) {
          arg.beforeSequenceId = cacheMessages[0].seqId;
        }

        // 2.1.2 Get messages from network
        const result = await client["topic/get_messages_until_reply"]({
          topicId: contact.topic,
          beforeSequenceId: arg.beforeSequenceId,
          untilReplySequenceId: arg.replyMessageSequenceId,
        });
        if (result.isErr()) {
          // TODO: handle error when messages is not found
          if (result.error.details.type == "TOPIC.REPLY_MESSAGE_NOT_EXIST") {
            return err({ type: "message not found" as const });
          }
          return err({ type: "unknown" as const, cause: result.error });
        }

        const networkMessages = result.value.msgs.map((m) => {
          if (m.type == "message") {
            return {
              topicId: contact.topic,
              content: m.content,
              seqId: m.sequenceId,
              author: m.author,
              createdAt: m.createdAt,
              read: m.read,
              isFirstOfDate: m.isFirstOfDate,
              deleted: m.deleted,
            };
          }
          return {
            topicId: contact.topic,
            content: {
              ...m.content,
              replyTo: null,
            },
            seqId: m.sequenceId,
            author: null,
            createdAt: m.createdAt,
            read: m.read,
            isFirstOfDate: m.isFirstOfDate,
            deleted: false,
          };
        });

        for (const m of networkMessages) {
          const existing = await dexie.messages.get([m.topicId, m.seqId]);
          if (existing === undefined) {
            await dexie.messages.add(m);
          }
        }

        const networkTopicEventLogs = result.value.msgs.filter(
          (m) => m.type == "event_log"
        ) as MessagesResultEventLogs[];

        for (const l of networkTopicEventLogs) {
          const existing = await dexie.topicEventLogs.get([
            contact.topic,
            l.sequenceId,
          ]);
          if (existing === undefined) {
            await dexie.topicEventLogs.add({
              seqId: l.sequenceId,
              topicId: contact.topic,
              topicEvent: l.event,
            });
          }
        }

        const messages: getMessageDisplaySequencesArg[] = cacheMessages
          .concat(networkMessages)
          .map((m) => {
            if (m.author == null) {
              return {
                type: "event_log" as const,
                text: m.content as EventLogContent,
                seqId: m.seqId,
                createdAt: m.createdAt,
                read: m.read,
                isFirstOfDate: m.isFirstOfDate,
              };
            }
            const userIsAuthor = m.author == store.profile?.userId;

            return {
              type: "message" as const,
              authorId: m.author,
              userIsAuthor,
              read: m.read,
              createdAt: m.createdAt,
              content: {
                ...m.content,
                replyTo:
                  m.content.replyTo === null || m.content.replyTo === undefined
                    ? null
                    : {
                        ...m.content.replyTo,
                        authorName: getReplyMessageAuthor(
                          m.content.replyTo.authorId
                        ),
                      },
              },
              seqId: m.seqId,
              isFirstOfDate: m.isFirstOfDate,
              deleted: m.deleted === undefined ? false : m.deleted,
              authorName: userIsAuthor
                ? store.profile?.fullname ?? ""
                : getTopicMember(m.author)?.name ?? "User not found",
            };
          })
          .sort((a, b) => a.seqId - b.seqId);

        return ok({
          messages,
          hasEarlierMessages: result.value.hasEarlierMessages,
        });
      } else {
        // 2.2 Fetch from cache
        const messages = await dexie.messages
          .filter(
            (m) =>
              m.seqId <
                (arg.beforeSequenceId < 0 ? Infinity : arg.beforeSequenceId) &&
              m.topicId === contact.topic &&
              m.seqId > arg.replyMessageSequenceId
          )
          .toArray();

        const replyMessage = await dexie.messages.get([
          contact.topic,
          arg.replyMessageSequenceId,
        ]);
        if (replyMessage === undefined) {
          return err({ type: "message not found" as const });
        }

        messages.push(replyMessage);
        const resultMessages: getMessageDisplaySequencesArg[] = messages
          .map((m) => {
            if (m.author == null) {
              return {
                type: "event_log" as const,
                text: m.content as EventLogContent,
                seqId: m.seqId,
                createdAt: m.createdAt,
                read: m.read,
                isFirstOfDate: m.isFirstOfDate,
              };
            }
            const userIsAuthor = m.author == store.profile?.userId;

            return {
              type: "message" as const,
              authorId: m.author,
              userIsAuthor,
              read: m.read,
              createdAt: m.createdAt,
              content: {
                ...m.content,
                replyTo:
                  m.content.replyTo === null || m.content.replyTo === undefined
                    ? null
                    : {
                        ...m.content.replyTo,
                        authorName: getReplyMessageAuthor(
                          m.content.replyTo.authorId
                        ),
                      },
              },
              seqId: m.seqId,
              isFirstOfDate: m.isFirstOfDate,
              deleted: m.deleted === undefined ? false : m.deleted,
              authorName: userIsAuthor
                ? store.profile?.fullname ?? ""
                : getTopicMember(m.author)?.name ?? "User not found",
            };
          })
          .sort((a, b) => a.seqId - b.seqId);

        // determine has earlier messages
        let hasEarlierMessages =
          (
            await dexie.messages
              .filter(
                (m) =>
                  m.topicId === contact.topic &&
                  m.seqId < arg.replyMessageSequenceId
              )
              .limit(1)
              .toArray()
          ).length != 0;
        if (!hasEarlierMessages) {
          const r = await client["topic/has_messages_earlier_than"]({
            topicId: contact.topic,
            beforeSequenceId: arg.replyMessageSequenceId,
          });
          if (r.isErr()) {
            return err({ type: "unknown" as const, cause: r.error });
          }
          hasEarlierMessages = r.value;
        }

        return ok({ messages: resultMessages, hasEarlierMessages });
      }
    },
    [
      getReplyMessageAuthor,
      getTopicMember,
      contact.topic,
      store.profile?.fullname,
      store.profile?.userId,
    ]
  );

  const loadMessages: MessagesStore["loadMessages"] = useCallback(
    async (pageSize, beforeSequenceId) => {
      messagesStore.setIsLoadingMoreMessages(true);

      const messagesResult = await _loadMessages({
        pageSize,
        beforeSequenceId,
      });
      if (messagesResult.isErr()) {
        messagesStore.setIsLoadingMoreMessages(false);
        return err(messagesResult.error);
      }

      const earlierConvertedMsg = getMessageDisplaySequences(
        messagesResult.value.messages
      );

      messagesStore.setHasEarlierMessages(
        messagesResult.value.hasEarlierMessages
      );
      messagesStore.setMessages(
        earlierConvertedMsg.concat(messagesStore.messages)
      );
      messagesStore.setIsLoadingMoreMessages(false);
      return ok({});
    },
    [messagesStore, _loadMessages]
  );

  const loadMessagesUntilReply: MessagesStore["loadMessagesUntilReply"] =
    useCallback(
      async (beforeSequenceId: number, replyMessageSequenceId: number) => {
        if (beforeSequenceId <= replyMessageSequenceId) {
          return ok({});
        }

        messagesStore.setIsLoadingMoreMessages(true);

        const messagesResult = await _loadMessagesUntilReply({
          beforeSequenceId,
          replyMessageSequenceId,
        });
        if (messagesResult.isErr()) {
          messagesStore.setIsLoadingMoreMessages(false);
          return err(messagesResult.error);
        }

        const earlierConvertedMsg = getMessageDisplaySequences(
          messagesResult.value.messages
        );

        messagesStore.setMessages(
          earlierConvertedMsg.concat(messagesStore.messages)
        );
        messagesStore.setHasEarlierMessages(
          messagesResult.value.hasEarlierMessages
        );
        messagesStore.setIsLoadingMoreMessages(false);
        return ok({});
      },
      [messagesStore, _loadMessagesUntilReply]
    );

  return {
    messages: messagesStore.messages,
    hasEarlierMessages: messagesStore.hasEarlierMessages,
    isLoadingMoreMessages: messagesStore.isLoadingMoreMessages,
    loadMessagesUntilReply,
    loadMessages,
    addMessage: messagesStore.addMessage,
    setMessage: messagesStore.setMessage,
    deleteMessage: messagesStore.deleteMessage,
    setLastMessageSeq: messagesStore.setLastMessageSeq,
    clearMessages: messagesStore.clearMessages,
  };
};
