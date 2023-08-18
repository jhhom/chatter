import { useRouter } from "next/navigation";
import { PermissionSetting } from "~/frontend/frontend-2/features/common/components";
import {
  IconBackArrow,
  IconLeaveGroup,
} from "~/frontend/frontend-2/features/common/icons";

export function SidePanelSettings() {
  const router = useRouter();

  return (
    <div className="pt-4">
      <div className="flex">
        <div className="pl-4">
          <button
            onClick={() => router.push("/")}
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
            <img
              className="h-full w-full rounded-lg"
              src="./new-ui-assets/abstract-art.jpg"
            />
          </div>
        </div>

        <div className="pt-1">
          <p className="text-center font-medium">Mark Newman</p>
          <p className="mt-3 text-center text-sm text-gray-500">
            ID: usr12345678190
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
            checked={true}
            editable={true}
          />
          <PermissionSetting
            name="Read (R)"
            permissionId="R"
            checked={true}
            editable={true}
          />
          <PermissionSetting
            name="Write (W)"
            permissionId="W"
            checked={true}
            editable={true}
          />
          <PermissionSetting
            name="Get notified (P)"
            permissionId="P"
            checked={true}
            editable={true}
          />
        </div>

        <div className="mt-8 flex justify-between px-4 text-sm">
          <button
            onClick={() => router.push("/")}
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
        <button className="group mt-3 flex h-10 w-full cursor-pointer items-center justify-between rounded-md bg-red-500 pl-4 text-left text-gray-600 hover:bg-red-600">
          <p className="text-sm text-white group-hover:text-white">LOG OUT</p>
          <div className="mr-2 flex h-full w-10 items-center justify-center rounded-md px-2">
            <IconLeaveGroup className="text-white group-hover:text-white" />
          </div>
        </button>
      </div>
    </div>
  );
}
