"use client";

import Link from "next/link";
import { Role } from "@prisma/client";
import clsx from "clsx";
import { usePathname } from "next/navigation";

interface SidebarProps {
  role: Role;
}

const menuByRole: Record<Role, { label: string; href: string }[]> = {
  ADMIN: [
    { label: "Overview", href: "/dashboard" },
    { label: "Bills", href: "/dashboard#bills" },
    { label: "History", href: "/dashboard/history" },
    { label: "Users", href: "/dashboard/admin/users" },
    { label: "Regions", href: "/dashboard/admin/regions" },
    { label: "Ambulances", href: "/dashboard/admin/ambulances" }
  ],
  OPERATOR: [
    { label: "Overview", href: "/dashboard" },
    { label: "Submit Bill", href: "/dashboard/bills/new" },
    { label: "History", href: "/dashboard/history" }
  ],
  LEVEL1: [
    { label: "Overview", href: "/dashboard" },
    { label: "History", href: "/dashboard/history" }
  ],
  LEVEL2: [
    { label: "Overview", href: "/dashboard" },
    { label: "History", href: "/dashboard/history" }
  ],
  ACCOUNTS: [
    { label: "Overview", href: "/dashboard" },
    { label: "History", href: "/dashboard/history" }
  ]
};

export function Sidebar({ role }: SidebarProps) {
  const currentPath = usePathname();
  const menu = menuByRole[role];
  return (
    <aside className="w-64 border-r border-slate-200 bg-white">
      <div className="p-6">
        <h2 className="text-lg font-semibold">Workspace</h2>
      </div>
      <nav className="flex flex-col gap-1 px-4">
        {menu.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              "rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-primary-50 hover:text-primary-700",
              currentPath === item.href && "bg-primary-100 text-primary-800"
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
