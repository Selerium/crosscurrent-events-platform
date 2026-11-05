import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * The points screen is shared by registrants and admins, so it sits outside
 * the (mainapp) layout (which redirects admins to /admin). Authentication is
 * still required; API access is restricted to event registrants and admins.
 */
export default async function EventPointsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token =
    cookieStore.get("access_token")?.value ??
    cookieStore.get("refresh_token")?.value;

  if (!token) {
    redirect("/login");
  }

  return <>{children}</>;
}
