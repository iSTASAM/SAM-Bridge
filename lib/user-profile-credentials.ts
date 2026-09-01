import { credentialsMatch, type AuthSession } from "@/lib/auth";
import { updateAdminAccount, upsertAdminAccountPassword, verifyAdminAccount } from "@/lib/admin-accounts";

export async function verifyCurrentPassword(session: AuthSession, password: string) {
  if (!password) return false;
  if (session.role !== "admin") return false;
  const stored = await verifyAdminAccount(session.username, password);
  if (stored) return true;
  if (!session.adminAccountId || session.adminAccountId === "env") {
    return credentialsMatch(session.username, password);
  }
  return false;
}

export async function changePassword(session: AuthSession, newPassword: string) {
  if (session.role !== "admin") throw new Error("PASSWORD_USER_LOCKED");
  if (newPassword.length < 8) throw new Error("PASSWORD_SHORT");
  if (session.adminAccountId && session.adminAccountId !== "env") {
    await updateAdminAccount(session.adminAccountId, { password: newPassword });
    return { adminAccountId: session.adminAccountId };
  }
  const account = await upsertAdminAccountPassword(session.username, newPassword);
  return { adminAccountId: account.id };
}
