import clsx from "clsx";

import { IconFile, IconCamera } from "~/components/experiments/chat/Icons";

export function TextMessage(props: { text: string }) {
  return <p className="px-4 pt-2 text-sm leading-relaxed">{props.text}</p>;
}

export function PictureMessage(props: { caption: string; pictureUrl: string }) {
  return (
    <div className="rounded-md p-1">
      <img
        className="max-h-[360px] min-h-[240px] min-w-[240px] max-w-full cursor-pointer rounded-md border bg-white object-cover hover:brightness-90"
        src={props.pictureUrl}
      />
      {props.caption !== "" && (
        <div className="pb-1 pl-1.5 pt-1 text-sm">
          <p>{props.caption}</p>
        </div>
      )}
    </div>
  );
}

export function FileMessage(props: {
  fileUrl: string;
  filename: string;
  fileSize: number;
  userIsWriter: boolean;
}) {
  return (
    <div className="p-1">
      <a
        target="_blank"
        href={props.fileUrl}
        className={clsx(
          "flex h-full rounded-md py-3 pl-2 pr-4 text-sm leading-relaxed text-gray-600",
          {
            "backdrop-brightness-[0.97]": props.userIsWriter,
            "bg-gray-200": !props.userIsWriter,
          }
        )}
      >
        <div className="flex items-center self-stretch px-2">
          <IconFile className="h-6 w-6 text-gray-700" />
        </div>
        <div className="basis-[calc(100%-2.5rem)] pl-2">
          <p className="line-clamp-2 max-h-[2rem] overflow-hidden overflow-ellipsis font-semibold leading-[1rem]">
            {props.filename}
          </p>
          <p className="text-gray-500">{formatFileSize(props.fileSize)}</p>
        </div>
      </a>
    </div>
  );
}

const formatFileSize = (size: number) => {
  if (size > 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  } else if (size > 1024) {
    return `${(size / 1024).toFixed(2)} KB`;
  }
  return `${size.toFixed(2)} Bytes`;
};

export function FileReply(props: { content: string; userIsWriter: boolean }) {
  return (
    <div className="p-1">
      <div
        className={clsx(
          "relative cursor-pointer rounded-md border-l-4 border-primary-500 pl-3",
          {
            "bg-gray-200": !props.userIsWriter,
            "backdrop-brightness-[0.97]": props.userIsWriter,
          }
        )}
      >
        <div className="h-fit flex-grow pb-1 pr-4 pt-2">
          <p className="mb-1 text-[0.825rem] font-semibold text-primary-500">
            You
          </p>
          <div>
            <p className="-mt-2 line-clamp-2 overflow-hidden overflow-ellipsis pb-1 pl-0.5 pt-1.5 text-xs leading-relaxed text-gray-500/80">
              <span className="mr-2">
                <IconFile className="inline-block h-6 w-3 pb-1 text-gray-500/75" />
              </span>
              {props.content === "" ? "Document" : props.content}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PictureReply(props: {
  content: string;
  userIsWriter: boolean;
  pictureUrl: string;
}) {
  return (
    <div className="p-1">
      <div
        className={clsx(
          "relative cursor-pointer rounded-md border-l-4 border-primary-500 pl-3",
          {
            "bg-gray-200": !props.userIsWriter,
            "backdrop-brightness-[0.97]": props.userIsWriter,
          }
        )}
      >
        <div className="mr-[60px] h-fit flex-grow pb-1 pr-4 pt-2">
          <p className="mb-1 text-[0.825rem] font-semibold text-primary-500">
            You
          </p>
          <div>
            <p className="-mt-2 line-clamp-2 overflow-hidden overflow-ellipsis pb-1 pl-0.5 pt-1.5 text-xs leading-relaxed text-gray-500/80">
              <span className="mr-2">
                <IconCamera className="inline-block h-6 w-3.5 pb-1 text-gray-500/75" />
              </span>
              {props.content === "" ? "Photo" : props.content}
            </p>
          </div>
        </div>
        <div className="absolute right-0 top-0 h-full w-[60px] flex-none rounded-r-md">
          <img
            className="h-full w-full rounded-r-md object-cover"
            src={props.pictureUrl}
          />
        </div>
      </div>
    </div>
  );
}

export function TextReply(props: { content: string; userIsWriter: boolean }) {
  return (
    <div className="p-1">
      <div
        className={clsx(
          "cursor-pointer rounded-md border-l-4 border-primary-500 pl-2.5",
          {
            "bg-gray-200": !props.userIsWriter,
            "backdrop-brightness-[0.97]": props.userIsWriter,
          }
        )}
      >
        <div className="px-1 pb-1 pr-4 pt-2">
          <p className="mb-1 text-[0.825rem] font-semibold text-primary-500">
            You
          </p>
          <p className="-mt-2 line-clamp-3 overflow-hidden overflow-ellipsis rounded-md pb-1 pt-1.5 text-xs leading-relaxed text-gray-500/80">
            {props.content}
          </p>
        </div>
      </div>
    </div>
  );
}
