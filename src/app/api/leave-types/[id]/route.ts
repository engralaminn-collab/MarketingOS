import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/api-middleware";
import { sanitizeInput, createAuditLog, ipFromRequest } from "@/lib/security";

export const PUT = withAuth(async (request, { params, user }) => {
  try {
    const { id } = await params;
    const existing = await db.leaveType.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Leave type not found" }, { status: 404 });
    }

    const body = await request.json();
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = sanitizeInput(body.name);
    if (body.code !== undefined) data.code = body.code ? sanitizeInput(body.code) : null;
    if (body.daysPerYear !== undefined) data.daysPerYear = body.daysPerYear;
    if (body.isPaid !== undefined) data.isPaid = body.isPaid;
    if (body.isActive !== undefined) data.isActive = body.isActive;

    const leaveType = await db.leaveType.update({
      where: { id },
      data,
      include: { _count: { select: { requests: true } } },
    });

    await createAuditLog({
      userId: user.userId,
      action: "update",
      resource: "leave_type",
      resourceId: id,
      details: data,
      ipAddress: ipFromRequest(request),
    });

    return NextResponse.json({ data: leaveType });
  } catch (error) {
    console.error("LeaveType PUT error:", error);
    return NextResponse.json({ error: "Failed to update leave type" }, { status: 500 });
  }
}, { minRole: "admin" });

export const DELETE = withAuth(async (request, { params, user }) => {
  try {
    const { id } = await params;
    const existing = await db.leaveType.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Leave type not found" }, { status: 404 });
    }

    await db.leaveType.delete({ where: { id } });

    await createAuditLog({
      userId: user.userId,
      action: "delete",
      resource: "leave_type",
      resourceId: id,
      details: { name: existing.name },
      ipAddress: ipFromRequest(request),
    });

    return NextResponse.json({ data: { message: "Leave type deleted successfully" } });
  } catch (error) {
    console.error("LeaveType DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete leave type" }, { status: 500 });
  }
}, { minRole: "admin" });
