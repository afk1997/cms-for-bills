import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createBill } from "@/lib/server-actions";

export default async function NewBillPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  if (session.user.role !== "OPERATOR") {
    redirect("/dashboard");
  }

  const ambulances = await prisma.ambulance.findMany({
    where: { operatorId: session.user.id },
    include: { region: true }
  });

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
              {ambulances.map((ambulance) => (
                <option key={ambulance.id} value={ambulance.id}>
                  {ambulance.name} ({ambulance.region.name})
                </option>
              ))}
            </select>
          </div>
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
