import { create } from "zustand";
import { Result, ok, err } from "neverthrow";

import type {
  UserTopicId as TopicId,
  UserId,
} from "~/api-contract/subscription/subscription";
import { AppErrorUnion } from "~/api-contract/errors/errors";

import {
  type ChatMessageType,
  ChatMessageDisplaySeq,
} from "~/frontend/features/chat/stores/messages/get-messages-display-sequences";
import type { MessagesResultEventLogs } from "~/backend/service/topics/common/repo/repo";
import {
  getMessageDisplaySequences,
  getMessageDisplaySequencesArg,
} from "~/frontend/features/chat/stores/messages/get-messages-display-sequences";

import { client } from "~/frontend/external/api-client/client";
import { dexie } from "~/frontend/external/browser/indexed-db";
import { useAppStore } from "~/frontend/stores/stores";

type EventLogContent = {
  type: "text";
  content: string;
  forwarded: false;
};
