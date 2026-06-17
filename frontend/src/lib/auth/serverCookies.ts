import { cookies } from "next/headers";

type SameSite = "lax" | "strict" | "none";

type ParsedSetCookie = {
  name: string;
  value: string;
  options: {
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: SameSite;
    path?: string;
    maxAge?: number;
  };
};

function parseSetCookieAttribute(attr: string) {
  // Example attributes we might see from Express:
  // - HttpOnly
  // - Secure
  // - Path=/
  // - Max-Age=900
  // - SameSite=Lax
  const [rawKey, ...rest] = attr.split("=");
  const key = rawKey.trim().toLowerCase();
  const value = rest.join("=").trim();
  return { key, value };
}

function parseSetCookieHeader(setCookie: string): ParsedSetCookie | null {
  // Example:
  // access_token=eyJ...; Path=/; HttpOnly; SameSite=Lax; Max-Age=900
  const [pairPart, ...attrParts] = setCookie.split(";").map((p) => p.trim());
  if (!pairPart) return null;

  const eqIdx = pairPart.indexOf("=");
  if (eqIdx === -1) return null;

  const name = pairPart.slice(0, eqIdx).trim();
  const value = pairPart.slice(eqIdx + 1).trim();

  const options: ParsedSetCookie["options"] = {};
  for (const attr of attrParts) {
    if (!attr) continue;
    const { key, value } = parseSetCookieAttribute(attr);
    if (key === "httponly") options.httpOnly = true;
    else if (key === "secure") options.secure = true;
    else if (key === "path") options.path = value;
    else if (key === "max-age") {
      const n = Number(value);
      if (!Number.isNaN(n)) options.maxAge = n;
    } else if (key === "samesite") {
      const v = value.toLowerCase();
      if (v === "lax" || v === "strict" || v === "none") {
        options.sameSite = v;
      }
    }
  }

  return { name, value, options };
}

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

