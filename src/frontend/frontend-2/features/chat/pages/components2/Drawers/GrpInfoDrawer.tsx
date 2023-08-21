import {
  IconX,
  IconShield2,
  IconLink,
  IconPlus,
  IconEllipsisVertical,
  IconLeaveGroup,
} from "~/frontend/frontend-2/features/common/icons";

const groupMembers: {
  profilePicSrc: string;
  username: string;
}[] = [
  {
    profilePicSrc: "./assets/girl-1.jpg",
    username: "Anna Smith",
  },
  {
    profilePicSrc: "./assets/girl-2.jpg",
    username: "Mary Lamb",
  },
  {
    profilePicSrc: "./assets/girl-3.jpg",
    username: "Jessica James",
  },
  {
    profilePicSrc: "./assets/man-9-[asian].jpg",
    username: "Paul Mark",
  },
  {
    profilePicSrc: "./assets/man-3-[white].jpg",
    username: "James Parker",
  },
];

export function GrpInfoDrawer() {
  return (
    <div className="h-full overflow-y-auto pb-4">
      <DrawerHeader
        onClose={() => {
          console.log("header");
        }}
      />

      <div className="bg-white pb-3 pt-4">
        <div className="flex justify-center py-2">
          <div className="h-14 w-14">
            <img
              className="h-full w-full rounded-lg"
              src="./assets/abstract-art.jpg"
            />
          </div>
        </div>
      </div>

      <div className="pt-1">
        <p className="text-center font-medium">Designers Team</p>
        <p className="mt-3 text-center text-sm text-gray-500">
          ID: grpv0gv99eytynq
        </p>
      </div>

      <div className="my-6 px-4">
        <hr className="border-t border-gray-300" />
      </div>

      <div className="mb-10 mt-8 text-sm">
        <div className="w-full px-4">
          <button className="flex h-12 w-full  cursor-pointer items-center justify-between rounded-md border border-gray-300 pl-4 text-left text-gray-600 hover:bg-gray-50">
            <p>Security</p>
            <div className="mr-2 flex h-full items-center justify-center rounded-md px-2">
              <IconShield2 height={20} className="text-gray-500" />
            </div>
          </button>

          <button className="mt-4 flex h-12 w-full  cursor-pointer items-center justify-between rounded-md border border-gray-300 pl-4 text-left text-gray-600 hover:bg-gray-50">
            <p>Invite to group via link</p>
            <div className="mr-2 flex h-full w-10 items-center justify-center rounded-md px-2">
              <IconLink className="text-gray-500" />
            </div>
          </button>

          <button className="mt-4 flex h-12 w-full  cursor-pointer items-center justify-between rounded-md border border-gray-300 pl-4 text-left text-gray-600 hover:bg-gray-50">
            <p>Add members to group</p>
            <div className="mr-2 flex h-full w-10 items-center justify-center rounded-md px-2.5">
              <IconPlus className="text-gray-500" />
            </div>
          </button>
        </div>
      </div>

      <div className="my-6 px-4">
        <hr className="border-t border-gray-300" />
      </div>

      <div className="px-4 text-sm">
        <div className="flex justify-between">
          <p className="border-gray-400  font-medium">Group members (10)</p>
        </div>

        <div className="mt-5">
          <ul className="space-y-5">
            {groupMembers.map((m) => (
              <li className="group flex cursor-pointer items-center justify-between rounded-lg">
                <div className="flex items-center">
                  <div className="h-9 w-9">
                    <img
                      className="h-full w-full rounded-lg object-cover"
                      src={m.profilePicSrc}
                    />
                  </div>
                  <p className="pl-3">{m.username}</p>
                </div>

                <div className="hidden group-hover:block">
                  <button className="block h-8 w-8 rounded-md border-2 bg-white px-1">
                    <IconEllipsisVertical className="text-gray-500" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="my-6 px-4">
        <hr className="border-t border-gray-300" />
      </div>

      <div className="px-4">
        <button className="group mt-3 flex h-12 w-full cursor-pointer items-center justify-between rounded-md border border-red-400 pl-4 text-left text-gray-600 hover:bg-red-500">
          <p className="text-sm text-red-600 group-hover:text-white">
            LEAVE CONVERSATION
          </p>
          <div className="mr-2 flex h-full w-10 items-center justify-center rounded-md px-2">
            <IconLeaveGroup className="text-red-500 group-hover:text-white" />
          </div>
        </button>
      </div>
    </div>
  );
}

function DrawerHeader(props: { onClose?: () => void }) {
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
