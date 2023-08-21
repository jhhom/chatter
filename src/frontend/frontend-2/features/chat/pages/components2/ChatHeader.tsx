export function ChatHeader(props: { onInfoClick: () => void }) {
  return (
    <div className="flex h-16 w-full items-center justify-between border-b-[1.5px] border-gray-200 px-5">
      <div className="flex items-center">
        <div className="relative h-10 w-10">
          <img
            className="inline-block h-10 w-10 rounded-lg"
            src="./assets/abstract-art.jpg"
          />
          <div className="absolute -right-1 -top-1 h-3 w-3 rounded-sm bg-white p-[0.1rem]">
            <div className="h-full w-full rounded-sm bg-green-400/80" />
          </div>
        </div>

        <p className="pl-3 font-medium">Designers Team</p>
      </div>

      <div className="pr-2"></div>
    </div>
  );
}
