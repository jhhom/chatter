export function ContactSearch(props: {
  onInput?: React.ChangeEventHandler<HTMLInputElement>;
}) {
  return (
    <div>
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-20 flex w-10 items-center px-3">
          <IconSearch className="text-gray-400" />
        </div>
        <input
          type="text"
          id="hs-leading-icon"
          name="hs-leading-icon"
          className="block w-full rounded-md border-gray-200 bg-gray-100 py-2 pl-10 pr-3 text-sm shadow-sm focus:z-10 focus:border-blue-500 focus:ring-blue-500"
          placeholder="Search contacts"
          onChange={props.onInput}
        />
      </div>
    </div>
  );
}

function IconSearch(props: { className: string }) {
  return (
    <svg
      className={props.className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      fill="currentColor"
    >
      <path d="M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z" />
    </svg>
  );
}
