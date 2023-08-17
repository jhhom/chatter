import { create } from "zustand";
import { LogClass } from "~/app/experiments/misc/instantiation-test/log-class";

const useLogClass = create(() => {
  logClass: new LogClass("zustand-create");
});

export function ZustandStoreTest() {
  return (
    <div>
      <ZustandComponent1 />
      <ZustandComponent2 />
    </div>
  );
}

function ZustandComponent1() {
  const lc = useLogClass();

  return <p>Zustand Component 1</p>;
}

function ZustandComponent2() {
  const lc = useLogClass();

  return <p>Zustand component 2</p>;
}
