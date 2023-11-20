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
import { format } from "date-fns";

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
        touchedAt: Date | null;
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
        touchedAt: Date | null;
      }
    | {
        type: "past-grp";
        topicId: GroupTopicId;
        fullname: string;
        description?: string;
        profilePhotoUrl: string | null;
        onClick: () => void;
        lastMessage: LastMessageOfTopic | null;
        touchedAt: Date | null;
      }
  ) & {
    userId: UserId;
  }
) {
  const unreadMessageCount =
    // the reason we need to check `dexie.isOpen`
    // IndexedDB (dexie) will be closed when user login to a different account on the same browser
    // When that happens, the database will be closed and resetted
    // Hence we need to check `dexie.isOpen` so that error is not thrown
    // Before the browser detects that a different account is open on another window
    useLiveQuery(() =>
      dexie.isOpen()
        ? dexie.messages
            .filter(
              (m) =>
                m.topicId == props.topicId &&
                !m.read &&
                !(m.author == props.userId)
            )
            .count()
        : 0
    ) ?? 0;

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
          <p
            className={cx("text-xs font-medium text-gray-500", {
              "font-medium text-green-500": unreadMessageCount > 0,
            })}
          >
            {match(props.lastMessage)
              .with(null, () => "")
              .with({ type: "deleted" }, (m) =>
                props.touchedAt ? format(props.touchedAt, "hh:mm aaa") : ""
              )
              .with({ type: "message" }, (m) =>
                props.touchedAt ? format(props.touchedAt, "hh:mm aaa") : ""
              )
              .run()}
          </p>
        </div>

        <div className="flex justify-between">
          <p
            className={cx(
              "overflow-hidden text-ellipsis whitespace-nowrap text-xs text-gray-500",
              {
                "pr-2": unreadMessageCount > 0,
              }
            )}
          >
            {contactDescription()}
          </p>

          {unreadMessageCount > 0 && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-green-400 text-center text-[0.64rem] text-white">
              {unreadMessageCount}
            </span>
          )}
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
