import { useState } from "react";

export function TabByID(props: {
  onSubscribeClick: (topicId: string) => void;
}) {
  const [topicId, setTopicId] = useState("");

  const onSubscribe = () => {
    props.onSubscribeClick(topicId);
  };

  return (
    <div className="px-4">
      <div className="pt-1">
        <input
          className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
          placeholder="Group or User ID"
          type="text"
          onChange={(e) => setTopicId(e.target.value)}
          value={topicId}
        />
      </div>
      <div className="mt-4 flex justify-end">
        <button
          onClick={() => {
            onSubscribe();
          }}
          className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white"
        >
          SUBSCRIBE
        </button>
      </div>
    </div>
  );
}
