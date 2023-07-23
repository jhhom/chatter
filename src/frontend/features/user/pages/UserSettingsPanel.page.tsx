import { useRouter } from "next/navigation";

import { IconShield, IconLogout } from "~/frontend/features/common/icons";
import { BackBtn } from "~/frontend/features/common/components";

import { useAppStore } from "~/frontend/stores/stores";
import storage from "~/frontend/external/browser/local-storage";
import { client } from "~/frontend/external/api-client/client";
import { dexie } from "~/frontend/external/browser/indexed-db";

export default function AccountSettingsPanel() {
  const router = useRouter();
  const { profile, setAuthStatus } = useAppStore((s) => ({
    profile: s.profile,
    setAuthStatus: s.setAuthStatus,
  }));

  return (
    <div>
      <div className="flex bg-blue-500 px-4 py-4 text-lg text-white">
        <BackBtn onClick={() => router.push("/")} />
        <p className="ml-4">Account Settings</p>
      </div>

      <div className="bg-gray-200">
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
              <p>{profile?.fullname}</p>
            </div>
            <div className="mt-4">
              <p>
                <span className="text-blue-500">ID</span>: {profile?.userId}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-2.5 bg-white">
          <div className="text-sm">
            <div className="pt-2">
              <button
                onClick={() => router.push("/security")}
                className="flex h-10 w-full items-center px-4 text-left text-blue-500 hover:text-blue-700"
              >
                <span>
                  <IconShield
                    height={20}
                    className="text-blue-500 hover:text-blue-700"
                  />
                </span>
                <span className="ml-2 block">SECURITY</span>
              </button>
            </div>
          </div>

          <div className="text-red-600 hover:text-red-800">
            <button
              onClick={async () => {
                const result = await client["auth/logout"]();
                if (result.isErr()) {
                  alert("Error logout: " + result.error.message);
                }
                storage.clearToken();
                setAuthStatus("logged-out");
                await dexie.delete().then(() => dexie.open());
                router.push("/");
              }}
              className="flex w-full items-center px-3 py-1 hover:text-red-800"
            >
              <IconLogout className="h-6 w-6" />
              <p className="ml-1 text-sm uppercase">Log out</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
