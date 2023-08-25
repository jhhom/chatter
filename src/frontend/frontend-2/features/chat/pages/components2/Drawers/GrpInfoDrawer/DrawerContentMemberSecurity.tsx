import { useState, useEffect } from "react";

import { permission } from "~/backend/service/common/permissions";

import { type PermissionId, PermissionSetting } from "../Permission";

export function DrawerContentMemberSecurity(props: {
  username: string;
  editable: boolean;
  getMemberPermission: () => Promise<string>;
  onSubmitPermissionChange: (permission: string) => Promise<string>;
  onCancel: () => void;
}) {
  const [permissionStr, setPermissionStr] = useState("");
  const [editingPermissionStr, setEditingPermissionStr] = useState("");

  useEffect(() => {
    void props.getMemberPermission().then((permission) => {
      setPermissionStr(permission);
      setEditingPermissionStr(permission);
    });
  }, [props]);

  const editingMemberPermission = () => permission(editingPermissionStr);

  const onCheckboxChange = (id: PermissionId, checked: boolean) => {
    let newPermissionString = permissionStr;
    if (checked) {
      newPermissionString = newPermissionString + id;
    } else {
      newPermissionString = newPermissionString.replace(id, "");
    }
    setEditingPermissionStr(newPermissionString);
  };

  return (
    <div>
      <div className="bg-gray-200">
        <div className="bg-white px-4 pb-3 pt-4">
          <p className="text-blue-600">{props.username}</p>
          <div className="mt-4">
            <PermissionSetting
              name="Join (J)"
              permissionId="J"
              checked={editingMemberPermission().canJoin()}
              onChange={onCheckboxChange}
              editable={props.editable}
            />
            <PermissionSetting
              name="Read (R)"
              permissionId="R"
              checked={editingMemberPermission().canRead()}
              onChange={onCheckboxChange}
              editable={props.editable}
            />
            <PermissionSetting
              name="Write (W)"
              permissionId="W"
              checked={editingMemberPermission().canWrite()}
              onChange={onCheckboxChange}
              editable={props.editable}
            />
            <PermissionSetting
              name="Get notified (P)"
              permissionId="P"
              checked={editingMemberPermission().canGetNotifiedOfPresence()}
              onChange={onCheckboxChange}
              editable={props.editable}
            />
            <PermissionSetting
              name="Share (S)"
              permissionId="S"
              checked={editingMemberPermission().canShare()}
              onChange={onCheckboxChange}
              editable={props.editable}
            />
            <PermissionSetting
              name="Delete (D)"
              permissionId="D"
              checked={editingMemberPermission().canDelete()}
              onChange={onCheckboxChange}
              editable={props.editable}
            />
            <PermissionSetting
              name="Administer (A)"
              permissionId="A"
              checked={editingMemberPermission().canAdminister()}
              onChange={onCheckboxChange}
              editable={props.editable}
            />
          </div>

          <div className="mt-8 pb-4">
            <p>User permissions:</p>
            <p className="mt-2 cursor-pointer">{permissionStr}</p>
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
          onClick={async () => {
            const permission = await props.onSubmitPermissionChange(
              editingPermissionStr
            );
            setPermissionStr(permission);
            setEditingPermissionStr(permission);
          }}
          className="ml-2 rounded-md bg-blue-500 px-8 text-white"
        >
          OK
        </button>
      </div>
    </div>
  );
}
