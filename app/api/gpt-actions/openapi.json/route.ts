function publicOrigin(request: Request) {
  const headers = request.headers;
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  const protocol = headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
  return host ? `${protocol}://${host}` : new URL(request.url).origin;
}

const dateParameters = [
  {
    name: "mode",
    in: "query",
    required: false,
    description: "Requested period type. day returns one business date; range is inclusive; month/year aggregate all elapsed dates in that calendar period. Multi-day responses are period totals, not daily time series.",
    schema: { type: "string", enum: ["day", "range", "month", "year"], default: "day" },
  },
  {
    name: "date",
    in: "query",
    required: false,
    description: "Real date in YYYY-MM-DD when mode=day. Defaults to today's Asia/Bangkok business date when omitted. Future dates are rejected.",
    schema: { type: "string", format: "date" },
  },
  {
    name: "from",
    in: "query",
    required: false,
    description: "Inclusive real start date in YYYY-MM-DD. Required when mode=range.",
    schema: { type: "string", format: "date" },
  },
  {
    name: "to",
    in: "query",
    required: false,
    description: "Inclusive real end date in YYYY-MM-DD. Required when mode=range and cannot be in the future. A range can contain at most 366 dates.",
    schema: { type: "string", format: "date" },
  },
  {
    name: "month",
    in: "query",
    required: false,
    description: "Real month in YYYY-MM from year 2000 onward. Required when mode=month. For the current month, future dates are excluded and reported in period.futureDatesExcluded.",
    schema: { type: "string", pattern: "^\\d{4}-\\d{2}$" },
  },
  {
    name: "year",
    in: "query",
    required: false,
    description: "Year in YYYY from 2000 onward. Required when mode=year. For the current year, future dates are excluded and reported in period.futureDatesExcluded.",
    schema: { type: "string", pattern: "^\\d{4}$" },
  },
];

const productionLineParameters = [
  {
    name: "lineName",
    in: "query",
    required: false,
    description: "Production line name or a distinctive part of it, for example TV2 Fork No.1. Use this to keep the response focused and compact.",
    schema: { type: "string" },
  },
  {
    name: "lineId",
    in: "query",
    required: false,
    description: "Exact production line UUID when known. Prefer lineName when the user provides a human-readable line name.",
    schema: { type: "string" },
  },
];

function companyParameter() {
  return {
    name: "companyId",
    in: "query",
    required: true,
    description: "iXacs company connection ID. Call listCompanies first when the ID is not already known.",
    schema: { type: "string" },
  };
}

export async function GET(request: Request) {
  const origin = publicOrigin(request);
  return Response.json({
    openapi: "3.1.0",
    info: {
      title: "iXacs Production Analytics",
      version: "1.1.0",
      description: "Read the same iXacs production and lost-time datasets shown on the settings data pages. Dates follow the Asia/Bangkok business timezone. Multi-day calls return aggregates over the complete effective period and explicitly identify their period-total granularity.",
    },
    servers: [{ url: origin }],
    paths: {
      "/api/gpt-actions/companies": {
        get: {
          operationId: "listCompanies",
          summary: "List iXacs companies available to this GPT",
          description: "Use this before analytics calls when the user has not supplied a company ID.",
          responses: {
            "200": { description: "Company list", content: { "application/json": { schema: { $ref: "#/components/schemas/CompaniesResponse" } } } },
            "401": { description: "Invalid API key" },
          },
        },
      },
      "/api/gpt-actions/data": {
        get: {
          operationId: "getProductionData",
          summary: "Get daily or historical iXacs production data",
          description: "Production metrics from the same pipeline as the settings data page. Use lineName or lineId to filter. Multi-day results are totals for the inclusive period, not daily observations. For daily trends, call mode=day separately for each date.",
          parameters: [companyParameter(), ...productionLineParameters, ...dateParameters],
          responses: {
            "200": { description: "Production data", content: { "application/json": { schema: { $ref: "#/components/schemas/ProductionDataResponse" } } } },
            "400": { description: "Invalid date selection" },
            "401": { description: "Invalid API key" },
            "403": { description: "Company is not allowed" },
            "404": { description: "Company or production line not found" },
          },
        },
      },
      "/api/gpt-actions/lost-time": {
        get: {
          operationId: "getLostTime",
          summary: "Get daily or historical iXacs lost-time data",
          description: "Lost Time totals from the same pipeline as the settings Lost Time page, including minutes, occurrences, Pareto causes, and line comparisons. Multi-day results are period totals. For daily trends, call mode=day for each date. Timeline events are unavailable.",
          parameters: [companyParameter(), ...productionLineParameters, ...dateParameters],
          responses: {
            "200": { description: "Lost-time data", content: { "application/json": { schema: { $ref: "#/components/schemas/LostTimeResponse" } } } },
            "400": { description: "Invalid date selection" },
            "401": { description: "Invalid API key" },
            "403": { description: "Company is not allowed" },
            "404": { description: "Company or production line not found" },
          },
        },
      },
    },
    components: {
      schemas: {
        Company: {
          type: "object",
          properties: {
            id: { type: "string", description: "iXacs company connection ID" },
            name: { type: "string", description: "Company display name" },
            lastOkAt: { type: ["string", "null"], format: "date-time" },
          },
          required: ["id", "name"],
        },
        CompaniesResponse: {
          type: "object",
          properties: {
            ok: { type: "boolean" },
            count: { type: "integer" },
            companies: { type: "array", items: { $ref: "#/components/schemas/Company" } },
          },
          required: ["ok", "count", "companies"],
        },
        AnalysisPeriod: {
          type: "object",
          description: "Requested and effective inclusive business-date period. Metrics in the response aggregate the effective period as a whole.",
          properties: {
            mode: { type: "string", enum: ["day", "range", "month", "year"] },
            timezone: { type: "string", const: "Asia/Bangkok" },
            requestedDateFrom: { type: "string", format: "date" },
            requestedDateTo: { type: "string", format: "date" },
            dateFrom: { type: "string", format: "date", description: "First included business date" },
            dateTo: { type: "string", format: "date", description: "Last included business date" },
            dateCount: { type: "integer", minimum: 1, maximum: 366 },
            futureDatesExcluded: { type: "boolean" },
            granularity: { type: "string", const: "period-total" },
          },
          required: ["mode", "timezone", "requestedDateFrom", "requestedDateTo", "dateFrom", "dateTo", "dateCount", "futureDatesExcluded", "granularity"],
        },
        ProductionRow: {
          type: "object",
          description: "Production metrics for one iXacs production line. Extra iXacs metrics may also be present.",
          properties: {
            uuid: { type: "string" },
            productionGroupUuid: { type: ["string", "null"] },
            productionGroupName: { type: ["string", "null"] },
            productionLineName: { type: ["string", "null"] },
            currentCt: { type: ["string", "number", "null"], description: "Current cycle time" },
            bizTime: { type: ["string", "number", "null"] },
            statusUuid: { type: ["string", "null"] },
            statusName: { type: ["string", "null"] },
            product: { type: ["string", "null"] },
            productUuid: { type: ["string", "null"] },
            planNum: { type: ["string", "number", "null"] },
            actualNum: { type: ["string", "number", "null"] },
            averageCt: { type: ["string", "number", "null"] },
            baseCt: { type: ["string", "number", "null"] },
            pcsPerHour: { type: ["string", "number", "null"] },
            volumeRate: { type: ["string", "number", "null"] },
            operationalAvailability: { type: ["string", "number", "null"] },
            operatingTime: { type: ["string", "number", "null"] },
            stopTime: { type: ["string", "number", "null"] },
            achievementPercent: { type: ["number", "null"] },
          },
          required: ["uuid"],
          additionalProperties: true,
        },
        ProductionLine: {
          type: "object",
          properties: {
            uuid: { type: "string" },
            name: { type: "string" },
          },
          required: ["uuid", "name"],
        },
        ProductionGroup: {
          type: "object",
          properties: {
            uuid: { type: "string" },
            name: { type: "string" },
            lines: { type: "array", items: { $ref: "#/components/schemas/ProductionLine" } },
          },
          required: ["uuid", "name", "lines"],
        },
        ProductionStatus: {
          type: "object",
          properties: {
            uuid: { type: "string" },
            name: { type: "string" },
            backgroundColor: { type: ["string", "null"] },
            textColor: { type: ["string", "null"] },
          },
          required: ["uuid", "name"],
        },
        ProductionDataResponse: {
          type: "object",
          properties: {
            ok: { type: "boolean" },
            source: { type: "string" },
            companyId: { type: "string" },
            companyName: { type: "string" },
            period: { $ref: "#/components/schemas/AnalysisPeriod" },
            mode: { type: "string", enum: ["realtime", "historical"] },
            date: { type: "string", format: "date" },
            dateFrom: { type: "string", format: "date" },
            dateTo: { type: ["string", "null"], format: "date" },
            dateCount: { type: "integer" },
            receivedAt: { type: "string", format: "date-time" },
            requestedLineId: { type: ["string", "null"] },
            requestedLineName: { type: ["string", "null"] },
            matchedLineCount: { type: "integer" },
            returnedLineCount: { type: "integer" },
            truncated: { type: "boolean" },
            summary: {
              type: "object",
              properties: {
                totalPlan: { type: "number" },
                totalActual: { type: "number" },
                achievementPercent: { type: ["number", "null"] },
              },
              required: ["totalPlan", "totalActual", "achievementPercent"],
            },
            units: {
              type: "object",
              description: "Units for numeric-looking iXacs fields. Raw row values can be strings or numbers.",
              additionalProperties: { type: "string" },
            },
            coverage: {
              type: ["object", "null"],
              description: "Line coverage reported by the production endpoints. complete=false means totals are incomplete.",
              additionalProperties: true,
            },
            warnings: { type: "array", items: { type: "string" } },
            rows: { type: "array", items: { $ref: "#/components/schemas/ProductionRow" } },
          },
          required: ["ok", "source", "companyId", "companyName", "period", "mode", "dateFrom", "dateTo", "dateCount", "matchedLineCount", "returnedLineCount", "truncated", "summary", "units", "warnings", "rows"],
          additionalProperties: true,
        },
        LostTimeSummary: {
          type: "object",
          properties: {
            totalLostTimeMinutes: { type: "number" },
            causeCount: { type: "integer" },
            eventCount: { type: "integer" },
            note: { type: "string" },
          },
          required: ["totalLostTimeMinutes", "causeCount", "eventCount", "note"],
        },
        ParetoCause: {
          type: "object",
          properties: {
            rank: { type: "integer" },
            key: { type: "string" },
            cause: { type: "string" },
            status: { type: "string" },
            minutes: { type: "number" },
            occurrences: { type: "number" },
            percent: { type: "number" },
            cumulativePercent: { type: "number" },
            linesAffected: { type: "integer" },
          },
          required: ["rank", "cause", "minutes", "occurrences", "percent", "cumulativePercent", "linesAffected"],
        },
        LineCause: {
          type: "object",
          properties: {
            cause: { type: "string" },
            minutes: { type: "number" },
            occurrences: { type: "number" },
          },
          required: ["cause", "minutes", "occurrences"],
        },
        LostTimeLineSummary: {
          type: "object",
          properties: {
            productionLineId: { type: "string" },
            productionLineName: { type: "string" },
            productionGroupName: { type: "string" },
            totalLostTimeMinutes: { type: "number" },
            topCauses: { type: "array", items: { $ref: "#/components/schemas/LineCause" } },
          },
          required: ["productionLineId", "productionLineName", "totalLostTimeMinutes", "topCauses"],
        },
        LostTimeDataQuality: {
          type: "object",
          properties: {
            complete: { type: "boolean" },
            failedRequestCount: { type: "number" },
            cachedLineCount: { type: "number" },
            fetchedLineCount: { type: "number" },
          },
          required: ["complete", "failedRequestCount", "cachedLineCount", "fetchedLineCount"],
        },
        LostTimeResponse: {
          type: "object",
          properties: {
            ok: { type: "boolean" },
            source: { type: "string" },
            companyId: { type: "string" },
            companyName: { type: "string" },
            period: { $ref: "#/components/schemas/AnalysisPeriod" },
            dateFrom: { type: "string", format: "date" },
            dateTo: { type: ["string", "null"], format: "date" },
            dateCount: { type: "integer", description: "Number of business dates included in this aggregate" },
            sourceLineCount: { type: "integer" },
            matchedLineCount: { type: "integer" },
            returnedLineCount: { type: "integer" },
            requestedLineId: { type: ["string", "null"] },
            requestedLineName: { type: ["string", "null"] },
            summary: { $ref: "#/components/schemas/LostTimeSummary" },
            units: { type: "object", additionalProperties: { type: "string" } },
            dataQuality: { $ref: "#/components/schemas/LostTimeDataQuality" },
            warnings: { type: "array", items: { type: "string" } },
            pareto: { type: "array", items: { $ref: "#/components/schemas/ParetoCause" } },
            lines: { type: "array", items: { $ref: "#/components/schemas/LostTimeLineSummary" } },
          },
          required: ["ok", "source", "companyId", "companyName", "period", "dateFrom", "dateTo", "dateCount", "sourceLineCount", "matchedLineCount", "returnedLineCount", "summary", "units", "dataQuality", "warnings", "pareto", "lines"],
        },
      },
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "API key" },
      },
    },
    security: [{ bearerAuth: [] }],
  }, {
    headers: { "cache-control": "no-store" },
  });
}
