import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import clsx from "clsx";
import { useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";

import { isAppError } from "~/api-contract/errors/errors";
import { useLoginHandler } from "~/frontend/frontend-2/features/auth/hooks/use-login-handler.hook";

import { useAppStore } from "~/frontend/stores/stores";
import { client } from "~/frontend/external/api-client/client";
import { useLocalStorageAuthToken } from "~/frontend/external/browser/local-storage";

import { Components } from "~/frontend/frontend-2/features/auth/pages/Login/components";

const formSchema = z.object({
  username: z.string().min(1, { message: "Username is required" }),
  password: z.string().min(1, { message: "Password is required" }),
});

type FormSchema = z.infer<typeof formSchema>;

export default function LoginPage(props: { onSignupClick: () => void }) {
  const { onLoginSuccess } = useLoginHandler();

  const {
    register,
    handleSubmit,
    formState: { errors: formErrors },
  } = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
  });

  const [openErrorAlert, setOpenErrorAlert] = useState(false);
  const store = useAppStore((s) => ({
    setProfile: s.setProfile,
    setAuthStatus: s.setAuthStatus,
  }));

  const { setToken } = useLocalStorageAuthToken();

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
      setToken(loginResult.value.token);
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

  const textInputclass =
    "focus:ring-primary block w-full rounded-md border-0 px-2 py-1.5 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset sm:text-sm sm:leading-6";

  return (
    <Components.Layout>
      <Components.FormTitle />

      <div
        className={clsx("flex items-end", {
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
        <Components.Form.TextInput
          id={"username"}
          label={"Username"}
          error={formErrors["username"]?.message}
        >
          <input className={textInputclass} {...register("username")} />
        </Components.Form.TextInput>

        <div className="mb-4" />

        <Components.Form.TextInput
          id={"password"}
          label={"Password"}
          error={formErrors["password"]?.message}
        >
          <input className={textInputclass} {...register("password")} />
        </Components.Form.TextInput>

        <div className="mb-6" />

        <Components.Form.RememberMeCheckbox />

        <div className="mb-6" />

        <Components.Form.SubmitButton isPending={loginMutation.isPending} />
      </form>

      <div>
        <div>
          <div className="mt-4">
            <p className="text-sm">
              Doesn&apos;t have an account?{" "}
              <span
                onClick={props.onSignupClick}
                className="cursor-pointer text-primary-600 hover:underline"
              >
                Sign up here
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
