"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "../../locale-context";
import { ApiKeysSection } from "./api-keys-section";
import { COPY } from "./copy";
import { EndpointSection } from "./endpoint-section";
import { ConfirmKeyDialog, CreateApiKeyDialog, CreatedApiKeyDialog } from "./key-dialogs";
import { KeyDrawer } from "./key-drawer";
import { PushSubnav } from "./push-subnav";
import type { CatalogChoice, CatalogGroup, Company, IssuedKey, KeyEnvironment } from "./types";
import { flattenCatalog } from "./types";

export function PushSettings() {
  const { locale } = useLocale();
  const copy = COPY[locale];
  const [origin, setOrigin] = useState("");
  const pushUrl = origin ? `${origin}/api/push` : "";
  const [keys, setKeys] = useState<IssuedKey[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [storage, setStorage] = useState<"supabase" | "file">("file");
  const [copied, setCopied] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogChoices, setCatalogChoices] = useState<CatalogChoice[]>([]);
  const [selectedLineUuid, setSelectedLineUuid] = useState("");
  const [keyNameValue, setKeyNameValue] = useState("");
  const [environment, setEnvironment] = useState<KeyEnvironment>("live");
  const [expiration, setExpiration] = useState("never");
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<IssuedKey | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [rotateTarget, setRotateTarget] = useState<IssuedKey | null>(null);
  const [rotateError, setRotateError] = useState<string | null>(null);
  const [viewTarget, setViewTarget] = useState<IssuedKey | null>(null);
  const [drawerError, setDrawerError] = useState<string | null>(null);

  const companyKeys = keys.filter((item) => item.company?.id === selectedCompanyId);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const load = useCallback(async () => {
    const response = await fetch("/api/settings", { cache: "no-store" });
    if (!response.ok) {
      setListError(copy.loadError);
      return [] as IssuedKey[];
    }
    const data = (await response.json()) as {
      keys?: IssuedKey[];
      companies?: Company[];
      storage?: "supabase" | "file";
    };
    const nextKeys = data.keys ?? [];
    setKeys(nextKeys);
    setCompanies(data.companies ?? []);
    setStorage(data.storage === "supabase" ? "supabase" : "file");
    setSelectedCompanyId((current) => current || data.companies?.[0]?.id || "");
    setListError(null);
    return nextKeys;
  }, [copy.loadError]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await load();
      } catch {
        if (!cancelled) setListError(copy.loadError);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [copy.loadError, load]);

  useEffect(() => {
    setViewTarget((current) => {
      if (!current) return null;
      return keys.find((item) => item.key === current.key) ?? null;
    });
  }, [keys]);

  async function copyText(id: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(id);
    window.setTimeout(() => setCopied((current) => (current === id ? null : current)), 1800);
  }

  async function openCreate() {
    if (!selectedCompanyId) {
      setCreateError(copy.chooseCompany);
      setCreateOpen(true);
      return;
    }
    setCreateOpen(true);
    setCreateError(null);
    setKeyNameValue("");
    setEnvironment("live");
    setExpiration("never");
    setCatalogLoading(true);
    setCatalogChoices([]);
    setSelectedLineUuid("");
    try {
      const response = await fetch(`/api/connections/${selectedCompanyId}/catalog`, { cache: "no-store" });
      const data = (await response.json()) as { groups?: CatalogGroup[]; error?: string };
      if (!response.ok) throw new Error(data.error);
      const choices = flattenCatalog(data.groups ?? []);
      setCatalogChoices(choices);
      setSelectedLineUuid(choices[0]?.lineUuid ?? "");
      if (choices[0]) setKeyNameValue(choices[0].lineName);
      if (choices.length === 0) setCreateError(copy.noLines);
    } catch {
      setCreateError(copy.catalogError);
    } finally {
      setCatalogLoading(false);
    }
  }

  async function createKey() {
    const choice = catalogChoices.find((item) => item.lineUuid === selectedLineUuid);
    if (!selectedCompanyId || !choice) {
      setCreateError(copy.chooseCompany);
      return;
    }
    setBusy(true);
    setCreateError(null);
    const response = await fetch("/api/keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        connectionId: selectedCompanyId,
        groupUuid: choice.groupUuid,
        groupName: choice.groupName,
        lineUuid: choice.lineUuid,
        lineName: choice.lineName,
        name: keyNameValue.trim() || choice.lineName,
        environment,
        expiration: expiration === "never" ? "" : expiration,
      }),
    });
    if (!response.ok) {
      setCreateError(copy.createError);
      setBusy(false);
      return;
    }
    const issued = (await response.json()) as { key?: string };
    setCreateOpen(false);
    setCreatedSecret(issued.key ?? null);
    await load();
    setBusy(false);
  }

  async function removeKey() {
    if (!deleteTarget) return;
    setBusy(true);
    setDeleteError(null);
    const response = await fetch(`/api/keys/${deleteTarget.key}`, { method: "DELETE" });
    if (!response.ok) {
      setDeleteError(copy.deleteError);
      setBusy(false);
      return;
    }
    setDeleteTarget(null);
    setViewTarget(null);
    await load();
    setBusy(false);
  }

  async function rotateKey() {
    if (!rotateTarget) return;
    setBusy(true);
    setRotateError(null);
    const response = await fetch(`/api/keys/${rotateTarget.key}/rotate`, { method: "POST" });
    if (!response.ok) {
      setRotateError(copy.rotateError);
      setBusy(false);
      return;
    }
    const issued = (await response.json()) as IssuedKey;
    setRotateTarget(null);
    setViewTarget(null);
    setCreatedSecret(issued.key);
    await load();
    setBusy(false);
  }

  async function toggleKey() {
    if (!viewTarget) return;
    setBusy(true);
    setDrawerError(null);
    const next = viewTarget.status === "disabled" ? "active" : "disabled";
    const response = await fetch(`/api/keys/${viewTarget.key}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (!response.ok) {
      setDrawerError(copy.updateError);
      setBusy(false);
      return;
    }
    await load();
    setBusy(false);
  }

  return (
    <div className="console-page pac-page">
      <header className="pac-head">
        <div className="pac-head-top">
          <h1 className="console-title">{copy.title}</h1>
          <label className="pac-company">
            <span className="sr-only">{copy.company}</span>
            <select
              value={selectedCompanyId}
              title={companies.find((item) => item.id === selectedCompanyId)?.name}
              onChange={(event) => setSelectedCompanyId(event.target.value)}
              disabled={loading || companies.length === 0}
            >
              {companies.length === 0 ? <option value="">{copy.noCompany}</option> : null}
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <PushSubnav copy={copy} active="setup" />
      </header>

      <EndpointSection
        copy={copy}
        pushUrl={pushUrl}
        copied={copied === "url"}
        onCopy={() => void copyText("url", pushUrl)}
      />
      <p className="pac-storage">
        {storage === "supabase" ? copy.storageSupabase : copy.storageFile}
      </p>

      <ApiKeysSection
        copy={copy}
        locale={locale}
        keys={companyKeys}
        loading={loading}
        error={listError}
        onCreate={() => void openCreate()}
        onOpen={(item) => {
          setDrawerError(null);
          setViewTarget(item);
        }}
      />

      <CreateApiKeyDialog
        open={createOpen}
        copy={copy}
        busy={busy}
        error={createError}
        name={keyNameValue}
        environment={environment}
        expiration={expiration}
        choices={catalogChoices}
        selectedLineUuid={selectedLineUuid}
        catalogLoading={catalogLoading}
        onNameChange={setKeyNameValue}
        onEnvironmentChange={setEnvironment}
        onExpirationChange={setExpiration}
        onLineChange={(uuid) => {
          setSelectedLineUuid(uuid);
          const choice = catalogChoices.find((item) => item.lineUuid === uuid);
          if (choice && (!keyNameValue || catalogChoices.some((item) => item.lineName === keyNameValue))) {
            setKeyNameValue(choice.lineName);
          }
        }}
        onClose={() => setCreateOpen(false)}
        onConfirm={() => void createKey()}
      />
      <CreatedApiKeyDialog
        open={Boolean(createdSecret)}
        copy={copy}
        secret={createdSecret ?? ""}
        copied={copied === "created"}
        onCopy={() => {
          if (createdSecret) void copyText("created", createdSecret);
        }}
        onClose={() => setCreatedSecret(null)}
      />
      <ConfirmKeyDialog
        open={Boolean(deleteTarget)}
        copy={copy}
        title={copy.deleteTitle}
        body={copy.deleteBody}
        action={copy.deleteAction}
        danger
        busy={busy}
        error={deleteError}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void removeKey()}
      />
      <ConfirmKeyDialog
        open={Boolean(rotateTarget)}
        copy={copy}
        title={copy.rotateTitle}
        body={copy.rotateBody}
        action={copy.rotateAction}
        busy={busy}
        error={rotateError}
        onClose={() => setRotateTarget(null)}
        onConfirm={() => void rotateKey()}
      />
      <KeyDrawer
        open={Boolean(viewTarget)}
        copy={copy}
        locale={locale}
        target={viewTarget}
        copied={copied === viewTarget?.key}
        busy={busy}
        error={drawerError}
        onClose={() => setViewTarget(null)}
        onCopy={() => {
          if (viewTarget) void copyText(viewTarget.key, viewTarget.key);
        }}
        onRotate={() => {
          if (!viewTarget) return;
          setRotateError(null);
          setRotateTarget(viewTarget);
        }}
        onToggle={() => void toggleKey()}
        onDelete={() => {
          if (!viewTarget) return;
          setDeleteError(null);
          setDeleteTarget(viewTarget);
        }}
      />
    </div>
  );
}
