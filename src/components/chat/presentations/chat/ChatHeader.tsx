import { format } from "date-fns";
import clsx from "clsx";

import { AVATAR_IMG } from "~/components/constants";
import { ProfilePicture } from "~/components/experiments/ContactList";

export type ChatHeaderProps = {
  name: string;
  online: boolean;
  lastSeen: Date | null;
  typing: string | null;
  profilePhotoUrl: string | null;
  type: "group" | "p2p";
};

export function ChatHeader(props: ChatHeaderProps) {
  const profileAnnotation = props.typing
    ? `${props.typing} is typing...`
    : props.lastSeen
    ? `last seen at ${format(props.lastSeen, "PPP")}, ${format(
        props.lastSeen,
        "p"
      )}`
    : "";

  return (
    <div className="flex h-20 items-center border-b border-primary-200 px-4">
      <div className="relative h-14 w-14 rounded-full">
        <ProfilePicture imgSrc={props.profilePhotoUrl ?? AVATAR_IMG} />
        {props.online && (
          <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500" />
        )}
      </div>
      <div className="flex items-end pl-3">
        <div className="mb-0.5">
          <p className="text-lg font-semibold">{props.name}</p>

          <p
            className={clsx("mt-0.5 text-sm", {
              "font-medium text-primary-500": props.typing !== null,
              "text-gray-600": props.typing === null,
            })}
          >
            {profileAnnotation}
          </p>
        </div>
      </div>
    </div>
  );
}
