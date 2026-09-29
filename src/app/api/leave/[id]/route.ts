import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/api-middleware";
import { sanitizeInput, createAuditLog, ipFromRequest } from "@/lib/security";

export const PUT = withAuth(async (request, { params, user }) => {
  try {
    const { id } = await params;
    const existing = await db.leaveRequest.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Leave request not found" }, { status: 404 });
    }

    if (existing.status !== "pending") {
      return NextResponse.json({ error: "Leave request is already processed" }, { status: 400 });
    }

    const isAdmin = user.isSuperAdmin || user.role === "admin";
    if (!isAdmin) {
      return NextResponse.json({ error: "Only admins can approve/reject leave requests" }, { status: 403 });
    }

    const body = await request.json();
    const status = sanitizeInput(body.status);

    if (!status || !["approved", "rejected"].includes(status)) {
      return NextResponse.json({ error: "Status must be 'approved' or 'rejected'" }, { status: 400 });
    }

    const data: Record<string, unknown> = {
      status,
      approvedBy: user.userId,
      approvedAt: new Date(),
    };

    if (status === "rejected" && body.rejectionNote) {
      data.rejectionNote = sanitizeInput(body.rejectionNote);
    }

    const leaveRequest = await db.leaveRequest.update({
      where: { id },
      data,
      include: {
        user: { select: { id: true, name: true, email: true } },
        leaveType: { select: { id: true, name: true, code: true, isPaid: true } },
      },
    });

    await createAuditLog({
      userId: user.userId,
      action: "update",
      resource: "leave_request",
      resourceId: id,
      details: { status, rejectionNote: data.rejectionNote },
      ipAddress: ipFromRequest(request),
    });

    return NextResponse.json({ data: leaveRequest });
  } catch (error) {
    console.error("Leave PUT error:", error);
    return NextResponse.json({ error: "Failed to update leave request" }, { status: 500 });
  }
});
