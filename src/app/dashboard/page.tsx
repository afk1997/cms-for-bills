import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Role, BillStatus, Prisma } from "@prisma/client";
import Link from "next/link";
import { TransitionForm } from "@/components/transition-form";
import { PaymentForm } from "@/components/payment-form";
import { notFound } from "next/navigation";
import { AnalyticsPanel } from "@/components/analytics-panel";

type DashboardSearchParams = {
  region?: string | string[];
  ambulance?: string | string[];
  vendor?: string | string[];
  status?: string | string[];
};

export default async function DashboardPage({
  searchParams
}: {
  searchParams?: DashboardSearchParams;
}) {
  const session = await getSession();
  if (!session) {
    notFound();
  }

  const user = session.user;

  const selectedRegion =
    typeof searchParams?.region === "string" ? searchParams.region : undefined;
  const selectedAmbulance =
    typeof searchParams?.ambulance === "string"
      ? searchParams.ambulance
      : undefined;
  const selectedVendor =
    typeof searchParams?.vendor === "string" ? searchParams.vendor : undefined;
  const rawStatus =
    typeof searchParams?.status === "string" ? searchParams.status : undefined;
  const selectedStatus =
    rawStatus && Object.values(BillStatus).includes(rawStatus as BillStatus)
      ? (rawStatus as BillStatus)
      : undefined;

  const where: Prisma.BillWhereInput = filterBillsByRole(user.id, user.role);

  if (user.role === Role.ADMIN) {
    if (selectedRegion) {
      where.regionId = selectedRegion;
    }
    if (selectedAmbulance) {
      where.ambulanceId = selectedAmbulance;
    }
    if (selectedVendor) {
      where.vendor = selectedVendor;
    }
    if (selectedStatus) {
      where.status = selectedStatus;
    }
  }

  const bills = await prisma.bill.findMany({
    where,
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

  let regions: { id: string; name: string }[] = [];
  let ambulances: { id: string; name: string }[] = [];
  let vendors: string[] = [];

  if (user.role === Role.ADMIN) {
    const [regionResults, ambulanceResults, vendorResults] = await Promise.all([
      prisma.region.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" }
      }),
      prisma.ambulance.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" }
      }),
      prisma.bill.findMany({
        select: { vendor: true },
        distinct: ["vendor"],
        orderBy: { vendor: "asc" }
      })
    ]);

    regions = regionResults;
    ambulances = ambulanceResults;
    vendors = vendorResults
      .map((entry) => entry.vendor)
      .filter((vendor): vendor is string => Boolean(vendor));
  }

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

      {(user.role === Role.OPERATOR || user.role === Role.ADMIN) && (
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
        {user.role === Role.ADMIN && (
          <form className="mt-4 grid gap-4 md:grid-cols-5" method="get">
            <label className="flex flex-col text-sm text-slate-600">
              <span className="mb-1 font-medium">Region</span>
              <select
                name="region"
                defaultValue={selectedRegion ?? ""}
                className="rounded-md border border-slate-200 px-3 py-2"
              >
                <option value="">All regions</option>
                {regions.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-sm text-slate-600">
              <span className="mb-1 font-medium">Ambulance</span>
              <select
                name="ambulance"
                defaultValue={selectedAmbulance ?? ""}
                className="rounded-md border border-slate-200 px-3 py-2"
              >
                <option value="">All ambulances</option>
                {ambulances.map((ambulance) => (
                  <option key={ambulance.id} value={ambulance.id}>
                    {ambulance.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-sm text-slate-600">
              <span className="mb-1 font-medium">Vendor</span>
              <select
                name="vendor"
                defaultValue={selectedVendor ?? ""}
                className="rounded-md border border-slate-200 px-3 py-2"
              >
                <option value="">All vendors</option>
                {vendors.map((vendor) => (
                  <option key={vendor} value={vendor}>
                    {vendor}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-sm text-slate-600">
              <span className="mb-1 font-medium">Status</span>
              <select
                name="status"
                defaultValue={selectedStatus ?? ""}
                className="rounded-md border border-slate-200 px-3 py-2"
              >
                <option value="">All statuses</option>
                {Object.values(BillStatus).map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                className="h-10 rounded-md bg-primary-600 px-4 text-sm font-medium text-white shadow hover:bg-primary-700"
              >
                Apply filters
              </button>
              <Link
                href="/dashboard#bills"
                className="h-10 rounded-md border border-slate-200 px-4 text-sm font-medium text-slate-600 hover:border-primary-400 hover:text-primary-700"
              >
                Reset
              </Link>
            </div>
          </form>
        )}
        <div className="mt-4 overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Vendor</th>
                <th>Ambulance</th>
                <th>Region</th>
                <th>Created</th>
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
                  <td>
                    {new Intl.DateTimeFormat("en-IN", {
                      year: "numeric",
                      month: "short",
                      day: "numeric"
                    }).format(bill.createdAt)}
                  </td>
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
            <Link
              href="/dashboard/bills/new"
              className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-primary-400 hover:text-primary-700"
            >
              Submit a new bill
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

function filterBillsByRole(userId: string, role: Role): Prisma.BillWhereInput {
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
