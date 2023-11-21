import { Fragment, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  type PermissionId,
  PermissionSetting,
} from "~/frontend/frontend-2/features/common/components";
import {
  IconBackArrow,
  IconLeaveGroup,
  IconUserXMark,
  IconWarning,
} from "~/frontend/frontend-2/features/common/icons";
import { useAppStore } from "~/frontend/stores/stores";
import storage from "~/frontend/external/browser/local-storage";
import { client } from "~/frontend/external/api-client/client";
import { dexie } from "~/frontend/external/browser/indexed-db";
import { permission } from "~/backend/service/common/permissions";

import { IconPerson } from "~/frontend/frontend-2/features/common/icons";
import { Dialog, Transition } from "@headlessui/react";

import { clsx as cx } from "clsx";

export function SidePanelSettings() {
  const router = useRouter();
  const { profile, setAuthStatus, setAfterLoginNavigateTo } = useAppStore(
    (s) => ({
      profile: s.profile.profile,
      setAuthStatus: s.setAuthStatus,
      setAfterLoginNavigateTo: s.setAfterLoginNavigateTo,
    })
  );

  const [permissionStr, setPermissionStr] = useState(
    profile?.defaultPermissions ?? ""
  );

  const [showDeleteAccountOverlay, setShowDeleteAccountOverlay] =
    useState(false);

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
            setAfterLoginNavigateTo(null);
            await dexie.delete().then(() => dexie.open());
            router.push(`/`);
          }}
          className="group mt-3 flex h-10 w-full cursor-pointer items-center justify-between rounded-md bg-red-500 pl-4 text-left text-gray-600 hover:bg-red-600"
        >
          <p className="text-sm text-white group-hover:text-white">LOG OUT</p>
          <div className="mr-2 flex h-full w-10 items-center justify-center rounded-md px-2">
            <IconLeaveGroup className="text-white group-hover:text-white" />
          </div>
        </button>

        <button
          onClick={() => setShowDeleteAccountOverlay(true)}
          className="group mt-3 flex h-10 w-full cursor-pointer items-center justify-between
         rounded-md border border-red-500 bg-white pl-4 text-left text-gray-600 hover:font-medium"
        >
          <p className="text-sm text-red-500">DELETE ACCOUNT</p>
          <div className="mr-2 flex h-full w-10 items-center justify-center rounded-md px-2">
            <IconUserXMark className="text-red-500" />
          </div>
        </button>
      </div>

      <DeleteAccountOverlay
        open={showDeleteAccountOverlay}
        onCancel={() => setShowDeleteAccountOverlay(false)}
        onDelete={async () => {
          const result = await client["users/delete_user"]();
          if (result.isErr()) {
            alert("Error logout: " + result.error.message);
          }
          storage.clearToken();
          setAuthStatus("logged-out");
          setAfterLoginNavigateTo(null);
          await dexie.delete().then(() => dexie.open());
          router.push(`/`);
        }}
      />
    </div>
  );
}

export function DeleteAccountOverlay(props: {
  open: boolean;
  onCancel: () => void;
  onDelete: () => void;
}) {
  return (
    <Transition appear show={props.open} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={props.onCancel}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-00"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-white bg-opacity-50" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel
                className="w-full max-w-md transform overflow-hidden
              rounded-sm bg-white p-6 text-left align-middle shadow-o-xl transition-all"
              >
                <div className="pb-8">
                  <DeleteAccountContent />
                </div>
                <div className="mt-2 flex justify-end gap-x-2 text-sm">
                  <button
                    onClick={props.onCancel}
                    className="rounded-full border border-gray-200 px-4 py-2 font-medium text-primary-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={props.onDelete}
                    className="rounded-full border border-gray-200 px-4 py-2 font-medium text-red-600 hover:bg-red-500 hover:text-white"
                  >
                    Delete My Account
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

function DeleteAccountContent() {
  return (
    <div className="">
      <p className="text-red-500">Delete account?</p>
      <div className="mt-4 flex items-center text-red-500">
        <IconWarning className="h-5 w-5" />
        <p className="ml-4">Deleting your account will:</p>
      </div>
      <ul className="mt-4 list-disc space-y-1.5 pl-12 text-sm text-gray-500">
        <li>Delete your account from Chatter</li>
        <li>Erase your message history</li>
        <li>Delete you from all of your Chatter groups</li>
        <li>Delete you from other people's conversation history</li>
      </ul>
    </div>
  );
}
