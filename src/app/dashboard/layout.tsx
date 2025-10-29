import { getSession } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar userName={session.user.name} userRole={session.user.role} />
      <div className="flex flex-1">
        <Sidebar role={session.user.role} />
        <main className="flex-1 bg-slate-50 p-6">{children}</main>
      </div>
    </div>
  );
}
