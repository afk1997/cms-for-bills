"use client";

import { useEffect, useState } from "react";

interface Toast {
  id: number;
  message: string;
  type?: "success" | "error" | "info";
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<Toast>;
      const toast = custom.detail;
      setToasts((prev) => [...prev, { ...toast, id: Date.now() }]);
      setTimeout(() => {
        setToasts((prev) => prev.slice(1));
      }, 4000);
    };

    window.addEventListener("app-toast", handler as EventListener);
    return () => window.removeEventListener("app-toast", handler as EventListener);
  }, []);

  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-4 right-4 flex w-80 flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`rounded-lg border bg-white p-4 shadow-lg ${
            toast.type === "success"
              ? "border-green-500"
              : toast.type === "error"
              ? "border-red-500"
              : "border-primary-300"
          }`}
        >
          <p className="text-sm text-slate-700">{toast.message}</p>
        </div>
      ))}
    </div>
  );
}

export function showToast(toast: Omit<Toast, "id">) {
  const event = new CustomEvent("app-toast", { detail: toast });
  window.dispatchEvent(event);
}
