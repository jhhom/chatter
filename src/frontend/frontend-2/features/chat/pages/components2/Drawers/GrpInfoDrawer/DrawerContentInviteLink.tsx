import {
  IconCopy,
  IconExclamationCircle,
  IconStop,
} from "~/frontend/frontend-2/features/common/icons";
import { DrawerButton } from "./components";

export function DrawerContentInviteLink() {
  return (
    <div className="px-6 pt-4">
      <div className="bg-white pb-3">
        <div className="flex py-2">
          <div className="h-14 w-14">
            <img
              className="h-full w-full rounded-lg"
              src="./assets/abstract-art.jpg"
            />
          </div>

          <div className="w-[calc(100%-3.5rem)] pl-4 text-sm">
            <p className="font-medium">Designers Team</p>
            <a
              className="mt-1.5 block text-[0.8rem] text-blue-600 hover:text-blue-700 hover:underline"
              href="http://localhost:4000/join_group/8y3a8505rgeory8"
            >
              http://localhost:4000/join_group/8y3a8505rgeory8
            </a>
          </div>
        </div>

        <div className="mt-4 flex rounded-md bg-orange-100 px-4 py-2 text-[0.8rem]">
          <IconExclamationCircle className="mr-3 w-12 text-orange-400" />
          <p>
            Anyone with Tinode can follow this link to join this group. Only
            share it with people you trust.
          </p>
        </div>

        <div className="mt-6 text-sm">
          <DrawerButton
            content="Copy link"
            icon={<IconCopy className="text-gray-400" />}
            iconPadding="px-2.5"
            onClick={() => {
              console.log("bom");
            }}
          />
        </div>

        <div className="mt-4 text-sm">
          <DrawerButton
            content="Reset link"
            icon={<IconStop className="text-gray-400" />}
            iconPadding="px-2.5"
            onClick={() => {
              console.log("bom");
            }}
          />
        </div>
      </div>
    </div>
  );
}
