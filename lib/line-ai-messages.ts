import type {
  ProductionAiPresentation,
  ProductionAiReplyLocale,
} from "@/lib/production-ai-chat";

type LineMessage = Record<string, unknown>;

const LABELS = {
  th: {
    analysis: "SAM AI · วิเคราะห์การผลิต",
    trend: "SAM AI · วิเคราะห์แนวโน้ม",
    pareto: "Lost Time · Pareto",
    period: "ช่วงข้อมูล",
    lines: "ไลน์",
    total: "Lost Time รวม",
    minutes: "นาที",
    cumulative: "สะสม",
    occurrences: "ครั้ง",
    partial: "ข้อมูลบางส่วน",
    noLostTime: "ไม่พบ Lost Time ในช่วงที่เลือก",
  },
  en: {
    analysis: "SAM AI · Production analysis",
    trend: "SAM AI · Trend analysis",
    pareto: "Lost Time · Pareto",
    period: "Period",
    lines: "lines",
    total: "Total Lost Time",
    minutes: "min",
    cumulative: "cumulative",
    occurrences: "occurrences",
    partial: "Partial data",
    noLostTime: "No Lost Time found in the selected period",
  },
  ja: {
    analysis: "SAM AI · 生産分析",
    trend: "SAM AI · トレンド分析",
    pareto: "ロスタイム · パレート",
    period: "期間",
    lines: "ライン",
    total: "ロスタイム合計",
    minutes: "分",
    cumulative: "累積",
    occurrences: "回",
    partial: "一部データ",
    noLostTime: "選択期間にロスタイムはありません",
  },
} as const;

function cleanAiText(value: string, limit: number) {
  const plain = value
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return plain.length > limit ? `${plain.slice(0, Math.max(0, limit - 1)).trimEnd()}…` : plain;
}

function periodLabel(dateFrom: string, dateTo: string) {
  const display = (value: string) => {
    const [year, month, day] = value.split("-");
    return year && month && day ? `${day}/${month}/${year}` : value;
  };
  return dateFrom === dateTo ? display(dateFrom) : `${display(dateFrom)} – ${display(dateTo)}`;
}

function number(value: number, maximumFractionDigits = 1) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(value);
}

function header(title: string, subtitle: string, accent: string) {
  return {
    type: "box",
    layout: "vertical",
    backgroundColor: "#071B33",
    paddingAll: "18px",
    spacing: "sm",
    contents: [
      { type: "text", text: "SAM BRIDGE", color: "#67C8FF", weight: "bold", size: "xs" },
      { type: "text", text: title, color: "#FFFFFF", weight: "bold", size: "xl", wrap: true },
      { type: "text", text: subtitle, color: accent, size: "xs", wrap: true },
    ],
  };
}

function answerCard(answer: string, presentation: Exclude<ProductionAiPresentation, { kind: "lost_time_pareto" }>): LineMessage {
  const copy = LABELS[presentation.locale];
  const title = presentation.kind === "trend_card" ? copy.trend : copy.analysis;
  const period = periodLabel(presentation.dateFrom, presentation.dateTo);
  return {
    type: "flex",
    altText: cleanAiText(answer, 350) || title,
    contents: {
      type: "bubble",
      size: "mega",
      header: header(title, `${copy.period} ${period}`, "#9FD7FF"),
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "18px",
        spacing: "md",
        contents: [
          { type: "text", text: cleanAiText(answer, 3_500), color: "#172033", size: "sm", wrap: true },
          { type: "separator", color: "#DFE7F0" },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: `${presentation.lineCount} ${copy.lines}`, color: "#5B6B7D", size: "xs", flex: 1 },
              ...(!presentation.dataComplete
                ? [{ type: "text", text: copy.partial, color: "#B54708", size: "xs", align: "end" }]
                : []),
            ],
          },
        ],
      },
    },
  };
}

function paretoRow(
  item: Extract<ProductionAiPresentation, { kind: "lost_time_pareto" }>["items"][number],
  maxMinutes: number,
  locale: ProductionAiReplyLocale,
) {
  const copy = LABELS[locale];
  const width = `${Math.max(4, Math.min(100, maxMinutes > 0 ? item.minutes / maxMinutes * 100 : 4)).toFixed(1)}%`;
  const barColor = item.cumulativePercent <= 80 ? "#1687E8" : "#8FA3B8";
  return {
    type: "box",
    layout: "vertical",
    spacing: "xs",
    contents: [
      {
        type: "box",
        layout: "horizontal",
        spacing: "sm",
        contents: [
          { type: "text", text: `${item.rank}. ${item.cause}`.slice(0, 55), color: "#172033", size: "xs", weight: "bold", wrap: true, flex: 5 },
          { type: "text", text: `${number(item.minutes)} ${copy.minutes}`, color: "#172033", size: "xs", align: "end", flex: 2 },
        ],
      },
      {
        type: "box",
        layout: "vertical",
        height: "8px",
        backgroundColor: "#E8EEF5",
        cornerRadius: "4px",
        contents: [{
          type: "box",
          layout: "vertical",
          width,
          height: "8px",
          backgroundColor: barColor,
          cornerRadius: "4px",
          contents: [{ type: "filler" }],
        }],
      },
      {
        type: "text",
        text: `${number(item.percent)}% · ${copy.cumulative} ${number(item.cumulativePercent)}% · ${number(item.occurrences, 0)} ${copy.occurrences}`,
        color: item.cumulativePercent <= 80 ? "#0B6FC2" : "#6A7888",
        size: "xxs",
      },
    ],
  };
}

function paretoCard(answer: string, presentation: Extract<ProductionAiPresentation, { kind: "lost_time_pareto" }>): LineMessage {
  const copy = LABELS[presentation.locale];
  const period = periodLabel(presentation.dateFrom, presentation.dateTo);
  const maxMinutes = Math.max(0, ...presentation.items.map((item) => item.minutes));
  const rows = presentation.items.length
    ? presentation.items.map((item) => paretoRow(item, maxMinutes, presentation.locale))
    : [{ type: "text", text: copy.noLostTime, color: "#6A7888", size: "sm", wrap: true }];
  return {
    type: "flex",
    altText: `${copy.pareto}: ${number(presentation.totalLostTimeMinutes)} ${copy.minutes}`,
    contents: {
      type: "bubble",
      size: "mega",
      header: header(copy.pareto, `${copy.period} ${period}`, "#FFCB66"),
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "18px",
        spacing: "lg",
        contents: [
          {
            type: "box",
            layout: "vertical",
            backgroundColor: "#FFF5DE",
            cornerRadius: "10px",
            paddingAll: "12px",
            contents: [
              { type: "text", text: copy.total, color: "#7A5200", size: "xs" },
              { type: "text", text: `${number(presentation.totalLostTimeMinutes)} ${copy.minutes}`, color: "#5C3D00", size: "xl", weight: "bold" },
            ],
          },
          ...rows,
          { type: "separator", color: "#DFE7F0" },
          { type: "text", text: cleanAiText(answer, 1_200), color: "#344459", size: "xs", wrap: true },
          ...(!presentation.dataComplete
            ? [{ type: "text", text: copy.partial, color: "#B54708", size: "xxs", weight: "bold" }]
            : []),
        ],
      },
    },
  };
}

export function buildLineAiMessages(result: {
  answer: string;
  presentation: ProductionAiPresentation;
}): LineMessage[] {
  return [result.presentation.kind === "lost_time_pareto"
    ? paretoCard(result.answer, result.presentation)
    : answerCard(result.answer, result.presentation)];
}
