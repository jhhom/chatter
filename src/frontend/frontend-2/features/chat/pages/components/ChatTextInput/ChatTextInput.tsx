import { type default as React, useCallback, useEffect, useRef } from "react";

import {
  IconPicture,
  IconPaperClip,
  IconAirplane,
} from "~/frontend/frontend-2/features/common/icons";
import { file2Base64 } from "~/frontend/utils";
import { clsx as cx } from "clsx";

import type { ServiceInput } from "~/api-contract/types";
import useIsTyping from "~/frontend/frontend-2/features/chat/pages/components/ChatTextInput/use-is-typing.hook";

export type ChatInputMode =
  | {
      type: "message";
    }
  | {
      type: "photo";
      filename: string;
    }
  | {
      type: "file";
      filename: string;
      contentType: string;
      /** file size in number of bytes */
      size: number;
    };

export type ChatTextInputProps = {
  inputMode: ChatInputMode;
  onTyping: (isTyping: boolean) => void;
  onMessageSubmit: (
    message: ServiceInput<"topic/send_message">["content"]
  ) => void;
  onLoadPhoto: (photo: File) => void;
  onLoadFile: (file: File) => void;
  disabled: boolean;
};

export function ChatTextInput({
  onTyping,
  inputMode,
  onMessageSubmit,
  ...props
}: ChatTextInputProps) {
  const messageInputRef = useRef<HTMLTextAreaElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isTyping, register] = useIsTyping({ timeout: 1500 });

  useEffect(() => {
    register(messageInputRef.current);
  }, [register]);

  useEffect(() => {
    onTyping(isTyping);
  }, [isTyping, onTyping]);

  const loadPhoto: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const files = (e.target as HTMLInputElement).files;
    if (files) {
      const file = files[0];
      // props.onLoadPhoto(URL.createObjectURL(files[0]));
      props.onLoadPhoto(file);
    }
  };

  const loadFile: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const files = (e.target as HTMLInputElement).files;
    if (files) {
      const file = files[0];
      props.onLoadFile(file);
    }
  };

  const onSendClick = useCallback(async () => {
    if (messageInputRef.current === null) {
      return;
    }

    if (inputMode.type == "message" && messageInputRef.current.value !== "") {
      onMessageSubmit({
        type: "text",
        content: messageInputRef.current.value,
      });
      messageInputRef.current.value = "";
    } else if (inputMode.type == "photo" && photoInputRef.current !== null) {
      const files = photoInputRef.current.files;
      let fileBase64 = "";
      let filename = "";
      if (files) {
        const file = files[0];
        fileBase64 = await file2Base64(file);
        filename = file.name;
      }

      onMessageSubmit({
        type: "picture",
        base64: fileBase64,
        caption: messageInputRef.current.value,
        filename,
      });
      messageInputRef.current.value = "";
    } else if (inputMode.type == "file" && fileInputRef.current !== null) {
      const files = fileInputRef.current.files;
      let fileBase64 = "";
      let filename = "";
      if (files) {
        const file = files[0];
        fileBase64 = await file2Base64(file);
        filename = file.name;
      }

      onMessageSubmit({
        type: "file",
        base64: fileBase64,
        caption: "",
        filename,
      });
    }
  }, [inputMode, onMessageSubmit]);

  return (
    <div className="flex h-12 items-center bg-gray-100">
      <div
        className={cx("flex w-full", {
          "pl-2.5": inputMode.type == "photo",
        })}
      >
        {inputMode.type === "message" && (
          <div className="flex w-20 justify-between px-2.5">
            <label
              htmlFor="photo-input"
              className="flex cursor-pointer items-center justify-center disabled:cursor-not-allowed"
            >
              <IconPicture className="h-5 w-5" fill="#6b7280" />
            </label>
            <label
              htmlFor="file-input"
              className="flex cursor-pointer items-center justify-center disabled:cursor-not-allowed"
            >
              <IconPaperClip className="h-5 w-5" fill="#6b7280" />
            </label>
          </div>
        )}

        <div
          className={cx("flex h-8 flex-grow items-center pl-6 pr-4", {
            hidden: inputMode.type != "file",
          })}
        >
          <hr className="w-full rounded-full border-2 border-gray-200" />
        </div>
        <textarea
          disabled={props.disabled}
          ref={messageInputRef}
          placeholder={inputMode.type == "message" ? "New message" : "Caption"}
          className={cx(
            "placeholder:text-gray-400/65 block h-8 w-full flex-grow resize-none rounded-sm border-b-2 border-gray-300 bg-gray-100 pl-0.5 pt-1 text-sm placeholder:font-light focus:border-b-blue-300 focus:outline-none  disabled:cursor-not-allowed",
            {
              hidden: inputMode.type == "file",
            }
          )}
        />

        <div className="w-20 pr-4">
          <button
            disabled={props.disabled}
            onClick={onSendClick}
            className="flex h-full w-full items-center justify-center rounded-sm disabled:cursor-not-allowed"
          >
            <IconAirplane className="h-5 w-5" fill="#60a5fa" />
          </button>
        </div>

        <input
          ref={photoInputRef}
          type="file"
          id="photo-input"
          className="hidden"
          accept="image/*"
          onChange={loadPhoto}
        />

        <input
          ref={fileInputRef}
          type="file"
          id="file-input"
          className="hidden"
          onChange={loadFile}
        />
      </div>
    </div>
  );
}
