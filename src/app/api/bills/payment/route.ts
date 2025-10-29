import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

const schema = z.object({
  billId: z.string(),
  referenceNo: z.string().min(2),
  paymentDate: z.string(),
  amountPaid: z.coerce.number().positive(),
  paymentMode: z.string().min(2),
  notes: z.string().optional()
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.user.role !== Role.ACCOUNTS) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const parsed = schema.safeParse({
    billId: formData.get("billId"),
    referenceNo: formData.get("referenceNo"),
    paymentDate: formData.get("paymentDate"),
    amountPaid: formData.get("amountPaid"),
    paymentMode: formData.get("paymentMode"),
    notes: formData.get("notes")
  });

  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
  }

  const bill = await prisma.bill.findUnique({ where: { id: parsed.data.billId } });
  if (!bill) {
    return NextResponse.json({ message: "Bill not found" }, { status: 404 });
  }

  if (bill.status !== "PENDING_PAYMENT") {
    return NextResponse.json({ message: "Bill not ready for payment" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.payment.upsert({
      where: { billId: bill.id },
      update: {
        referenceNo: parsed.data.referenceNo,
        paymentDate: new Date(parsed.data.paymentDate),
        amountPaid: parsed.data.amountPaid,
        paymentMode: parsed.data.paymentMode,
        notes: parsed.data.notes ?? undefined,
        createdById: session.user.id
      },
      create: {
        billId: bill.id,
        referenceNo: parsed.data.referenceNo,
        paymentDate: new Date(parsed.data.paymentDate),
        amountPaid: parsed.data.amountPaid,
        paymentMode: parsed.data.paymentMode,
        notes: parsed.data.notes ?? undefined,
        createdById: session.user.id
      }
    }),
    prisma.bill.update({
      where: { id: bill.id },
      data: {
        status: "PAID",
        logs: {
          create: {
            actorId: session.user.id,
            from: bill.status,
            to: "PAID",
            note: `Payment recorded (${parsed.data.paymentMode})`
          }
        }
      }
    })
  ]);

  return NextResponse.json({ success: true });
}
