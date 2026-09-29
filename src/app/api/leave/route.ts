import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/api-middleware";
import { sanitizeInput, createAuditLog, ipFromRequest } from "@/lib/security";

export const GET = withAuth(async (request, { user }) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const userId = searchParams.get("userId");

    const isAdmin = user.isSuperAdmin || user.role === "admin";

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (!isAdmin) {
      // Teacher/employee can only see own leave requests
      where.userId = user.userId;
    } else if (userId) {
      where.userId = userId;
    }

    const leaveRequests = await db.leaveRequest.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, avatar: true } },
        leaveType: { select: { id: true, name: true, code: true, isPaid: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: leaveRequests });
  } catch (error) {
    console.error("Leave GET error:", error);
    return NextResponse.json({ error: "Failed to fetch leave requests" }, { status: 500 });
  }
});

export const POST = withAuth(async (request, { user }) => {
  try {
    const body = await request.json();
    const startDate = body.startDate ? new Date(body.startDate) : null;
    const endDate = body.endDate ? new Date(body.endDate) : null;
    const reason = body.reason ? sanitizeInput(body.reason) : null;
    const leaveTypeId = body.leaveTypeId || null;

    if (!startDate || !endDate) {
      return NextResponse.json({ error: "Start date and end date are required" }, { status: 400 });
    }

    if (endDate < startDate) {
      return NextResponse.json({ error: "End date must be after start date" }, { status: 400 });
    }

    const diffMs = endDate.getTime() - startDate.getTime();
    const totalDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1);

    const leaveRequest = await db.leaveRequest.create({
      data: {
        startDate,
        endDate,
        totalDays,
        reason,
        userId: user.userId,
        leaveTypeId,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        leaveType: { select: { id: true, name: true, code: true, isPaid: true } },
      },
    });

    await createAuditLog({
      userId: user.userId,
      action: "create",
      resource: "leave_request",
      resourceId: leaveRequest.id,
      details: { startDate: body.startDate, endDate: body.endDate, totalDays, reason },
      ipAddress: ipFromRequest(request),
    });

    return NextResponse.json({ data: leaveRequest }, { status: 201 });
  } catch (error) {
    console.error("Leave POST error:", error);
    return NextResponse.json({ error: "Failed to create leave request" }, { status: 500 });
  }
});
