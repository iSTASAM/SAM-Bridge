"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FiMessageCircle, FiSend, FiX } from "react-icons/fi";
import { useLocale } from "../../locale-context";

type Message = { role: "user" | "assistant"; text: string; meta?: string };
type ChatProvider = "openrouter" | "gemini";
type ChatOption = { provider: ChatProvider; name: string; model: string };

const STORAGE_KEY = "sam.chat.model";

export function DataAiChat({ connectionIds, dateQuery }: { connectionIds: string[]; dateQuery: Record<string, string> }) {
  const { locale } = useLocale();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [options, setOptions] = useState<ChatOption[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [selected, setSelected] = useState("");
  const suggestions = locale === "th" ? ["ไลน์ไหน Actual ต่ำกว่า Plan", "ไลน์ไหน Current CT สูงกว่า Base CT", "สรุปประสิทธิภาพการผลิต"] : ["Which lines are below plan?", "Where is Current CT above Base CT?", "Summarize production performance"];
  const labels = locale === "th"
    ? { model: "Model", loading: "กำลังโหลดโมเดล…", empty: "เชื่อมต่อ AI API ที่ Settings > AI ก่อน", settings: "เปิด AI Models" }
    : { model: "Model", loading: "Loading models…", empty: "Connect an AI API in Settings > AI first", settings: "Open AI Models" };

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setModelsLoading(true);
    void fetch("/api/ai/models", { cache: "no-store" }).then(async (response) => {
      const data = await response.json().catch(() => ({})) as { options?: ChatOption[] };
      if (cancelled) return;
      const next = data.options ?? [];
      setOptions(next);
      const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : "";
      const chosen = next.some((item) => item.provider === stored) ? stored! : next[0]?.provider ?? "";
      setSelected(chosen);
      setModelsLoading(false);
    }).catch(() => {
      if (!cancelled) setModelsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const selectedOption = options.find((item) => item.provider === selected) ?? null;

  function chooseModel(value: string) {
    setSelected(value);
    window.localStorage.setItem(STORAGE_KEY, value);
  }

  async function ask(value = question) {
    const text = value.trim();
    if (!text || loading || !selectedOption) return;
    setQuestion("");
    setError("");
    setMessages((current) => [...current, { role: "user", text }]);
    setLoading(true);
    const history = messages.slice(-8).map(({ role, text: messageText }) => ({ role, text: messageText }));
    const response = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question: text,
        connectionIds,
        dateQuery,
        history,
        provider: selectedOption.provider,
      }),
    });
    const data = await response.json().catch(() => ({})) as { answer?: string; error?: string; model?: string; lineCount?: number; documentCount?: number; dateFrom?: string; dateTo?: string };
    setLoading(false);
    if (!response.ok || !data.answer) { setError(data.error || "AI request failed"); return; }
    setMessages((current) => [...current, { role: "assistant", text: data.answer!, meta: `${data.model} · ${data.lineCount} lines · ${data.documentCount ?? 0} files · ${data.dateFrom}${data.dateTo !== data.dateFrom ? ` → ${data.dateTo}` : ""}` }]);
  }

  return <>
    <button type="button" className="dx-ai-fab" onClick={() => setOpen(true)} aria-label="Production AI"><FiMessageCircle size={20} /><span>Production AI</span></button>
    {open ? <aside className="dx-ai-panel" aria-label="Production AI chat">
      <header>
        <div>
          <strong>Production AI</strong>
          <span>{locale === "th" ? "ค้นหาจากข้อมูล iXacs ที่เลือกอยู่" : "Search the selected iXacs production data"}</span>
        </div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close"><FiX size={18} /></button>
      </header>
      <div className="dx-ai-modelbar">
        {modelsLoading ? <p className="dx-ai-model-hint">{labels.loading}</p> : null}
        {!modelsLoading && !options.length ? (
          <p className="dx-ai-model-hint">{labels.empty} <Link href="/settings/ai">{labels.settings}</Link></p>
        ) : null}
        {!modelsLoading && options.length ? (
          <label>
            <span>{labels.model}</span>
            <select value={selected} onChange={(event) => chooseModel(event.target.value)}>
              {options.map((item) => (
                <option key={item.provider} value={item.provider}>
                  {item.name} · {item.model}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <div className="dx-ai-messages">
        {!messages.length ? <div className="dx-ai-welcome"><FiMessageCircle size={24} /><strong>{locale === "th" ? "ถามเกี่ยวกับข้อมูลการผลิต" : "Ask about production data"}</strong><span>{locale === "th" ? "AI จะดึงข้อมูลจริงจากบริษัทและช่วงวันที่ที่กำลังแสดง" : "AI retrieves real data for the selected companies and period"}</span>{suggestions.map((item) => <button type="button" key={item} onClick={() => void ask(item)}>{item}</button>)}</div> : null}
        {messages.map((message, index) => <div key={index} className={`dx-ai-message is-${message.role}`}><p>{message.text}</p>{message.meta ? <small>{message.meta}</small> : null}</div>)}
        {loading ? <div className="dx-ai-message is-assistant is-loading"><span className="skeleton" /><span className="skeleton" /><span className="skeleton" /></div> : null}
        {error ? <p className="dx-ai-error">{error}</p> : null}
      </div>
      <form onSubmit={(event) => { event.preventDefault(); void ask(); }}><textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={locale === "th" ? "ถาม เช่น ไลน์ไหน Actual ต่ำกว่า Plan" : "Ask about production data"} rows={2} /><button type="submit" disabled={!question.trim() || loading || !selectedOption} aria-label="Send"><FiSend size={17} /></button></form>
    </aside> : null}
  </>;
}
