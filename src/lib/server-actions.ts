"use server";

import { redirect } from "next/navigation";
import { authenticate, createSession, destroySession, getSession, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { z } from "zod";
import { saveFile } from "@/lib/upload";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

export async function login(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password")
  });
  if (!parsed.success) {
    return { error: "Invalid credentials" };
  }

  const user = await authenticate(parsed.data.email, parsed.data.password);
  if (!user) {
    return { error: "Invalid email or password" };
  }
  await createSession({ userId: user.id, role: user.role });
  redirect("/dashboard");
}

export async function logout() {
  destroySession();
  redirect("/login");
}

const createBillSchema = z.object({
  title: z.string().min(3),
  vendor: z.string().min(2),
  amount: z.coerce.number().positive(),
  currency: z.string().min(1),
  invoiceNumber: z.string().min(2),
  invoiceDate: z.string(),
  description: z.string().optional(),
  ambulanceId: z.string()
});

export async function createBill(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== Role.OPERATOR) {
    return { error: "Not authorized" };
  }

  const parsed = createBillSchema.safeParse({
    title: formData.get("title"),
    vendor: formData.get("vendor"),
    amount: formData.get("amount"),
    currency: formData.get("currency") ?? "INR",
    invoiceNumber: formData.get("invoiceNumber"),
    invoiceDate: formData.get("invoiceDate"),
    description: formData.get("description"),
    ambulanceId: formData.get("ambulanceId")
  });

  if (!parsed.success) {
    return { error: "Invalid bill details" };
  }

  const ambulance = await prisma.ambulance.findUnique({
    where: { id: parsed.data.ambulanceId },
    include: { region: true }
  });
  if (!ambulance) {
    return { error: "Ambulance not found" };
  }

  const files = formData.getAll("attachments");
  const attachments = [] as { fileName: string; fileUrl: string }[];
  for (const file of files) {
    if (file instanceof File && file.size > 0) {
      const saved = await saveFile(file);
      attachments.push(saved);
    }
  }

  await prisma.bill.create({
    data: {
      title: parsed.data.title,
      vendor: parsed.data.vendor,
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      invoiceNumber: parsed.data.invoiceNumber,
      invoiceDate: new Date(parsed.data.invoiceDate),
      description: parsed.data.description,
      regionId: ambulance.regionId,
      ambulanceId: ambulance.id,
      operatorId: session.user.id,
      attachments: {
        create: attachments
      },
      logs: {
        create: {
          actorId: session.user.id,
          to: "PENDING_L1",
          note: "Bill submitted"
        }
      }
    },
  });

  redirect("/dashboard");
}

const statusTransitionSchema = z.object({
  billId: z.string(),
  status: z.enum([
    "PENDING_L2",
    "RETURNED_L1",
    "REJECTED_L1",
    "PENDING_PAYMENT",
    "RETURNED_L2",
    "REJECTED_L2",
    "PAID"
  ]),
  note: z.string().optional()
});

export async function transitionBill(formData: FormData) {
  const session = await getSession();
  if (!session) {
    return { error: "Not authorized" };
  }

  const parsed = statusTransitionSchema.safeParse({
    billId: formData.get("billId"),
    status: formData.get("status"),
    note: formData.get("note")
  });

  if (!parsed.success) {
    return { error: "Invalid status update" };
  }

  const bill = await prisma.bill.findUnique({ where: { id: parsed.data.billId } });
  if (!bill) {
    return { error: "Bill not found" };
  }

  const allowed = getAllowedStatus(session.role, bill.status);
  if (!allowed.includes(parsed.data.status)) {
    return { error: "Status not allowed" };
  }

  const updated = await prisma.bill.update({
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

  return { bill: updated };
}

function getAllowedStatus(role: Role, current: string) {
  switch (role) {
    case Role.LEVEL1:
      return current === "PENDING_L1" ? ["PENDING_L2", "RETURNED_L1", "REJECTED_L1"] : [];
    case Role.LEVEL2:
      return current === "PENDING_L2" ? ["PENDING_PAYMENT", "RETURNED_L2", "REJECTED_L2"] : [];
    case Role.ACCOUNTS:
      return current === "PENDING_PAYMENT" ? ["PAID"] : [];
    default:
      return [];
  }
}

const paymentSchema = z.object({
  billId: z.string(),
  referenceNo: z.string().min(3),
  paymentDate: z.string(),
  amountPaid: z.coerce.number().positive(),
  paymentMode: z.string().min(2),
  notes: z.string().optional()
});

export async function recordPayment(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== Role.ACCOUNTS) {
    return { error: "Not authorized" };
  }

  const parsed = paymentSchema.safeParse({
    billId: formData.get("billId"),
    referenceNo: formData.get("referenceNo"),
    paymentDate: formData.get("paymentDate"),
    amountPaid: formData.get("amountPaid"),
    paymentMode: formData.get("paymentMode"),
    notes: formData.get("notes")
  });

  if (!parsed.success) {
    return { error: "Invalid payment data" };
  }

  const bill = await prisma.bill.findUnique({ where: { id: parsed.data.billId } });
  if (!bill) {
    return { error: "Bill not found" };
  }

  if (bill.status !== "PENDING_PAYMENT") {
    return { error: "Bill is not ready for payment" };
  }

  const payment = await prisma.payment.upsert({
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
  });

  await prisma.bill.update({
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
  });

  return { payment };
}

const userSchema = z.object({
  name: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.nativeEnum(Role),
  regionIds: z.array(z.string()).optional()
});

export async function createUser(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== Role.ADMIN) {
    return { error: "Not authorized" };
  }

  const parsed = userSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
    regionIds: formData
      .getAll("regionIds")
      .filter((id): id is string => typeof id === "string" && id.length > 0)
  });

  if (!parsed.success) {
    return { error: "Invalid user data" };
  }

  const hashed = await hashPassword(parsed.data.password);

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash: hashed,
      role: parsed.data.role,
      regions: parsed.data.regionIds?.length
        ? {
            createMany: {
              data: parsed.data.regionIds.map((regionId) => ({ regionId }))
            }
          }
        : undefined
    }
  });

  return { user };
}

const regionSchema = z.object({
  name: z.string().min(2),
  city: z.string().min(2),
  state: z.string().min(2)
});

export async function createRegion(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== Role.ADMIN) {
    return { error: "Not authorized" };
  }

  const parsed = regionSchema.safeParse({
    name: formData.get("name"),
    city: formData.get("city"),
    state: formData.get("state")
  });

  if (!parsed.success) {
    return { error: "Invalid region data" };
  }

  const region = await prisma.region.create({
    data: parsed.data
  });

  return { region };
}

const ambulanceSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2),
  regionId: z.string(),
  operatorId: z.string().optional()
});

export async function createAmbulance(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== Role.ADMIN) {
    return { error: "Not authorized" };
  }

  const parsed = ambulanceSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code"),
    regionId: formData.get("regionId"),
    operatorId: formData.get("operatorId") || undefined
  });

  if (!parsed.success) {
    return { error: "Invalid ambulance data" };
  }

  const ambulance = await prisma.ambulance.create({
    data: {
      name: parsed.data.name,
      code: parsed.data.code,
      regionId: parsed.data.regionId,
      operatorId: parsed.data.operatorId
    }
  });

  return { ambulance };
}
