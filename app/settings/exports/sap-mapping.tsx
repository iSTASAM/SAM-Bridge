"use client";

import { useEffect, useMemo, useState } from "react";
import { buildProductionConfirmationPayload } from "@/lib/sap-confirmation";
import { SAP_COPY } from "./copy";
import { useLocale } from "../../locale-context";
import type { PublicSapConnection, SapSelectedOrder } from "./types";

export type Sample = {
  line: string;
  product: string;
  actual: string;
  timestamp: string;
};

export function sampleFrom(rows: Array<Record<string, unknown>>): Sample {
  const row = rows[0] ?? {};
  return {
    line: String(row.productionLineName ?? "").trim(),
    product: String(row.product ?? "").trim(),
    actual: String(row.actualNum ?? "").trim(),
    timestamp: String(row.bizTime ?? row.collectedAt ?? "").trim(),
  };
}

export function mappingIssues(
  copy: (typeof SAP_COPY)[keyof typeof SAP_COPY],
  order: SapSelectedOrder | null,
  sample: Sample,
  unit: string,
) {
  const issues: string[] = [];
  if (!order?.id) issues.push(copy.validateNeedOrder);
  if (!sample.actual) issues.push(copy.validateNeedActual);
  const qty = Number(sample.actual);
  if (sample.actual && (!Number.isFinite(qty) || qty <= 0)) issues.push(copy.validateNeedActualPositive);
  if (!unit.trim()) issues.push(copy.validateNeedUnit);
  if (issues.length === 0 && order?.id) {
    try {
      buildProductionConfirmationPayload({
        orderId: order.id,
        yieldQuantity: sample.actual,
        unit,
      });
    } catch {
      issues.push(copy.validateNeedPayload);
    }
  }
  return issues;
}

export function SapMappingStep({
  connection,
  order,
  unit,
  sampleRows,
  validated,
  onOrder,
  onUnit,
  onValidated,
}: {
  connection: PublicSapConnection;
  order: SapSelectedOrder | null;
  unit: string;
  sampleRows: Array<Record<string, unknown>>;
  validated: boolean;
  onOrder: (order: SapSelectedOrder | null) => void;
  onUnit: (unit: string) => void;
  onValidated: (ok: boolean) => void;
}) {
  const { locale } = useLocale();
  const copy = SAP_COPY[locale];
  const sample = useMemo(() => sampleFrom(sampleRows), [sampleRows]);
  const [query, setQuery] = useState("");
  const [orders, setOrders] = useState<SapSelectedOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<string[]>([]);

  const payload = useMemo(() => {
    if (!order?.id || !sample.actual || !unit.trim()) return null;
    try {
      return buildProductionConfirmationPayload({
        orderId: order.id,
        yieldQuantity: sample.actual,
        unit,
      });
    } catch {
      return null;
    }
  }, [order?.id, sample.actual, unit]);

  useEffect(() => {
    setIssues([]);
  }, [order?.id, unit, sample.actual]);

  useEffect(() => {
    if (order) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        setError(null);
        const response = await fetch(
          `/api/exports/sap/${connection.id}/orders?q=${encodeURIComponent(query.trim())}`,
          { cache: "no-store" },
        );
        const data = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          orders?: SapSelectedOrder[];
          error?: string;
        };
        if (cancelled) return;
        setLoading(false);
        if (!response.ok || data.ok === false) {
          setOrders([]);
          setError(data.error || copy.ordersError);
          return;
        }
        setOrders(data.orders ?? []);
      })();
    }, query ? 280 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [connection.id, copy.ordersError, order, query]);

  function validate() {
    const next = mappingIssues(copy, order, sample, unit);
    setIssues(next);
    onValidated(next.length === 0);
  }

  return (
    <section className="ew-step">
      <div className="ew-intro">
        <h2>{copy.mappingHeading}</h2>
        <p>{copy.mappingDesc}</p>
      </div>

      <div className="ew-sap-sim">
        <div className="ew-sap-sim-head">
          <p className="ew-label">{copy.confirmation}</p>
          <span className="ew-sap-badge">{copy.simulationBadge}</span>
        </div>
        <strong>{copy.simulationMode}</strong>
        <p>{copy.simulationExplain}</p>
      </div>

      <div className="ew-sap-map-block">
        <p className="ew-label">{order ? copy.selectedOrder : copy.selectOrder}</p>
        {order ? (
          <div className="ew-sap-order is-selected">
            <strong>{order.id}</strong>
            <dl>
              <div><dt>{copy.product}</dt><dd>{order.product || "—"}</dd></div>
              <div><dt>{copy.plant}</dt><dd>{order.plant || "—"}</dd></div>
            </dl>
            <p className="ew-sap-status is-on">
              <i />
              {copy.reviewSandbox}
            </p>
            <small className="machine-help">{copy.realSapData}</small>
            <button
              type="button"
              className="ew-text-btn"
              onClick={() => {
                onOrder(null);
                onValidated(false);
              }}
            >
              {copy.changeOrder}
            </button>
          </div>
        ) : (
          <>
            <input
              className="machine-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={copy.searchOrder}
              autoComplete="off"
            />
            {loading ? <p className="ew-muted">{copy.loadingOrders}</p> : null}
            {error ? <p className="ew-sap-result is-bad">{error}</p> : null}
            {!loading && !error && orders.length === 0 ? <p className="ew-muted">{copy.noOrders}</p> : null}
            <ul className="ew-sap-orders">
              {orders.map((item) => (
                <li key={item.id}>
                  <div className="ew-sap-order">
                    <strong>{item.id}</strong>
                    <dl>
                      <div><dt>{copy.product}</dt><dd>{item.product || "—"}</dd></div>
                      <div><dt>{copy.plant}</dt><dd>{item.plant || "—"}</dd></div>
                      <div><dt>{copy.plannedQty}</dt><dd>{item.plannedQty ? `${item.plannedQty} ${item.unit}` : "—"}</dd></div>
                    </dl>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        onOrder(item);
                        onUnit(item.unit || "PC");
                        onValidated(false);
                      }}
                    >
                      {copy.useOrder}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {order ? (
        <>
          <div className="ew-sap-map-block">
            <p className="ew-label">{copy.productionMapping}</p>
            <div className="ew-sap-map-head">
              <span>{copy.ixacs}</span>
              <span>{copy.sap}</span>
            </div>
            <ul className="ew-sap-map">
              <li className="is-primary">
                <span>
                  <strong>{copy.actualNum}</strong>
                  <small>{sample.actual || "—"}</small>
                </span>
                <i>→</i>
                <strong>{copy.yieldQty}</strong>
              </li>
              <li>
                <span>
                  <strong>{copy.product}</strong>
                  <small>{sample.product || "—"}</small>
                </span>
                <i>→</i>
                <strong>{copy.productRef}</strong>
              </li>
              <li>
                <span>
                  <strong>{copy.productionLine}</strong>
                  <small>{sample.line || "—"}</small>
                </span>
                <i>→</i>
                <strong>{copy.lineMap}</strong>
              </li>
              <li>
                <span>
                  <strong>{copy.timestamp}</strong>
                  <small>{sample.timestamp || "—"}</small>
                </span>
                <i>→</i>
                <strong>{copy.confirmationTime}</strong>
              </li>
            </ul>
            <label className="ew-field">
              <span className="ew-label">{copy.productionUnit}</span>
              <input
                className="machine-input"
                value={unit}
                onChange={(event) => {
                  onUnit(event.target.value.toUpperCase());
                  onValidated(false);
                }}
                autoComplete="off"
              />
            </label>
            <p className="ew-sap-bridge">
              iXacs Actual Num
              <br />↓
              <br />
              SAP ConfirmationYieldQuantity
            </p>
          </div>

          <div className="ew-sap-map-block">
            <div className="ew-sap-sim-head">
              <p className="ew-label">{copy.payloadHeading}</p>
              <span className="ew-sap-badge">{copy.payloadSub}</span>
            </div>
            <pre className="ew-sap-payload">{payload ? JSON.stringify(payload, null, 2) : "—"}</pre>
          </div>
        </>
      ) : null}

      {issues.length ? (
        <div className="ew-sap-result is-bad">
          {issues.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      ) : null}
      {validated ? (
        <div className="ew-sap-result is-ok">
          <strong>✓ {copy.validated}</strong>
          <span>{copy.validatedReady}</span>
        </div>
      ) : null}

      <div className="ew-sap-actions">
        <button type="button" className="btn btn-secondary" onClick={() => validate()}>
          {copy.validate}
        </button>
      </div>
    </section>
  );
}
