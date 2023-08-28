import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  type PermissionId,
  PermissionSetting,
} from "~/frontend/frontend-2/features/common/components";
import {
  IconBackArrow,
  IconLeaveGroup,
} from "~/frontend/frontend-2/features/common/icons";
import { useAppStore } from "~/frontend/stores/stores";
import storage from "~/frontend/external/browser/local-storage";
import { client } from "~/frontend/external/api-client/client";
import { dexie } from "~/frontend/external/browser/indexed-db";
import { permission } from "~/backend/service/common/permissions";

import { IconPerson } from "~/frontend/frontend-2/features/common/icons";

export function SidePanelSettings() {
  const router = useRouter();
  const { profile, setAuthStatus } = useAppStore((s) => ({
    profile: s.profile.profile,
    setAuthStatus: s.setAuthStatus,
  }));

  const [permissionStr, setPermissionStr] = useState(
    profile?.defaultPermissions ?? ""
  );

  const currentTopic = useSearchParams().get("topic");

  if (profile === null) {
    throw new Error("Profile is null");
  }

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
    <div className="h-full bg-white pt-4">
      <div className="flex">
        <div className="pl-4">
          <button
            onClick={() =>
              router.push(
                `/${currentTopic !== null ? `?topic=${currentTopic}` : ""}`
              )
            }
            className="rounded-lg border border-gray-300 px-2 py-2 hover:bg-gray-100"
          >
            <IconBackArrow className="h-4 w-4 text-gray-600" />
          </button>
        </div>

        <p className="flex items-center pl-3 text-lg font-medium">Settings</p>
      </div>

      <div className="bg-white pb-3 pt-4">
        <div className="flex justify-center py-2">
          <div className="h-14 w-14">
            {profile?.profilePhotoUrl ? (
              <img
                className="inline-block h-10 w-10 rounded-lg object-cover"
                src={profile?.profilePhotoUrl ?? ""}
              />
            ) : (
              <div className="flex h-14 w-14 items-end justify-center rounded-lg bg-gray-100 pb-1">
                <IconPerson className="h-10 w-10 text-gray-400" />
              </div>
            )}
          </div>
        </div>

        <div className="pt-1">
          <p className="text-center font-medium">{profile.fullname}</p>
          <p className="mt-3 text-center text-sm text-gray-500">
            ID: {profile.userId}
          </p>
        </div>

        <div className="my-6 px-4">
          <hr className="border-t border-gray-300" />
        </div>

        <div className="px-4 text-sm">
          <p className="font-medium">Default permissions</p>
          <p className="mt-3">Permission given to new contact:</p>

          <PermissionSetting
            name="Join (J)"
            permissionId="J"
            checked={permission(permissionStr).canJoin()}
            onChange={onCheckboxChange}
            editable={true}
          />
          <PermissionSetting
            name="Read (R)"
            permissionId="R"
            checked={permission(permissionStr).canRead()}
            onChange={onCheckboxChange}
            editable={true}
          />
          <PermissionSetting
            name="Write (W)"
            permissionId="W"
            checked={permission(permissionStr).canWrite()}
            onChange={onCheckboxChange}
            editable={true}
          />
          <PermissionSetting
            name="Get notified (P)"
            permissionId="P"
            checked={permission(permissionStr).canGetNotifiedOfPresence()}
            onChange={onCheckboxChange}
            editable={true}
          />
        </div>

        <div className="mt-8 flex justify-between px-4 text-sm">
          <button
            onClick={() =>
              router.push(
                `/${currentTopic !== null ? `?topic=${currentTopic}` : ""}`
              )
            }
            className="rounded-md border-2 border-gray-200 px-4 py-1.5"
          >
            Cancel
          </button>

          <button className="rounded-md bg-green-600 px-4 py-1.5 font-medium text-white">
            Save changes
          </button>
        </div>
      </div>

      <div className="my-6 px-4">
        <hr className="border-t border-gray-300" />
      </div>

      <div className="px-4">
        <button
          onClick={async () => {
            const result = await client["auth/logout"]();
            if (result.isErr()) {
              alert("Error logout: " + result.error.message);
            }
            storage.clearToken();
            setAuthStatus("logged-out");
            await dexie.delete().then(() => dexie.open());
            router.push(
              `/${currentTopic !== null ? `?topic=${currentTopic}` : ""}`
            );
          }}
          className="group mt-3 flex h-10 w-full cursor-pointer items-center justify-between rounded-md bg-red-500 pl-4 text-left text-gray-600 hover:bg-red-600"
        >
          <p className="text-sm text-white group-hover:text-white">LOG OUT</p>
          <div className="mr-2 flex h-full w-10 items-center justify-center rounded-md px-2">
            <IconLeaveGroup className="text-white group-hover:text-white" />
          </div>
        </button>
      </div>
    </div>
  );
}
