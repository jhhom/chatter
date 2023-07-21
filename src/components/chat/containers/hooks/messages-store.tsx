import { create } from "zustand";
import { type Result, ok, err } from "neverthrow";

import { type AppErrorUnion } from "~/api-contract/errors/errors";
import { type ChatMessageType } from "~/components/chat/presentations/chat/types";
import { type ChatMessageDisplaySeq } from "~/components/chat/presentations/chat/types";
import { type TopicId } from "~/components/hooks/stores/dexie";
import { type UserId } from "~/backend/drizzle/schema";
import { useClientContext } from "~/components/hooks/stores/client";
import { type Message } from "~/backend/drizzle/message-type";

import { type ChatMessage } from "~/components/hooks/stores/dexie";
import { type TopicEventLog } from "~/components/hooks/stores/dexie";
import { type MessagesResultEventLogs } from "~/backend/service/topics/common/repo";
import { dexie } from "~/components/hooks/stores/dexie";
import { useContactStore } from "~/components/hooks/stores/contact-status.store";
import { createContext, useCallback, useContext, useEffect } from "react";

import { produce } from "immer";

type EventLogContent = {
  type: "text";
  content: string;
  forwarded: false;
};

export type ChatBubbleMessageContent = Message & {
  replyTo: null | (Message & { seqId: number; authorName: string });
};

export type getMessageDisplaySequencesArg =
  | {
      authorId: UserId;
      authorName: string;
      userIsAuthor: boolean;
      read: boolean;
      createdAt: Date;
      content: ChatBubbleMessageContent;
      seqId: number;
      isFirstOfDate: boolean;
      type: "message";
      deleted: boolean;
    }
  | {
      type: "event_log";
      text: Extract<Message, { type: "text" }>;
      seqId: number;
      createdAt: Date;
      isFirstOfDate: boolean;
      read: boolean;
    };

type MessagesStore = {
  messages: ChatMessageType[];
  setMessages: (messages: ChatMessageType[]) => void;
  hasEarlierMessages: boolean;
  setHasEarlierMessages: (has: boolean) => void;
  isLoadingMoreMessages: boolean;
  setIsLoadingMoreMessages: (isLoading: boolean) => void;
};

const useMessagesStore = create<MessagesStore>((set) => ({
  messages: [],
  setMessages(messages) {
    set(() => {
      return { messages };
    });
  },
  hasEarlierMessages: false,
  setHasEarlierMessages: (hasEarlierMessages) => {
    set(() => {
      return { hasEarlierMessages };
    });
  },
  isLoadingMoreMessages: false,
  setIsLoadingMoreMessages: (loading) => {
    set((state) => {
      return { isLoadingMoreMessages: loading };
    });
  },
}));

type MessagesContextType = Pick<
  MessagesStore,
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
  addMessage: (m: ChatMessageType) => void;
  setMessage: (idx: number, m: ChatMessageType) => void;
  deleteMessage: (idx: number, deleteFor: "self" | "everyone") => void;
  setLastMessageSeq: (seq: ChatMessageDisplaySeq) => void;
};

const MessagesContext = createContext<MessagesContextType | null>(null);

export function MessagesProvider(
  props: { children: React.ReactNode; topicId: TopicId } & (
    | {
        type: "p2p";
      }
    | {
        type: "grp";
        topicMembers: Map<UserId, { name: string; online: boolean }>;
      }
  )
) {
  const store = useMessagesStore();
  const client = useClientContext();
  const contact = useContactStore();

  useEffect(() => {
    store.setMessages([]);
    store.setHasEarlierMessages(false);
    store.setIsLoadingMoreMessages(false);
  }, [props.topicId, store]);

  const getTopicMember = useCallback(
    (userId: UserId) => {
      if (props.type == "p2p") {
        const c = contact.p2p.get(userId);
        if (c == undefined) {
          return undefined;
        }
        return {
          name: c.profile.name,
          online: c.status.online,
        };
      } else {
        return props.topicMembers.get(userId);
      }
    },
    props.type == "grp"
      ? [props.type, props.topicId, props.topicMembers, contact.p2p]
      : [props.type, props.topicId, contact.p2p]
  );

  const getReplyMessageAuthor = useCallback(
    (authorId: UserId) => {
      if (authorId == client.profile()?.userId) {
        return "You";
      }
      return getTopicMember(authorId)?.name ?? "";
    },
    [client, getTopicMember]
  );

  const clearMessages = useCallback(() => {
    store.setMessages([]);
    store.setHasEarlierMessages(false);
    store.setIsLoadingMoreMessages(false);
  }, [store]);

  const loadMessages: MessagesContextType["loadMessages"] = async (
    pageSize,
    beforeSequenceId
  ) => {
    store.setIsLoadingMoreMessages(true);

    const messagesResult = await _loadMessages({
      pageSize,
      beforeSequenceId,
    });
    if (messagesResult.isErr()) {
      store.setIsLoadingMoreMessages(false);
      return err(messagesResult.error);
    }

    const earlierConvertedMsg = getMessageDisplaySequences(
      messagesResult.value.messages
    );

    store.setHasEarlierMessages(messagesResult.value.hasEarlierMessages);
    store.setMessages(earlierConvertedMsg.concat(store.messages));
    store.setIsLoadingMoreMessages(false);
    return ok({});
  };

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
              x.topicId == props.topicId &&
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
              m.topicId === props.topicId &&
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
          topicId: props.topicId,
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
              topicId: props.topicId,
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
            topicId: props.topicId,
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

        await dexie.messages.bulkAdd(networkMessages);

        const networkTopicEventLogs = result.value.msgs.filter(
          (m) => m.type == "event_log"
        ) as MessagesResultEventLogs[];

        await dexie.topicEventLogs.bulkAdd(
          networkTopicEventLogs.map((l) => ({
            seqId: l.sequenceId,
            topicId: props.topicId,
            topicEvent: l.event,
          }))
        );

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
            const userIsAuthor = m.author == client.profile()?.userId;

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
                ? client.profile()?.fullname ?? ""
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
              m.topicId === props.topicId &&
              m.seqId > arg.replyMessageSequenceId
          )
          .toArray();

        const replyMessage = await dexie.messages.get([
          props.topicId,
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
            const userIsAuthor = m.author == client.profile()?.userId;

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
                ? client.profile()?.fullname ?? ""
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
                  m.topicId === props.topicId &&
                  m.seqId < arg.replyMessageSequenceId
              )
              .limit(1)
              .toArray()
          ).length != 0;
        if (!hasEarlierMessages) {
          const r = await client["topic/has_messages_earlier_than"]({
            topicId: props.topicId,
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
    [client, getReplyMessageAuthor, getTopicMember, props.topicId]
  );

  const loadMessagesUntilReply: MessagesContextType["loadMessagesUntilReply"] =
    useCallback(
      async (beforeSequenceId: number, replyMessageSequenceId: number) => {
        if (beforeSequenceId <= replyMessageSequenceId) {
          return ok({});
        }

        store.setIsLoadingMoreMessages(true);

        const messagesResult = await _loadMessagesUntilReply({
          beforeSequenceId,
          replyMessageSequenceId,
        });
        if (messagesResult.isErr()) {
          store.setIsLoadingMoreMessages(false);
          return err(messagesResult.error);
        }

        const earlierConvertedMsg = getMessageDisplaySequences(
          messagesResult.value.messages
        );

        store.setMessages(earlierConvertedMsg.concat(store.messages));
        store.setHasEarlierMessages(messagesResult.value.hasEarlierMessages);
        store.setIsLoadingMoreMessages(false);
        return ok({});
      },
      [store, _loadMessagesUntilReply]
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
            m.topicId === props.topicId
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
          topicId: props.topicId,
          numberOfMessages: arg.pageSize,
          beforeSequenceId: arg.beforeSequenceId,
        });
        if (result.isErr()) {
          return err(result.error);
        }

        const networkMessages = result.value.msgs.map((m) => {
          if (m.type == "message") {
            return {
              topicId: props.topicId,
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
            topicId: props.topicId,
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

        await dexie.messages.bulkAdd(networkMessages);

        const networkTopicEventLogs = result.value.msgs.filter(
          (m) => m.type == "event_log"
        ) as MessagesResultEventLogs[];

        await dexie.topicEventLogs.bulkAdd(
          networkTopicEventLogs.map((l) => ({
            seqId: l.sequenceId,
            topicId: props.topicId,
            topicEvent: l.event,
          }))
        );

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
            const userIsAuthor = m.author == client.profile()?.userId;

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
                ? client.profile()?.fullname ?? ""
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
              m.topicId === props.topicId
          )
          .count();

        let hasEarlierMessages = earlierMessageCount > 0;
        if (!hasEarlierMessages) {
          const r = await client["topic/has_messages_earlier_than"]({
            topicId: props.topicId,
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
            const userIsAuthor = m.author == client.profile()?.userId;

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
                ? client.profile()?.fullname ?? ""
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
    [client, getReplyMessageAuthor, getTopicMember, props.topicId]
  );

  // add messages from the server to the view
  // we don't add to IndexedDB because we already register a listener during login to add message from the server
  // if we add to IndexedDB, then there would be repeated messages
  // messages sent by us is added to the view and IndexedDB, because we don't have other listeners
  // that will add message to IndexedDB
  const addMessage = useCallback(
    (msg: ChatMessageType) => {
      store.setMessages([...store.messages, msg]);
    },
    [store]
  );

  const setMessage = useCallback(
    (idx: number, message: ChatMessageType) => {
      store.setMessages(
        produce(store.messages, (m) => {
          m[idx] = message;
        })
      );
    },
    [store]
  );

  const deleteMessage = useCallback(
    (idx: number, deleteFor: "self" | "everyone") => {
      if (deleteFor == "self") {
        if (idx >= store.messages.length) {
          return;
        }
        const deletedMessage = store.messages[idx];
        if (deletedMessage.type == "event_log") {
          return;
        }
        store.setMessages(
          produce(store.messages, (m) => {
            m.splice(idx, 1);
          })
        );

        if (store.messages.length > idx + 1) {
          const nextMessage = store.messages[idx];
          if (nextMessage.type == "message") {
            if (nextMessage.authorId == deletedMessage.authorId) {
              setMessage(idx, {
                ...nextMessage,
                seq: nextMessage.seq == "middle" ? "first" : "single",
              });
            }

            if (deletedMessage.isFirstOfDate) {
              setMessage(idx, {
                ...nextMessage,
                isFirstOfDate: true,
              });
            }
          }
        }
      } else {
        const msg = store.messages[idx];
        if (msg.type == "message") {
          setMessage(idx, {
            ...msg,
            text: {
              type: "text",
              forwarded: false,
              content: "",
              replyTo: null,
            },
            deleted: true,
          });
        }
      }
    },
    [store, setMessage]
  );

  const setLastMessageSeq = useCallback(
    (seq: ChatMessageDisplaySeq) => {
      store.setMessages(
        produce(store.messages, (messages) => {
          const m = messages[messages.length - 1];
          if (m.type == "message") {
            messages[messages.length - 1] = {
              ...m,
              seq,
            };
          }
        })
      );
    },
    [store]
  );

  return (
    <MessagesContext.Provider
      value={{
        messages: store.messages,
        hasEarlierMessages: store.hasEarlierMessages,
        isLoadingMoreMessages: store.isLoadingMoreMessages,
        loadMessagesUntilReply,
        loadMessages,
        addMessage,
        setMessage,
        deleteMessage,
        setLastMessageSeq,
        clearMessages,
      }}
    >
      {props.children}
    </MessagesContext.Provider>
  );
}

/**
 *
 * @param input An array of messages sorted by their seqId in ascending order
 * @returns The output with each message attached their display `seq`
 */
export function getMessageDisplaySequences(
  input: getMessageDisplaySequencesArg[]
): ChatMessageType[] {
  const output: ChatMessageType[] = [];
  let currDate: Date | undefined = undefined;
  let prevAuthor: string | undefined = undefined;

  for (const [i, msg] of input.entries()) {
    if (msg.type == "event_log") {
      output.push({
        type: "event_log",
        text: msg.text,
        seqId: msg.seqId,
        date: msg.createdAt,
        isFirstOfDate: msg.isFirstOfDate,
      });
      prevAuthor = undefined;
      continue;
    }
    if (
      currDate == undefined ||
      currDate.toDateString() != msg.createdAt.toDateString()
    ) {
      currDate = msg.createdAt;
      prevAuthor = undefined;
    }

    let nextDate: Date | undefined = undefined;
    let nextAuthor: UserId | undefined = undefined;

    if (i < input.length - 1) {
      const next = input[i + 1];
      if (next.type == "message") {
        nextDate = next.createdAt;
        nextAuthor = next.authorId;
      }
    }

    let seq: "first" | "middle" | "last" | "single";

    const differentPrev =
      prevAuthor === undefined || prevAuthor !== msg.authorId;
    const differentNext = nextAuthor != msg.authorId || nextDate != currDate;

    if (differentPrev && differentNext) {
      seq = "single";
    } else if (!differentPrev && !differentNext) {
      seq = "middle";
    } else if (!differentPrev && differentNext) {
      seq = "last";
    } else {
      seq = "first";
    }

    output.push({
      type: "message",
      authorId: msg.authorId,
      authorName: msg.authorName,
      seq,
      date: msg.createdAt,
      text: msg.content,
      isFirstOfDate: msg.isFirstOfDate,
      read: msg.read,
      userIsAuthor: msg.userIsAuthor,
      seqId: msg.seqId,
      deleted: msg.deleted,
    });
    prevAuthor = msg.authorId;
  }

  return output;
}

export function sortMessagesAndEventLogs(
  messages: ChatMessage[],
  eventLogs: TopicEventLog[]
): (
  | (ChatMessage & { type: "message" })
  | (TopicEventLog & { type: "event_log" })
)[] {
  let results: (
    | (ChatMessage & { type: "message" })
    | (TopicEventLog & { type: "event_log" })
  )[] = [];

  const _messages = messages.map((m) => ({ ...m, type: "message" as const }));
  const _eventLogs = eventLogs.map((l) => ({
    ...l,
    type: "event_log" as const,
  }));

  results = [..._messages, ..._eventLogs];

  results = results.sort((a, b) => a.seqId - b.seqId);

  return results;
}

export const useMesssages = () => useContext(MessagesContext)!;
