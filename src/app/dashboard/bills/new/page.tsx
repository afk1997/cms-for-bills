import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createBill } from "@/lib/server-actions";
import { Role } from "@prisma/client";

const ambulanceInclude = {
  region: true,
  operatorAssignments: {
    include: { operator: true },
    orderBy: { createdAt: "asc" }
  }
} as const;

export default async function NewBillPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  if (session.user.role !== Role.OPERATOR && session.user.role !== Role.ADMIN) {
    redirect("/dashboard");
  }

  let ambulances = await prisma.ambulance.findMany({
    include: ambulanceInclude,
    orderBy: { name: "asc" }
  });

  if (session.user.role === Role.OPERATOR) {
    const assignments = await prisma.ambulanceOperatorAssignment.findMany({
      where: { operatorId: session.user.id },
      include: {
        ambulance: {
          include: ambulanceInclude
        }
      }
    });

    ambulances = assignments
      .flatMap((assignment) => (assignment.ambulance ? [assignment.ambulance] : []))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="card">
        <h2 className="text-xl font-semibold text-slate-800">Submit a bill</h2>
        <p className="mt-2 text-sm text-slate-500">
          Upload the invoice and provide payment details for review.
        </p>
        <form action={createBill} className="mt-6 grid grid-cols-1 gap-4">
          <div>
            <label className="text-sm font-medium text-slate-600">Ambulance</label>
            <select name="ambulanceId" required className="mt-1 w-full">
              <option value="">Select ambulance</option>
              {ambulances.map((ambulance) => {
                const operatorNames = ambulance.operatorAssignments
                  .map((assignment) => assignment.operator.name)
                  .join(", ");
                const operatorSuffix = operatorNames ? ` • ${operatorNames}` : "";
                return (
                  <option key={ambulance.id} value={ambulance.id}>
                    {`${ambulance.name} (${ambulance.region.name}${operatorSuffix})`}
                  </option>
                );
              })}
            </select>
          </div>
          {session.user.role === Role.ADMIN && (
            <div>
              <label className="text-sm font-medium text-slate-600">Route bill to</label>
              <select name="initialStatus" required className="mt-1 w-full">
                <option value="">Select workflow destination</option>
                <option value="PENDING_L1">Level 1 review</option>
                <option value="PENDING_L2">Level 2 review</option>
                <option value="PENDING_PAYMENT">Accounts for payment</option>
              </select>
              <p className="mt-1 text-xs text-slate-400">
                Choose which team should receive this bill first.
              </p>
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-600">Bill title</label>
              <input name="title" required placeholder="Medicine purchase" className="mt-1 w-full" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-600">Vendor</label>
              <input name="vendor" required placeholder="Pharmacy name" className="mt-1 w-full" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="text-sm font-medium text-slate-600">Amount (INR)</label>
              <input name="amount" type="number" step="0.01" required className="mt-1 w-full" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-600">Invoice number</label>
              <input name="invoiceNumber" required className="mt-1 w-full" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-600">Invoice date</label>
              <input name="invoiceDate" type="date" required className="mt-1 w-full" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600">Description</label>
            <textarea name="description" rows={4} className="mt-1 w-full" placeholder="Add any notes" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600">Attachments</label>
            <input name="attachments" type="file" multiple className="mt-1 w-full" />
            <p className="mt-1 text-xs text-slate-400">Upload invoice and supporting documents (PDF/JPG/PNG, max 4MB each)</p>
          </div>
          <button type="submit" className="mt-2 rounded-md bg-primary-600 px-4 py-2 text-white hover:bg-primary-700">
            Submit bill
          </button>
        </form>
      </div>
    </div>
  );
}
