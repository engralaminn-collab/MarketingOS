import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/api-middleware";
import { sanitizeInput, createAuditLog, ipFromRequest } from "@/lib/security";

export const GET = withAuth(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const studentId = searchParams.get("studentId");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (studentId) where.userId = studentId;

    const skip = (page - 1) * limit;
    const [fees, total] = await Promise.all([
      db.fee.findMany({
        where,
        include: {
          user: {
            // Prisma rejects `include` alongside `select` on the same relation;
            // nest the relation inside the select instead.
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
              studentProfile: { select: { studentId: true, admissionStatus: true } },
            },
          },
          feeStructure: { select: { id: true, name: true, frequency: true } },
          payments: { select: { id: true, amount: true, method: true, paidAt: true, status: true } },
          _count: { select: { payments: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.fee.count({ where }),
    ]);

    return NextResponse.json({
      data: fees,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Fees GET error:", error);
    return NextResponse.json({ error: "Failed to fetch fees" }, { status: 500 });
  }
});

export const POST = withAuth(async (request, { user }) => {
  try {
    const body = await request.json();
    const userId = body.userId;
    const amount = body.amount;
    const dueDate = body.dueDate ? new Date(body.dueDate) : null;
    const feeStructureId = body.feeStructureId || null;
    const discount = body.discount ?? 0;
    const fine = body.fine ?? 0;

    if (!userId || amount === undefined || amount === null) {
      return NextResponse.json({ error: "userId and amount are required" }, { status: 400 });
    }

    const fee = await db.fee.create({
      data: {
        userId,
        amount,
        dueDate,
        feeStructureId,
        discount,
        fine,
        status: "pending",
        paidAmount: 0,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            studentProfile: { select: { studentId: true } },
          },
        },
        feeStructure: { select: { id: true, name: true, frequency: true } },
      },
    });

    await createAuditLog({
      userId: user.userId,
      action: "create",
      resource: "fee",
      resourceId: fee.id,
      details: { userId, amount, dueDate: body.dueDate, feeStructureId },
      ipAddress: ipFromRequest(request),
    });

    return NextResponse.json({ data: fee }, { status: 201 });
  } catch (error) {
    console.error("Fees POST error:", error);
    return NextResponse.json({ error: "Failed to create fee" }, { status: 500 });
  }
}, { minRole: "accountant" });
