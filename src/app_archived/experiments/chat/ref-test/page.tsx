"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

type PHandle = {
  changeText: (text: string) => void;
};

export default function Page() {
  const ref = useRef<PHandle | null>(null);

  useEffect(() => {
    ref.current?.changeText("Halo");
  }, []);

  return (
    <div>
      <p>Ref test</p>
      <Div ref={ref} />
    </div>
  );
}

const Div = forwardRef(function Div(props, ref) {
  const pRef = useRef<HTMLParagraphElement | null>(null);

  useImperativeHandle(ref, () => {
    return {
      changeText(text: string) {
        const p = pRef.current;
        if (p) {
          p.innerHTML = text;
        }
      },
    };
  });

  return (
    <div>
      <p ref={pRef}></p>
    </div>
  );
});
