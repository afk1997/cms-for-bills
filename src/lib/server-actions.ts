"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { authenticate, createSession, destroySession, getSession, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role, BillStatus } from "@prisma/client";
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
  ambulanceId: z.string(),
  initialStatus: z
    .enum(["PENDING_L1", "PENDING_L2", "PENDING_PAYMENT"])
    .optional()
});

export async function createBill(formData: FormData) {
  const session = await getSession();
  if (!session || (session.role !== Role.OPERATOR && session.role !== Role.ADMIN)) {
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
    ambulanceId: formData.get("ambulanceId"),
    initialStatus: formData.get("initialStatus")
  });

  if (!parsed.success) {
    return { error: "Invalid bill details" };
  }

  if (session.role !== Role.ADMIN && parsed.data.initialStatus) {
    return { error: "Not authorized" };
  }

  if (session.role === Role.ADMIN && !parsed.data.initialStatus) {
    return { error: "Select a workflow destination" };
  }

  const ambulance = await prisma.ambulance.findUnique({
    where: { id: parsed.data.ambulanceId },
    include: {
      region: true,
      operatorAssignments: {
        include: { operator: true },
        orderBy: { createdAt: "asc" }
      }
    }
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

  const destinationStatus: BillStatus =
    session.role === Role.ADMIN
      ? (parsed.data.initialStatus as BillStatus)
      : BillStatus.PENDING_L1;

  const submissionNote =
    session.role === Role.ADMIN
      ? getAdminSubmissionNote(destinationStatus)
      : "Bill submitted";

  const defaultOperatorId =
    session.role === Role.ADMIN
      ? ambulance.operatorAssignments[0]?.operatorId ?? session.user.id
      : session.user.id;

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
      operatorId: defaultOperatorId,
      status: destinationStatus,
      attachments: {
        create: attachments
      },
      logs: {
        create: {
          actorId: session.user.id,
          to: destinationStatus,
          note: submissionNote
        }
      }
    },
  });

  redirect("/dashboard");
}

function getAdminSubmissionNote(status: BillStatus) {
  switch (status) {
    case BillStatus.PENDING_L1:
      return "Admin submitted directly to Level 1";
    case BillStatus.PENDING_L2:
      return "Admin submitted directly to Level 2";
    case BillStatus.PENDING_PAYMENT:
      return "Admin routed bill to accounts";
    default:
      return "Admin submitted bill";
  }
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
    case Role.ADMIN:
      return ["PENDING_L1", "PENDING_L2", "PENDING_PAYMENT"];
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
  regionIds: z.array(z.string()).optional(),
  ambulanceIds: z.array(z.string()).optional()
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
      .map((id) => id.trim()),
    ambulanceIds: formData
      .getAll("ambulanceIds")
      .filter((id): id is string => typeof id === "string" && id.length > 0)
      .map((id) => id.trim())
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
        : undefined,
      ambulanceAssignments: parsed.data.ambulanceIds?.length
        ? {
            createMany: {
              data: parsed.data.ambulanceIds.map((ambulanceId) => ({ ambulanceId }))
            }
          }
        : undefined
    }
  });

  revalidatePath("/dashboard/admin/users");
  if (parsed.data.ambulanceIds?.length) {
    revalidatePath("/dashboard/admin/ambulances");
    const affectedAmbulances = new Set(parsed.data.ambulanceIds);
    for (const ambulanceId of affectedAmbulances) {
      revalidatePath(`/dashboard/admin/ambulances/${ambulanceId}`);
    }
  }

  return { user };
}

const updateUserSchema = z.object({
  userId: z.string(),
  name: z.string().min(3),
  email: z.string().email(),
  role: z.nativeEnum(Role),
  password: z.string().min(6).optional(),
  regionIds: z.array(z.string()).optional(),
  ambulanceIds: z.array(z.string()).optional()
});

export async function updateUser(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== Role.ADMIN) {
    return { error: "Not authorized" };
  }

  const password = formData.get("password");
  const parsed = updateUserSchema.safeParse({
    userId: formData.get("userId"),
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
    password: typeof password === "string" && password.trim().length ? password : undefined,
    regionIds: formData
      .getAll("regionIds")
      .filter((id): id is string => typeof id === "string" && id.length > 0)
      .map((id) => id.trim()),
    ambulanceIds: formData
      .getAll("ambulanceIds")
      .filter((id): id is string => typeof id === "string" && id.length > 0)
      .map((id) => id.trim())
  });

  if (!parsed.success) {
    return { error: "Invalid user data" };
  }

  const regionIds = parsed.data.regionIds ?? [];
  const ambulanceIds = parsed.data.ambulanceIds ?? [];

  const updates: { name: string; email: string; role: Role; passwordHash?: string } = {
    name: parsed.data.name,
    email: parsed.data.email,
    role: parsed.data.role
  };

  if (parsed.data.password) {
    updates.passwordHash = await hashPassword(parsed.data.password);
  }

  let previousAmbulanceIds: string[] = [];

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: parsed.data.userId },
      data: updates
    });

    if (regionIds.length) {
      await tx.userRegionAssignment.deleteMany({
        where: {
          userId: parsed.data.userId,
          regionId: { notIn: regionIds }
        }
      });
    } else {
      await tx.userRegionAssignment.deleteMany({ where: { userId: parsed.data.userId } });
    }

    const existingAssignments = await tx.userRegionAssignment.findMany({
      where: { userId: parsed.data.userId }
    });
    const assignedRegionIds = new Set(existingAssignments.map((assignment) => assignment.regionId));
    const regionsToCreate = regionIds.filter((regionId) => !assignedRegionIds.has(regionId));
    if (regionsToCreate.length) {
      await tx.userRegionAssignment.createMany({
        data: regionsToCreate.map((regionId) => ({ userId: parsed.data.userId, regionId }))
      });
    }

    const existingAmbulanceAssignments = await tx.ambulanceOperatorAssignment.findMany({
      where: { operatorId: parsed.data.userId }
    });
    previousAmbulanceIds = existingAmbulanceAssignments.map((assignment) => assignment.ambulanceId);
    if (ambulanceIds.length) {
      await tx.ambulanceOperatorAssignment.deleteMany({
        where: {
          operatorId: parsed.data.userId,
          ambulanceId: { notIn: ambulanceIds }
        }
      });
    } else {
      await tx.ambulanceOperatorAssignment.deleteMany({ where: { operatorId: parsed.data.userId } });
    }

    const currentAmbulanceIds = new Set(previousAmbulanceIds);
    const ambulancesToCreate = ambulanceIds.filter((ambulanceId) => !currentAmbulanceIds.has(ambulanceId));
    if (ambulancesToCreate.length) {
      await tx.ambulanceOperatorAssignment.createMany({
        data: ambulancesToCreate.map((ambulanceId) => ({
          operatorId: parsed.data.userId,
          ambulanceId
        }))
      });
    }
  });

  revalidatePath("/dashboard/admin/users");
  revalidatePath(`/dashboard/admin/users/${parsed.data.userId}`);
  const affectedAmbulances = new Set([...previousAmbulanceIds, ...ambulanceIds]);
  if (affectedAmbulances.size) {
    revalidatePath("/dashboard/admin/ambulances");
    for (const ambulanceId of affectedAmbulances) {
      revalidatePath(`/dashboard/admin/ambulances/${ambulanceId}`);
    }
  }

  redirect("/dashboard/admin/users");
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

  revalidatePath("/dashboard/admin/regions");

  return { region };
}

const ambulanceSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2),
  regionId: z.string(),
  operatorIds: z.array(z.string()).optional()
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
    operatorIds: formData
      .getAll("operatorIds")
      .filter((id): id is string => typeof id === "string" && id.length > 0)
      .map((id) => id.trim())
  });

  if (!parsed.success) {
    return { error: "Invalid ambulance data" };
  }

  const ambulance = await prisma.ambulance.create({
    data: {
      name: parsed.data.name,
      code: parsed.data.code,
      regionId: parsed.data.regionId,
      operatorAssignments: parsed.data.operatorIds?.length
        ? {
            createMany: {
              data: parsed.data.operatorIds.map((operatorId) => ({ operatorId }))
            }
          }
        : undefined
    }
  });

  revalidatePath("/dashboard/admin/ambulances");

  if (parsed.data.operatorIds?.length) {
    revalidatePath("/dashboard/admin/users");
    const affectedUsers = new Set(parsed.data.operatorIds);
    for (const operatorId of affectedUsers) {
      revalidatePath(`/dashboard/admin/users/${operatorId}`);
    }
  }

  return { ambulance };
}

const updateRegionSchema = regionSchema.extend({
  regionId: z.string()
});

export async function updateRegion(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== Role.ADMIN) {
    return { error: "Not authorized" };
  }

  const parsed = updateRegionSchema.safeParse({
    regionId: formData.get("regionId"),
    name: formData.get("name"),
    city: formData.get("city"),
    state: formData.get("state")
  });

  if (!parsed.success) {
    return { error: "Invalid region data" };
  }

  await prisma.region.update({
    where: { id: parsed.data.regionId },
    data: {
      name: parsed.data.name,
      city: parsed.data.city,
      state: parsed.data.state
    }
  });

  revalidatePath("/dashboard/admin/regions");
  revalidatePath(`/dashboard/admin/regions/${parsed.data.regionId}`);
  revalidatePath("/dashboard/admin/ambulances");

  redirect("/dashboard/admin/regions");
}

const updateAmbulanceSchema = ambulanceSchema.extend({
  ambulanceId: z.string()
});

export async function updateAmbulance(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== Role.ADMIN) {
    return { error: "Not authorized" };
  }

  const parsed = updateAmbulanceSchema.safeParse({
    ambulanceId: formData.get("ambulanceId"),
    name: formData.get("name"),
    code: formData.get("code"),
    regionId: formData.get("regionId"),
    operatorIds: formData
      .getAll("operatorIds")
      .filter((id): id is string => typeof id === "string" && id.length > 0)
      .map((id) => id.trim())
  });

  if (!parsed.success) {
    return { error: "Invalid ambulance data" };
  }

  const existing = await prisma.ambulance.findUnique({
    where: { id: parsed.data.ambulanceId },
    select: {
      regionId: true,
      operatorAssignments: { select: { operatorId: true } }
    }
  });

  if (!existing) {
    return { error: "Ambulance not found" };
  }

  const newOperatorIds = parsed.data.operatorIds ?? [];
  const previousOperatorIds = existing.operatorAssignments.map((assignment) => assignment.operatorId);

  let updatedAmbulance: { id: string; regionId: string } | null = null;

  await prisma.$transaction(async (tx) => {
    updatedAmbulance = await tx.ambulance.update({
      where: { id: parsed.data.ambulanceId },
      data: {
        name: parsed.data.name,
        code: parsed.data.code,
        regionId: parsed.data.regionId
      },
      select: { id: true, regionId: true }
    });

    if (newOperatorIds.length) {
      await tx.ambulanceOperatorAssignment.deleteMany({
        where: {
          ambulanceId: parsed.data.ambulanceId,
          operatorId: { notIn: newOperatorIds }
        }
      });
    } else {
      await tx.ambulanceOperatorAssignment.deleteMany({
        where: { ambulanceId: parsed.data.ambulanceId }
      });
    }

    const currentOperatorIds = new Set(previousOperatorIds);
    const operatorsToCreate = newOperatorIds.filter((operatorId) => !currentOperatorIds.has(operatorId));
    if (operatorsToCreate.length) {
      await tx.ambulanceOperatorAssignment.createMany({
        data: operatorsToCreate.map((operatorId) => ({
          ambulanceId: parsed.data.ambulanceId,
          operatorId
        }))
      });
    }
  });

  if (!updatedAmbulance) {
    return { error: "Failed to update ambulance" };
  }

  revalidatePath("/dashboard/admin/ambulances");
  revalidatePath(`/dashboard/admin/ambulances/${parsed.data.ambulanceId}`);
  revalidatePath("/dashboard/admin/regions");

  const affectedRegions = new Set([existing.regionId, updatedAmbulance.regionId]);
  for (const regionId of affectedRegions) {
    revalidatePath(`/dashboard/admin/regions/${regionId}`);
  }

  const affectedUsers = new Set([...previousOperatorIds, ...newOperatorIds]);

  for (const userId of affectedUsers) {
    revalidatePath(`/dashboard/admin/users/${userId}`);
  }

  revalidatePath("/dashboard/admin/users");

  redirect("/dashboard/admin/ambulances");
}
