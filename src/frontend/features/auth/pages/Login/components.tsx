import { clsx } from "clsx";

function FormRememberMeCheckbox() {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center">
        <input
          id="remember-me"
          type="checkbox"
          className="text-primary focus:ring-primary h-4 w-4 cursor-pointer rounded border-gray-300"
        />
        <label
          htmlFor="remember-me"
          className="ml-3 block cursor-pointer text-sm leading-6 text-gray-700"
        >
          Keep me signed in
        </label>
      </div>
    </div>
  );
}

function FormSubmitButton(props: { isPending: boolean }) {
  return (
    <div>
      <button
        type="submit"
        disabled={props.isPending}
        className={clsx(
          "focus-visible:outline-primary flex w-full items-center justify-center rounded-md bg-primary-500 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
          {
            "hover:bg-primary-600": !props.isPending,
            "cursor-not-allowed bg-primary-300": props.isPending,
          }
        )}
      >
        {props.isPending && (
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

        <span>Sign in</span>
      </button>
    </div>
  );
}

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

function FormTitle() {
  return (
    <div>
      <div className="flex">
        <ChatIcon className="ml-2 h-10 w-10 text-primary-500" />
        <div className="flex items-center pl-2.5 text-2xl font-semibold text-primary-500">
          <p>Chatter</p>
        </div>
      </div>

      <h2 className="mt-8 text-2xl font-bold leading-9 tracking-tight text-gray-900">
        Sign in to your account
      </h2>
    </div>
  );
}

function FormLayout(props: { children: JSX.Element }) {
  return (
    <div className="flex h-screen min-h-full">
      <div className="flex basis-full flex-col justify-center py-12">
        <div className="mx-auto w-4/5 max-w-sm">{props.children}</div>
      </div>
    </div>
  );
}

function SignupLink() {
  return (
    <div>
      <div>
        <div className="mt-4">
          <p className="text-sm">
            Doesn&apos;t have an account?{" "}
            <span className="cursor-pointer text-primary-600 hover:underline">
              Sign up here
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

function ErrorAlert(props: { onClose: () => void; errorMessage: string }) {
  return (
    <div className="w-full pb-2">
      <ErrorAlert1 message={props.errorMessage} onClose={props.onClose} />
    </div>
  );
}

function ErrorAlert1(props: { message: string; onClose: () => void }) {
  return (
    <div
      id="dismiss-alert"
      className="hs-removing:translate-x-5 hs-removing:opacity-0 rounded-md border border-red-200 bg-red-50 p-4 transition duration-300"
      role="alert"
    >
      <div className="flex">
        <div className="ml-3">
          <h3 className="text-sm font-semibold text-red-800">
            {props.message}
          </h3>
        </div>
        <div className="ml-auto pl-3">
          <div className="-mx-1.5 -my-1.5">
            <button
              type="button"
              onClick={props.onClose}
              className="inline-flex rounded-md bg-red-50 p-1.5 text-red-500 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 focus:ring-offset-red-50"
              data-hs-remove-element="#dismiss-alert"
            >
              <span className="sr-only">Dismiss</span>
              <svg
                className="h-3 w-3"
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M0.92524 0.687069C1.126 0.486219 1.39823 0.373377 1.68209 0.373377C1.96597 0.373377 2.2382 0.486219 2.43894 0.687069L8.10514 6.35813L13.7714 0.687069C13.8701 0.584748 13.9882 0.503105 14.1188 0.446962C14.2494 0.39082 14.3899 0.361248 14.5321 0.360026C14.6742 0.358783 14.8151 0.38589 14.9468 0.439762C15.0782 0.493633 15.1977 0.573197 15.2983 0.673783C15.3987 0.774389 15.4784 0.894026 15.5321 1.02568C15.5859 1.15736 15.6131 1.29845 15.6118 1.44071C15.6105 1.58297 15.5809 1.72357 15.5248 1.85428C15.4688 1.98499 15.3872 2.10324 15.2851 2.20206L9.61883 7.87312L15.2851 13.5441C15.4801 13.7462 15.588 14.0168 15.5854 14.2977C15.5831 14.5787 15.4705 14.8474 15.272 15.046C15.0735 15.2449 14.805 15.3574 14.5244 15.3599C14.2437 15.3623 13.9733 15.2543 13.7714 15.0591L8.10514 9.38812L2.43894 15.0591C2.23704 15.2543 1.96663 15.3623 1.68594 15.3599C1.40526 15.3574 1.13677 15.2449 0.938279 15.046C0.739807 14.8474 0.627232 14.5787 0.624791 14.2977C0.62235 14.0168 0.730236 13.7462 0.92524 13.5441L6.59144 7.87312L0.92524 2.20206C0.724562 2.00115 0.611816 1.72867 0.611816 1.44457C0.611816 1.16047 0.724562 0.887983 0.92524 0.687069Z"
                  fill="currentColor"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TextInput(props: {
  id: string;
  label: string;
  error: string | undefined;
  children: JSX.Element;
}) {
  return (
    <div>
      <label
        htmlFor={props.id}
        className="block text-sm font-medium leading-6 text-gray-700 "
      >
        {props.label}
      </label>
      <div className="mt-0.5">{props.children}</div>

      <div className="mt-0.5 h-6">
        {props?.error && (
          <p className="text-[0.8rem] text-red-600">{props.error}</p>
        )}
      </div>
    </div>
  );
}

export const Components = {
  Layout: FormLayout,
  FormTitle,
  SignupLink,
  ErrorAlert,
  Form: {
    RememberMeCheckbox: FormRememberMeCheckbox,
    SubmitButton: FormSubmitButton,
    TextInput,
  },
};
