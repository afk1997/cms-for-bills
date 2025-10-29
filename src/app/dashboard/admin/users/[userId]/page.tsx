import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { updateUser } from "@/lib/server-actions";

const roles: { label: string; value: Role }[] = [
  { label: "Admin", value: "ADMIN" },
  { label: "Ambulance Operator", value: "OPERATOR" },
  { label: "Level 1 Checker", value: "LEVEL1" },
  { label: "Level 2 Checker", value: "LEVEL2" },
  { label: "Accounts", value: "ACCOUNTS" }
];

interface PageParams {
  params: { userId: string };
}

export default async function EditUserPage({ params }: PageParams) {
  const session = await getSession();
  if (!session || session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    include: {
      regions: {
        include: { region: true }
      },
      ambulances: {
        include: { region: true }
      }
    }
  });

  if (!user) {
    notFound();
  }

  const regions = await prisma.region.findMany({ orderBy: { name: "asc" } });
  const ambulances = await prisma.ambulance.findMany({
    include: { region: true },
    orderBy: { name: "asc" }
  });

  const assignedRegionIds = user.regions.map((assignment) => assignment.regionId);
  const assignedAmbulanceIds = user.ambulances.map((ambulance) => ambulance.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Edit {user.name}</h1>
          <p className="text-sm text-slate-500">Manage profile, access and assignments</p>
        </div>
        <Link href="/dashboard/admin/users" className="text-sm font-medium text-primary-700 hover:underline">
          ← Back to users
        </Link>
      </div>

      <section className="card">
        <h2 className="text-lg font-semibold text-slate-800">User details</h2>
        <form action={updateUser} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <input type="hidden" name="userId" value={user.id} />
          <div>
            <label className="text-sm font-medium text-slate-600">Full name</label>
            <input name="name" required defaultValue={user.name} className="mt-1 w-full" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600">Email</label>
            <input name="email" type="email" required defaultValue={user.email} className="mt-1 w-full" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600">Role</label>
            <select name="role" required defaultValue={user.role} className="mt-1 w-full">
              <option value="">Select role</option>
              {roles.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600">Reset password</label>
            <input
              name="password"
              type="password"
              className="mt-1 w-full"
              placeholder="Leave blank to keep current password"
            />
            <p className="mt-1 text-xs text-slate-400">Minimum 6 characters if provided.</p>
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-medium text-slate-600">Regions</label>
            <select
              name="regionIds"
              multiple
              defaultValue={assignedRegionIds}
              className="mt-1 h-32 w-full"
            >
              {regions.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.name} ({region.city}, {region.state})
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-400">Hold Ctrl or Command to multi-select.</p>
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-medium text-slate-600">Ambulances</label>
            <select
              name="ambulanceIds"
              multiple
              defaultValue={assignedAmbulanceIds}
              className="mt-1 h-32 w-full"
            >
              {ambulances.map((ambulance) => (
                <option key={ambulance.id} value={ambulance.id}>
                  {ambulance.name} ({ambulance.code}) — {ambulance.region.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-400">
              Assign ambulances directly from here. Unselect to remove access.
            </p>
          </div>
          <div className="md:col-span-2">
            <button type="submit" className="rounded-md bg-primary-600 px-4 py-2 text-white hover:bg-primary-700">
              Save changes
            </button>
          </div>
        </form>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold text-slate-800">Current assignments</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-700">Regions</h3>
            {user.regions.length ? (
              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-slate-600">
                {user.regions.map((assignment) => (
                  <li key={assignment.id}>
                    {assignment.region.name} ({assignment.region.city}, {assignment.region.state})
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-500">No regions assigned.</p>
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-700">Ambulances</h3>
            {user.ambulances.length ? (
              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-slate-600">
                {user.ambulances.map((ambulance) => (
                  <li key={ambulance.id}>
                    {ambulance.name} ({ambulance.code}) — {ambulance.region.name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-500">No ambulances assigned.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
