import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createRegion } from "@/lib/server-actions";

export default async function RegionsAdminPage() {
  const session = await getSession();
  if (!session || session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const regions = await prisma.region.findMany({
    include: {
      ambulances: true,
      bills: true
    },
    orderBy: { createdAt: "desc" }
  });

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-800">Add a region</h2>
        <form action={createRegion} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="text-sm font-medium text-slate-600">Name</label>
            <input name="name" required className="mt-1 w-full" placeholder="Nagpur" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600">City</label>
            <input name="city" required className="mt-1 w-full" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600">State</label>
            <input name="state" required className="mt-1 w-full" />
          </div>
          <div className="md:col-span-3">
            <button type="submit" className="rounded-md bg-primary-600 px-4 py-2 text-white hover:bg-primary-700">
              Save region
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-slate-800">Regions overview</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {regions.map((region) => (
            <div key={region.id} className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-slate-700">{region.name}</h3>
                  <p className="text-sm text-slate-500">
                    {region.city}, {region.state}
                  </p>
                </div>
                <Link
                  href={`/dashboard/admin/regions/${region.id}`}
                  className="text-sm font-medium text-primary-700 hover:underline"
                >
                  Edit
                </Link>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                {region.ambulances.length} ambulances • {region.bills.length} bills
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
