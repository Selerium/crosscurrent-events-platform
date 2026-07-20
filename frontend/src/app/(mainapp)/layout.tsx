import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function MainAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;
  if (!token) {
    redirect("/");
  }

  let role: string | null = null;
  let firstTime: boolean | null = null;
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64").toString(),
    );
    role = payload.role;
    firstTime = payload.firstTime;
  } catch {}

  if (role === "ADMIN") {
    redirect("/admin");
  }

  if (firstTime === true) {
    redirect("/profile/first-time");
  }

  return <>{children}</>;
}
