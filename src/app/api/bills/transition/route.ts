import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role, BillStatus } from "@prisma/client";

const schema = z.object({
  billId: z.string(),
  status: z.nativeEnum(BillStatus),
  note: z.string().optional()
});

function allowedStatuses(role: Role, current: BillStatus): BillStatus[] {
  switch (role) {
    case "LEVEL1":
      return current === "PENDING_L1" ? ["PENDING_L2", "RETURNED_L1", "REJECTED_L1"] : [];
    case "LEVEL2":
      return current === "PENDING_L2" ? ["PENDING_PAYMENT", "RETURNED_L2", "REJECTED_L2"] : [];
    case "ADMIN":
      return ["PENDING_L1", "PENDING_L2", "PENDING_PAYMENT"];
    default:
      return [];
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const parsed = schema.safeParse({
    billId: formData.get("billId"),
    status: formData.get("status"),
    note: formData.get("note")
  });

  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
  }

  const bill = await prisma.bill.findUnique({ where: { id: parsed.data.billId } });
  if (!bill) {
    return NextResponse.json({ message: "Bill not found" }, { status: 404 });
  }

  const allowed = allowedStatuses(session.user.role, bill.status);
  if (!allowed.includes(parsed.data.status)) {
    return NextResponse.json({ message: "Action not allowed" }, { status: 403 });
  }

  await prisma.bill.update({
    where: { id: bill.id },
    data: {
      status: parsed.data.status,
      logs: {
        create: {
          actorId: session.user.id,
          from: bill.status,
          to: parsed.data.status,
          note: parsed.data.note
        }
      }
    }
  });

  return NextResponse.json({ success: true });
}
