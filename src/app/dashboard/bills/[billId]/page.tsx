import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Role } from "@prisma/client";

interface PageParams {
  params: { billId: string };
}

export default async function BillDetailPage({ params }: PageParams) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const bill = await prisma.bill.findUnique({
    where: { id: params.billId },
    include: {
      region: true,
      ambulance: true,
      operator: true,
      attachments: { orderBy: { createdAt: "asc" } },
      logs: {
        include: { actor: true },
        orderBy: { createdAt: "desc" }
      },
      payment: {
        include: { createdBy: true }
      }
    }
  });

  if (!bill) {
    notFound();
  }

  if (session.user.role === Role.OPERATOR && bill.operatorId !== session.user.id) {
    notFound();
  }

  const formattedAmount = Number(bill.amount).toLocaleString();
  const invoiceDate = bill.invoiceDate.toLocaleDateString();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{bill.title}</h1>
          <p className="text-sm text-slate-500">Invoice #{bill.invoiceNumber}</p>
        </div>
        <Link href="/dashboard" className="text-sm font-medium text-primary-700 hover:underline">
          ← Back to dashboard
        </Link>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="card">
          <p className="text-xs uppercase text-slate-500">Current status</p>
          <p className="mt-2 text-xl font-semibold text-slate-800">{bill.status}</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase text-slate-500">Amount</p>
          <p className="mt-2 text-xl font-semibold text-slate-800">
            ₹{formattedAmount}
          </p>
          <p className="text-xs text-slate-500">Currency: {bill.currency}</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase text-slate-500">Region</p>
          <p className="mt-2 text-xl font-semibold text-slate-800">{bill.region.name}</p>
          <p className="text-xs text-slate-500">
            {bill.region.city}, {bill.region.state}
          </p>
        </div>
        <div className="card">
          <p className="text-xs uppercase text-slate-500">Ambulance</p>
          <p className="mt-2 text-xl font-semibold text-slate-800">{bill.ambulance.name}</p>
          <p className="text-xs text-slate-500">{bill.ambulance.code}</p>
        </div>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold text-slate-800">Bill information</h2>
        <dl className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Vendor</dt>
            <dd className="mt-1 text-sm text-slate-800">{bill.vendor}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Invoice date</dt>
            <dd className="mt-1 text-sm text-slate-800">{invoiceDate}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Submitted by</dt>
            <dd className="mt-1 text-sm text-slate-800">{bill.operator.name}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Last updated</dt>
            <dd className="mt-1 text-sm text-slate-800">{bill.updatedAt.toLocaleString()}</dd>
          </div>
          {bill.description && (
            <div className="md:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Description</dt>
              <dd className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{bill.description}</dd>
            </div>
          )}
        </dl>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold text-slate-800">Attachments</h2>
        {bill.attachments.length ? (
          <ul className="mt-4 space-y-2">
            {bill.attachments.map((attachment) => (
              <li key={attachment.id}>
                <a
                  href={attachment.fileUrl}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-primary-700 hover:underline"
                >
                  {attachment.fileName}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-slate-500">No attachments uploaded.</p>
        )}
      </section>

      {bill.payment && (
        <section className="card">
          <h2 className="text-lg font-semibold text-slate-800">Payment details</h2>
          <dl className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Reference number</dt>
              <dd className="mt-1 text-sm text-slate-800">{bill.payment.referenceNo}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Payment date</dt>
              <dd className="mt-1 text-sm text-slate-800">{bill.payment.paymentDate.toLocaleDateString()}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Amount paid</dt>
              <dd className="mt-1 text-sm text-slate-800">₹{Number(bill.payment.amountPaid).toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Recorded by</dt>
              <dd className="mt-1 text-sm text-slate-800">{bill.payment.createdBy.name}</dd>
            </div>
            {bill.payment.notes && (
              <div className="md:col-span-2">
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Notes</dt>
                <dd className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{bill.payment.notes}</dd>
              </div>
            )}
          </dl>
        </section>
      )}

      <section className="card">
        <h2 className="text-lg font-semibold text-slate-800">Workflow history</h2>
        {bill.logs.length ? (
          <ul className="mt-4 space-y-3">
            {bill.logs.map((log) => (
              <li key={log.id} className="rounded-md border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-800">{log.actor.name}</p>
                  <span className="text-xs text-slate-500">{log.createdAt.toLocaleString()}</span>
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {log.from ? `${log.from} → ${log.to}` : `Moved to ${log.to}`}
                </p>
                {log.note && <p className="mt-1 text-sm text-slate-500">Note: {log.note}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-slate-500">No activity logged for this bill yet.</p>
        )}
      </section>
    </div>
  );
}
