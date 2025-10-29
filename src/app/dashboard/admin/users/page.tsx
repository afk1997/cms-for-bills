import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createUser } from "@/lib/server-actions";
import { Role } from "@prisma/client";
import Link from "next/link";

const roles: { label: string; value: Role }[] = [
  { label: "Admin", value: "ADMIN" },
  { label: "Ambulance Operator", value: "OPERATOR" },
  { label: "Level 1 Checker", value: "LEVEL1" },
  { label: "Level 2 Checker", value: "LEVEL2" },
  { label: "Accounts", value: "ACCOUNTS" }
];

export default async function UsersAdminPage() {
  const session = await getSession();
  if (!session || session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const users = await prisma.user.findMany({
    include: {
      regions: {
        include: { region: true }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  const regions = await prisma.region.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-800">Invite a new teammate</h2>
        <form action={createUser} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-1">
            <label className="text-sm font-medium text-slate-600">Full name</label>
            <input name="name" required className="mt-1 w-full" />
          </div>
          <div className="md:col-span-1">
            <label className="text-sm font-medium text-slate-600">Email</label>
            <input type="email" name="email" required className="mt-1 w-full" />
          </div>
          <div className="md:col-span-1">
            <label className="text-sm font-medium text-slate-600">Temporary password</label>
            <input name="password" type="password" required className="mt-1 w-full" placeholder="Set a temporary password" />
          </div>
          <div className="md:col-span-1">
            <label className="text-sm font-medium text-slate-600">Role</label>
            <select name="role" required className="mt-1 w-full">
              <option value="">Select role</option>
              {roles.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-medium text-slate-600">Regions (optional)</label>
            <select name="regionIds" multiple className="mt-1 w-full h-32">
              {regions.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.name} ({region.city}, {region.state})
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-400">Hold Ctrl (Windows) or Command (Mac) to select multiple regions.</p>
          </div>
          <div className="md:col-span-2">
            <button type="submit" className="rounded-md bg-primary-600 px-4 py-2 text-white hover:bg-primary-700">
              Create user
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-slate-800">Existing users</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Regions</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b">
                  <td className="font-medium text-slate-700">{user.name}</td>
                  <td>{user.email}</td>
                  <td>{user.role}</td>
                  <td>
                    {user.regions.length ? (
                      <ul className="list-disc pl-4 text-sm text-slate-500">
                        {user.regions.map((assignment) => (
                          <li key={assignment.id}>
                            {assignment.region.name} ({assignment.region.city})
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-xs text-slate-400">Not assigned</span>
                    )}
                  </td>
                  <td>{user.createdAt.toDateString()}</td>
                  <td>
                    <Link
                      href={`/dashboard/admin/users/${user.id}`}
                      className="text-sm font-medium text-primary-700 hover:underline"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
