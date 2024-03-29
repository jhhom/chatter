import { useState, useRef, forwardRef, Fragment } from "react";
import { type UserTopicId } from "~/api-contract/subscription/subscription";
import { IconX, IconSearch } from "~/frontend/frontend-2/features/common/icons";
import { clsx as cx } from "clsx";

import { Transition, Dialog } from "@headlessui/react";

export function ChatFileUploadPreviewOverlay(props: {
  filename: string;
  contentType: string;
  /** Size in number of bytes */
  size: number;
  onCloseOverlay: () => void;
}) {
  return (
    <>
      <div className="flex h-14 items-center border-b-2 border-gray-300 bg-gray-100">
        <div className="flex-grow overflow-hidden pl-4 pr-4">
          <p className="overflow-hidden overflow-ellipsis whitespace-nowrap">
            {props.filename}
          </p>
        </div>
        <div className="flex items-center pr-4">
          <button onClick={props.onCloseOverlay}>
            <div className="h-5 w-5">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960">
                <path d="m249-207-42-42 231-231-231-231 42-42 231 231 231-231 42 42-231 231 231 231-42 42-231-231-231 231Z" />
              </svg>
            </div>
          </button>
        </div>
      </div>
      <div className="flex h-[calc(100%-3.5rem)] items-center justify-center">
        <div className="flex h-full w-full items-center justify-center">
          <div className="w-[250px]">
            <div className="flex justify-center">
              <div className="mb-2 h-16 w-16 text-gray-500">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 -960 960 960"
                  fill="currentColor"
                >
                  <path d="M220-80q-24 0-42-18t-18-42v-680q0-24 18-42t42-18h361l219 219v521q0 24-18 42t-42 18H220Zm331-554h189L551-820v186Z" />
                </svg>
              </div>
            </div>

            <div className="text-sm">
              <p className="overflow-hidden overflow-ellipsis whitespace-nowrap">
                <span className="font-medium">File name:</span>&nbsp;
                <span>{props.filename}</span>
              </p>
              <p className="overflow-hidden overflow-ellipsis whitespace-nowrap">
                <span className="font-medium">Content type:</span>&nbsp;
                <span>{props.contentType}</span>
              </p>
              <p className="overflow-hidden overflow-ellipsis whitespace-nowrap">
                <span className="font-medium">Size:</span>&nbsp;
                <span>
                  {props.size < 1024 * 1024
                    ? `${(props.size / 1024).toFixed(2)} KB`
                    : `${(props.size / (1024 * 1024)).toFixed(2)} MB`}
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export const ChatImageUploadPreviewOverlay = forwardRef<
  HTMLImageElement,
  {
    filename: string;
    onCloseOverlay: () => void;
  }
>(function ChatImageUploadPreviewOverlay(props, ref) {
  return (
    <>
      <div className="flex h-14 items-center border-b-2 border-gray-300 bg-gray-100">
        <div className="flex-grow pl-4">
          <p>{props.filename}</p>
        </div>
        <div className="flex items-center pr-4">
          <button onClick={props.onCloseOverlay}>
            <div className="h-5 w-5">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960">
                <path d="m249-207-42-42 231-231-231-231 42-42 231 231 231-231 42 42-231 231 231 231-42 42-231-231-231 231Z" />
              </svg>
            </div>
          </button>
        </div>
      </div>
      <div className="flex  h-[calc(100%-3.5rem)] w-full items-center justify-center bg-white">
        <img ref={ref} className="h-full object-scale-down" />
      </div>
    </>
  );
});

export function ForwardMessageOverlay(props: {
  contacts: Array<{
    name: string;
    topicId: UserTopicId;
  }>;
  onForwardMessage: (topicId: UserTopicId) => void;
  onClose: () => void;
  open: boolean;
}) {
  const [contactSearch, setContactSearch] = useState("");

  const filteredContacts = () =>
    props.contacts.filter((x) =>
      x.name.toLowerCase().includes(contactSearch.toLowerCase())
    );

  return (
    <Transition appear show={props.open} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={props.onClose}>
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
                className="fixed bottom-0 left-1/2 h-[80%] w-full -translate-x-1/2 overflow-y-auto 
          rounded-md border-t border-gray-100 bg-white shadow-lg 
          sm:bottom-auto sm:top-1/2 sm:h-[85%] sm:w-80 sm:-translate-y-1/2"
              >
                <div className="">
                  <div className="flex items-center justify-between px-4 pt-4">
                    <p className="font-semibold text-primary-600">Forward to</p>
                    <button
                      onClick={props.onClose}
                      className="h-7 w-7 rounded-md p-1"
                    >
                      <IconX className="text-primary-500" strokeWidth="2" />
                    </button>
                  </div>

                  <div className="mt-1.5 px-4">
                    <SearchContactInput
                      search={contactSearch}
                      setSearch={(s) => setContactSearch(s)}
                    />
                  </div>

                  <ul className="mt-4">
                    {filteredContacts().map((c) => (
                      <li
                        onClick={() => props.onForwardMessage(c.topicId)}
                        className="cursor-pointer px-4 pt-1.5 text-sm hover:bg-gray-100"
                      >
                        <div className="flex pb-1.5">
                          <div className="mr-2 h-10 w-10 rounded-full bg-gray-200"></div>
                          <p>{c.name}</p>
                        </div>

                        <hr className="border-1 ml-auto w-[calc(100%-2.5rem-0.25rem)] border-gray-200" />
                      </li>
                    ))}
                  </ul>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

function SearchContactInput(props: {
  search: string;
  setSearch: (s: string) => void;
}) {
  return (
    <div className="relative flex w-full">
      <div className="absolute bottom-2.5 flex items-center justify-center">
        <div className="h-4 w-4">
          <IconSearch />
        </div>
      </div>
      <input
        className="block w-full border-b-[1.5px] border-gray-400 py-1.5 pl-5 text-sm text-gray-400 focus:border-blue-400 focus:outline-none"
        type="text"
        placeholder="Search contacts"
        value={props.search}
        onChange={(e) => props.setSearch(e.target.value)}
      />
    </div>
  );
}

export type DeleteMessageOverlayProps = {
  onDeleteForEveryone?: () => void;
  onDeleteForMe: () => void;
  onCancel: () => void;
  open: boolean;
};

export function DeleteMessageOverlay(props: DeleteMessageOverlayProps) {
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
                <div className="flex justify-between pb-8">
                  <p className="leading-6 text-gray-600">Delete message?</p>
                </div>
                <div
                  className={cx("flex text-sm", {
                    "flex-col items-end space-y-4":
                      props.onDeleteForEveryone !== undefined,
                    "justify-end space-x-3":
                      props.onDeleteForEveryone === undefined,
                  })}
                >
                  {props.onDeleteForEveryone !== undefined && (
                    <DeleteMessageOverlayButton
                      text="Delete for everyone"
                      onClick={props.onDeleteForEveryone}
                    />
                  )}
                  <DeleteMessageOverlayButton
                    className={cx({
                      "order-5 ml-3 border-none bg-primary-500 text-white":
                        props.onDeleteForEveryone === undefined,
                    })}
                    text="Delete for me"
                    onClick={props.onDeleteForMe}
                  />
                  <DeleteMessageOverlayButton
                    text="Cancel"
                    onClick={props.onCancel}
                  />
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

const DeleteMessageOverlayButton = (props: {
  text: string;
  className?: string;
  onClick: React.MouseEventHandler<HTMLButtonElement>;
}) => {
  return (
    <button
      className={`rounded-full border border-gray-200 px-4 py-2 font-medium text-primary-600 ${
        props.className ?? ""
      }`}
      onClick={props.onClick}
    >
      {props.text}
    </button>
  );
};

export const ChatImageOverlay = forwardRef<
  HTMLImageElement,
  {
    onCloseOverlay: () => void;
  }
>(function ChatImageOverlay(props, ref) {
  return (
    <>
      <div className="flex h-16 items-center border-b-2 border-gray-300 bg-gray-100">
        <div className="flex-grow pl-4">
          <p>Picture</p>
        </div>
        <div className="flex items-center pr-4">
          <button onClick={props.onCloseOverlay}>
            <div className="h-5 w-5">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960">
                <path d="m249-207-42-42 231-231-231-231 42-42 231 231 231-231 42 42-231 231 231 231-42 42-231-231-231 231Z" />
              </svg>
            </div>
          </button>
        </div>
      </div>
      <div className="flex h-[calc(100%-4rem)] items-center justify-center">
        <div className="h-full">
          <img ref={ref} className="h-full object-scale-down" />
        </div>
      </div>
    </>
  );
});
