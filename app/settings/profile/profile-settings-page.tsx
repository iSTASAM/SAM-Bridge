"use client";

import { useEffect, useState } from "react";
import { FiCamera, FiCheck, FiLoader } from "react-icons/fi";
import { useLocale } from "@/app/locale-context";
import "@/app/styles/globals/80-user-profile.css";

type Profile = {
  id: string;
  role: "admin" | "user";
  username: string;
  displayName: string;
  avatarUrl: string | null;
  canChangePassword: boolean;
};

const COPY = {
  th: {
    title: "ตั้งค่าบัญชี",
    profile: "โปรไฟล์",
    displayNamePlaceholder: "ชื่อที่แสดง",
    changeAvatar: "เปลี่ยนรูปโปรไฟล์",
    password: "รหัสผ่าน",
    currentPassword: "รหัสผ่านปัจจุบัน",
    newPassword: "รหัสผ่านใหม่",
    saveProfile: "บันทึกโปรไฟล์",
    savePassword: "บันทึกรหัสผ่าน",
    saved: "บันทึกแล้ว",
    loadError: "โหลดโปรไฟล์ไม่สำเร็จ",
    avatarError: "อัปโหลดรูปไม่สำเร็จ",
  },
  en: {
    title: "Account settings",
    profile: "Profile",
    displayNamePlaceholder: "Display name",
    changeAvatar: "Change profile photo",
    password: "Password",
    currentPassword: "Current password",
    newPassword: "New password",
    saveProfile: "Save profile",
    savePassword: "Save password",
    saved: "Saved",
    loadError: "Could not load profile",
    avatarError: "Could not upload avatar",
  },
  ja: {
    title: "アカウント設定",
    profile: "プロフィール",
    displayNamePlaceholder: "表示名",
    changeAvatar: "プロフィール写真を変更",
    password: "パスワード",
    currentPassword: "現在のパスワード",
    newPassword: "新しいパスワード",
    saveProfile: "プロフィールを保存",
    savePassword: "パスワードを保存",
    saved: "保存しました",
    loadError: "プロフィールを読み込めませんでした",
    avatarError: "アバターをアップロードできませんでした",
  },
} as const;

function initials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  return value.trim().slice(0, 2).toUpperCase() || "?";
}

function notifyProfileUpdated() {
  window.dispatchEvent(new Event("profile-updated"));
}

export function ProfileSettingsPage() {
  const { locale } = useLocale();
  const copy = COPY[locale];
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarBroken, setAvatarBroken] = useState(false);
  const [savedProfile, setSavedProfile] = useState(false);
  const [savedPassword, setSavedPassword] = useState(false);
  const [error, setError] = useState("");
  const [avatarVersion, setAvatarVersion] = useState(0);

  useEffect(() => {
    void fetch("/api/user/profile", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(copy.loadError);
        return response.json() as Promise<Profile>;
      })
      .then((value) => {
        setProfile(value);
        setDisplayName(value.displayName);
        setAvatarBroken(false);
      })
      .catch((cause: Error) => setError(cause.message));
  }, [copy.loadError]);

  useEffect(() => () => {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
  }, [avatarPreview]);

  const avatarSrc = profile?.avatarUrl && !avatarBroken
    ? `${profile.avatarUrl}${profile.avatarUrl.includes("?") ? "&" : "?"}v=${avatarVersion}`
    : null;
  const shownAvatar = avatarPreview || avatarSrc;
  const fallbackText = initials(displayName || profile?.username || "?");

  async function uploadAvatar(file: File) {
    const preview = URL.createObjectURL(file);
    setAvatarPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return preview;
    });
    setAvatarBroken(false);
    setAvatarBusy(true);
    setError("");
    const form = new FormData();
    form.set("avatar", file);
    const response = await fetch("/api/user/profile/avatar", { method: "POST", body: form });
    const data = (await response.json().catch(() => ({}))) as Profile & { error?: string };
    setAvatarBusy(false);
    if (!response.ok) {
      setAvatarPreview((current) => {
        if (current) URL.revokeObjectURL(current);
        return null;
      });
      setError(data.error || copy.avatarError);
      return;
    }
    setProfile(data);
    setAvatarPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    setAvatarVersion((value) => value + 1);
    notifyProfileUpdated();
  }

  async function saveProfile() {
    if (!profile) return;
    setBusy(true);
    setSavedProfile(false);
    setError("");
    const response = await fetch("/api/user/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ displayName }),
    });
    const data = (await response.json().catch(() => ({}))) as Profile & { error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(data.error || copy.loadError);
      return;
    }
    setProfile(data);
    setDisplayName(data.displayName);
    setSavedProfile(true);
    notifyProfileUpdated();
    window.setTimeout(() => setSavedProfile(false), 1600);
  }

  async function savePassword() {
    if (!profile || !newPassword) return;
    setBusy(true);
    setSavedPassword(false);
    setError("");
    const response = await fetch("/api/user/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = (await response.json().catch(() => ({}))) as Profile & { error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(data.error || copy.loadError);
      return;
    }
    setProfile(data);
    setCurrentPassword("");
    setNewPassword("");
    setSavedPassword(true);
    window.setTimeout(() => setSavedPassword(false), 1600);
  }

  return (
    <div className="console-page profile-page">
      <header>
        <h1 className="console-title">{copy.title}</h1>
      </header>

      {error ? <p className="profile-flash is-error" role="alert">{error}</p> : null}

      <section className="profile-section">
        <div className="profile-section-head">
          <h2>{copy.profile}</h2>
        </div>
        <div className="profile-identity">
          <label className="profile-avatar-picker">
            <input
              className="profile-avatar-input"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              disabled={avatarBusy || busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void uploadAvatar(file);
              }}
            />
            <span className="profile-avatar-frame" aria-hidden={avatarBusy}>
              {shownAvatar ? (
                <img
                  src={shownAvatar}
                  alt=""
                  className="profile-avatar"
                  width={80}
                  height={80}
                  onError={() => setAvatarBroken(true)}
                />
              ) : (
                <span className="profile-avatar-fallback">{fallbackText}</span>
              )}
              <span className="profile-avatar-overlay">
                {avatarBusy ? <FiLoader size={18} className="profile-avatar-spinner" /> : <FiCamera size={18} />}
              </span>
            </span>
            <span className="sr-only">{copy.changeAvatar}</span>
          </label>
          <div className="profile-fields">
            <div className="profile-field">
              <input
                id="profile-display-name"
                value={displayName}
                placeholder={copy.displayNamePlaceholder}
                aria-label={copy.displayNamePlaceholder}
                disabled={!profile || busy}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="profile-actions">
          <button type="button" className="btn btn-secondary" disabled={busy || !profile} onClick={() => void saveProfile()}>
            {savedProfile ? <FiCheck size={16} /> : null}
            {savedProfile ? copy.saved : copy.saveProfile}
          </button>
        </div>
      </section>

      {profile?.canChangePassword ? (
        <section className="profile-section">
          <div className="profile-section-head">
            <h2>{copy.password}</h2>
          </div>
          <div className="profile-fields">
            <div className="profile-field">
              <label htmlFor="profile-current-password">{copy.currentPassword}</label>
              <input
                id="profile-current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                disabled={busy}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </div>
            <div className="profile-field">
              <label htmlFor="profile-new-password">{copy.newPassword}</label>
              <input
                id="profile-new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                disabled={busy}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </div>
          </div>
          <div className="profile-actions">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy || !newPassword || !currentPassword}
              onClick={() => void savePassword()}
            >
              {savedPassword ? <FiCheck size={16} /> : null}
              {savedPassword ? copy.saved : copy.savePassword}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
