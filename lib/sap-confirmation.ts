export type ConfirmationPayload = {
  OrderID: string;
  ConfirmationUnit: string;
  ConfirmationUnitISOCode: string;
  ConfirmationYieldQuantity: string;
  APIConfHasNoGoodsMovements: true;
};

export type ConfirmationInput = {
  orderId: string;
  yieldQuantity: string;
  unit: string;
};

export type ConfirmationSubmitResult = {
  mode: "simulation" | "sap";
  executed: boolean;
  transactionId: string;
  payload: ConfirmationPayload;
  validation: "passed";
};

export type SapTransportConfig = {
  confirmationServiceUrl: string;
  authentication: { type: "api-key" };
  environment: "dev" | "qas" | "production";
};

const UNIT_ISO: Record<string, string> = {
  PC: "PCE",
  PCE: "PCE",
  ST: "PCE",
  EA: "EA",
  KG: "KGM",
  G: "GRM",
  M: "MTR",
  L: "LTR",
};

export function confirmationUnitIso(unit: string) {
  const key = unit.trim().toUpperCase();
  return UNIT_ISO[key] || "PCE";
}

export function buildProductionConfirmationPayload(input: ConfirmationInput): ConfirmationPayload {
  const orderId = input.orderId.trim();
  const unit = (input.unit.trim() || "PC").toUpperCase();
  const yieldQuantity = String(input.yieldQuantity).trim();
  if (!orderId) throw new Error("ORDER_ID_REQUIRED");
  if (!yieldQuantity) throw new Error("YIELD_REQUIRED");
  const qty = Number(yieldQuantity);
  if (!Number.isFinite(qty) || qty <= 0) throw new Error("YIELD_INVALID");
  if (!unit) throw new Error("UNIT_REQUIRED");
  const payload: ConfirmationPayload = {
    OrderID: orderId,
    ConfirmationUnit: unit === "PCE" ? "PC" : unit,
    ConfirmationUnitISOCode: confirmationUnitIso(unit),
    ConfirmationYieldQuantity: String(qty),
    APIConfHasNoGoodsMovements: true,
  };
  JSON.stringify(payload);
  return payload;
}

export interface ProductionConfirmationTransport {
  readonly mode: "simulation" | "sap";
  submit(
    payload: ConfirmationPayload,
    transactionId: string,
  ): Promise<ConfirmationSubmitResult>;
}

export class SimulationTransport implements ProductionConfirmationTransport {
  readonly mode = "simulation" as const;

  async submit(
    payload: ConfirmationPayload,
    transactionId: string,
  ): Promise<ConfirmationSubmitResult> {
    JSON.stringify(payload);
    return {
      mode: "simulation",
      executed: false,
      transactionId,
      payload,
      validation: "passed",
    };
  }
}

export class SAPTransport implements ProductionConfirmationTransport {
  readonly mode = "sap" as const;

  constructor(private readonly _config: SapTransportConfig) {
    void this._config;
  }

  async submit(): Promise<ConfirmationSubmitResult> {
    throw new Error("SAP_TRANSPORT_NOT_CONFIGURED");
  }
}

export function getProductionConfirmationTransport(): ProductionConfirmationTransport {
  // Hub has no POST sandbox. Switch to SAPTransport when DEV/QAS URL, auth, and environment are configured.
  return new SimulationTransport();
}
