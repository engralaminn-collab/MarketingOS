import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/api-middleware";
import { sanitizeInput, createAuditLog, ipFromRequest } from "@/lib/security";

export const GET = withAuth(async () => {
  try {
    const leaveTypes = await db.leaveType.findMany({
      include: {
        _count: { select: { requests: true } },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ data: leaveTypes });
  } catch (error) {
    console.error("LeaveTypes GET error:", error);
    return NextResponse.json({ error: "Failed to fetch leave types" }, { status: 500 });
  }
});

export const POST = withAuth(async (request, { user }) => {
  try {
    const body = await request.json();
    const name = sanitizeInput(body.name);
    const code = body.code ? sanitizeInput(body.code) : null;
    const daysPerYear = body.daysPerYear ?? 0;
    const isPaid = body.isPaid ?? true;
    const institutionId = body.institutionId;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (!institutionId) {
      return NextResponse.json({ error: "Institution ID is required" }, { status: 400 });
    }

    const leaveType = await db.leaveType.create({
      data: { name, code, daysPerYear, isPaid, institutionId },
      include: { _count: { select: { requests: true } } },
    });

    await createAuditLog({
      userId: user.userId,
      action: "create",
      resource: "leave_type",
      resourceId: leaveType.id,
      details: { name, code, daysPerYear, isPaid },
      ipAddress: ipFromRequest(request),
    });

    return NextResponse.json({ data: leaveType }, { status: 201 });
  } catch (error) {
    console.error("LeaveTypes POST error:", error);
    return NextResponse.json({ error: "Failed to create leave type" }, { status: 500 });
  }
}, { minRole: "admin" });
