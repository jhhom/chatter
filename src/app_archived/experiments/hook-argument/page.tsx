"use client";

import { useState } from "react";

export default function Page() {
  const [a, setA] = useState(0);

  const [b, setB, addAToB] = useCustomHook({ defaultState: a });

  const aPlusB = addAToB();

  return (
    <div>
      <p>Page</p>

      <div>A: {a}</div>
      <div>B: {b}</div>
      <div>A+B: {aPlusB}</div>

      <div>
        <button
          className="mt-4 block rounded-md bg-gray-100 px-2 py-2"
          onClick={() => setA((a) => a + 1)}
        >
          Add to A
        </button>

        <button
          className="mt-4 block rounded-md bg-gray-100 px-2 py-2"
          onClick={() => setB((b) => b + 1)}
        >
          Add to B
        </button>
      </div>
    </div>
  );
}

function useCustomHook(props: { defaultState: number }) {
  const [customState, setCustomState] = useState(props.defaultState);

  const addAToB = () => {
    return props.defaultState + customState;
  };

  return [customState, setCustomState, addAToB] as const;
}
