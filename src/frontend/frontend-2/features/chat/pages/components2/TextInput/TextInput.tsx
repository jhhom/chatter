import { type ServiceInput } from "~/api-contract/types";
import { useIsTyping } from "./use-is-typing.hook";
import { useRef, useEffect, useCallback } from "react";
import { file2Base64 } from "~/frontend/utils";
import { clsx as cx } from "clsx";

export type TextInputMode =
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

export type TextInputProps = {
  inputMode: TextInputMode;
  onTyping: (isTyping: boolean) => void;
  onMessageSubmit: (
    message: ServiceInput<"topic/send_message">["content"]
  ) => void;
  onLoadPhoto: (photo: File) => void;
  onLoadFile: (file: File) => void;
  disabled: boolean;
};

export function TextInput(props: TextInputProps) {
  const messageInputRef = useRef<HTMLTextAreaElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isTyping, register] = useIsTyping({ timeout: 1500 });

  useEffect(() => {
    register(messageInputRef.current);
  }, [register]);

  useEffect(() => {
    props.onTyping(isTyping);
  }, [isTyping, props.onTyping]);

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

    if (
      props.inputMode.type == "message" &&
      messageInputRef.current.value !== ""
    ) {
      props.onMessageSubmit({
        type: "text",
        content: messageInputRef.current.value,
      });
      messageInputRef.current.value = "";
    } else if (
      props.inputMode.type == "photo" &&
      photoInputRef.current !== null
    ) {
      const files = photoInputRef.current.files;
      let fileBase64 = "";
      let filename = "";
      if (files) {
        const file = files[0];
        fileBase64 = await file2Base64(file);
        filename = file.name;
      }

      props.onMessageSubmit({
        type: "picture",
        base64: fileBase64,
        caption: messageInputRef.current.value,
        filename,
      });
      messageInputRef.current.value = "";
    } else if (
      props.inputMode.type == "file" &&
      fileInputRef.current !== null
    ) {
      const files = fileInputRef.current.files;
      let fileBase64 = "";
      let filename = "";
      if (files) {
        const file = files[0];
        fileBase64 = await file2Base64(file);
        filename = file.name;
      }

      props.onMessageSubmit({
        type: "file",
        base64: fileBase64,
        caption: "",
        filename,
      });
    }
  }, [props.inputMode, props.onMessageSubmit]);

  return (
    <div className="flex h-16 items-center border-t-[1.5px] border-gray-200 pl-2 pr-6">
      {props.inputMode.type === "message" && (
        <div
          className={cx("flex", {
            "cursor-not-allowed": props.disabled,
          })}
        >
          <label
            htmlFor="photo-input"
            className={cx(
              "mr-1 h-10 w-10  rounded-lg p-3 hover:bg-gray-100 disabled:cursor-not-allowed",
              {
                "cursor-pointer": !props.disabled,
                "cursor-not-allowed": props.disabled,
              }
            )}
          >
            <IconPicture className="text-gray-400" />
          </label>
          <div className="h-6 self-center border-r-[1.5px] border-gray-200"></div>
          <label
            htmlFor="file-input"
            className={cx(
              "mx-1 h-10 w-10 rounded-md p-3 hover:bg-gray-100 disabled:cursor-not-allowed",
              {
                "cursor-not-allowed": props.disabled,
                "cursor-pointer": !props.disabled,
              }
            )}
          >
            <IconFile className="text-gray-400" />
          </label>
        </div>
      )}

      <input
        disabled={props.disabled}
        ref={photoInputRef}
        type="file"
        id="photo-input"
        className="hidden"
        accept="image/*"
        onChange={loadPhoto}
      />

      <input
        disabled={props.disabled}
        ref={fileInputRef}
        type="file"
        id="file-input"
        className="hidden"
        onChange={loadFile}
      />

      <div
        className={cx("flex h-8 flex-grow items-center pl-6 pr-4", {
          hidden: props.inputMode.type != "file",
        })}
      >
        <hr className="w-full rounded-full border-2 border-gray-200" />
      </div>

      <textarea
        disabled={props.disabled}
        ref={messageInputRef}
        className={cx(
          "block h-10 w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-blue-100 disabled:cursor-not-allowed",
          {
            hidden: props.inputMode.type === "file",
          }
        )}
        placeholder="Type new message"
      />
      <div className="ml-4 flex items-center justify-center">
        <button
          onClick={onSendClick}
          className="h-10 w-10 rounded-md bg-green-500 p-3 text-white"
        >
          <IconPaperPlane className="" />
        </button>
      </div>
    </div>
  );
}

function IconPicture(props: { className: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      fill="currentColor"
      className={props.className}
    >
      <path d="M448 80c8.8 0 16 7.2 16 16V415.8l-5-6.5-136-176c-4.5-5.9-11.6-9.3-19-9.3s-14.4 3.4-19 9.3L202 340.7l-30.5-42.7C167 291.7 159.8 288 152 288s-15 3.7-19.5 10.1l-80 112L48 416.3l0-.3V96c0-8.8 7.2-16 16-16H448zM64 32C28.7 32 0 60.7 0 96V416c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V96c0-35.3-28.7-64-64-64H64zm80 192a48 48 0 1 0 0-96 48 48 0 1 0 0 96z" />
    </svg>
  );
}

function IconFile(props: { className: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 448 512"
      fill="currentColor"
      className={props.className}
    >
      <path d="M364.2 83.8c-24.4-24.4-64-24.4-88.4 0l-184 184c-42.1 42.1-42.1 110.3 0 152.4s110.3 42.1 152.4 0l152-152c10.9-10.9 28.7-10.9 39.6 0s10.9 28.7 0 39.6l-152 152c-64 64-167.6 64-231.6 0s-64-167.6 0-231.6l184-184c46.3-46.3 121.3-46.3 167.6 0s46.3 121.3 0 167.6l-176 176c-28.6 28.6-75 28.6-103.6 0s-28.6-75 0-103.6l144-144c10.9-10.9 28.7-10.9 39.6 0s10.9 28.7 0 39.6l-144 144c-6.7 6.7-6.7 17.7 0 24.4s17.7 6.7 24.4 0l176-176c24.4-24.4 24.4-64 0-88.4z" />
    </svg>
  );
}

function IconPaperPlane(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={props.className}
      fill="currentColor"
      viewBox="0 0 512 512"
    >
      <path d="M16.1 260.2c-22.6 12.9-20.5 47.3 3.6 57.3L160 376V479.3c0 18.1 14.6 32.7 32.7 32.7c9.7 0 18.9-4.3 25.1-11.8l62-74.3 123.9 51.6c18.9 7.9 40.8-4.5 43.9-24.7l64-416c1.9-12.1-3.4-24.3-13.5-31.2s-23.3-7.5-34-1.4l-448 256zm52.1 25.5L409.7 90.6 190.1 336l1.2 1L68.2 285.7zM403.3 425.4L236.7 355.9 450.8 116.6 403.3 425.4z" />
    </svg>
  );
}
