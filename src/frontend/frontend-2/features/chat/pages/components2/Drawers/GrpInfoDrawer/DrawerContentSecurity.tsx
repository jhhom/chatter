import { useState, useEffect } from "react";
import { clsx as cx } from "clsx";
import { type PermissionId, PermissionSetting } from "../Permission";
import { permission } from "~/backend/service/common/permissions";

export function DrawerContentSecurity(props: {
  userPermission: string;
  groupDefaultPermission: string;
  editable: boolean;
  onSubmitPermissionChange: (permission: string) => void;
  onBack: () => void;
}) {
  const [permissionStr, setPermissionStr] = useState(
    props.groupDefaultPermission
  );

  const groupDefaultPermission = () => permission(permissionStr);

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
    setPermissionStr(props.groupDefaultPermission);
  }, [props]);

  return (
    <div className="h-full bg-white px-4 pt-6">
      <div>
        <p className="mb-3 text-sm font-medium">Group default permissions</p>

        <PermissionSetting
          name="Join (J)"
          permissionId="J"
          checked={groupDefaultPermission().canJoin()}
          onChange={() => {
            console.log("bom");
          }}
          editable={props.editable}
        />
        <PermissionSetting
          name="Read (R)"
          permissionId="R"
          checked={groupDefaultPermission().canRead()}
          onChange={onCheckboxChange}
          editable={props.editable}
        />
        <PermissionSetting
          name="Write (W)"
          permissionId="W"
          checked={groupDefaultPermission().canWrite()}
          onChange={onCheckboxChange}
          editable={props.editable}
        />
        <PermissionSetting
          name="Get notified (P)"
          permissionId="P"
          checked={groupDefaultPermission().canGetNotifiedOfPresence()}
          onChange={onCheckboxChange}
          editable={props.editable}
        />
        <PermissionSetting
          name="Share (S)"
          permissionId="P"
          checked={groupDefaultPermission().canShare()}
          onChange={onCheckboxChange}
          editable={props.editable}
        />
        <PermissionSetting
          name="Delete (D)"
          permissionId="P"
          checked={groupDefaultPermission().canDelete()}
          onChange={onCheckboxChange}
          editable={props.editable}
        />
        <PermissionSetting
          name="Administer (A)"
          permissionId="P"
          checked={groupDefaultPermission().canAdminister()}
          onChange={onCheckboxChange}
          editable={props.editable}
        />
      </div>

      <div className="text-sm">
        <p className="mb-3 mt-9 font-medium">Permissions given to you:</p>
        <p className="">{props.userPermission}</p>
      </div>

      <div className="mt-8 flex justify-between text-sm">
        <button
          onClick={props.onBack}
          className={cx("rounded-md border-2 border-gray-200 px-4 py-1.5", {
            "ml-auto": !props.editable,
          })}
        >
          {props.editable ? "Cancel" : "Back"}
        </button>

        {props.editable && (
          <button
            onClick={() => props.onSubmitPermissionChange(permissionStr)}
            className="rounded-md bg-green-600 px-4 py-1.5 font-medium text-white"
          >
            Save changes
          </button>
        )}
      </div>
    </div>
  );
}
