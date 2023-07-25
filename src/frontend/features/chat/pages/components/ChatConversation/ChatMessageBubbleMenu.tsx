import { useEffect, forwardRef, useRef, useImperativeHandle } from "react";
import clsx from "clsx";

export const ChatMessageBubbleMenuItem = (props: {
  content: string;
  onClick?: () => void;
}) => {
  return (
    <div>
      <button
        onClick={props.onClick}
        className="w-full cursor-pointer py-2 pl-3 text-left hover:bg-gray-100"
      >
        {props.content}
      </button>
    </div>
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
      className={clsx("fixed z-10 w-[200px] bg-white py-2 text-sm shadow-md", {
        hidden: !props.showMenu,
      })}
      id="chat-message-menu"
      ref={divRef}
    >
      {props.children}
    </div>
  );
});
