"use server";

import {
  applyBackendSetCookies,
  cookieHeaderFromNextCookies,
} from "@/lib/auth/serverCookies";

export async function backendFetchWithAuthCookies(
  url: string,
  init: RequestInit = {},
) {
  const cookieHeader = await cookieHeaderFromNextCookies();

  const headers = new Headers(init.headers);
  if (cookieHeader && !headers.has("Cookie")) {
    headers.set("Cookie", cookieHeader);
  }

  const res = await fetch(url, {
    ...init,
    headers,
  });

  // Forward backend Set-Cookie headers back to the browser.
  const getSetCookie = (res.headers as any).getSetCookie as
    | undefined
    | (() => string[]);

  const setCookies = typeof getSetCookie === "function"
    ? getSetCookie.call(res.headers)
    : res.headers.get("set-cookie")
      ? [res.headers.get("set-cookie") as string]
      : null;

  await applyBackendSetCookies(setCookies);
  return res;
}

