import { useState } from "react";
import { z } from "zod";

import LoginPage from "~/frontend/frontend-2/features/auth/pages/Login/Login.subpage";
import SignupPage from "~/frontend/frontend-2/features/auth/pages/Login/SignUp.subpage";

type Page = "login" | "sign-up";

export default function LoggedOutPage() {
  const [page, setPage] = useState<Page>("sign-up");

  return <>{page === "login" ? <LoginPage /> : <SignupPage />}</>;
}
