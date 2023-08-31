import { clsx as cx } from "clsx";
import { useRef, useState, forwardRef, createRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useAppStore } from "~/frontend/stores/stores";
import { z } from "zod";

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
  profileImage: z.custom<FileList>().superRefine((files, ctx) => {
    if (files.length === 0) {
      return true;
    }

    if (
      ![
        "image/webp",
        "image/png",
        "image/svg",
        "image/jpg",
        "image/jpeg",
      ].includes(files[0].type)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "File must be a valid image type",
      });
      return false;
    }

    if (files[0].size > 1024 * 1024 * 5) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "File must be less than 5MB",
      });
      return false;
    }

    return true;
  }),
});

type FormSchema = z.infer<typeof formSchema>;

export function TabNewGroup(props: { onSubmit: (values: FormSchema) => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors: formErrors },
  } = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
  });
  const imageInputRef = createRef<HTMLInputElement>();

  return (
    <div>
      <form
        onSubmit={handleSubmit(
          (data) => {
            props.onSubmit(data);
          },
          (err) => {
            console.error(`Form error`, err);
          }
        )}
      >
        <div className="flex justify-center">
          <ImageUpload {...register("profileImage")} />
        </div>

        <div className="px-4 pt-6">
          <label htmlFor="name" className="text-sm">
            Name
          </label>
          <FormInput
            {...register("groupName")}
            placeholder="Freeform name of the group"
          />
          <FormErrorMessage message={formErrors.groupName?.message ?? ""} />
        </div>

        <div className="px-4 pt-6">
          <label htmlFor="description" className="text-sm">
            Description
          </label>
          <FormInput
            {...register("description")}
            placeholder="Optional description"
          />
          <FormErrorMessage message={formErrors.description?.message ?? ""} />
        </div>

        <div className="mt-6 flex justify-end px-4">
          <button
            type="submit"
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white"
          >
            CREATE
          </button>
        </div>
      </form>
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
      className="mt-1  block w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
    />
  );
});

export function FormErrorMessage(props: {
  message: string;
  marginTop?: `mt-${number}` | `-mt-${number}`;
}) {
  return (
    <div className={`h-3 pl-0.5 ${props.marginTop ?? ""}`}>
      {props.message !== "" && (
        <span className="text-xs text-red-500">{props.message}</span>
      )}
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
