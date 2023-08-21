import { useRef } from "react";

export function ChatFileUploadPreviewOverlay(props: {
  filename: string;
  contentType: string;
  /** Size in number of bytes */
  size: number;
  onCloseOverlay: () => void;
}) {
  return (
    <>
      <div className="flex h-14 items-center border-b-2 border-gray-300 bg-gray-100">
        <div className="flex-grow overflow-hidden pl-4 pr-4">
          <p className="overflow-hidden overflow-ellipsis whitespace-nowrap">
            {props.filename}
          </p>
        </div>
        <div className="flex items-center pr-4">
          <button onClick={props.onCloseOverlay}>
            <div className="h-5 w-5">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960">
                <path d="m249-207-42-42 231-231-231-231 42-42 231 231 231-231 42 42-231 231 231 231-42 42-231-231-231 231Z" />
              </svg>
            </div>
          </button>
        </div>
      </div>
      <div className="flex h-[calc(100%-3.5rem)] items-center justify-center">
        <div className="flex h-full w-full items-center justify-center">
          <div className="w-[250px]">
            <div className="flex justify-center">
              <div className="mb-2 h-16 w-16 text-gray-500">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 -960 960 960"
                  fill="currentColor"
                >
                  <path d="M220-80q-24 0-42-18t-18-42v-680q0-24 18-42t42-18h361l219 219v521q0 24-18 42t-42 18H220Zm331-554h189L551-820v186Z" />
                </svg>
              </div>
            </div>

            <div className="text-sm">
              <p className="overflow-hidden overflow-ellipsis whitespace-nowrap">
                <span className="font-medium">File name:</span>&nbsp;
                <span>{props.filename}</span>
              </p>
              <p className="overflow-hidden overflow-ellipsis whitespace-nowrap">
                <span className="font-medium">Content type:</span>&nbsp;
                <span>{props.contentType}</span>
              </p>
              <p className="overflow-hidden overflow-ellipsis whitespace-nowrap">
                <span className="font-medium">Size:</span>&nbsp;
                <span>
                  {props.size < 1024 * 1024
                    ? `${(props.size / 1024).toFixed(2)} KB`
                    : `${(props.size / (1024 * 1024)).toFixed(2)} MB`}
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export function ChatImageUploadPreviewOverlay(props: {
  imgRef: (r: HTMLImageElement) => void;
  filename: string;
  onCloseOverlay: () => void;
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);

  return (
    <>
      <div className="flex h-14 items-center border-b-2 border-gray-300 bg-gray-100">
        <div className="flex-grow pl-4">
          <p>{props.filename}</p>
        </div>
        <div className="flex items-center pr-4">
          <button onClick={props.onCloseOverlay}>
            <div className="h-5 w-5">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960">
                <path d="m249-207-42-42 231-231-231-231 42-42 231 231 231-231 42 42-231 231 231 231-42 42-231-231-231 231Z" />
              </svg>
            </div>
          </button>
        </div>
      </div>
      <div className="flex  h-[calc(100%-3.5rem)] w-full items-center justify-center bg-white">
        <img ref={imgRef} className="h-full object-scale-down" />
      </div>
    </>
  );
}
