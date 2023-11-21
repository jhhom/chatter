import { Dialog, Transition } from "@headlessui/react";
import { Fragment } from "react";

export function UnblockModal(props: {
  name: string;
  onUnblock: () => void;
  onCancel: () => void;
  show: boolean;
}) {
  return (
    <Transition appear show={props.show} as={Fragment}>
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
                className="fixed left-[50%] top-[50%] z-10 w-4/5 -translate-x-[50%] -translate-y-[50%] 
              rounded-md border-2 border-gray-200 bg-white px-4 py-4 
              text-left text-sm shadow-md sm:w-auto md:px-8 md:py-8 md:text-base"
              >
                <p>Do you want to unblock {props.name}?</p>
                <p className="mt-2">
                  This will allow them to send messages to you.
                </p>

                <div className="mt-16 flex justify-end uppercase">
                  <button
                    onClick={props.onCancel}
                    className="rounded-md px-4 py-2 text-sm hover:bg-gray-100"
                  >
                    CANCEL
                  </button>
                  <button
                    onClick={props.onUnblock}
                    className="rounded-md bg-primary-500 px-4 py-2 text-sm text-white hover:bg-primary-600"
                  >
                    UNBLOCK
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
