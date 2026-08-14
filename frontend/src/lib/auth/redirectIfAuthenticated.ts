import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");

export type SessionUser = {
  id: string;
  name: string;
  role: string;
  firstTime: boolean;
  approved: boolean;
  churchId: string | null;
};

export async function redirectIfAuthenticated(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;
  if (!token) return null;

  let data: SessionUser;
  try {
    const res = await fetch(`${API_BASE}/me`, {
      headers: {
        Accept: "application/json",
        Cookie: cookieStore.toString(),
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = await res.json();
    data = json?.data;
    if (!data) return null;
  } catch {
    return null;
  }

  if (data.role === "ADMIN") {
    redirect("/admin");
  }

  if (data.firstTime === true) {
    redirect("/profile/first-time");
  }

  if (!data.approved && !data.churchId) {
    redirect("/choose-church");
  }

  return data;
}
