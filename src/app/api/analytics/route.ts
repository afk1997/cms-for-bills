import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const totalPaid = await prisma.bill.aggregate({
    where: { status: "PAID" },
    _sum: { amount: true }
  });

  const byRegion = await prisma.region.findMany({
    select: {
      id: true,
      name: true,
      city: true,
      state: true,
      bills: {
        select: {
          status: true,
          amount: true
        }
      }
    }
  });

  const formatted = byRegion.map((region) => {
    const total = region.bills.reduce((acc, bill) => acc + Number(bill.amount), 0);
    const paid = region.bills.filter((bill) => bill.status === "PAID").reduce((acc, bill) => acc + Number(bill.amount), 0);
    return {
      id: region.id,
      name: region.name,
      location: `${region.city}, ${region.state}`,
      total,
      paid
    };
  });

  return NextResponse.json({
    totalPaid: Number(totalPaid._sum.amount ?? 0),
    regions: formatted
  });
}
