"use client";

import { useState } from "react";
import { Role, BillStatus } from "@prisma/client";
import { showToast } from "@/components/toaster";

const transitions: Record<Role, { label: string; status: BillStatus; requiresNote?: boolean }[]> = {
  LEVEL1: [
    { label: "Send to Level 2", status: "PENDING_L2" },
    { label: "Return to operator", status: "RETURNED_L1", requiresNote: true },
    { label: "Reject", status: "REJECTED_L1", requiresNote: true }
  ],
  LEVEL2: [
    { label: "Approve for payment", status: "PENDING_PAYMENT" },
    { label: "Return to Level 1", status: "RETURNED_L2", requiresNote: true },
    { label: "Reject", status: "REJECTED_L2", requiresNote: true }
  ],
  ADMIN: [
    { label: "Route to Level 1", status: "PENDING_L1" },
    { label: "Route to Level 2", status: "PENDING_L2" },
    { label: "Route to Accounts", status: "PENDING_PAYMENT" }
  ],
  ACCOUNTS: [],
  OPERATOR: []
};

export function TransitionForm({ billId, role }: { billId: string; role: Role }) {
  const [selected, setSelected] = useState<BillStatus | "">("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const options = transitions[role];
  if (!options?.length) return <span className="text-xs text-slate-400">No actions</span>;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) {
      showToast({ message: "Select a status", type: "error" });
      return;
    }

    const option = options.find((opt) => opt.status === selected);
    if (option?.requiresNote && !note.trim()) {
      showToast({ message: "Add a note to proceed", type: "error" });
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append("billId", billId);
    formData.append("status", selected);
    if (note) {
      formData.append("note", note);
    }

    const response = await fetch("/api/bills/transition", {
      method: "POST",
      body: formData
    });

    setLoading(false);
    if (response.ok) {
      showToast({ message: "Bill updated", type: "success" });
      window.location.reload();
    } else {
      const body = await response.json().catch(() => ({ message: "Unable to update bill" }));
      showToast({ message: body.message ?? "Unable to update bill", type: "error" });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <select
        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
        value={selected}
        onChange={(event) => setSelected(event.target.value as BillStatus)}
      >
        <option value="">Select</option>
        {options.map((option) => (
          <option key={option.status} value={option.status}>
            {option.label}
          </option>
        ))}
      </select>
      <textarea
        className="h-16 rounded-md border border-slate-200 px-3 py-2 text-sm"
        placeholder="Optional note"
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
      <button
        type="submit"
        className="rounded-md bg-primary-600 px-3 py-2 text-sm text-white hover:bg-primary-700"
        disabled={loading}
      >
        {loading ? "Updating..." : "Update"}
      </button>
    </form>
  );
}
