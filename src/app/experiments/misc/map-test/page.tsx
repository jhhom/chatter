"use client";

import { useState } from "react";
import { faker } from "@faker-js/faker";
import { create } from "zustand";

const useMap = () => {
  const [map, setMap] = useState(new Map<string, string>());

  const addValueToMap = () => {
    const k = faker.string.alphanumeric(4);
    const v = faker.animal.bird();
    map.set(k, v);

    console.log("array", Array.from(map.values()));

    setMap(new Map(map));
  };

  return { map: Array.from(map.entries()), addValueToMap };
};

const useMapStore = create<{
  map: Map<string, string>;
  addValueToMap: () => void;
  mapValues: () => IterableIterator<[string, string]>;
}>((set, get) => ({
  map: new Map(),
  addValueToMap: () => {
    set((state) => {
      const newMap = new Map(state.map);
      const k = faker.string.alphanumeric(4);
      const v = faker.animal.bird();
      newMap.set(k, v);

      return { map: newMap };
    });
  },
  mapValues: () => {
    const map = get().map;
    return map.entries();
  },
}));

export default function Page() {
  // const { map, addValueToMap } = useMap();
  const { mapValues, addValueToMap } = useMapStore((state) => ({
    mapValues: state.mapValues,
    addValueToMap: state.addValueToMap,
  }));

  return (
    <div>
      <p>Page</p>

      <p>Bird species list:</p>

      {Array.from(mapValues()).map((v) => (
        <p key={v[0]}>{`${v[0]}: ${v[1]}`}</p>
      ))}

      <div>
        <button
          onClick={addValueToMap}
          className="rounded-md bg-gray-200/75 px-2 py-2"
        >
          Add random value to map
        </button>
      </div>
    </div>
  );
}
