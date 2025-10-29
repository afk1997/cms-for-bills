"use client";

import { useState } from "react";
import { showToast } from "@/components/toaster";

export function PaymentForm({ billId }: { billId: string }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    referenceNo: "",
    paymentDate: "",
    amountPaid: "",
    paymentMode: "",
    notes: ""
  });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    const formData = new FormData();
    formData.append("billId", billId);
    Object.entries(form).forEach(([key, value]) => {
      if (value) formData.append(key, value);
    });

    const response = await fetch("/api/bills/payment", {
      method: "POST",
      body: formData
    });
    setLoading(false);
    if (response.ok) {
      showToast({ message: "Payment recorded", type: "success" });
      window.location.reload();
    } else {
      const body = await response.json().catch(() => ({ message: "Unable to record payment" }));
      showToast({ message: body.message ?? "Unable to record payment", type: "error" });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <input
        className="w-full"
        placeholder="Reference no."
        value={form.referenceNo}
        onChange={(event) => setForm((prev) => ({ ...prev, referenceNo: event.target.value }))}
        required
      />
      <input
        type="date"
        className="w-full"
        value={form.paymentDate}
        onChange={(event) => setForm((prev) => ({ ...prev, paymentDate: event.target.value }))}
        required
      />
      <input
        type="number"
        className="w-full"
        placeholder="Amount"
        value={form.amountPaid}
        onChange={(event) => setForm((prev) => ({ ...prev, amountPaid: event.target.value }))}
        required
        step="0.01"
      />
      <input
        className="w-full"
        placeholder="Payment mode"
        value={form.paymentMode}
        onChange={(event) => setForm((prev) => ({ ...prev, paymentMode: event.target.value }))}
        required
      />
      <textarea
        className="w-full"
        placeholder="Notes (optional)"
        value={form.notes}
        onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
      />
      <button
        type="submit"
        className="rounded-md bg-primary-600 px-3 py-2 text-sm text-white hover:bg-primary-700"
        disabled={loading}
      >
        {loading ? "Saving..." : "Record payment"}
      </button>
    </form>
  );
}
