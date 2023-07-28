import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ok } from "neverthrow";

import { BackBtn } from "~/frontend/features/common/components";
import { permission } from "~/backend/service/common/permissions";

import { useAppStore } from "~/frontend/stores/stores";
import { client } from "~/frontend/external/api-client/client";

export type PermissionId = "J" | "R" | "W" | "P" | "S" | "D" | "A";

export default function SecuritySettingsPanel() {
  const router = useRouter();

  const profile = useAppStore((s) => s.profile.profile);

  const [permissionStr, setPermissionStr] = useState(
    profile?.defaultPermissions ?? ""
  );

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
      <div className="flex bg-blue-500 px-4 py-4 text-lg text-white">
        <BackBtn onClick={() => router.push("/")} />
        <p className="ml-4">Security</p>
      </div>

      <div className="bg-gray-200">
        <div className="bg-white px-4 pb-3 pt-4">
          <p className="text-blue-600">Permissions</p>
          <div className="mt-4">
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
        </div>
      </div>

      <div className="mt-4 flex h-8 justify-end px-4">
        <button
          onClick={() => router.push("/settings")}
          className="rounded-md border-2 border-gray-300 bg-white px-4 text-blue-500"
        >
          CANCEL
        </button>
        <button
          onClick={async () => {
            const r = await client[
              "permissions/update_user_default_permission"
            ]({
              newPermission: permissionStr,
            });
            if (r.isOk()) {
              router.push("/settings");
            }
          }}
          className="ml-2 rounded-md bg-blue-500 px-8 text-white"
        >
          OK
        </button>
      </div>
    </div>
  );
}

export function PermissionSetting(props: {
  name: string;
  permissionId: PermissionId;
  checked: boolean;
  onChange: (id: PermissionId, checked: boolean) => void;
  editable: boolean;
}) {
  return (
    <div className="mt-2 flex justify-between">
      <p>{props.name}</p>
      <input
        className="cursor-pointer"
        type="checkbox"
        name="checked"
        disabled={!props.editable}
        checked={props.checked}
        onChange={(e) => props.onChange(props.permissionId, e.target.checked)}
      />
    </div>
  );
}
