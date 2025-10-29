import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createAmbulance } from "@/lib/server-actions";

export default async function AmbulancesAdminPage() {
  const session = await getSession();
  if (!session || session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const ambulances = await prisma.ambulance.findMany({
    include: {
      region: true,
      operator: true
    },
    orderBy: { createdAt: "desc" }
  });

  const regions = await prisma.region.findMany({ orderBy: { name: "asc" } });
  const operators = await prisma.user.findMany({ where: { role: "OPERATOR" }, orderBy: { name: "asc" } });

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-800">Register an ambulance</h2>
        <form action={createAmbulance} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-slate-600">Name</label>
            <input name="name" required className="mt-1 w-full" placeholder="Nagpur Ambulance 1" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600">Code</label>
            <input name="code" required className="mt-1 w-full" placeholder="NAG-AMB-01" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600">Region</label>
            <select name="regionId" required className="mt-1 w-full">
              <option value="">Select region</option>
              {regions.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.name} ({region.city})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600">Operator (optional)</label>
            <select name="operatorId" className="mt-1 w-full">
              <option value="">Assign later</option>
              {operators.map((operator) => (
                <option key={operator.id} value={operator.id}>
                  {operator.name}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <button type="submit" className="rounded-md bg-primary-600 px-4 py-2 text-white hover:bg-primary-700">
              Save ambulance
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-slate-800">Fleet</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th>Region</th>
                <th>Operator</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {ambulances.map((ambulance) => (
                <tr key={ambulance.id} className="border-b">
                  <td className="font-medium text-slate-700">{ambulance.name}</td>
                  <td>{ambulance.code}</td>
                  <td>
                    {ambulance.region.name} ({ambulance.region.city})
                  </td>
                  <td>{ambulance.operator ? ambulance.operator.name : <span className="text-xs text-slate-400">Unassigned</span>}</td>
                  <td>{ambulance.createdAt.toDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
