import { useLiveQuery } from "dexie-react-hooks";
import { LastMessageOfTopic } from "~/backend/service/topics/common/get-user-topics/get-last-message-of-topic.repo";

import {
  UserTopicId as TopicId,
  UserId,
} from "~/api-contract/subscription/subscription";
import { IconGroup } from "~/frontend/features/common/icons";
import { dexie } from "~/frontend/external/browser/indexed-db";

import { clsx } from "clsx";

import { match } from "ts-pattern";

export function ContactListNewContact(props: {
  topicId: TopicId;
  fullname: string;
  onClick: () => void;
  profilePhotoUrl: string | null;
}) {
  return (
    <div
      onClick={props.onClick}
      className="flex cursor-pointer items-center border-b border-gray-200 py-2 pl-1.5 hover:bg-gray-100"
    >
      <div className="h-10 w-10 rounded-full">
        <img
          src={
            props.profilePhotoUrl ??
            "https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Google_Images_2015_logo.svg/2880px-Google_Images_2015_logo.svg.png"
          }
          className="h-10 w-10 rounded-full object-cover"
        />
      </div>
      <div className="pl-2 text-sm">
        <div className="flex items-center">
          <p>{props.fullname}</p>
        </div>
      </div>
    </div>
  );
}

export function ContactListContact(
  props: (
    | {
        type: "p2p";
        topicId: TopicId;
        fullname: string;
        description?: string;
        isGroup?: boolean;
        isOnline?: boolean;
        isTyping?: boolean;
        profilePhotoUrl: string | null;
        onClick: () => void;
        lastMessage: LastMessageOfTopic | null;
      }
    | {
        type: "grp";
        topicId: TopicId;
        fullname: string;
        description?: string;
        isGroup?: boolean;
        isOnline?: boolean;
        typingUserFullname?: string;
        profilePhotoUrl: string | null;
        onClick: () => void;
        lastMessage: LastMessageOfTopic | null;
      }
    | {
        type: "past-grp";
        topicId: TopicId;
        fullname: string;
        description?: string;
        profilePhotoUrl: string | null;
        onClick: () => void;
        lastMessage: LastMessageOfTopic | null;
      }
  ) & {
    userId: UserId;
  }
) {
  const unreadMessageCount = useLiveQuery(() =>
    dexie.messages
      .filter(
        (m) =>
          m.topicId == props.topicId && !m.read && !(m.author == props.userId)
      )
      .count()
  );

  const contactDescription = () => {
    if (props.type === "p2p" && props.isTyping) {
      return <p>{props.fullname} is typing...</p>;
    } else if (props.type === "grp" && props.typingUserFullname) {
      return <p>{props.typingUserFullname} is typing...</p>;
    } else if (props.lastMessage === null || props.lastMessage === undefined) {
      return "";
    } else {
      return match(props.lastMessage)
        .with({ type: "deleted" }, () => "This message was deleted")
        .with({ type: "message" }, (m) => m.content)
        .exhaustive();
    }
  };

  return (
    <div
      onClick={props.onClick}
      className="flex w-[22rem] cursor-pointer items-center border-b border-gray-200 py-2 pl-1.5 hover:bg-gray-100"
    >
      <div className="relative h-10 w-10 rounded-full">
        <img
          src={
            props.profilePhotoUrl ??
            "https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Google_Images_2015_logo.svg/2880px-Google_Images_2015_logo.svg.png"
          }
          className="h-full w-full rounded-full object-cover"
        />
        <div
          className={clsx(
            "absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full",
            {
              hidden: props.type == "past-grp" || props.isOnline === undefined,
              "bg-gray-400":
                props.type != "past-grp" && props.isOnline === false,
              "bg-green-400":
                props.type != "past-grp" && props.isOnline === true,
            }
          )}
        />
      </div>
      <div className="pl-2 text-sm">
        <div className="flex items-center">
          <p>
            {props.fullname} ({unreadMessageCount ?? 0})
          </p>
          {props.type !== "past-grp" && props.isGroup && (
            <IconGroup className="ml-1 h-4 w-4 text-gray-400" />
          )}
        </div>
        {contactDescription()}
      </div>
    </div>
  );
}

const AddContactIcon = () => {
  return (
    <div className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-sm">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="#bfdbfe"
        className="h-5 w-5"
      >
        <path
          fillRule="evenodd"
          d="M4.848 2.771A49.144 49.144 0 0112 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 01-3.476.383.39.39 0 00-.297.17l-2.755 4.133a.75.75 0 01-1.248 0l-2.755-4.133a.39.39 0 00-.297-.17 48.9 48.9 0 01-3.476-.384c-1.978-.29-3.348-2.024-3.348-3.97V6.741c0-1.946 1.37-3.68 3.348-3.97zM6.75 8.25a.75.75 0 01.75-.75h9a.75.75 0 010 1.5h-9a.75.75 0 01-.75-.75zm.75 2.25a.75.75 0 000 1.5H12a.75.75 0 000-1.5H7.5z"
          clipRule="evenodd"
        />
      </svg>
    </div>
  );
};

export const CogIcon = (props: { fill: string }) => {
  return (
    <div className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-sm">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill={props.fill}
      >
        <g>
          <path d="M0,0h24v24H0V0z" fill="none" />
          <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z" />
        </g>
      </svg>
    </div>
  );
};

export function SettingBtn(props: { onClick: () => void }) {
  return (
    <button onClick={props.onClick} className="block">
      <CogIcon fill="#bfdbfe" />
    </button>
  );
}

export function AddContactBtn(props: { onClick: () => void }) {
  return (
    <button onClick={props.onClick} className="block">
      <AddContactIcon />
    </button>
  );
}
