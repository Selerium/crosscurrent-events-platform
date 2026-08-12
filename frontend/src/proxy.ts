import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { parseSetCookieHeaders } from "@/lib/auth/parseSetCookie";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");

function getSetCookieHeaders(res: Response): string[] {
  const getSetCookie = (res.headers as any).getSetCookie as
    | undefined
    | (() => string[]);
  if (typeof getSetCookie === "function") {
    return getSetCookie.call(res.headers);
  }
  const single = res.headers.get("set-cookie");
  return single ? [single] : [];
}

export async function proxy(request: NextRequest) {
  const accessToken = request.cookies.get("access_token")?.value;
  if (!accessToken) {
    return NextResponse.next();
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/me`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Cookie: request.cookies.toString(),
      },
      cache: "no-store",
    });
  } catch {
    return NextResponse.next();
  }

  if (res.status === 401) {
    const response = NextResponse.next();
    response.cookies.set("access_token", "", { path: "/", maxAge: 0 });
    response.cookies.set("refresh_token", "", { path: "/", maxAge: 0 });
    return response;
  }

  if (!res.ok) {
    return NextResponse.next();
  }

  const parsedCookies = parseSetCookieHeaders(getSetCookieHeaders(res));
  const newAccessToken = parsedCookies.find(
    (c) => c.name === "access_token",
  )?.value;

  const requestHeaders = new Headers(request.headers);
  if (newAccessToken) {
    const cookieParts = request.cookies.getAll().map((c) =>
      c.name === "access_token"
        ? `access_token=${newAccessToken}`
        : `${c.name}=${c.value}`,
    );
    requestHeaders.set("cookie", cookieParts.join("; "));
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  for (const parsed of parsedCookies) {
    response.cookies.set(parsed.name, parsed.value, parsed.options);
  }
  return response;
}

export const config = {
  matcher: [
    {
      source:
        "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
      has: [{ type: "cookie", key: "access_token" }],
    },
  ],
};
