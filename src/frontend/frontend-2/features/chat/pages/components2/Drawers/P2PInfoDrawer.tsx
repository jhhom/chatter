import type { UserId } from "~/api-contract/subscription/subscription";
import { useState } from "react";
import { IconX, IconPerson } from "~/frontend/frontend-2/features/common/icons";
import { PermissionSetting } from "./Permission";
import { permission } from "~/backend/service/common/permissions";
import type { PermissionId } from "./Permission";

export function P2PInfoDrawer(props: {
  userPermission: string;
  peerPermission: string;
  userName: string;
  userId: UserId;
  userProfilePhotoUrl: string | null;
  onSavePermissionChanges: (permission: string) => void;
  onClose: () => void;
}) {
  const [permissionStr, setPermissionStr] = useState(props.peerPermission);

  const peerPermission = permission(permissionStr);

  const onCheckboxChange = (id: PermissionId, checked: boolean) => {
    let newPermissionString = permissionStr;
    if (checked) {
      newPermissionString = newPermissionString + id;
    } else {
      newPermissionString = newPermissionString.replace(id, "");
    }
    setPermissionStr(newPermissionString);
  };

  return (
    <div>
      <DrawerHeader onClose={props.onClose} />

      <div className="bg-white pb-3 pt-4">
        <div className="flex justify-center py-2">
          <div className="h-14 w-14">
            {props.userProfilePhotoUrl ? (
              <img
                className="h-full w-full rounded-lg"
                src={props.userProfilePhotoUrl ?? ""}
              />
            ) : (
              <div className="flex h-full w-full items-end justify-center rounded-lg bg-gray-100 pb-1">
                <IconPerson className="h-10 w-10 text-gray-400" />
              </div>
            )}
          </div>
        </div>

        <div className="pt-1">
          <p className="text-center font-medium">{props.userName}</p>
          <p className="mt-3 text-center text-sm text-gray-500">
            ID: {props.userId}
          </p>
        </div>

        <div className="my-6 px-4">
          <hr className="border-t border-gray-300" />
        </div>

        <div className="px-4 text-sm">
          <p className="font-medium">Permissions</p>
          <p className="mt-3">Permissions given to {props.userName}:</p>

          <PermissionSetting
            name="Join (J)"
            permissionId="J"
            checked={peerPermission.canJoin()}
            onChange={onCheckboxChange}
            editable={true}
          />
          <PermissionSetting
            name="Read (R)"
            permissionId="R"
            checked={peerPermission.canRead()}
            onChange={onCheckboxChange}
            editable={true}
          />
          <PermissionSetting
            name="Write (W)"
            permissionId="W"
            checked={peerPermission.canWrite()}
            onChange={onCheckboxChange}
            editable={true}
          />
          <PermissionSetting
            name="Get notified (P)"
            permissionId="P"
            checked={peerPermission.canGetNotifiedOfPresence()}
            onChange={onCheckboxChange}
            editable={true}
          />

          <p className="mb-2 mt-7">Permissions given to you:</p>
          <p className="">JRWP</p>
        </div>

        <div className="mt-8 flex justify-between px-4 text-sm">
          <button
            onClick={props.onClose}
            className="rounded-md border-2 border-gray-200 px-4 py-1.5"
          >
            Cancel
          </button>

          <button
            onClick={() => props.onSavePermissionChanges(permissionStr)}
            className="rounded-md bg-green-600 px-4 py-1.5 font-medium text-white"
          >
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}

function DrawerHeader(props: { onClose: () => void }) {
  return (
    <div className="flex h-16 items-center justify-between border-b border-gray-300 px-4">
      <p>Info</p>
      <button
        onClick={props.onClose}
        className="h-10 w-10 rounded-md p-2.5 hover:bg-gray-100"
      >
        <IconX />
      </button>
    </div>
  );
}
