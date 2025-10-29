"use client";

import useSWR from "swr";

interface AnalyticsResponse {
  totalPaid: number;
  regions: { id: string; name: string; location: string; total: number; paid: number }[];
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function AnalyticsPanel() {
  const { data, error } = useSWR<AnalyticsResponse>("/api/analytics", fetcher, {
    refreshInterval: 60_000
  });

  if (error) {
    return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">Unable to load analytics</div>;
  }

  if (!data) {
    return <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">Loading analytics...</div>;
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-slate-800">Spending insights</h2>
      <p className="mt-1 text-sm text-slate-500">Automatically refreshes every minute.</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data.regions.map((region) => (
          <div key={region.id} className="rounded-lg border border-slate-200 p-4">
            <h3 className="text-base font-semibold text-slate-700">{region.name}</h3>
            <p className="text-xs uppercase tracking-wide text-slate-400">{region.location}</p>
            <p className="mt-2 text-sm text-slate-500">Total: ₹{region.total.toLocaleString()}</p>
            <p className="text-sm text-slate-500">Paid: ₹{region.paid.toLocaleString()}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-lg bg-primary-50 p-4 text-sm text-primary-700">
        Total paid across India: <strong>₹{data.totalPaid.toLocaleString()}</strong>
      </div>
    </div>
  );
}
