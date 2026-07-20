import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;
  // if (!token) {
  //   redirect("/");
  // }

  // let role: string | null = null;
  // try {
  //   const payload = JSON.parse(
  //     Buffer.from(token.split(".")[1], "base64").toString(),
  //   );
  //   role = payload.role;
  // } catch {}

  // if (role !== "ADMIN") {
  //   redirect("/dashboard");
  // }

  return <>{children}</>;
}
