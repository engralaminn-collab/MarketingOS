import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/api-middleware";
import { sanitizeInput, createAuditLog, ipFromRequest } from "@/lib/security";

export const PUT = withAuth(async (request, { params, user }) => {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await db.classSchedule.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (body.dayOfWeek !== undefined) data.dayOfWeek = sanitizeInput(body.dayOfWeek);
    if (body.startTime !== undefined) data.startTime = sanitizeInput(body.startTime);
    if (body.endTime !== undefined) data.endTime = sanitizeInput(body.endTime);
    if (body.room !== undefined) data.room = body.room ? sanitizeInput(body.room) : null;
    if (body.batchId !== undefined) data.batchId = body.batchId || null;
    if (body.subjectId !== undefined) data.subjectId = body.subjectId || null;
    if (body.teacherId !== undefined) data.teacherId = body.teacherId || null;

    const schedule = await db.classSchedule.update({
      where: { id },
      data,
      include: {
        subject: { select: { id: true, name: true, code: true } },
        batch: { select: { id: true, name: true, academicYear: true } },
        teacher: { select: { id: true, name: true, email: true, avatar: true } },
      },
    });

    await createAuditLog({
      userId: user.userId,
      action: "update",
      resource: "class_schedule",
      resourceId: id,
      details: data,
      ipAddress: ipFromRequest(request),
    });

    return NextResponse.json({ data: schedule });
  } catch (error) {
    console.error("Schedule PUT error:", error);
    return NextResponse.json({ error: "Failed to update schedule" }, { status: 500 });
  }
}, { minRole: "teacher" });

export const DELETE = withAuth(async (request, { params, user }) => {
  try {
    const { id } = await params;
    const existing = await db.classSchedule.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    }

    await db.classSchedule.delete({ where: { id } });

    await createAuditLog({
      userId: user.userId,
      action: "delete",
      resource: "class_schedule",
      resourceId: id,
      details: { dayOfWeek: existing.dayOfWeek, startTime: existing.startTime },
      ipAddress: ipFromRequest(request),
    });

    return NextResponse.json({ data: { message: "Schedule deleted successfully" } });
  } catch (error) {
    console.error("Schedule DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete schedule" }, { status: 500 });
  }
}, { minRole: "teacher" });
