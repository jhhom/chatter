import { useState } from "react";

export function ByIdTab(props: {
  onSubscribeClick: (topicId: string) => void;
}) {
  const [topicId, setTopicId] = useState("");

  const onSubscribe = () => {
    props.onSubscribeClick(topicId);
  };

  return (
    <div>
      <div className="mt-3 px-3">
        <input
          className="block w-full border-b-[1.5px] border-gray-400 py-1.5 text-sm text-gray-400 focus:border-blue-400 focus:outline-none"
          type="text"
          placeholder="Group or User ID"
          onChange={(e) => setTopicId(e.target.value)}
          value={topicId}
        />
      </div>

      <div className="mt-2.5 flex justify-end pr-2.5">
        <button
          onClick={() => {
            onSubscribe();
          }}
          className="cursor-pointer rounded-md bg-blue-500 px-4 py-1.5 text-sm uppercase text-white"
        >
          SUBSCRIBE
        </button>
      </div>
    </div>
  );
}
