import { useRef, useLayoutEffect } from "react";

export function useMessageInputResize(props: {
  resizedHeight: (messageInputContainerHeight: number) => string;
}) {
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const messageInputContainerRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const inputHeightObserver = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.target === messageInputContainerRef.current) {
          if (chatContainerRef.current) {
            // 4rem - top bar
            // chat messages container's height
            // 1px - the message input container border height
            chatContainerRef.current.style.height = props.resizedHeight(
              entry.target.clientHeight
            );
          }
        }
      });
    });

    if (messageInputContainerRef.current) {
      inputHeightObserver.observe(messageInputContainerRef.current);
    }

    return () => inputHeightObserver.disconnect();
  }, []);

  return {
    chatContainerRef,
    messageInputContainerRef,
  };
}
