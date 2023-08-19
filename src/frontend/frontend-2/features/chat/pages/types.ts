import type { UserId } from "~/api-contract/subscription/subscription";
import type { ChatMessageType } from "~/frontend/frontend-2/features/chat/pages/components/ChatConversation/ChatMessage";
import type { ChatMessageTypeMessage } from "~/frontend/frontend-2/features/chat/pages/components/ChatConversation/ChatMessage";

export type IChatConversationUI = {
  updateFirstMessageRef: () => void;
  isUserAtTheBottomOfScroll: () => boolean;
  scrollChatToTheBottom: () => void;
  scrollToMessage: (seqId: number) => void;
};

export type ChatConversationProps = {
  /** id of the login-ed user */
  peerName: string;
  userId: UserId;
  messages: ChatMessageType[];
  isNewContact: boolean;
  conversationContainerRef: (control: IChatConversationUI) => void;
  onChatScrollToTop: () => Promise<
    "new messages loaded" | "no new messages loaded"
  >;
  onMessageImageClick: (messageUrl: string) => void;
  onMessageBubbleMenuClick: (
    e: React.MouseEvent,
    message: ChatMessageTypeMessage
  ) => void;
  onReplyMessageClick: (messageSeqId: number) => void;
  mode:
    | {
        type: "normal";
      }
    | {
        type: "needs unblocking";
        onUnblock: () => void;
      }
    | {
        type: "blocked by peer";
      }
    | {
        type: "read disabled";
      }
    | {
        type: "write disabled";
      }
    | {
        type: "removed from group";
      };
};

export type IChatUI = Pick<
  IChatConversationUI,
  "isUserAtTheBottomOfScroll" | "scrollChatToTheBottom"
>;
