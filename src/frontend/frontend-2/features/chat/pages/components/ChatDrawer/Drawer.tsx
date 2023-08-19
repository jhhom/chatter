import type { PropsWithChildren } from "react";
import { IconX } from "~/frontend/frontend-2/features/common/icons";

export function ChatInfoDrawer(
  props: PropsWithChildren<{ onClose: () => void }>
) {
  return (
    <div className="h-screen border-l-2 border-gray-300 bg-gray-200">
      <div className="flex h-14 items-center justify-between bg-gray-300 px-2">
        <p className="text-gray-500">Info</p>
        <div>
          <button onClick={props.onClose}>
            <IconX className="h-5 w-5 text-gray-500" />
          </button>
        </div>
      </div>

      <div className="h-[calc(100vh-4rem)] flex-grow overflow-y-auto">
        <div className="h-full">{props.children}</div>
      </div>
    </div>
  );
}

export default ChatInfoDrawer;
