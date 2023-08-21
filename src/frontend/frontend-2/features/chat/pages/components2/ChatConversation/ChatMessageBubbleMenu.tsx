import { useEffect, forwardRef, useRef, useImperativeHandle } from "react";
import clsx from "clsx";

export const ChatMessageBubbleMenuItem = (props: {
  content: string;
  onClick?: () => void;
}) => {
  return (
    <button
      onClick={props.onClick}
      className="block w-full px-4 py-2 text-left hover:bg-gray-100"
    >
      {props.content}
    </button>
  );
};

export const ChatMessageBubbleMenu = forwardRef<
  HTMLDivElement,
  {
    showMenu: boolean;
    onClose: () => void;
    children: React.ReactNode;
  }
>(function ChatMessageBubbleMenu(props, ref) {
  const divRef = useRef<HTMLDivElement | null>(null);

  useImperativeHandle<
    HTMLDivElement | null,
    HTMLDivElement | null
  >(ref, () => divRef.current);

  useEffect(() => {
    const onClick: Parameters<
      typeof document.body.addEventListener<"click">
    >[1] = (e) => {
      if (divRef.current === null) {
        return;
      }

      if (e.target instanceof Node && !divRef.current.contains(e.target)) {
        props.onClose();
      }
    };

    document.body.addEventListener("click", onClick);
    return () => {
      document.body.removeEventListener("click", onClick);
    };
  }, []);

  return (
    <div
      className={clsx(
        "w-[150px] rounded-md border-[1.5px] border-gray-300 bg-white py-2 text-sm",
        {
          hidden: !props.showMenu,
        }
      )}
      id="chat-message-menu"
      ref={divRef}
    >
      {props.children}
    </div>
  );
});
