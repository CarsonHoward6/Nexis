import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";

export type Event = APIGatewayProxyEventV2;
export type Result = APIGatewayProxyStructuredResultV2;

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type,authorization",
  "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
};

export function ok(body: unknown, status = 200): Result {
  return {
    statusCode: status,
    headers: { "content-type": "application/json", ...CORS },
    body: JSON.stringify(body),
  };
}

export function err(status: number, message: string): Result {
  return ok({ error: message }, status);
}

export function parseBody<T = unknown>(event: Event): T {
  if (!event.body) return {} as T;
  const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw Object.assign(new Error("Invalid JSON"), { status: 400 });
  }
}

export function requireAuth(event: Event): { sub: string; email?: string } {
  const claims = (event.requestContext as any)?.authorizer?.jwt?.claims;
  if (!claims?.sub) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  return { sub: String(claims.sub), email: claims.email ? String(claims.email) : undefined };
}

export function handle(fn: (e: Event) => Promise<Result>) {
  return async (e: Event): Promise<Result> => {
    try {
      return await fn(e);
    } catch (e: any) {
      const status = e?.status || 500;
      console.error("handler error", e);
      return err(status, e?.message || "Internal error");
    }
  };
}
