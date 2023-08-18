export function TabByID() {
  return (
    <div className="px-4">
      <div className="pt-1">
        <input
          className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
          placeholder="Group or User ID"
          type="text"
        />
      </div>
      <div className="mt-4 flex justify-end">
        <button className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white">
          SUBSCRIBE
        </button>
      </div>
    </div>
  );
}
