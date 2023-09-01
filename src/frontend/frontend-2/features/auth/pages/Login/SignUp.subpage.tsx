import {
  useState,
  forwardRef,
  useRef,
  useImperativeHandle,
  useEffect,
} from "react";
import { z } from "zod";
import { RefCallBack, useForm } from "react-hook-form";
import { clsx as cx } from "clsx";
import { useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";

import { isAppError } from "~/api-contract/errors/errors";
import { useLoginHandler } from "~/frontend/frontend-2/features/auth/hooks/use-login-handler.hook";

import { useAppStore } from "~/frontend/stores/stores";
import { client } from "~/frontend/external/api-client/client";
import storage from "~/frontend/external/browser/local-storage";

import { Components } from "~/frontend/frontend-2/features/auth/pages/Login/components";

const formSchema = z.object({
  username: z.string().min(1, { message: "Username is required" }),
  password: z.string().min(1, { message: "Password is required" }),
  fullname: z.string().min(1, { message: "Full name is required" }),
  email: z.string().min(1, { message: "Email is required" }),
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

function ChatIcon(props: { className: string }) {
  return (
    <svg
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      height="1em"
      viewBox="0 0 512 512"
      className={props.className}
    >
      <path d="M256 448c141.4 0 256-93.1 256-208S397.4 32 256 32S0 125.1 0 240c0 45.1 17.7 86.8 47.7 120.9c-1.9 24.5-11.4 46.3-21.4 62.9c-5.5 9.2-11.1 16.6-15.2 21.6c-2.1 2.5-3.7 4.4-4.9 5.7c-.6 .6-1 1.1-1.3 1.4l-.3 .3 0 0 0 0 0 0 0 0c-4.6 4.6-5.9 11.4-3.4 17.4c2.5 6 8.3 9.9 14.8 9.9c28.7 0 57.6-8.9 81.6-19.3c22.9-10 42.4-21.9 54.3-30.6c31.8 11.5 67 17.9 104.1 17.9zM128 208a32 32 0 1 1 0 64 32 32 0 1 1 0-64zm128 0a32 32 0 1 1 0 64 32 32 0 1 1 0-64zm96 32a32 32 0 1 1 64 0 32 32 0 1 1 -64 0z" />
    </svg>
  );
}

export default function SignupPage() {
  const { onLoginSuccess } = useLoginHandler();

  const {
    watch,
    register,
    handleSubmit,
    setValue,
    formState: { errors: formErrors },
  } = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
  });

  const watchProfileImage = watch("profileImage");

  const [openErrorAlert, setOpenErrorAlert] = useState(false);
  const store = useAppStore((s) => ({
    setProfile: s.setProfile,
    setAuthStatus: s.setAuthStatus,
  }));

  const loginMutation = useMutation({
    mutationFn: async (values: { username: string; password: string }) => {
      const loginResult = await client["auth/login"]({
        username: values.username,
        password: values.password,
      });

      if (loginResult.isErr()) {
        throw loginResult.error;
      }

      const r = await onLoginSuccess(loginResult.value);
      if (r.isErr()) {
        throw r.error;
      }
      store.setProfile(loginResult.value);
      storage.setToken(loginResult.value.token);
    },
    onSuccess(data) {
      setOpenErrorAlert(false);
      store.setAuthStatus("logged-in");
    },
    onError(error: unknown) {
      setOpenErrorAlert(true);
    },
  });

  const loginErrorMessage = loginApiErrorMessage(loginMutation.error);

  const { ref: profileImageInputRef, ...profileImageRegister } =
    register("profileImage");

  const imgUploadRef = useRef<ImageUploadRef | null>(null);

  const textInputclass =
    "focus:ring-primary block w-full rounded-md border-0 px-2 py-1.5 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset sm:text-sm sm:leading-6";

  return (
    <Components.Layout>
      <div className="mb-4">
        <div className="flex">
          <ChatIcon className="h-10 w-10 text-primary-500" />
          <div className="ml-2 flex items-center text-2xl font-semibold text-primary-500">
            <p>Chatter</p>
          </div>
        </div>

        <h2 className="mb-8 mt-4 text-2xl font-bold leading-9 tracking-tight text-gray-900">
          Sign up for an account
        </h2>
      </div>

      <div
        className={cx("flex items-end", {
          "h-20": loginMutation.isError && openErrorAlert,
          "h-10": !loginMutation.isError && openErrorAlert,
        })}
      >
        {openErrorAlert && loginErrorMessage !== undefined && (
          <Components.ErrorAlert
            onClose={() => setOpenErrorAlert(false)}
            errorMessage={loginErrorMessage ?? ""}
          />
        )}
      </div>

      <form
        onSubmit={handleSubmit((data) => {
          loginMutation.mutate({
            username: data.username,
            password: data.password,
          });
        })}
      >
        <label className="block text-sm font-medium leading-6 text-gray-700 ">
          Profile picture
        </label>
        <div className="mb-6 flex pt-2">
          <ImageUpload
            ref={(e) => {
              if (e) {
                const imgInputRef = e.imgInput();
                if (imgInputRef) {
                  profileImageInputRef(imgInputRef);
                }
              }
              imgUploadRef.current = e;
            }}
            {...profileImageRegister}
          />

          {watchProfileImage?.length > 0 && (
            <div className="flex flex-col justify-end pb-2 pl-3">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  const r = document.getElementById("profileImage");
                  if (r && r instanceof HTMLInputElement) {
                    r.value = "";
                    if (r.files !== null) {
                      setValue("profileImage", r.files);
                    }
                  }
                  imgUploadRef.current?.removeImage();
                }}
                className="rounded-md border border-red-500 px-4 py-2 text-red-500 hover:bg-red-500 hover:text-white"
              >
                DELETE
              </button>
            </div>
          )}
        </div>

        <Components.Form.TextInput
          id={"username"}
          label={"Username"}
          error={formErrors["username"]?.message}
        >
          <input className={textInputclass} {...register("username")} />
        </Components.Form.TextInput>

        <Components.Form.TextInput
          id={"password"}
          label={"Password"}
          error={formErrors["password"]?.message}
        >
          <input className={textInputclass} {...register("password")} />
        </Components.Form.TextInput>

        <Components.Form.TextInput
          id={"fullname"}
          label={"Full name"}
          error={formErrors["fullname"]?.message}
        >
          <input className={textInputclass} {...register("fullname")} />
        </Components.Form.TextInput>

        <Components.Form.TextInput
          id={"email"}
          label={"Email"}
          error={formErrors["email"]?.message}
        >
          <input className={textInputclass} {...register("email")} />
        </Components.Form.TextInput>

        <div className="mb-6" />

        <div>
          <button
            type="submit"
            disabled={loginMutation.isPending}
            className={cx(
              "focus-visible:outline-primary flex w-full items-center justify-center rounded-md bg-primary-500 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
              {
                "hover:bg-primary-600": !loginMutation.isPending,
                "cursor-not-allowed bg-primary-300": loginMutation.isPending,
              }
            )}
          >
            {loginMutation.isPending && (
              <span className="flex w-6 items-center">
                <span
                  className="inline-block h-4 w-4 animate-spin rounded-full border-[3px] border-current border-t-transparent text-white"
                  role="status"
                  aria-label="loading"
                >
                  <span className="sr-only">Loading...</span>
                </span>
              </span>
            )}

            <span>Sign up</span>
          </button>
        </div>
      </form>

      <div>
        <div>
          <div className="mt-4">
            <p className="text-sm">
              Already have an account?{" "}
              <span className="cursor-pointer text-primary-600 hover:underline">
                Login here
              </span>
            </p>
          </div>
        </div>
      </div>
    </Components.Layout>
  );
}

const loginApiErrorMessage = (loginApiError: unknown) => {
  if (loginApiError === undefined || loginApiError === null) {
    return undefined;
  }
  if (isAppError(loginApiError)) {
    if (loginApiError.details.type === "AUTH.INCORRECT_PASSWORD") {
      return "Wrong password";
    } else if (loginApiError.details.type === "RESOURCE_NOT_FOUND") {
      return "Wrong username";
    } else if (loginApiError.details.type === "UNKNOWN") {
      return `An unexpected error has occured.`;
    }
  }
  return `An unexpected error has occured`;
};

type ImageUploadRef = {
  imgInput: () => HTMLInputElement | null;
  removeImage: () => void;
};

const ImageUpload = forwardRef<
  ImageUploadRef,
  {
    name: string;
    onInput?: React.FormEventHandler<HTMLInputElement>;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
    onBlur?: React.FocusEventHandler<HTMLInputElement>;
  }
>((props, ref) => {
  const img = useRef<HTMLImageElement | null>(null);
  const imgInput = useRef<HTMLInputElement | null>(null);

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

  useImperativeHandle(ref, (): ImageUploadRef => {
    return {
      imgInput: () => {
        return imgInput.current;
      },
      removeImage: () => {
        if (img.current) {
          img.current.src = "";
          setShowImage(false);
        }
      },
    };
  });

  return (
    <div className="pb-2">
      <div className="relative flex h-24 w-24 items-center justify-center rounded-lg border border-dashed border-gray-400 bg-white text-center">
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
          htmlFor={props.name}
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
          ref={imgInput}
          name={props.name}
          type="file"
          id={props.name}
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
