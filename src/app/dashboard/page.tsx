import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Role, BillStatus } from "@prisma/client";
import Link from "next/link";
import { TransitionForm } from "@/components/transition-form";
import { PaymentForm } from "@/components/payment-form";
import { notFound } from "next/navigation";
import { AnalyticsPanel } from "@/components/analytics-panel";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) {
    notFound();
  }

  const user = session.user;

  const bills = await prisma.bill.findMany({
    where: filterBillsByRole(user.id, user.role),
    include: {
      ambulance: true,
      region: true,
      operator: true,
      payment: true
    },
    orderBy: { createdAt: "desc" }
  });

  const summary = await prisma.bill.groupBy({
    by: ["status"],
    _count: { status: true },
    _sum: { amount: true }
  });

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-4">
        {summary.map((item) => (
          <div key={item.status} className="card">
            <p className="text-xs uppercase tracking-wide text-slate-500">{item.status}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-800">₹{Number(item._sum.amount ?? 0).toLocaleString()}</p>
            <p className="text-sm text-slate-500">{item._count.status} bills</p>
          </div>
        ))}
      </section>

      <AnalyticsPanel />

      {user.role === Role.OPERATOR && (
        <div>
          <Link
            href="/dashboard/bills/new"
            className="rounded-md bg-primary-600 px-4 py-2 text-white shadow hover:bg-primary-700"
          >
            Submit a new bill
          </Link>
        </div>
      )}

      <section id="bills" className="card">
        <h2 className="text-lg font-semibold text-slate-800">Workflow queue</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Vendor</th>
                <th>Ambulance</th>
                <th>Region</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((bill) => (
                <tr key={bill.id} className="border-b">
                  <td>
                    <div className="flex flex-col">
                      <Link
                        href={`/dashboard/bills/${bill.id}`}
                        className="font-medium text-primary-700 hover:underline"
                      >
                        {bill.title}
                      </Link>
                      <span className="text-xs text-slate-500">Invoice #{bill.invoiceNumber}</span>
                    </div>
                  </td>
                  <td>{bill.vendor}</td>
                  <td>{bill.ambulance.name}</td>
                  <td>{bill.region.name}</td>
                  <td>₹{Number(bill.amount).toLocaleString()}</td>
                  <td>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                      {bill.status}
                    </span>
                  </td>
                  <td className="w-64">
                    <div className="flex flex-col gap-2">
                      <Link
                        href={`/dashboard/bills/${bill.id}`}
                        className="text-sm font-medium text-primary-700 hover:underline"
                      >
                        View details
                      </Link>
                      <BillActions billStatus={bill.status} role={user.role} billId={bill.id} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {user.role === Role.ADMIN && (
        <section className="card">
          <h2 className="text-lg font-semibold text-slate-800">Quick admin actions</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/dashboard/admin/users"
              className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-primary-400 hover:text-primary-700"
            >
              Manage users
            </Link>
            <Link
              href="/dashboard/admin/regions"
              className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-primary-400 hover:text-primary-700"
            >
              Manage regions
            </Link>
            <Link
              href="/dashboard/admin/ambulances"
              className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-primary-400 hover:text-primary-700"
            >
              Manage ambulances
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

function filterBillsByRole(userId: string, role: Role) {
  switch (role) {
    case Role.OPERATOR:
      return { operatorId: userId };
    case Role.LEVEL1:
      return { status: BillStatus.PENDING_L1 };
    case Role.LEVEL2:
      return { status: BillStatus.PENDING_L2 };
    case Role.ACCOUNTS:
      return { status: BillStatus.PENDING_PAYMENT };
    case Role.ADMIN:
      return {};
    default:
      return {};
  }
}

function BillActions({ billStatus, role, billId }: { billStatus: BillStatus; role: Role; billId: string }) {
  if (role === Role.ACCOUNTS && billStatus === BillStatus.PENDING_PAYMENT) {
    return <PaymentForm billId={billId} />;
  }

  if (role === Role.LEVEL1 || role === Role.LEVEL2 || role === Role.ADMIN) {
    return <TransitionForm billId={billId} role={role} />;
  }

  return <span className="text-xs text-slate-400">No workflow actions</span>;
}
