import { useState } from "react";
import { permission } from "~/backend/service/common/permissions";

import { IconShield } from "~/frontend/features/common/icons";
import type { UserId } from "~/api-contract/subscription/subscription";
import {
  type PermissionId,
  PermissionSetting,
} from "~/frontend/features/user/pages/UserPermissionSettingPanel.page";
import ChatInfoDrawer from "~/frontend/features/chat/pages/components/ChatInfoDrawer/Drawer";

export function P2PInfoDrawer(props: {
  onClose: () => void;
  children: (props: {
    content: "info" | "security";
    setContent: (content: "info" | "security") => void;
  }) => JSX.Element;
}) {
  const [content, setContent] = useState<"info" | "security">("info");
  return (
    <ChatInfoDrawer onClose={props.onClose}>
      {props.children({ content, setContent })}
    </ChatInfoDrawer>
  );
}

export type SecurityContentProps = {
  userPermission: string;
  peerPermission: string;
  onSubmitPermissionChange: (permission: string) => void;
  onCancel: () => void;
};

export function SecurityContent(props: SecurityContentProps) {
  const [permissionStr, setPermissionStr] = useState(props.peerPermission);

  const peerPermission = () => permission(permissionStr);

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
      <div className="bg-gray-200">
        <div className="bg-white px-4 pb-3 pt-4">
          <p className="text-blue-600">Permissions</p>
          <div className="mt-4">
            <PermissionSetting
              name="Join (J)"
              permissionId="J"
              checked={peerPermission().canJoin()}
              onChange={onCheckboxChange}
              editable={true}
            />
            <PermissionSetting
              name="Read (R)"
              permissionId="R"
              checked={peerPermission().canRead()}
              onChange={onCheckboxChange}
              editable={true}
            />
            <PermissionSetting
              name="Write (W)"
              permissionId="W"
              checked={peerPermission().canWrite()}
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

export function InfoContent(props: {
  userFullname: string;
  userId: UserId;
  onSecurityClick: () => void;
}) {
  return (
    <div>
      <div className="bg-white pb-3">
        <div className="flex justify-center py-2">
          <div className="h-32 w-32">
            <img
              className="h-full w-full rounded-full"
              src="https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Tour_Eiffel_Wikimedia_Commons_%28cropped%29.jpg/640px-Tour_Eiffel_Wikimedia_Commons_%28cropped%29.jpg"
            />
          </div>
        </div>

        <div className="px-2 text-sm">
          <div>
            <p className="text-blue-600">Name</p>
            <p>{props.userFullname}</p>
          </div>
          <div className="mt-4">
            <p>ID: {props.userId}</p>
          </div>
        </div>

        <div className="mt-2.5 bg-white">
          <div className="text-sm">
            <div className="pt-2">
              <button
                onClick={props.onSecurityClick}
                className="flex h-10 w-full items-center px-4 text-left text-blue-500 hover:text-blue-700"
              >
                <span>
                  <IconShield
                    height={20}
                    className="text-blue-500 hover:text-blue-700"
                  />
                </span>
                <span className="ml-1 block">SECURITY</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
