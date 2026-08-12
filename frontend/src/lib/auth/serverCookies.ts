import { cookies } from "next/headers";
import { parseSetCookieHeader } from "@/lib/auth/parseSetCookie";

export async function applyBackendSetCookies(
  setCookies: string[] | string | null,
) {
  if (!setCookies) return;
  const list = Array.isArray(setCookies) ? setCookies : [setCookies];

  const cookieStore = await cookies();
  for (const setCookie of list) {
    const parsed = parseSetCookieHeader(setCookie);
    if (!parsed) continue;
    // Next's typings for cookies() are version-dependent. In server actions
    // this store is mutable, so we set via a narrow runtime cast.
    (cookieStore as any).set(parsed.name, parsed.value, parsed.options);
  }
}

export async function cookieHeaderFromNextCookies() {
  
  return (await cookies()).toString();
}
