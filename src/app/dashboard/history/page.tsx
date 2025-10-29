import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export default async function HistoryPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const [logs, payments] = await Promise.all([
    prisma.billStatusLog.findMany({
      where: { actorId: session.user.id },
      include: {
        bill: {
          select: {
            id: true,
            title: true,
            invoiceNumber: true,
            status: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    }),
    prisma.payment.findMany({
      where: { createdById: session.user.id },
      include: {
        bill: {
          select: {
            id: true,
            title: true,
            invoiceNumber: true
          }
        }
      },
      orderBy: { paymentDate: "desc" }
    })
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Your activity history</h1>
        <p className="text-sm text-slate-500">Track bill updates and payments that you have performed.</p>
      </div>

      <section className="card">
        <h2 className="text-lg font-semibold text-slate-800">Workflow actions</h2>
        {logs.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Bill</th>
                  <th>Transition</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="whitespace-nowrap text-sm text-slate-600">{log.createdAt.toLocaleString()}</td>
                    <td className="text-sm">
                      <Link href={`/dashboard/bills/${log.bill.id}`} className="font-medium text-primary-700 hover:underline">
                        {log.bill.title}
                      </Link>
                      <p className="text-xs text-slate-500">Invoice #{log.bill.invoiceNumber}</p>
                    </td>
                    <td className="text-sm text-slate-700">
                      {log.from ? `${log.from} → ${log.to}` : `Moved to ${log.to}`}
                      <p className="text-xs text-slate-500">Current status: {log.bill.status}</p>
                    </td>
                    <td className="text-sm text-slate-600">
                      {log.note ? log.note : <span className="text-xs text-slate-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">No workflow actions recorded yet.</p>
        )}
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold text-slate-800">Payments recorded</h2>
        {payments.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Payment date</th>
                  <th>Bill</th>
                  <th>Reference</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="whitespace-nowrap text-sm text-slate-600">{payment.paymentDate.toLocaleDateString()}</td>
                    <td className="text-sm">
                      <Link href={`/dashboard/bills/${payment.bill.id}`} className="font-medium text-primary-700 hover:underline">
                        {payment.bill.title}
                      </Link>
                      <p className="text-xs text-slate-500">Invoice #{payment.bill.invoiceNumber}</p>
                    </td>
                    <td className="text-sm text-slate-700">{payment.referenceNo}</td>
                    <td className="text-sm text-slate-700">₹{Number(payment.amountPaid).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">No payments captured by you so far.</p>
        )}
      </section>
    </div>
  );
}
