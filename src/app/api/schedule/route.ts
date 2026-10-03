import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/api-middleware";
import { sanitizeInput, createAuditLog, ipFromRequest } from "@/lib/security";

export const GET = withAuth(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const dayOfWeek = searchParams.get("dayOfWeek");
    const batchId = searchParams.get("batchId");
    const teacherId = searchParams.get("teacherId");

    const where: Record<string, unknown> = {};
    if (dayOfWeek) where.dayOfWeek = sanitizeInput(dayOfWeek);
    if (batchId) where.batchId = batchId;
    if (teacherId) where.teacherId = teacherId;

    const schedules = await db.classSchedule.findMany({
      where,
      include: {
        subject: { select: { id: true, name: true, code: true } },
        batch: { select: { id: true, name: true, academicYear: true } },
        teacher: { select: { id: true, name: true, email: true, avatar: true } },
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });

    return NextResponse.json({ data: schedules });
  } catch (error) {
    console.error("Schedule GET error:", error);
    return NextResponse.json({ error: "Failed to fetch schedules" }, { status: 500 });
  }
}, { minRole: "teacher" });

export const POST = withAuth(async (request, { user }) => {
  try {
    const body = await request.json();
    const dayOfWeek = sanitizeInput(body.dayOfWeek);
    const startTime = sanitizeInput(body.startTime);
    const endTime = sanitizeInput(body.endTime);
    const room = body.room ? sanitizeInput(body.room) : null;
    const batchId = body.batchId || null;
    const subjectId = body.subjectId || null;
    const teacherId = body.teacherId || null;
    const institutionId = body.institutionId || null;

    if (!dayOfWeek || !startTime || !endTime) {
      return NextResponse.json(
        { error: "Day of week, start time, and end time are required" },
        { status: 400 }
      );
    }

    const schedule = await db.classSchedule.create({
      data: {
        dayOfWeek,
        startTime,
        endTime,
        room,
        batchId,
        subjectId,
        teacherId,
        institutionId,
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        batch: { select: { id: true, name: true, academicYear: true } },
        teacher: { select: { id: true, name: true, email: true, avatar: true } },
      },
    });

    await createAuditLog({
      userId: user.userId,
      action: "create",
      resource: "class_schedule",
      resourceId: schedule.id,
      details: { dayOfWeek, startTime, endTime, batchId, subjectId, teacherId },
      ipAddress: ipFromRequest(request),
    });

    return NextResponse.json({ data: schedule }, { status: 201 });
  } catch (error) {
    console.error("Schedule POST error:", error);
    return NextResponse.json({ error: "Failed to create schedule" }, { status: 500 });
  }
}, { minRole: "teacher" });
