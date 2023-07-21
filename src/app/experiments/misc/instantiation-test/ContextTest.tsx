import { useContext, createContext, useState } from "react";
import { LogClass } from "~/app/experiments/misc/instantiation-test/log-class";

const LogClassContext = createContext<null | LogClass>(null);

function LogClassProvider({ children }: { children: React.ReactNode }) {
  const [logClass, setLogClass] = useState(new LogClass("hook"));

  return (
    <LogClassContext.Provider value={{ logClass, setLogClass }}>
      {children}
    </LogClassContext.Provider>
  );
}

const useLogClassContext = () => useContext(LogClassContext);

function ContextComponent1() {
  const lc = useLogClassContext();

  return <p>Context Component 1</p>;
}

function ContextComponent2() {
  const lc = useLogClassContext();

  return <p>Context Component 2</p>;
}

export function ContextTest() {
  return (
    <LogClassProvider>
      <div>
        <ContextComponent1 />
        <ContextComponent2 />
      </div>
    </LogClassProvider>
  );
}
