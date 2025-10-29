import { login } from "@/lib/server-actions";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-primary-50 to-slate-100">
      <div className="card w-full max-w-md">
        <h2 className="text-2xl font-semibold text-slate-800">Log in</h2>
        <p className="mt-2 text-sm text-slate-500">
          Use the credentials provided by your administrator to access the billing workspace.
        </p>
        <form action={login} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600">Email</label>
            <input type="email" name="email" required className="mt-1 w-full" placeholder="you@example.org" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600">Password</label>
            <input type="password" name="password" required className="mt-1 w-full" placeholder="••••••" />
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-primary-600 px-4 py-2 text-white shadow hover:bg-primary-700"
          >
            Sign in
          </button>
        </form>
        <div className="mt-4 text-sm text-slate-500">
          Need access? Contact your platform administrator.
        </div>
        <Link href="https://example.org" className="mt-6 inline-block text-xs text-slate-400 hover:text-slate-500">
          Learn more about the program
        </Link>
      </div>
    </div>
  );
}
