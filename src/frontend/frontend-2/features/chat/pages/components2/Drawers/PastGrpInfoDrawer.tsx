import { IconPerson } from "~/frontend/frontend-2/features/common/icons";

import type {
  GroupTopicId,
  UserId,
} from "~/api-contract/subscription/subscription";

export function PastGrpDrawerContentInfo(props: {
  groupName: string;
  groupId: GroupTopicId;
  userId: UserId;
  userFullname: string;
  profilePhotoUrl: string | null;
  memberList: {
    name: string;
    userId: UserId;
    profilePhotoUrl: string | null;
  }[];
}) {
  return (
    <div className="h-full bg-white">
      <div className="pb-3 pt-4">
        <div className="flex justify-center py-2">
          <div className="h-14 w-14">
            {props.profilePhotoUrl ? (
              <img
                className="h-full w-full rounded-lg"
                src={props.profilePhotoUrl}
              />
            ) : (
              <div className="flex h-full w-full items-end justify-center rounded-lg bg-gray-100 pb-1">
                <IconPerson className="h-9 w-9 text-gray-400" />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="pt-1">
        <p className="text-center font-medium">{props.groupName}</p>
        <p className="mt-3 text-center text-sm text-gray-500">
          ID: {props.groupId}
        </p>
      </div>

      <div className="mt-8 px-4 text-sm">
        <div className="flex justify-between">
          <p className="border-gray-400  font-medium">
            Group members ({props.memberList.length})
          </p>
        </div>

        <div className="mt-5">
          <ul className="space-y-5">
            {props.memberList.map((m) => {
              return (
                <MemberListContact
                  key={m.userId}
                  name={m.name}
                  profilePhotoUrl={m.profilePhotoUrl}
                  userId={m.userId}
                  isOwnSelf={m.userId === props.userId}
                />
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

function MemberListContact(props: {
  name: string;
  userId: UserId;
  isOwnSelf: boolean;
  profilePhotoUrl: string | null;
}) {
  return (
    <li className="group flex cursor-pointer items-center justify-between rounded-lg">
      <div className="flex items-center">
        <div className="h-9 w-9">
          {props.profilePhotoUrl ? (
            <img
              className="h-full w-full rounded-lg object-cover"
              src={props.profilePhotoUrl}
            />
          ) : (
            <div className="flex h-full w-full items-end justify-center rounded-lg bg-gray-100 pb-1">
              <IconPerson className="h-6 w-6 text-gray-400" />
            </div>
          )}
        </div>
        <p className="pl-3">{props.name}</p>
      </div>
    </li>
  );
}
