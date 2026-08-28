import { Suspense } from "react";
import { LineLoginPage } from "./line-login-page";

export default function Page() {
  return (
    <Suspense>
      <LineLoginPage />
    </Suspense>
  );
}
