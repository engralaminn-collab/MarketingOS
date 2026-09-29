import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/api-middleware";
import { sanitizeInput, createAuditLog, ipFromRequest } from "@/lib/security";

export const PUT = withAuth(async (request, { params, user }) => {
  try {
    const { id } = await params;
    const existing = await db.feeStructure.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Fee structure not found" }, { status: 404 });
    }

    const body = await request.json();
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = sanitizeInput(body.name);
    if (body.amount !== undefined) data.amount = body.amount;
    if (body.frequency !== undefined) data.frequency = sanitizeInput(body.frequency);
    if (body.isActive !== undefined) data.isActive = body.isActive;
    if (body.programId !== undefined) data.programId = body.programId || null;

    const feeStructure = await db.feeStructure.update({
      where: { id },
      data,
      include: {
        program: { select: { id: true, name: true, code: true } },
        institution: { select: { id: true, name: true, shortName: true } },
        _count: { select: { fees: true } },
      },
    });

    await createAuditLog({
      userId: user.userId,
      action: "update",
      resource: "fee_structure",
      resourceId: id,
      details: data,
      ipAddress: ipFromRequest(request),
    });

    return NextResponse.json({ data: feeStructure });
  } catch (error) {
    console.error("FeeStructure PUT error:", error);
    return NextResponse.json({ error: "Failed to update fee structure" }, { status: 500 });
  }
}, { minRole: "admin" });

export const DELETE = withAuth(async (request, { params, user }) => {
  try {
    const { id } = await params;
    const existing = await db.feeStructure.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Fee structure not found" }, { status: 404 });
    }

    await db.feeStructure.delete({ where: { id } });

    await createAuditLog({
      userId: user.userId,
      action: "delete",
      resource: "fee_structure",
      resourceId: id,
      details: { name: existing.name, amount: existing.amount },
      ipAddress: ipFromRequest(request),
    });

    return NextResponse.json({ data: { message: "Fee structure deleted successfully" } });
  } catch (error) {
    console.error("FeeStructure DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete fee structure" }, { status: 500 });
  }
}, { minRole: "admin" });
