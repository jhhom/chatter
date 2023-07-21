import { useState } from "react";
import { LogClass } from "./log-class";

export function HookStoreTest() {
  return (
    <div>
      <HookComponent1 />
    </div>
  );
}

const useLogClassHook = () => {
  const [lc, setLc] = useState(new LogClass("hook"));

  return { lc, setLc };
};

function HookComponent1() {
  const lc = useLogClassHook();

  return <p>Hook Component 1</p>;
}

function HookComponent2() {
  const lc = useLogClassHook();

  return <p>Hook Component 2</p>;
}
