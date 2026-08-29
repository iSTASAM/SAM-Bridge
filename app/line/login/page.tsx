import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LINE_AUTH_COOKIE, readLineSessionToken } from "@/lib/line-auth";
import { LineLoginPage } from "./line-login-page";

export default async function Page() {
  const session = await readLineSessionToken((await cookies()).get(LINE_AUTH_COOKIE)?.value);
  if (session) redirect("/line/dashboard");

  return (
    <Suspense>
      <LineLoginPage />
    </Suspense>
  );
}
