import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LINE_AUTH_COOKIE, readLineSessionToken } from "@/lib/line-auth";
import { LineLoginPage } from "./line-login-page";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const loggedOut = params.loggedOut === "1" || params.loggedOut === "true";

  // After logout navigation, always show the login form even if a stale
  // session cookie is still briefly visible in this request.
  if (!loggedOut) {
    const session = await readLineSessionToken((await cookies()).get(LINE_AUTH_COOKIE)?.value);
    if (session) redirect("/line/dashboard");
  }

  return (
    <Suspense>
      <LineLoginPage />
    </Suspense>
  );
}
