export type SlackMessage = {
  text: string;
  blocks?: Array<Record<string, unknown>>;
  attachments?: Array<Record<string, unknown>>;
};

export function isSlackWebhookUrl(value: string) {
  try {
    const url = new URL(value);
    const allowedHost =
      url.hostname === "hooks.slack.com" || url.hostname === "hooks.slack-gov.com";
    return (
      url.protocol === "https:" &&
      allowedHost &&
      !url.username &&
      !url.password &&
      !url.port &&
      url.pathname.startsWith("/services/")
    );
  } catch {
    return false;
  }
}

export async function postSlackWebhook(webhookUrl: string, message: SlackMessage) {
  if (!isSlackWebhookUrl(webhookUrl)) {
    throw new Error("INVALID_SLACK_WEBHOOK_URL");
  }

  let response: Response;
  try {
    response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify(message),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new Error("SLACK_TIMEOUT");
    }
    throw new Error("SLACK_UNREACHABLE");
  }

  const responseText = (await response.text()).trim();
  if (!response.ok || responseText !== "ok") {
    const safeError = /^[a-z0-9_ -]{1,120}$/i.test(responseText)
      ? responseText
      : `HTTP_${response.status}`;
    throw new Error(`SLACK_${safeError.toUpperCase().replaceAll(" ", "_")}`);
  }
}

export async function slackApi(
  botToken: string,
  method: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string; [key: string]: unknown }> {
  const response = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${botToken}`,
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const result = await response.json().catch(() => ({ ok: false, error: `HTTP_${response.status}` })) as {
    ok: boolean;
    error?: string;
    [key: string]: unknown;
  };
  if (!response.ok && !result.error) result.error = `HTTP_${response.status}`;
  return result;
}
