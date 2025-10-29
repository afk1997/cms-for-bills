import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateRegion } from "@/lib/server-actions";

interface PageParams {
  params: { regionId: string };
}

export default async function EditRegionPage({ params }: PageParams) {
  const session = await getSession();
  if (!session || session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const region = await prisma.region.findUnique({
    where: { id: params.regionId },
    include: {
      ambulances: {
        include: { operator: true },
        orderBy: { name: "asc" }
      },
      bills: { select: { id: true } }
    }
  });

  if (!region) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Edit region</h1>
          <p className="text-sm text-slate-500">Update the region details and review linked resources.</p>
        </div>
        <Link href="/dashboard/admin/regions" className="text-sm font-medium text-primary-700 hover:underline">
          ← Back to regions
        </Link>
      </div>

      <section className="card">
        <h2 className="text-lg font-semibold text-slate-800">Region details</h2>
        <form action={updateRegion} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <input type="hidden" name="regionId" value={region.id} />
          <div>
            <label className="text-sm font-medium text-slate-600">Name</label>
            <input name="name" required defaultValue={region.name} className="mt-1 w-full" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600">City</label>
            <input name="city" required defaultValue={region.city} className="mt-1 w-full" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600">State</label>
            <input name="state" required defaultValue={region.state} className="mt-1 w-full" />
          </div>
          <div className="md:col-span-3">
            <button type="submit" className="rounded-md bg-primary-600 px-4 py-2 text-white hover:bg-primary-700">
              Save changes
            </button>
          </div>
        </form>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold text-slate-800">Linked ambulances</h2>
        {region.ambulances.length ? (
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            {region.ambulances.map((ambulance) => (
              <li key={ambulance.id} className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-slate-700">
                    {ambulance.name} ({ambulance.code})
                  </p>
                  <p className="text-xs text-slate-500">
                    Operator: {ambulance.operator ? ambulance.operator.name : "Unassigned"}
                  </p>
                </div>
                <Link
                  href={`/dashboard/admin/ambulances/${ambulance.id}`}
                  className="text-xs font-medium text-primary-700 hover:underline"
                >
                  Manage
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-slate-500">No ambulances mapped to this region.</p>
        )}
        <p className="mt-4 text-xs text-slate-400">{region.bills.length} bill(s) reference this region.</p>
      </section>
    </div>
  );
}
