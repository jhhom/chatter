import type { UserId } from "~/api-contract/subscription/subscription";
import { IconShield, IconX } from "~/frontend/frontend-2/features/common/icons";
import { PermissionSetting } from "./Permission";

export function P2PInfoDrawer(props: {
  userName: string;
  userId: UserId;
  onSecurityClick: () => void;
  onClose: () => void;
}) {
  return (
    <div>
      <DrawerHeader onClose={props.onClose} />

      <div className="bg-white pb-3 pt-4">
        <div className="flex justify-center py-2">
          <div className="h-14 w-14">
            <img
              className="h-full w-full rounded-lg"
              src="./assets/abstract-art.jpg"
            />
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
            checked={true}
            onChange={() => {
              console.log("change");
            }}
            editable={true}
          />
          <PermissionSetting
            name="Read (R)"
            permissionId="R"
            checked={true}
            onChange={() => {
              console.log("change");
            }}
            editable={true}
          />
          <PermissionSetting
            name="Write (W)"
            permissionId="W"
            checked={true}
            onChange={() => {
              console.log("change");
            }}
            editable={true}
          />
          <PermissionSetting
            name="Get notified (P)"
            permissionId="P"
            checked={true}
            onChange={() => {
              console.log("change");
            }}
            editable={true}
          />

          <p className="mb-2 mt-7">Permissions given to you:</p>
          <p className="">JRWP</p>
        </div>

        <div className="mt-8 flex justify-between px-4 text-sm">
          <button className="rounded-md border-2 border-gray-200 px-4 py-1.5">
            Cancel
          </button>

          <button className="rounded-md bg-green-600 px-4 py-1.5 font-medium text-white">
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
