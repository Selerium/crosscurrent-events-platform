import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import NotificationsContentPage from "./NotificationsContent";

export default async function NotificationsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;
  if (!token) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-full flex-col">
      <main className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
        <NotificationsContentPage />
      </main>
    </div>
  );
}
