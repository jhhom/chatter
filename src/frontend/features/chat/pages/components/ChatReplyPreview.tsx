import { match } from "ts-pattern";

import { IconFile, IconCamera, IconX } from "~/frontend/features/common/icons";
import { type ChatMessageTypeMessage } from "~/frontend/features/chat/pages/stores/messages/get-messages-display-sequences";

export type ChatReplyPreviewProps = {
  messageReplied: ChatMessageTypeMessage;
  onClose: () => void;
};

export function ChatReplyPreview(props: ChatReplyPreviewProps) {
  return (
    <div id="chat-reply-preview" className="flex bg-gray-100 py-2 pl-4">
      <div className="w-[calc(100%-3rem)] rounded-[0.25rem] border-l-4 border-blue-500 bg-gray-200/75 pl-2 text-sm text-gray-500">
        {match(props.messageReplied.text)
          .with({ type: "text" }, (t) => {
            return (
              <div className="py-2 pr-4">
                <p className="mb-1 text-blue-500">
                  {props.messageReplied.userIsAuthor
                    ? "You"
                    : props.messageReplied.authorName}
                </p>
                <p className="max-h-10 overflow-hidden">{t.content}</p>
              </div>
            );
          })
          .with({ type: "file" }, (t) => {
            return (
              <div className="py-2 pr-4">
                <p className="mb-1 text-blue-500">
                  {props.messageReplied.userIsAuthor
                    ? "You"
                    : props.messageReplied.authorName}
                </p>
                <div className="flex">
                  <div className="flex h-5 w-5 items-center justify-center">
                    <IconFile className="h-4 w-4 text-gray-400" />
                  </div>
                  <p className="ml-0.5 max-h-10 overflow-hidden whitespace-nowrap">
                    {t.filename == "" ? "File" : t.filename}
                  </p>
                </div>
              </div>
            );
          })
          .with({ type: "picture" }, (t) => {
            return (
              <div className="flex h-20 rounded-md">
                <div className="flex w-[calc(100%-5rem)] flex-col justify-center">
                  <p className="mb-1 text-blue-500">
                    {props.messageReplied.userIsAuthor
                      ? "You"
                      : props.messageReplied.authorName}
                  </p>
                  <div className="flex pr-4">
                    <div className="flex h-5 w-5 items-center justify-center">
                      <IconCamera className="h-4 w-4 text-gray-500" />
                    </div>
                    <p className="ml-1 max-h-10 overflow-hidden whitespace-nowrap pr-1.5">
                      {t.caption == "" ? "Photo" : t.caption}
                    </p>
                  </div>
                </div>
                <div className="h-20 w-20 rounded-r-md bg-white">
                  <img src={t.url} className="h-full w-full rounded-r-md" />
                </div>
              </div>
            );
          })
          .run()}
      </div>
      <div className="w-12 pr-2.5">
        <button
          onClick={props.onClose}
          className="flex h-full w-full items-center justify-center"
        >
          <IconX className="h-5 w-5 text-gray-500/75" strokeWidth="3.5" />
        </button>
      </div>
    </div>
  );
}
