import { NextResponse } from "next/server";

const ALLOWED_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
const ALLOWED_HEADERS = "Content-Type, Authorization, X-API-Key";
const MAX_AGE = "86400";

function isLocalOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return /^https?:\/\/(localhost|127\.0\.0\.1|spare\.birdsphichitchai\.dev)(:\d+)?$/.test(origin);
}

export function corsOptions(): (request: Request) => Promise<NextResponse> {
  return async (request: Request) => {
    const origin = request.headers.get("origin");
    if (!isLocalOrigin(origin)) {
      return new NextResponse(null, { status: 403 });
    }
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": origin!,
        "Access-Control-Allow-Methods": ALLOWED_METHODS,
        "Access-Control-Allow-Headers": ALLOWED_HEADERS,
        "Access-Control-Max-Age": MAX_AGE,
        Vary: "Origin",
      },
    });
  };
}

export function withCors<Args extends unknown[]>(
  handler: (request: Request, ...args: Args) => Promise<NextResponse>
): (request: Request, ...args: Args) => Promise<NextResponse> {
  return async (request: Request, ...args: Args) => {
    const response = await handler(request, ...args);
    const origin = request.headers.get("origin");
    const safeOrigin = isLocalOrigin(origin) ? origin! : null;

    if (safeOrigin) {
      response.headers.set("Access-Control-Allow-Origin", safeOrigin);
      response.headers.set("Vary", "Origin");
    }

    return response;
  };
}
