import { clsx as cx } from "clsx";
import { useRef, useState, forwardRef, createRef } from "react";

export function TabNewGroup() {
  const imageInputRef = createRef<HTMLInputElement>();

  return (
    <div>
      <div className="flex justify-center">
        <ImageUpload name="haha" ref={imageInputRef} />
      </div>

      <div className="px-4 pt-6">
        <label htmlFor="name" className="text-sm">
          Name
        </label>
        <input
          className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
          placeholder="Freeform name of the group"
          type="text"
        />
      </div>

      <div className="px-4 pt-6">
        <label htmlFor="description" className="text-sm">
          Description
        </label>
        <input
          className="mt-1  block w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
          placeholder="Optional description"
          type="text"
        />
      </div>

      <div className="mt-6 flex justify-end px-4">
        <button className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white">
          CREATE
        </button>
      </div>
    </div>
  );
}

const ImageUpload = forwardRef<
  HTMLInputElement,
  {
    name: string;
    onInput?: React.FormEventHandler<HTMLInputElement>;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
    onBlur?: React.FocusEventHandler<HTMLInputElement>;
  }
>((props, ref) => {
  const img = useRef<HTMLImageElement | null>(null);

  const [showImage, setShowImage] = useState(false);

  const loadFile: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const files = (e.target as HTMLInputElement).files;
    if (files && img.current) {
      img.current.src = URL.createObjectURL(files[0]);
      setShowImage(true);
    }
    if (props.onChange) {
      props.onChange(e);
    }
  };

  return (
    <div className="pb-2">
      <div className="relative flex h-32 w-32 items-center justify-center rounded-lg border border-dashed border-gray-400 text-center">
        <p className={cx("text-xs text-gray-400", { hidden: showImage })}>
          384x384
        </p>
        <img
          ref={img}
          className={cx("h-full w-full rounded-lg object-cover", {
            hidden: !showImage,
          })}
        />
        <label
          htmlFor="file-input-avatar-0.32"
          className="image-upload border-1 absolute -bottom-2 right-0 flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-gray-50  shadow-[0_2px_6px_0_rgba(0,0,0,0.3)] hover:bg-blue-100"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="black"
            className="icon h-5 w-5"
          >
            <path d="M11.47 1.72a.75.75 0 011.06 0l3 3a.75.75 0 01-1.06 1.06l-1.72-1.72V7.5h-1.5V4.06L9.53 5.78a.75.75 0 01-1.06-1.06l3-3zM11.25 7.5V15a.75.75 0 001.5 0V7.5h3.75a3 3 0 013 3v9a3 3 0 01-3 3h-9a3 3 0 01-3-3v-9a3 3 0 013-3h3.75z" />
          </svg>
        </label>
        <input
          ref={ref}
          name={props.name}
          type="file"
          id="file-input-avatar-0.32"
          className="hidden"
          accept="image/*"
          onInput={props.onInput}
          onChange={loadFile}
          onBlur={props.onBlur}
        />
      </div>
    </div>
  );
});
