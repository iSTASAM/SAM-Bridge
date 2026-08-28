"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FiPlus } from "react-icons/fi";
import { useLocale } from "../locale-context";
import { COPY } from "./connections/copy";
import { DeleteMachineDialog } from "./connections/delete-machine-dialog";
import { MachineEditor } from "./connections/machine-editor";
import { MachineRow } from "./connections/machine-row";
import {
  DEFAULT_LOGIN_PATH,
  EMPTY_FORM,
  formFromConnection,
  fullLoginUrl,
  normalizeBaseUrl,
  type Connection,
  type Flash,
  type FormState,
} from "./connections/types";
import type { IxacsCustomerOption } from "@/lib/ixacs-login";

export default function ConnectionsPage() {
  const { locale } = useLocale();
  const copy = COPY[locale];
  const [activeId, setActiveId] = useState<string | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Connection | null>(null);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [pageFlash, setPageFlash] = useState<Flash | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [customerOptions, setCustomerOptions] = useState<IxacsCustomerOption[]>([]);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/connections", { cache: "no-store" });
    const data = (await response.json()) as {
      activeId?: string | null;
      connections?: Connection[];
    };
    setActiveId(data.activeId ?? null);
    setConnections(data.connections ?? []);
    return data.connections ?? [];
  }, []);

  useEffect(() => {
    void load();
    void fetch("/api/session", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((session) => setCanManage(session?.role === "admin"));
  }, [load]);

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (!listRef.current?.contains(event.target as Node)) setMenuId(null);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuId(null);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  function openNew() {
    setEditingId("new");
    setForm(EMPTY_FORM);
    setFlash(null);
    setPageFlash(null);
    setCustomerOptions([]);
    setSelectedCustomerIds([]);
  }

  function openEdit(item: Connection) {
    const savedCustomers = item.customers ?? [];
    setEditingId(item.id);
    setForm(formFromConnection(item));
    setFlash(null);
    setPageFlash(null);
    setMenuId(null);
    setCustomerOptions(savedCustomers);
    setSelectedCustomerIds(savedCustomers.map((customer) => customer.id));
  }

  function closeEditor() {
    setEditingId(null);
    setFlash(null);
  }

  async function save() {
    if (editingId === "new") {
      await testLogin(undefined, true);
      return;
    }
    setBusy(true);
    setFlash(null);
    const multiCustomer = customerOptions.length > 0;
    if (multiCustomer && selectedCustomerIds.length === 0) {
      setFlash({ kind: "error", title: copy.loginFailTitle, text: copy.selectAtLeastOne });
      setBusy(false);
      return;
    }
    const selectedCustomers = multiCustomer
      ? customerOptions.filter((item) => selectedCustomerIds.includes(item.id))
      : [];
    const payload = {
      name: form.name,
      baseUrl: normalizeBaseUrl(form.baseUrl) || form.baseUrl,
      loginUrl: fullLoginUrl(form.baseUrl, DEFAULT_LOGIN_PATH),
      customerId: multiCustomer ? selectedCustomers[0]?.id ?? "" : form.customerId,
      ...(multiCustomer ? { customers: selectedCustomers } : {}),
      loginId: form.loginId,
      basicAuth: form.basicAuth,
      session: form.session,
      lineUuids: form.lineUuids,
    };
    const response = await fetch(
      editingId && editingId !== "new" ? `/api/connections/${editingId}` : "/api/connections",
      {
        method: editingId && editingId !== "new" ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    if (response.ok) {
      setEditingId(null);
      setFlash(null);
      await load();
    } else {
      setFlash({ kind: "error", title: copy.saveError, text: copy.saveError });
    }
    setBusy(false);
  }

  async function testLogin(credentials?: {
    customerId: string;
    loginId: string;
    password: string;
  }, persist = false) {
    const customerId = (credentials?.customerId ?? form.customerId).trim();
    const loginId = (credentials?.loginId ?? form.loginId).trim();
    const password = credentials?.password ?? form.password;

    if (!loginId || (!password && !form.hasSavedPassword)) {
      const missing = [
        !loginId ? copy.loginId : null,
        !password && !form.hasSavedPassword ? copy.password : null,
      ].filter(Boolean);
      setFlash({
        kind: "error",
        title: copy.loginFailTitle,
        text: `${copy.loginRequired} (${missing.join(", ")})`,
      });
      return;
    }

    if (customerOptions.length > 0 && persist) {
      if (selectedCustomerIds.length === 0) {
        setFlash({ kind: "error", title: copy.loginFailTitle, text: copy.selectAtLeastOne });
        return;
      }
      setBusy(true);
      setFlash(null);
      const selectedCustomers = customerOptions.filter((item) =>
        selectedCustomerIds.includes(item.id),
      );
      const primary = selectedCustomers[0];
      const response = await fetch("/api/connections/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          connectionId: editingId && editingId !== "new" ? editingId : undefined,
          name: form.name.trim() || "iXacs",
          baseUrl: normalizeBaseUrl(form.baseUrl) || form.baseUrl,
          loginUrl: fullLoginUrl(form.baseUrl, DEFAULT_LOGIN_PATH),
          customerId: "",
          selectedCustomerId: primary.id,
          customers: selectedCustomers,
          loginId,
          password,
          basicAuth: form.basicAuth,
          language: locale,
          lineUuids: form.lineUuids,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        lineCount?: number;
      };
      await load();
      if (!response.ok || !result.ok) {
        setFlash({
          kind: "error",
          title: copy.loginFailTitle,
          text: result.error || copy.loginFailBody,
        });
      } else {
        setEditingId(null);
        setCustomerOptions([]);
        setSelectedCustomerIds([]);
        setPageFlash({
          kind: "ok",
          title: copy.loginOkTitle,
          text: `${copy.loginOkBody} · ${selectedCustomers.length} ${copy.selectCustomers}${
            (result.lineCount ?? 0) > 0 ? ` · ${copy.linesCount(result.lineCount ?? 0)}` : ""
          }`,
        });
      }
      setBusy(false);
      return;
    }

    setBusy(true);
    setFlash(null);
    const response = await fetch("/api/connections/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        connectionId: editingId && editingId !== "new" ? editingId : undefined,
        name: form.name,
        baseUrl: normalizeBaseUrl(form.baseUrl) || form.baseUrl,
        loginUrl: fullLoginUrl(form.baseUrl, DEFAULT_LOGIN_PATH),
        customerId,
        loginId,
        password,
        basicAuth: form.basicAuth,
        language: locale,
        lineUuids: form.lineUuids,
        probe: !persist,
      }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      connectionId?: string;
      lineCount?: number;
      discoveryError?: string | null;
      customerIds?: string[];
      customers?: IxacsCustomerOption[];
    };

    if (data.error === "LOGIN_CUSTOMER_SELECTION_REQUIRED") {
      const options = data.customers?.length
        ? data.customers
        : (data.customerIds ?? []).map((id) => ({ id, name: id }));
      setCustomerOptions(options);
      setSelectedCustomerIds((current) => {
        const stillSelected = current.filter((id) => options.some((item) => item.id === id));
        if (stillSelected.length > 0) return stillSelected;
        return options.length === 1 ? [options[0].id] : [];
      });
      setFlash({
        kind: options.length > 0 ? "ok" : "error",
        title: copy.selectCustomers,
        text: options.length > 0 ? copy.selectCustomersHint : copy.selectCustomersEmpty,
      });
      setBusy(false);
      return;
    }

    if (response.ok && data.ok && !persist) {
      setFlash({
        kind: "ok",
        title: copy.loginOkTitle,
        text: `${copy.loginOkBody}${(data.lineCount ?? 0) > 0 ? ` · ${copy.linesCount(data.lineCount ?? 0)}` : ""}`,
      });
    } else if (response.ok && data.ok && data.connectionId) {
      const detail = await fetch(`/api/connections/${data.connectionId}`, { cache: "no-store" });
      if (detail.ok) {
        const connection = (await detail.json()) as Connection;
        setEditingId(connection.id);
        setForm({
          ...formFromConnection(connection),
          password: "",
          curl: form.curl,
        });
      }
      setFlash({
        kind: "ok",
        title: copy.loginOkTitle,
        text: `${copy.loginOkBody} ${copy.sessionCreated}${
          (data.lineCount ?? 0) > 0
            ? ` · ${copy.linesCount(data.lineCount ?? 0)}`
            : ""
        }`,
      });
      await load();
    } else {
      const detail =
        data.error === "LOGIN_FAILED"
          ? locale === "th"
            ? "iXacs ส่งกลับมาที่หน้า Login และยังไม่ยืนยัน Session จากคำขอนี้ กรุณาตรวจ URL และข้อมูลเข้าสู่ระบบ"
            : locale === "ja"
              ? "iXacs はログインページを返し、このリクエストのセッションを認証しませんでした。URLとログイン情報を確認してください。"
              : "iXacs returned the login page and did not authenticate this request. Check the URL and sign-in details."
          : data.error === "LOGIN_MONITOR_UNAUTHORIZED"
            ? locale === "th"
              ? "เข้าสู่ Gateway ได้ แต่บัญชีนี้ไม่มีสิทธิ์เข้า CT Monitor บน URL นี้"
              : locale === "ja"
                ? "Gatewayにはログインできましたが、このアカウントはこのURLのCT Monitorを利用できません。"
                : "Gateway sign-in worked, but this account cannot access CT Monitor on this URL."
            : data.error && !data.error.startsWith("LOGIN_")
              ? data.error
              : copy.loginFailBody;
      setFlash({ kind: "error", title: copy.loginFailTitle, text: detail });
    }
    setBusy(false);
  }

  async function activate(id: string) {
    setBusy(true);
    setMenuId(null);
    await fetch(`/api/connections/${id}`, { method: "PUT" });
    await load();
    setBusy(false);
  }

  async function remove() {
    if (!deleteTarget) return;
    setBusy(true);
    await fetch(`/api/connections/${deleteTarget.id}`, { method: "DELETE" });
    if (editingId === deleteTarget.id) setEditingId(null);
    setDeleteTarget(null);
    await load();
    setBusy(false);
  }

  async function sync(id: string, probe: boolean) {
    setBusy(true);
    setTestingId(probe ? id : null);
    setPageFlash(null);
    setMenuId(null);
    const response = await fetch(`/api/connections/${id}/sync`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ probe }),
    });
    const data = (await response.json()) as {
      ok?: boolean;
      error?: string | null;
    };
    if (data.ok) {
      setPageFlash({
        kind: "ok",
        title: copy.loginOkTitle,
        text: copy.loginOkBody,
      });
    } else {
      setPageFlash({
        kind: "error",
        title: copy.loginFailTitle,
        text: data.error || copy.lastError,
      });
    }
    await load();
    setTestingId(null);
    setBusy(false);
  }

  const editorOpen = editingId !== null;

  return (
    <div className="console-page">
      <div className="machine-page">
      <div className="machine-page-head">
        <div>
          <h1 className="console-title">{copy.title}</h1>
        </div>
        {canManage ? (
          <button type="button" className="btn btn-primary" disabled={busy} onClick={openNew}>
            <FiPlus size={16} />
            {copy.add}
          </button>
        ) : null}
      </div>

      {pageFlash && !editorOpen ? (
        <div className={`machine-feedback is-${pageFlash.kind}`} role="status">
          {pageFlash.title ? <p className="machine-feedback-title">{pageFlash.title}</p> : null}
          <p className={pageFlash.title ? "machine-feedback-body" : "machine-feedback-title"}>
            {pageFlash.text}
          </p>
        </div>
      ) : null}

      {connections.length === 0 ? (
        <div className="empty-state">
          <h3>{copy.emptyTitle}</h3>
          <p>{copy.emptyBody}</p>
          {canManage ? (
            <button type="button" className="btn btn-primary" onClick={openNew}>
              <FiPlus size={16} />
              {copy.add}
            </button>
          ) : null}
        </div>
      ) : (
        <section className="machine-list-section">
          <div className="machine-list" ref={listRef}>
            {connections.map((item) => (
              <MachineRow
                key={item.id}
                item={item}
                copy={copy}
                busy={busy}
                testing={testingId === item.id}
                menuOpen={menuId === item.id}
                canActivate={item.id !== activeId}
                canManage={canManage}
                onTest={() => void sync(item.id, true)}
                onEdit={() => openEdit(item)}
                onDetails={() => openEdit(item)}
                onUse={() => void activate(item.id)}
                onDelete={() => {
                  setMenuId(null);
                  setDeleteTarget(item);
                }}
                onToggleMenu={() => setMenuId((current) => (current === item.id ? null : item.id))}
              />
            ))}
          </div>
        </section>
      )}

      {editorOpen ? (
        <MachineEditor
          open
          copy={copy}
          form={form}
          editingId={editingId}
          busy={busy}
          flash={flash}
          customerOptions={customerOptions}
          selectedCustomerIds={selectedCustomerIds}
          onChange={setForm}
          onClose={closeEditor}
          onSave={() => void save()}
          onLogin={(credentials) => void testLogin(credentials)}
          onToggleCustomer={(customerId) => setSelectedCustomerIds((current) =>
            current.includes(customerId)
              ? current.filter((item) => item !== customerId)
              : [...current, customerId]
          )}
        />
      ) : null}

      <DeleteMachineDialog
        open={Boolean(deleteTarget)}
        copy={copy}
        target={deleteTarget}
        busy={busy}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void remove()}
      />
      </div>
    </div>
  );
}
