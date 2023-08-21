export function DrawerButton(props: {
  content: string;
  icon: JSX.Element;
  iconPadding: "px-2" | "px-2.5";
  onClick: () => void;
}) {
  return (
    <button
      onClick={props.onClick}
      className="flex h-12 w-full  cursor-pointer items-center justify-between rounded-md border border-gray-300 pl-4 text-left text-gray-600 hover:bg-gray-50"
    >
      <p>{props.content}</p>
      <div
        className={`flex h-full items-center justify-center rounded-md ${props.iconPadding} mr-2 w-10`}
      >
        {props.icon}
      </div>
    </button>
  );
}
