import Link from "next/link";
import { logout } from "@/lib/server-actions";

interface TopbarProps {
  userName: string;
  userRole: string;
}

export function Topbar({ userName, userRole }: TopbarProps) {
  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
      <div>
        <h1 className="text-xl font-semibold">Animal Ambulance Billing</h1>
        <p className="text-sm text-slate-500">Logged in as {userName} ({userRole})</p>
      </div>
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="text-sm text-primary-700 hover:underline">
          Dashboard
        </Link>
        <form action={logout}>
          <button type="submit" className="rounded-md bg-primary-600 px-3 py-2 text-sm text-white hover:bg-primary-700">
            Log out
          </button>
        </form>
      </div>
    </header>
  );
}
