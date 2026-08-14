import { redirect } from "next/navigation";
import { ApprovalGuard } from "@/components/layout/ApprovalGuard";
import { redirectIfAuthenticated } from "@/lib/auth/redirectIfAuthenticated";

export default async function MainAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await redirectIfAuthenticated();
  if (!user) {
    redirect("/login");
  }

  return (
    <ApprovalGuard approved={user.approved}>
      {children}
    </ApprovalGuard>
  );
}
