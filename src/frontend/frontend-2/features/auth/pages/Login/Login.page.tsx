import { useState } from "react";
import { z } from "zod";

import LoginPage from "~/frontend/frontend-2/features/auth/pages/Login/Login.subpage";
import SignupPage from "~/frontend/frontend-2/features/auth/pages/Login/SignUp.subpage";

import { Toaster } from "react-hot-toast";

type Page = "login" | "sign-up";

export default function LoggedOutPage() {
  const [page, setPage] = useState<Page>("login");

  return (
    <>
      {page === "login" ? (
        <LoginPage onSignupClick={() => setPage("sign-up")} />
      ) : (
        <SignupPage
          onLoginClick={() => setPage("login")}
          onSignupSuccess={() => setPage("login")}
        />
      )}
      <Toaster position="top-right" />
    </>
  );
}
