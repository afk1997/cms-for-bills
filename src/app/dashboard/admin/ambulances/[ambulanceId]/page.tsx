import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateAmbulance } from "@/lib/server-actions";

interface PageParams {
  params: { ambulanceId: string };
}

export default async function EditAmbulancePage({ params }: PageParams) {
  const session = await getSession();
  if (!session || session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const ambulance = await prisma.ambulance.findUnique({
    where: { id: params.ambulanceId },
    include: {
      region: true,
      operatorAssignments: {
        include: { operator: true }
      },
      bills: { select: { id: true } }
    }
  });

  if (!ambulance) {
    notFound();
  }

  const regions = await prisma.region.findMany({ orderBy: { name: "asc" } });
  const operators = await prisma.user.findMany({ where: { role: "OPERATOR" }, orderBy: { name: "asc" } });
  const assignedOperatorIds = ambulance.operatorAssignments.map((assignment) => assignment.operatorId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Edit ambulance</h1>
          <p className="text-sm text-slate-500">Keep fleet data in sync and reassign operators when needed.</p>
        </div>
        <Link href="/dashboard/admin/ambulances" className="text-sm font-medium text-primary-700 hover:underline">
          ← Back to fleet
        </Link>
      </div>

      <section className="card">
        <h2 className="text-lg font-semibold text-slate-800">Ambulance details</h2>
        <form action={updateAmbulance} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <input type="hidden" name="ambulanceId" value={ambulance.id} />
          <div>
            <label className="text-sm font-medium text-slate-600">Name</label>
            <input name="name" required defaultValue={ambulance.name} className="mt-1 w-full" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600">Code</label>
            <input name="code" required defaultValue={ambulance.code} className="mt-1 w-full" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600">Region</label>
            <select name="regionId" required defaultValue={ambulance.regionId} className="mt-1 w-full">
              <option value="">Select region</option>
              {regions.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.name} ({region.city})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600">Operators</label>
            <select
              name="operatorIds"
              multiple
              defaultValue={assignedOperatorIds}
              className="mt-1 h-32 w-full"
            >
              {operators.map((operator) => (
                <option key={operator.id} value={operator.id}>
                  {operator.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-400">Hold Ctrl or Command to multi-select.</p>
          </div>
          <div className="md:col-span-2">
            <button type="submit" className="rounded-md bg-primary-600 px-4 py-2 text-white hover:bg-primary-700">
              Save changes
            </button>
          </div>
        </form>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold text-slate-800">Usage</h2>
        <p className="mt-2 text-sm text-slate-500">
          This ambulance is currently mapped to the <span className="font-medium">{ambulance.region.name}</span> region
          and has {ambulance.bills.length} bill(s) linked.
        </p>
        {ambulance.operatorAssignments.length ? (
          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-500">
            {ambulance.operatorAssignments.map((assignment) => (
              <li key={assignment.id}>{assignment.operator.name}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-slate-400">Assign an operator to enable bill submissions.</p>
        )}
      </section>
    </div>
  );
}
