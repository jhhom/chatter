"use client";

// 1. zustand store
// question: if a class is initialized in a zustand store
// then the zustand store is consumed in multiple components
// does the class get initialized twice?

// 2. hook
// question: if a class is initialized in a hook
// then the hook is called in multiple components
// does the class get initialized twice?

// 3. context
// ... don't know what to ask yet

import { useState } from "react";
import { HookStoreTest } from "~/app/experiments/misc/instantiation-test/HookTest";
import { ContextTest } from "~/app/experiments/misc/instantiation-test/ContextTest";

export default function Page() {
  return (
    <div>
      <p>Page</p>

      <ContextTest />
    </div>
  );
}
