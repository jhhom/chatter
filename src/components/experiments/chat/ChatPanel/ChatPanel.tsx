import {
  IconPicture,
  IconPaperClip,
  IconAirplane,
  IconChat,
} from "~/components/experiments/chat/Icons";

import {
  ChatHeader,
  ChatHeaderProps,
} from "~/components/experiments/chat/ChatHeader";
import { ChatConversation } from "~/components/experiments/chat/ChatConversation/ChatConversation";

// presentation
export function Conversation(props: { headerInfo: ChatHeaderProps }) {
  return (
    <div className="h-screen">
      <ChatHeader {...props.headerInfo} />
      <div className="h-[calc(100%-5rem-3.5rem)] overflow-y-auto">
        <ChatConversation />
      </div>
      <div className="flex h-14 items-center border-t border-blue-400 bg-white px-2">
        <div className="flex justify-between px-2.5">
          <label
            htmlFor="photo-input"
            className="flex cursor-pointer items-center justify-center rounded-full p-3 hover:bg-gray-100 disabled:cursor-not-allowed"
          >
            <IconPicture className="h-5 w-5" fill="#6b7280" />
          </label>
          <label
            htmlFor="file-input"
            className="flex cursor-pointer items-center justify-center rounded-full p-3 hover:bg-gray-100 disabled:cursor-not-allowed"
          >
            <IconPaperClip className="h-5 w-5" fill="#6b7280" />
          </label>
        </div>
        <textarea
          name=""
          id=""
          className="h-10 w-full resize-none rounded-full bg-gray-100 px-4 py-2.5 text-sm placeholder:text-gray-500/80"
          placeholder="Aa"
        ></textarea>

        <div className="px-2">
          <button className="rounded-full p-3 hover:bg-gray-100">
            <IconAirplane className="h-5 w-5" fill="#60a5fa" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function DummyView() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <IconChat className="ml-2 h-20 w-20 text-primary-500" />
      <div className="flex items-center pl-4 text-4xl font-semibold text-primary-500">
        <p>Chatter</p>
      </div>
    </div>
  );
}
