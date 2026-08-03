import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function redirectIfAuthenticated() {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;
  if (!token) return;

  let role: string | null = null;
  let firstTime: boolean | null = null;
  let approved = false;
  let churchId: string | null = null;
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64").toString(),
    );
    if (payload.exp && payload.exp * 1000 < Date.now()) return;
    role = payload.role;
    firstTime = payload.firstTime;
    approved = payload.approved ?? false;
    churchId = payload.churchId ?? null;
  } catch {
    return;
  }

  if (role === "ADMIN") {
    redirect("/admin");
  }

  if (firstTime === true) {
    redirect("/profile/first-time");
  }

  if (!approved && !churchId) {
    redirect("/choose-church");
  }

  redirect("/dashboard");
}
