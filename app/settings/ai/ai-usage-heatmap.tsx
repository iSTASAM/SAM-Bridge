"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "../../locale-context";
import type { AiUsageHeatmapResponse, DailyHeatmapItem } from "@/lib/ai-usage-store";

type Locale = "th" | "en" | "ja";

const MONTH_NAMES = {
  th: ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  ja: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"],
};

const WEEKDAY_NAMES = {
  th: ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  ja: ["日", "月", "火", "水", "木", "金", "土"],
};

function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

function formatCompactDate(dateStr: string, locale: Locale): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString(locale === "th" ? "th-TH" : locale === "ja" ? "ja-JP" : "en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatDateLabel(dateStr: string, locale: Locale): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString(locale === "th" ? "th-TH" : locale === "ja" ? "ja-JP" : "en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatMoney(thb: number): string {
  const value = Number(thb) || 0;
  if (value <= 0) return "฿0.00";
  if (value < 0.01) return `฿${value.toFixed(4)}`;
  return `฿${value.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Sparkline({
  values,
  kind = "line",
}: {
  values: number[];
  kind?: "line" | "bar";
}) {
  const width = 120;
  const height = 36;
  const max = Math.max(1, ...values);
  if (!values.length) {
    return <svg className="ai-usage-spark" viewBox={`0 0 ${width} ${height}`} aria-hidden="true" />;
  }

  if (kind === "bar") {
    const gap = 1.5;
    const barW = Math.max(1.5, (width - gap * (values.length - 1)) / values.length);
    return (
      <svg className="ai-usage-spark" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        {values.map((v, i) => {
          const h = Math.max(1, (v / max) * (height - 2));
          return (
            <rect
              key={i}
              x={i * (barW + gap)}
              y={height - h}
              width={barW}
              height={h}
              rx="0.5"
              className="ai-usage-spark-fill"
            />
          );
        })}
      </svg>
    );
  }

  const points = values
    .map((v, i) => {
      const x = values.length <= 1 ? 0 : (i / (values.length - 1)) * width;
      const y = height - (v / max) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg className="ai-usage-spark" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline points={points} fill="none" strokeWidth="1.5" className="ai-usage-spark-stroke" />
    </svg>
  );
}

function BarChart({
  days,
  metric,
  locale,
  hovered,
  onHover,
}: {
  days: DailyHeatmapItem[];
  metric: "spend" | "requests" | "tokens";
  locale: Locale;
  hovered: DailyHeatmapItem | null;
  onHover: (item: DailyHeatmapItem | null) => void;
}) {
  const chartDays = useMemo(() => {
    const take = Math.min(days.length, metric === "tokens" ? 30 : Math.max(days.length, 7) > 14 ? 30 : 14);
    return days.slice(-Math.min(take, days.length));
  }, [days, metric]);

  const valueOf = (d: DailyHeatmapItem) =>
    metric === "spend" ? d.costThb : metric === "tokens" ? d.tokens : d.count;

  const max = Math.max(1, ...chartDays.map(valueOf));
  const height = 180;
  const padX = 2;
  const padTop = 12;
  const padBottom = 8;
  const plotH = height - padTop - padBottom;
  const labelEvery = chartDays.length > 20 ? 5 : chartDays.length > 10 ? 2 : 1;

  return (
    <div className="ai-usage-chart">
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="ai-usage-chart-svg" role="img">
        {[0.25, 0.5, 0.75, 1].map((t) => (
          <line
            key={t}
            x1={padX}
            x2={100 - padX}
            y1={padTop + plotH * (1 - t)}
            y2={padTop + plotH * (1 - t)}
            className="ai-usage-chart-grid"
          />
        ))}
        {chartDays.map((item, i) => {
          const value = valueOf(item);
          const h = (value / max) * plotH;
          const slot = (100 - padX * 2) / Math.max(chartDays.length, 1);
          const x = padX + i * slot + slot * 0.15;
          const w = slot * 0.7;
          const y = padTop + plotH - h;
          const active = hovered?.date === item.date;
          return (
            <rect
              key={item.date}
              x={x}
              y={y}
              width={Math.max(w, 0.8)}
              height={Math.max(h, value > 0 ? 1.5 : 0)}
              rx="0.6"
              className={`ai-usage-chart-bar${active ? " is-active" : ""}`}
              onMouseEnter={() => onHover(item)}
              onMouseLeave={() => onHover(null)}
            />
          );
        })}
      </svg>
      <div className="ai-usage-chart-labels">
        {chartDays.map((item, i) =>
          i % labelEvery === 0 || i === chartDays.length - 1 ? (
            <span key={item.date} style={{ left: `${((i + 0.5) / chartDays.length) * 100}%` }}>
              {formatCompactDate(item.date, locale)}
            </span>
          ) : null,
        )}
      </div>
    </div>
  );
}

export function AiUsageHeatmap() {
  const { locale } = useLocale();
  const [days, setDays] = useState(30);
  const [metric, setMetric] = useState<"spend" | "requests" | "tokens">("spend");
  const [data, setData] = useState<AiUsageHeatmapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState<DailyHeatmapItem | null>(null);
  const [heatmapHovered, setHeatmapHovered] = useState<DailyHeatmapItem | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/ai/usage?days=${days}`)
      .then((res) => res.json())
      .then((resData: AiUsageHeatmapResponse) => {
        if (active && resData.ok) setData(resData);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [days]);

  const rangedDaily = useMemo(() => {
    const all = data?.daily ?? [];
    return all.slice(-days);
  }, [data, days]);

  const summary = data?.summary ?? null;
  const sparkSpend = useMemo(() => rangedDaily.slice(-24).map((d) => d.costThb), [rangedDaily]);
  const sparkRequests = useMemo(() => rangedDaily.slice(-24).map((d) => d.count), [rangedDaily]);
  const sparkTokens = useMemo(() => rangedDaily.slice(-24).map((d) => d.tokens), [rangedDaily]);

  const gridStructure = useMemo(() => {
    const dailyItems = data?.daily ?? [];
    if (!dailyItems.length) return { columns: [], monthLabels: [] as Array<{ monthName: string; colIndex: number }> };

    const columns: Array<{ weekIndex: number; days: Array<DailyHeatmapItem | null> }> = [];
    const monthLabels: Array<{ monthName: string; colIndex: number }> = [];
    let currentWeekDays: Array<DailyHeatmapItem | null> = [];
    let lastMonth = -1;

    const firstDate = new Date(dailyItems[0].date);
    const firstDayOfWeek = firstDate.getDay();
    for (let p = 0; p < firstDayOfWeek; p++) currentWeekDays.push(null);

    dailyItems.forEach((item) => {
      const d = new Date(item.date);
      const m = d.getMonth();
      if (m !== lastMonth) {
        monthLabels.push({ monthName: MONTH_NAMES[locale][m], colIndex: columns.length });
        lastMonth = m;
      }
      currentWeekDays.push(item);
      if (currentWeekDays.length === 7) {
        columns.push({ weekIndex: columns.length, days: currentWeekDays });
        currentWeekDays = [];
      }
    });

    if (currentWeekDays.length > 0) {
      while (currentWeekDays.length < 7) currentWeekDays.push(null);
      columns.push({ weekIndex: columns.length, days: currentWeekDays });
    }

    const filteredMonthLabels: Array<{ monthName: string; colIndex: number }> = [];
    let lastColIndex = -5;
    monthLabels.forEach((ml) => {
      if (ml.colIndex - lastColIndex >= 3) {
        filteredMonthLabels.push(ml);
        lastColIndex = ml.colIndex;
      }
    });

    return { columns, monthLabels: filteredMonthLabels };
  }, [data, locale]);

  const chartTitle =
    metric === "spend"
      ? locale === "th"
        ? "ค่าใช้จ่ายรวม (บาท)"
        : locale === "ja"
          ? "合計費用 (THB)"
          : "Total spend (THB)"
      : metric === "requests"
        ? locale === "th"
          ? "คำขอรวม"
          : locale === "ja"
            ? "総リクエスト"
            : "Total requests"
        : locale === "th"
          ? "โทเค็นรวม"
          : locale === "ja"
            ? "総トークン"
            : "Total tokens";

  const hoverValue = hovered
    ? metric === "spend"
      ? formatMoney(hovered.costThb)
      : metric === "requests"
        ? formatNumber(hovered.count)
        : formatNumber(hovered.tokens)
    : metric === "spend"
      ? formatMoney(summary?.totalCostThb ?? 0)
      : metric === "requests"
        ? formatNumber(summary?.totalRequests ?? 0)
        : formatNumber(summary?.totalTokens ?? 0);

  return (
    <div className="ai-usage">
      <div className="ai-usage-toolbar">
        <h2 className="ai-usage-title">
          {locale === "th" ? "การใช้งาน" : locale === "ja" ? "利用状況" : "Usage"}
        </h2>
        <div className="ai-usage-controls">
          <div className="ai-btn-group" role="group" aria-label="Range">
            {[
              { value: 7, label: locale === "th" ? "7 วัน" : locale === "ja" ? "7日" : "7d" },
              { value: 30, label: locale === "th" ? "30 วัน" : locale === "ja" ? "30日" : "30d" },
              { value: 90, label: locale === "th" ? "90 วัน" : locale === "ja" ? "90日" : "90d" },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`ai-pill-btn${days === opt.value ? " is-active" : ""}`}
                onClick={() => setDays(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="ai-btn-group" role="group" aria-label="Metric">
            <button
              type="button"
              className={`ai-pill-btn${metric === "spend" ? " is-active" : ""}`}
              onClick={() => setMetric("spend")}
            >
              {locale === "th" ? "บาท" : locale === "ja" ? "THB" : "THB"}
            </button>
            <button
              type="button"
              className={`ai-pill-btn${metric === "requests" ? " is-active" : ""}`}
              onClick={() => setMetric("requests")}
            >
              {locale === "th" ? "คำขอ" : locale === "ja" ? "リクエスト" : "Requests"}
            </button>
            <button
              type="button"
              className={`ai-pill-btn${metric === "tokens" ? " is-active" : ""}`}
              onClick={() => setMetric("tokens")}
            >
              Tokens
            </button>
          </div>
        </div>
      </div>

      {loading && !data ? (
        <div className="ai-heatmap-loading">
          <span className="ai-spinner" />
        </div>
      ) : (
        <>
          {!summary?.totalRequests ? (
            <p className="ai-usage-empty">
              {locale === "th"
                ? "ยังไม่มี usage จริง — ใช้งาน AI บน Web / LINE / Slack แล้วข้อมูลจะถูกบันทึกอัตโนมัติ"
                : locale === "ja"
                  ? "まだ実利用データがありません。Web / LINE / Slack で AI を使うと自動記録されます。"
                  : "No live usage yet — Web / LINE / Slack AI requests are logged automatically."}
            </p>
          ) : null}

          <section className="ai-usage-summary-grid">
            <article className="ai-usage-summary-card">
              <span>{locale === "th" ? "ค่าใช้จ่ายรวม" : locale === "ja" ? "合計費用" : "Total spend"}</span>
              <strong>{formatMoney(summary?.totalCostThb ?? 0)}</strong>
            </article>
            <article className="ai-usage-summary-card">
              <span>{locale === "th" ? "คำขอรวม" : locale === "ja" ? "総リクエスト" : "Total requests"}</span>
              <strong>{formatNumber(summary?.totalRequests ?? 0)}</strong>
            </article>
            <article className="ai-usage-summary-card">
              <span>{locale === "th" ? "ผู้ใช้ที่ไม่ซ้ำ" : locale === "ja" ? "ユニークユーザー" : "Unique users"}</span>
              <strong>{formatNumber(summary?.uniqueUsers ?? 0)}</strong>
            </article>
            <article className="ai-usage-summary-card is-channel">
              <span>Web</span>
              <strong>{formatNumber(summary?.byChannel?.web ?? 0)}</strong>
            </article>
            <article className="ai-usage-summary-card is-channel">
              <span>LINE</span>
              <strong>{formatNumber(summary?.byChannel?.line ?? 0)}</strong>
            </article>
            <article className="ai-usage-summary-card is-channel">
              <span>Slack</span>
              <strong>{formatNumber(summary?.byChannel?.slack ?? 0)}</strong>
            </article>
          </section>

          <div className="ai-usage-layout">
            <section className="ai-usage-main">
              <div className="ai-usage-main-head">
                <div>
                  <p className="ai-usage-kicker">{chartTitle}</p>
                  <p className="ai-usage-figure">
                    {hoverValue}
                    {hovered ? (
                      <span className="ai-usage-figure-sub"> · {formatCompactDate(hovered.date, locale)}</span>
                    ) : null}
                  </p>
                </div>
              </div>
              <BarChart
                days={rangedDaily}
                metric={metric}
                locale={locale}
                hovered={hovered}
                onHover={setHovered}
              />
            </section>

            <aside className="ai-usage-aside">
              <div className="ai-usage-metric">
                <div className="ai-usage-metric-top">
                  <span>{locale === "th" ? "ค่าใช้จ่ายรวม (บาท)" : locale === "ja" ? "合計費用 (THB)" : "Total spend (THB)"}</span>
                  <strong>{formatMoney(summary?.totalCostThb ?? 0)}</strong>
                </div>
                <Sparkline values={sparkSpend} kind="line" />
              </div>

              <div className="ai-usage-metric">
                <div className="ai-usage-metric-top">
                  <span>{locale === "th" ? "โทเค็นรวม" : locale === "ja" ? "総トークン" : "Total tokens"}</span>
                  <strong>{formatNumber(summary?.totalTokens ?? 0)}</strong>
                </div>
                <Sparkline values={sparkTokens} kind="line" />
              </div>

              <div className="ai-usage-metric">
                <div className="ai-usage-metric-top">
                  <span>{locale === "th" ? "คำขอรวม" : locale === "ja" ? "総リクエスト" : "Total requests"}</span>
                  <strong>{formatNumber(summary?.totalRequests ?? 0)}</strong>
                </div>
                <Sparkline values={sparkRequests} kind="bar" />
              </div>

              <div className="ai-usage-entities">
                <div className="ai-usage-entities-head">
                  {locale === "th" ? "แยกตาม Model" : locale === "ja" ? "モデル別" : "By model"}
                </div>
                {(data?.models ?? []).length ? (
                  <ul>
                    {(data?.models ?? []).slice(0, 8).map((model) => (
                      <li key={`${model.providerId}-${model.model}`}>
                        <span title={model.name}>{model.name}</span>
                        <em>{formatMoney(model.costThb)}</em>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="ai-usage-entities-empty">—</p>
                )}
              </div>
            </aside>
          </div>

          <section className="ai-heatmap-card">
            <div className="ai-heatmap-card-head">
              <h3>Activity Heatmap</h3>
            </div>

            <div className="ai-heatmap-scroll">
              <div className="ai-heatmap-grid-container">
                <div className="ai-heatmap-months-row">
                  <div className="ai-heatmap-weekday-corner" />
                  <div className="ai-heatmap-months-track">
                    {gridStructure.monthLabels.map((m, idx) => (
                      <span
                        key={`${m.monthName}-${idx}`}
                        className="ai-heatmap-month-label"
                        style={{ gridColumnStart: m.colIndex + 1 }}
                      >
                        {m.monthName}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="ai-heatmap-body">
                  <div className="ai-heatmap-weekdays-col">
                    <span>{WEEKDAY_NAMES[locale][1]}</span>
                    <span className="is-spacer" />
                    <span>{WEEKDAY_NAMES[locale][3]}</span>
                    <span className="is-spacer" />
                    <span>{WEEKDAY_NAMES[locale][5]}</span>
                    <span className="is-spacer" />
                  </div>

                  <div className="ai-heatmap-columns">
                    {gridStructure.columns.map((col) => (
                      <div key={col.weekIndex} className="ai-heatmap-col">
                        {col.days.map((item, dIdx) => {
                          if (!item) {
                            return <div key={`empty-${col.weekIndex}-${dIdx}`} className="ai-heatmap-cell is-empty" />;
                          }
                          return (
                            <div
                              key={item.date}
                              className="ai-heatmap-cell"
                              data-level={item.level}
                              tabIndex={0}
                              onMouseEnter={() => setHeatmapHovered(item)}
                              onMouseLeave={() => setHeatmapHovered(null)}
                              onFocus={() => setHeatmapHovered(item)}
                              onBlur={() => setHeatmapHovered(null)}
                              aria-label={`${item.date}: ${item.count} requests, ${formatNumber(item.tokens)} tokens, ${formatMoney(item.costThb)}`}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="ai-heatmap-footer">
                <div className="ai-heatmap-hover-info">
                  {heatmapHovered ? (
                    <span>
                      <strong>{formatDateLabel(heatmapHovered.date, locale)}</strong>
                      {": "}
                      <em>{heatmapHovered.count.toLocaleString()}</em>{" "}
                      {locale === "th" ? "คำขอ" : locale === "ja" ? "リクエスト" : "requests"}
                      {" · "}
                      <em>{formatNumber(heatmapHovered.tokens)}</em> tokens
                      {" · "}
                      <em>{formatMoney(heatmapHovered.costThb)}</em>
                    </span>
                  ) : (
                    <span className="is-hint">
                      {locale === "th"
                        ? "วางเมาส์บนช่องเพื่อดูรายวัน"
                        : locale === "ja"
                          ? "セルにホバーして詳細を表示"
                          : "Hover a day for details"}
                    </span>
                  )}
                </div>
                <div className="ai-heatmap-legend">
                  <span>{locale === "th" ? "น้อย" : locale === "ja" ? "少" : "Less"}</span>
                  <span className="ai-heatmap-cell" data-level={0} />
                  <span className="ai-heatmap-cell" data-level={1} />
                  <span className="ai-heatmap-cell" data-level={2} />
                  <span className="ai-heatmap-cell" data-level={3} />
                  <span className="ai-heatmap-cell" data-level={4} />
                  <span>{locale === "th" ? "มาก" : locale === "ja" ? "多" : "More"}</span>
                </div>
              </div>
            </div>
          </section>

          <section className="ai-usage-models">
            <div className="ai-usage-caps-head">
              {locale === "th" ? "แยกตามช่องทาง" : locale === "ja" ? "チャネル別" : "By channel"}
            </div>
            <div className="ai-usage-cap-grid">
              {(data?.channels ?? []).length ? (
                (data?.channels ?? []).map((ch) => (
                  <article key={ch.channel} className="ai-usage-cap">
                    <header>
                      <h3>{locale === "th" ? ch.labelTh : locale === "ja" ? ch.labelJa : ch.labelEn}</h3>
                      <span>{ch.percent}%</span>
                    </header>
                    <div className="ai-progress-track">
                      <div className="ai-progress-fill" style={{ width: `${Math.max(ch.percent, 2)}%` }} />
                    </div>
                    <footer>
                      <strong>{formatMoney(ch.costThb)}</strong>
                      <span>
                        {formatNumber(ch.count)} {locale === "th" ? "คำขอ" : locale === "ja" ? "リクエスト" : "requests"}
                        {" · "}
                        {formatNumber(ch.uniqueUsers)} {locale === "th" ? "users" : "users"}
                      </span>
                    </footer>
                  </article>
                ))
              ) : (
                <p className="ai-usage-empty is-inline">—</p>
              )}
            </div>
          </section>

          <section className="ai-usage-models">
            <div className="ai-usage-caps-head">
              {locale === "th" ? "แยกตามผู้ใช้" : locale === "ja" ? "ユーザー別" : "By user"}
            </div>
            <div className="ai-usage-model-table">
              <div className="ai-usage-model-row is-head is-user">
                <span>{locale === "th" ? "ผู้ใช้" : locale === "ja" ? "ユーザー" : "User"}</span>
                <span>{locale === "th" ? "ช่องทาง" : locale === "ja" ? "チャネル" : "Channel"}</span>
                <span>{locale === "th" ? "คำขอ" : locale === "ja" ? "リクエスト" : "Requests"}</span>
                <span>Tokens</span>
                <span>{locale === "th" ? "บาท" : "THB"}</span>
              </div>
              {(data?.users ?? []).length ? (
                (data?.users ?? []).map((user) => (
                  <div key={`${user.userId}-${user.channel}`} className="ai-usage-model-row is-user">
                    <span>
                      <strong title={user.userId}>{user.userId}</strong>
                    </span>
                    <span>{user.channel}</span>
                    <span>{formatNumber(user.count)}</span>
                    <span>{formatNumber(user.tokens)}</span>
                    <span>{formatMoney(user.costThb)}</span>
                  </div>
                ))
              ) : (
                <div className="ai-usage-model-row is-empty">
                  <span>—</span>
                </div>
              )}
            </div>
          </section>

          <section className="ai-usage-models">
            <div className="ai-usage-caps-head">
              {locale === "th" ? "สรุปตาม Model" : locale === "ja" ? "モデル別サマリー" : "Model breakdown"}
            </div>
            <div className="ai-usage-model-table">
              <div className="ai-usage-model-row is-head">
                <span>Model</span>
                <span>{locale === "th" ? "คำขอ" : locale === "ja" ? "リクエスト" : "Requests"}</span>
                <span>Tokens</span>
                <span>{locale === "th" ? "บาท" : locale === "ja" ? "THB" : "THB"}</span>
              </div>
              {(data?.models ?? []).length ? (
                (data?.models ?? []).map((model) => (
                  <div key={`${model.providerId}-${model.model}`} className="ai-usage-model-row">
                    <span>
                      <strong>{model.name}</strong>
                      <small>{model.providerId}</small>
                    </span>
                    <span>{formatNumber(model.count)}</span>
                    <span>{formatNumber(model.tokens)}</span>
                    <span>{formatMoney(model.costThb)}</span>
                  </div>
                ))
              ) : (
                <div className="ai-usage-model-row is-empty">
                  <span>—</span>
                </div>
              )}
            </div>
          </section>

          <section className="ai-usage-caps">
            <div className="ai-usage-caps-head">
              {locale === "th" ? "ตามฟีเจอร์" : locale === "ja" ? "機能別" : "By capability"}
            </div>
            <div className="ai-usage-cap-grid">
              {(data?.features ?? []).length ? (
                (data?.features ?? []).map((feat) => (
                  <article key={feat.key} className="ai-usage-cap">
                    <header>
                      <h3>{locale === "th" ? feat.labelTh : locale === "ja" ? feat.labelJa : feat.labelEn}</h3>
                      <span>{feat.percent}%</span>
                    </header>
                    <div className="ai-progress-track">
                      <div className="ai-progress-fill" style={{ width: `${Math.max(feat.percent, 2)}%` }} />
                    </div>
                    <footer>
                      <strong>{formatMoney(feat.costThb)}</strong>
                      <span>
                        {formatNumber(feat.count)} {locale === "th" ? "คำขอ" : locale === "ja" ? "リクエスト" : "requests"}
                      </span>
                    </footer>
                  </article>
                ))
              ) : (
                <p className="ai-usage-empty is-inline">—</p>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
