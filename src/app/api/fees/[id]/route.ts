import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/api-middleware";
import { createAuditLog, ipFromRequest } from "@/lib/security";

export const GET = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;
    const fee = await db.fee.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            studentProfile: { select: { studentId: true, admissionStatus: true } },
          },
        },
        feeStructure: { select: { id: true, name: true, frequency: true, amount: true } },
        payments: {
          select: { id: true, amount: true, method: true, paidAt: true, status: true, receiptNo: true },
          orderBy: { createdAt: "desc" },
        },
        _count: { select: { payments: true } },
      },
    });

    if (!fee) {
      return NextResponse.json({ error: "Fee not found" }, { status: 404 });
    }

    return NextResponse.json({ data: fee });
  } catch (error) {
    console.error("Fee GET by id error:", error);
    return NextResponse.json({ error: "Failed to fetch fee" }, { status: 500 });
  }
});

export const PUT = withAuth(async (request, { params, user }) => {
  try {
    const { id } = await params;
    const existing = await db.fee.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Fee not found" }, { status: 404 });
    }

    const body = await request.json();
    const data: Record<string, unknown> = {};
    if (body.amount !== undefined) data.amount = body.amount;
    if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    if (body.discount !== undefined) data.discount = body.discount;
    if (body.fine !== undefined) data.fine = body.fine;
    if (body.status !== undefined) data.status = body.status;
    if (body.paidAmount !== undefined) data.paidAmount = body.paidAmount;
    if (body.feeStructureId !== undefined) data.feeStructureId = body.feeStructureId || null;

    const fee = await db.fee.update({
      where: { id },
      data,
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
      action: "update",
      resource: "fee",
      resourceId: id,
      details: data,
      ipAddress: ipFromRequest(request),
    });

    return NextResponse.json({ data: fee });
  } catch (error) {
    console.error("Fee PUT error:", error);
    return NextResponse.json({ error: "Failed to update fee" }, { status: 500 });
  }
}, { minRole: "accountant" });
