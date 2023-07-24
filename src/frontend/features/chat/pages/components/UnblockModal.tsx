export function UnblockModal(props: {
  name: string;
  onUnblock: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed left-[50%] top-[50%] z-10 w-4/5 -translate-x-[50%] -translate-y-[50%] rounded-md border-2 border-gray-200 bg-white px-4 py-4 text-sm shadow-md sm:w-auto md:px-8 md:py-8 md:text-base">
      <p>Do you want to unblock {props.name}?</p>
      <p className="mt-2">This will allow them to send messages to you.</p>

      <div className="mt-16 flex justify-end uppercase">
        <button
          onClick={props.onCancel}
          className="rounded-md px-4 py-2 text-sm"
        >
          CANCEL
        </button>
        <button
          onClick={props.onUnblock}
          className="rounded-md bg-blue-500 px-4 py-2 text-sm text-white"
        >
          UNBLOCK
        </button>
      </div>
    </div>
  );
}
