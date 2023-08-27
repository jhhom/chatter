import { useLiveQuery } from "dexie-react-hooks";
import { match } from "ts-pattern";
import { clsx as cx } from "clsx";

import type { LastMessageOfTopic } from "~/backend/service/topics/common/get-user-topics/get-last-message-of-topic.repo";
import type {
  GroupTopicId,
  UserId,
  UserTopicId,
} from "~/api-contract/subscription/subscription";
import { dexie } from "~/frontend/external/browser/indexed-db";

import { IconPerson } from "~/frontend/frontend-2/features/common/icons";

export function ContactListContact(
  props: (
    | {
        type: "p2p";
        topicId: UserTopicId;
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
        topicId: GroupTopicId;
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
        topicId: GroupTopicId;
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
      return `${props.fullname} is typing...`;
    } else if (props.type === "grp" && props.typingUserFullname) {
      return `${props.typingUserFullname} is typing...`;
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
      className="flex cursor-pointer items-center px-5 py-2 hover:bg-gray-100"
    >
      <div className="relative w-10">
        {props?.profilePhotoUrl ? (
          <img
            className="inline-block h-10 w-10 rounded-lg object-cover"
            src={props?.profilePhotoUrl ?? ""}
          />
        ) : (
          <div className="flex h-10 w-10 items-end justify-center rounded-lg bg-gray-100 pb-1">
            <IconPerson className="h-7 w-7 text-gray-400" />
          </div>
        )}
        <div
          className={cx(
            "absolute -right-1 -top-1 h-3 w-3 rounded-sm bg-white p-[0.1rem]",
            {
              hidden:
                props.type == "past-grp" ||
                props.isOnline === undefined ||
                !props.isOnline,
              "bg-green-400":
                props.type != "past-grp" && props.isOnline === true,
            }
          )}
        >
          <div className="h-full w-full rounded-sm bg-green-400/80" />
        </div>
      </div>

      <div className="flex h-10 w-[calc(100%-2.5rem)] flex-col justify-between pl-3.5">
        <div className="flex items-end justify-between">
          <p className="text-sm font-medium">{props.fullname}</p>
          <p className="text-xs font-medium text-gray-500">
            {match(props.lastMessage)
              .with(null, () => "")
              .with({ type: "deleted" }, (m) => "12:07")
              .with({ type: "message" }, (m) => "12:07")
              .run()}
          </p>
        </div>

        <div>
          <p className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-gray-500">
            {contactDescription()}
          </p>
        </div>
      </div>
    </div>
  );
}

export function ContactListNewContact(props: {
  topicId: UserTopicId;
  fullname: string;
  onClick: () => void;
  profilePhotoUrl: string | null;
}) {
  return (
    <div
      onClick={props.onClick}
      className="flex cursor-pointer items-center px-5 py-2 hover:bg-gray-100"
    >
      <div className="h-10 w-10 rounded-full">
        {props?.profilePhotoUrl ? (
          <img
            className="inline-block h-10 w-10 rounded-lg object-cover"
            src={props?.profilePhotoUrl ?? ""}
          />
        ) : (
          <div className="flex h-10 w-10 items-end justify-center rounded-lg bg-gray-100 pb-1">
            <IconPerson className="h-7 w-7 text-gray-400" />
          </div>
        )}
      </div>
      <div className="pl-2 text-sm">
        <div className="flex items-center">
          <p>{props.fullname}</p>
        </div>
      </div>
    </div>
  );
}
