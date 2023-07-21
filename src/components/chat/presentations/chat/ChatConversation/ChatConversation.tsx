import React from "react";
import { match } from "ts-pattern";

import { ConversationItem } from "~/components/experiments/chat/ChatConversation/ConversationItem";
import {
  TextMessage,
  PictureMessage,
  FileMessage,
} from "~/components/experiments/chat/ChatConversation/ChatMessage";

import { messages } from "~/components/experiments/chat/data";

export function ChatConversation() {
  const [showMenuButtonForSeqId, setShowMenuButtonForSeqId] = React.useState<
    number | null
  >(null);

  return (
    <>
      <div className="flex w-full flex-col pt-2 @container">
        {messages.map((m) =>
          match(m)
            .with({ type: "message" }, (msg) =>
              msg.userIsAuthor ? (
                <ConversationItem
                  replyTo={msg.content.replyTo}
                  seqId={msg.seqId}
                  key={msg.seqId}
                  userIsAuthor={msg.userIsAuthor}
                  read={msg.read}
                  date={msg.date}
                  showMessageMenu={msg.seqId === showMenuButtonForSeqId}
                  onHoverStart={(e) => {
                    setShowMenuButtonForSeqId(msg.seqId);
                  }}
                  onHoverEnd={(e) => {
                    setShowMenuButtonForSeqId(null);
                  }}
                >
                  {match(msg.content)
                    .with({ type: "text" }, (msgContent) => (
                      <TextMessage text={msgContent.content} />
                    ))
                    .with({ type: "picture" }, (content) => (
                      <PictureMessage
                        pictureUrl={content.url}
                        caption={content.caption}
                      />
                    ))
                    .with({ type: "file" }, (content) => (
                      <FileMessage
                        userIsWriter={msg.userIsAuthor}
                        fileSize={content.size}
                        filename={content.filename}
                        fileUrl={content.url}
                      />
                    ))
                    .otherwise(() => (
                      <div>lol</div>
                    ))}
                </ConversationItem>
              ) : (
                <ConversationItem
                  replyTo={msg.content.replyTo}
                  seqId={msg.seqId}
                  key={msg.seqId}
                  userIsAuthor={msg.userIsAuthor}
                  date={msg.date}
                  onHoverStart={() => {
                    setShowMenuButtonForSeqId(msg.seqId);
                  }}
                  onHoverEnd={() => {
                    setShowMenuButtonForSeqId(null);
                  }}
                  showMessageMenu={msg.seqId === showMenuButtonForSeqId}
                >
                  {match(msg.content)
                    .with({ type: "text" }, (msgContent) => (
                      <TextMessage text={msgContent.content} />
                    ))
                    .with({ type: "picture" }, (content) => (
                      <PictureMessage
                        pictureUrl={content.url}
                        caption={content.caption}
                      />
                    ))
                    .with({ type: "file" }, (content) => (
                      <FileMessage
                        userIsWriter={msg.userIsAuthor}
                        fileSize={content.size}
                        filename={content.filename}
                        fileUrl={content.url}
                      />
                    ))
                    .otherwise(() => (
                      <div>lol</div>
                    ))}
                </ConversationItem>
              )
            )
            .otherwise((m) => (
              <div>
                <p>Otherwise</p>
              </div>
            ))
        )}
      </div>
    </>
  );
}
