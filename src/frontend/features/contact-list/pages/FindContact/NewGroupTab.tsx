import { type default as React, useState, useRef, forwardRef } from "react";
import { z } from "zod";
import { UseFormRegisterReturn, useForm } from "react-hook-form";
import clsx from "clsx";
import { zodResolver } from "@hookform/resolvers/zod";

const MAX_FILE_SIZE = 10;
const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];
const formSchema = z.object({
  groupName: z.string().min(1),
  description: z.string().optional(),
  profileImage: z
    .instanceof(File)
    .refine((file?: File) => {
      return file?.size ? file?.size / 1_000_000 <= MAX_FILE_SIZE : true;
    }, `Max file size is ${MAX_FILE_SIZE}MB.`)
    .refine(
      (file?: File) =>
        file === undefined
          ? true
          : ACCEPTED_IMAGE_TYPES.includes(file?.type ?? ""),
      ".jpg, .jpeg, .png and .webp files are accepted."
    )
    .optional(),
});

type FormSchema = z.infer<typeof formSchema>;

export default function NewGroupTab(props: {
  onSubmit: (values: FormSchema) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors: formErrors },
  } = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
  });

  return (
    <div>
      <div className="px-2">
        <form
          onSubmit={handleSubmit(
            (data) => {
              props.onSubmit(data);
            },
            (err) => {
              console.error(`Form error ${err}`);
            }
          )}
        >
          <div className="mt-4 flex justify-center">
            <ImageUpload {...register("profileImage")} />
          </div>

          <div className="mt-4">
            <label htmlFor="groupName" className="text-xs text-primary-500">
              Name
            </label>
            <FormInput
              {...register("groupName")}
              placeholder="Freeform name of the group"
            />
            <FormErrorMessage message={formErrors.groupName?.message ?? ""} />
          </div>

          <div className="mt-4">
            <label htmlFor="description" className="text-xs text-primary-500">
              Description
            </label>
            <FormInput
              {...register("description")}
              placeholder="Optional description"
            />
            <FormErrorMessage
              message={formErrors.description?.message ?? ""}
              marginTop="-mt-1"
            />
          </div>

          <div className="mt-4 flex justify-end">
            <button
              className="cursor-pointer rounded-md bg-blue-500 px-4 py-1.5 text-sm text-white"
              type="submit"
            >
              CREATE
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const ImageUpload = forwardRef<
  HTMLInputElement,
  UseFormRegisterReturn<"profileImage">
>(function ImageUpload(props, ref) {
  const imgRef = useRef<null | HTMLImageElement>(null);

  const [showImage, setShowImage] = useState(false);

  const loadFile: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const files = (e.target as HTMLInputElement).files;
    if (files && imgRef.current) {
      imgRef.current.src = URL.createObjectURL(files[0]);
      setShowImage(true);
    }
    props.onChange(e);
  };

  return (
    <div className="pb-2">
      <div className="relative flex h-36 w-36 items-center justify-center rounded-full border border-dashed border-gray-400 text-center">
        <p className={clsx({ hidden: showImage }, "text-xs text-gray-400")}>
          384x384
        </p>
        <img
          ref={imgRef}
          className={clsx(
            { hidden: !showImage },
            "h-full w-full rounded-full object-cover"
          )}
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
          onChange={loadFile}
          onBlur={props.onBlur}
        />
      </div>
    </div>
  );
});

type MarginTop = `mt-${number}` | `-mt-${number}`;

export function FormErrorMessage(props: {
  message: string;
  marginTop?: MarginTop;
}) {
  return (
    <div className={`h-3 pl-0.5 ${props.marginTop ?? ""}`}>
      {props.message !== "" && (
        <span className="text-xs text-red-500">{props.message}</span>
      )}
    </div>
  );
}

export const FormInput = forwardRef<
  HTMLInputElement,
  {
    name: string;
    onChange: React.ChangeEventHandler<HTMLInputElement>;
    onBlur: React.FocusEventHandler<HTMLInputElement>;
    placeholder: string;
    type?: string;
    marginTop?: MarginTop;
  }
>(function FormInput(props, ref) {
  return (
    <input
      id={props.name}
      type={props.type}
      name={props.name}
      ref={ref}
      onChange={props.onChange}
      onBlur={props.onBlur}
      placeholder={props.placeholder}
      className={`block h-10 w-full rounded-sm border-b-2 border-gray-200 pl-0.5 ${
        props.marginTop ?? ""
      }`}
    />
  );
});
