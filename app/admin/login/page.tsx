import { Suspense } from "react";
import { LoginPage } from "../../login/login-page";

export default function AdminLoginPage() {
  return <Suspense><LoginPage admin /></Suspense>;
}
