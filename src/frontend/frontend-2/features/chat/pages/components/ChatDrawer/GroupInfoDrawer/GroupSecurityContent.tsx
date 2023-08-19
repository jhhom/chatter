import { useState, useEffect } from "react";

import {
  type PermissionId,
  PermissionSetting,
} from "~/frontend/frontend-2/features/common/components";
import { permission } from "~/backend/service/common/permissions";

export function GroupSecurityContent({
  groupDefaultPermission,
  ...props
}: {
  userPermission: string;
  groupDefaultPermission: string;
  editable: boolean;
  onSubmitPermissionChange: (permission: string) => void;
  onCancel: () => void;
}) {
  const [permissionStr, setPermissionStr] = useState(groupDefaultPermission);

  const displayedGroupDefaultPermission = permission(permissionStr);

  const onCheckboxChange = (id: PermissionId, checked: boolean) => {
    let newPermissionString = permissionStr;
    if (checked) {
      newPermissionString = newPermissionString + id;
    } else {
      newPermissionString = newPermissionString.replace(id, "");
    }
    setPermissionStr(newPermissionString);
  };

  // synchronize the updates of group default permission on the server with the permissions displayed
  useEffect(() => {
    setPermissionStr(groupDefaultPermission);
  }, [groupDefaultPermission]);

  return (
    <div>
      <div className="bg-gray-200">
        <div className="bg-white px-4 pb-3 pt-4">
          <p className="text-blue-600">Default permissions</p>
          <div className="mt-4">
            <PermissionSetting
              name="Join (J)"
              permissionId="J"
              checked={displayedGroupDefaultPermission.canJoin()}
              onChange={onCheckboxChange}
              editable={props.editable}
            />
            <PermissionSetting
              name="Read (R)"
              permissionId="R"
              checked={displayedGroupDefaultPermission.canRead()}
              onChange={onCheckboxChange}
              editable={props.editable}
            />
            <PermissionSetting
              name="Write (W)"
              permissionId="W"
              checked={displayedGroupDefaultPermission.canWrite()}
              onChange={onCheckboxChange}
              editable={props.editable}
            />
            <PermissionSetting
              name="Get notified (P)"
              permissionId="P"
              checked={displayedGroupDefaultPermission.canGetNotifiedOfPresence()}
              onChange={onCheckboxChange}
              editable={props.editable}
            />
            <PermissionSetting
              name="Share (S)"
              permissionId="S"
              checked={displayedGroupDefaultPermission.canShare()}
              onChange={onCheckboxChange}
              editable={props.editable}
            />
            <PermissionSetting
              name="Delete (D)"
              permissionId="D"
              checked={displayedGroupDefaultPermission.canDelete()}
              onChange={onCheckboxChange}
              editable={props.editable}
            />
            <PermissionSetting
              name="Administer (A)"
              permissionId="A"
              checked={displayedGroupDefaultPermission.canAdminister()}
              onChange={onCheckboxChange}
              editable={props.editable}
            />
          </div>

          <div className="mt-8 pb-4">
            <p>User permissions:</p>
            <p className="mt-2 cursor-pointer">{props.userPermission}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex h-8 justify-end px-4">
        <button
          onClick={props.onCancel}
          className="rounded-md border-2 border-gray-300 bg-white px-4 text-blue-500"
        >
          CANCEL
        </button>
        <button
          onClick={() => props.onSubmitPermissionChange(permissionStr)}
          className="ml-2 rounded-md bg-blue-500 px-8 text-white"
        >
          OK
        </button>
      </div>
    </div>
  );
}
