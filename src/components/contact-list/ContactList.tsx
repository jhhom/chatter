"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { GroupTopicId, UserId } from "~/backend/drizzle/schema";
import { LastMessageOfTopic } from "~/backend/service/topics/use-cases/get-user-topics/get-last-message-of-topic";
import { Contact2 } from "~/components/contact-list/ContactList0";
import { useClientContext } from "~/components/hooks/stores/client";

export type ContactListProps = {
  contactList: ({
    name: string;
    description: string;
    profilePhotoUrl: string | null;
    touchedAt: Date | null;
  } & (
    | {
        type: "grp";
        topicId: GroupTopicId;
        typing: {
          id: `usr${string}`;
          fullname: string;
        } | null;
        online: boolean;
        lastMessage: LastMessageOfTopic | null;
      }
    | {
        type: "p2p";
        topicId: UserId;
        typing: boolean;
        online: boolean;
        lastMessage: LastMessageOfTopic | null;
      }
    | {
        type: "past-grp";
        topicId: GroupTopicId;
        lastMessage: LastMessageOfTopic | null;
      }
    | {
        type: "new-p2p-contact";
        topicId: UserId;
      }
  ))[];
};

export function ContactList(props: ContactListProps) {
  const router = useRouter();
  const client = useClientContext();

  return (
    <div>
      <div className="flex h-20 items-center justify-between px-4">
        <div className="flex items-center">
          <div className="h-16 w-16">
            <ProfilePicture />
          </div>
          <p className="ml-4 text-lg font-bold">Carol</p>
        </div>
        <div className="flex space-x-4">
          <ContactListIcon icon={<IconUserFriends />} />
          <ContactListIcon icon={<IconEllipsis />} />
          <div>
            <button
              onClick={() => client["auth/logout"]()}
              className="rounded-md bg-red-500 px-2 py-2 text-sm text-white"
            >
              Log out
            </button>
          </div>
        </div>
      </div>

      <div className="mb-4 mt-4 px-4">
        <p className="text-lg font-bold">
          Messages <span className="text-primary-600">(12)</span>
        </p>
      </div>

      <div className="my-2 flex px-4">
        <div className="absolute rounded-l-full px-2.5 py-2.5 text-gray-500">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            height="1em"
            viewBox="0 0 512 512"
            fill="currentColor"
          >
            <path d="M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z" />
          </svg>
        </div>
        <input
          type="text"
          placeholder="Search contact"
          className="block w-full rounded-full border-0 bg-gray-100 py-1.5 pl-9 pr-4 ring-primary-600 placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 sm:text-sm sm:leading-6"
        />
      </div>

      <div className="px-2">
        {props.contactList.map((t) => {
          if (t.type == "p2p") {
            return (
              <Contact2
                key={t.topicId}
                type={t.type}
                onClick={() => {
                  router.push(location.pathname + `?topic=${t.topicId}`);
                }}
                topicId={t.topicId}
                fullname={t.name}
                isTyping={t.typing}
                isOnline={t.online}
                profilePhotoUrl={t.profilePhotoUrl}
                lastMessage={
                  t.lastMessage === null || t.lastMessage === undefined
                    ? null
                    : t.lastMessage
                }
              />
            );
          } else if (t.type == "grp") {
            return (
              <Contact2
                key={t.topicId}
                type={t.type}
                onClick={() => {
                  router.push(location.pathname + `?topic=${t.topicId}`);
                }}
                topicId={t.topicId}
                fullname={t.name}
                typingUserFullname={t.typing?.fullname}
                isOnline={t.online}
                profilePhotoUrl={t.profilePhotoUrl}
                lastMessage={
                  t.lastMessage === null || t.lastMessage === undefined
                    ? null
                    : t.lastMessage
                }
              />
            );
          } else if (t.type == "past-grp") {
            return (
              <Contact2
                key={t.topicId}
                type={t.type}
                onClick={() => {
                  router.push(location.pathname + `?topic=${t.topicId}`);
                }}
                topicId={t.topicId}
                fullname={t.name}
                profilePhotoUrl={t.profilePhotoUrl}
                lastMessage={
                  t.lastMessage === null || t.lastMessage === undefined
                    ? null
                    : t.lastMessage
                }
              />
            );
          } else {
            return <div>A new contact</div>;
          }
        })}
      </div>
    </div>
  );
}

function Contact(props: {
  name: string;
  text: string;
  profilePicSrc: string;
  unreadCount: number;
}) {
  return (
    <div className="flex cursor-pointer rounded-md py-2 hover:bg-primary-50">
      <div className="px-4">
        <div className="h-16 w-16">
          <ProfilePicture imgSrc={props.profilePicSrc} />
        </div>
      </div>

      <div className="flex w-full items-center pr-4">
        <div className="w-full">
          <div className="flex w-full items-end justify-between">
            <p>{props.name}</p>
            <p
              className={clsx("mb-0.5 text-xs", {
                "text-primary-600": props.unreadCount != 0,
                "text-gray-400": props.unreadCount === 0,
              })}
            >
              9:37 Pm
            </p>
          </div>
          <div className="flex h-[1.4rem] items-end justify-between">
            <p className="text-sm text-gray-500">{props.text}</p>
            {props.unreadCount != 0 && (
              <div className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary-600 text-center text-[0.7rem] text-white">
                <p>{props.unreadCount}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProfilePicture(props: { imgSrc?: string }) {
  return (
    <div className="h-full w-full rounded-full">
      <img
        className="h-full w-full rounded-full object-cover"
        src={
          props.imgSrc
            ? props.imgSrc
            : "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTh8fHByb2ZpbGV8ZW58MHx8MHx8fDA%3D&w=1000&q=80"
        }
      />
    </div>
  );
}

function ContactListIcon(props: { icon: JSX.Element }) {
  return (
    <div className="cursor-full flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-gray-200 hover:bg-gray-300">
      <div className="h-5 w-5 text-gray-600">{props.icon}</div>
    </div>
  );
}

function IconUserFriends() {
  // source: https://fontawesome.com/icons/user-group?f=classNameic&s=solid
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-full w-full"
      fill="currentColor"
      viewBox="0 0 640 512"
    >
      <path d="M96 128a128 128 0 1 1 256 0A128 128 0 1 1 96 128zM0 482.3C0 383.8 79.8 304 178.3 304h91.4C368.2 304 448 383.8 448 482.3c0 16.4-13.3 29.7-29.7 29.7H29.7C13.3 512 0 498.7 0 482.3zM609.3 512H471.4c5.4-9.4 8.6-20.3 8.6-32v-8c0-60.7-27.1-115.2-69.8-151.8c2.4-.1 4.7-.2 7.1-.2h61.4C567.8 320 640 392.2 640 481.3c0 17-13.8 30.7-30.7 30.7zM432 256c-31 0-59-12.6-79.3-32.9C372.4 196.5 384 163.6 384 128c0-26.8-6.6-52.1-18.3-74.3C384.3 40.1 407.2 32 432 32c61.9 0 112 50.1 112 112s-50.1 112-112 112z" />
    </svg>
  );
}

function IconEllipsis() {
  // source: https://fontawesome.com/icons/ellipsis?f=classNameic&s=solid
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-full w-full"
      fill="currentColor"
      viewBox="0 0 448 512"
    >
      <path d="M8 256a56 56 0 1 1 112 0A56 56 0 1 1 8 256zm160 0a56 56 0 1 1 112 0 56 56 0 1 1 -112 0zm216-56a56 56 0 1 1 0 112 56 56 0 1 1 0-112z" />
    </svg>
  );
}
