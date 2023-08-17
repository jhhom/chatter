"use client";

import {
  IconPicture,
  IconPaperClip,
  IconAirplane,
} from "~/components/experiments/chat/Icons";

import { ChatHeader } from "~/components/experiments/chat/ChatHeader";
import { ChatConversation } from "~/components/experiments/chat/ChatConversation/ChatConversation";

export default function Page() {
  return (
    <div className="h-screen">
      {/* <ChatHeader  /> */}
      <div className="h-[calc(100%-5rem-3.5rem)] overflow-y-auto">
        <ChatConversation />
      </div>
      <div className="flex h-14 items-center border-t border-blue-400 bg-white px-12">
        <div className="flex w-20 justify-between px-2.5">
          <label
            htmlFor="photo-input"
            className="flex cursor-pointer items-center justify-center disabled:cursor-not-allowed"
          >
            <IconPicture className="h-5 w-5" fill="#6b7280" />
          </label>
          <label
            htmlFor="file-input"
            className="flex cursor-pointer items-center justify-center disabled:cursor-not-allowed"
          >
            <IconPaperClip className="h-5 w-5" fill="#6b7280" />
          </label>
        </div>
        <textarea
          name=""
          id=""
          className="h-10 resize-none rounded-full bg-gray-100 px-4 py-2.5 text-sm placeholder:text-gray-500/80"
          placeholder="Aa"
        ></textarea>

        <div>
          <button>
            <IconAirplane className="h-5 w-5" fill="#60a5fa" />
          </button>
        </div>
      </div>
    </div>
  );
}
