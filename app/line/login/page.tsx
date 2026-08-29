import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LINE_AUTH_COOKIE, readLineSessionToken } from "@/lib/line-auth";
import { lineLoginStatus } from "@/lib/line-logins";
import { LineLoginPage } from "./line-login-page";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const loggedOut = params.loggedOut === "1" || params.loggedOut === "true";

  if (!loggedOut) {
    const session = await readLineSessionToken((await cookies()).get(LINE_AUTH_COOKIE)?.value);
    if (session) {
      const status = await lineLoginStatus(session.lineUserId);
      // Stale LIFF cookie after logout must not skip the login form.
      if (status !== "out") redirect("/line/dashboard");
    }
  }

  return (
    <Suspense>
      <LineLoginPage />
    </Suspense>
  );
}
