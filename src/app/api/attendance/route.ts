import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/api-middleware";
import { sanitizeInput, createAuditLog, ipFromRequest } from "@/lib/security";

export const GET = withAuth(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date");
    const subjectId = searchParams.get("subjectId");
    const batchId = searchParams.get("batchId");
    const studentId = searchParams.get("studentId");

    const where: Record<string, unknown> = {};
    if (dateStr) {
      const startOfDay = new Date(dateStr);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(dateStr);
      endOfDay.setHours(23, 59, 59, 999);
      where.date = { gte: startOfDay, lte: endOfDay };
    }
    if (subjectId) where.subjectId = subjectId;
    if (batchId) where.batchId = batchId;
    if (studentId) where.userId = studentId;

    const records = await db.attendanceRecord.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, avatar: true } },
        subject: { select: { id: true, name: true, code: true } },
      },
      orderBy: { date: "desc" },
    });

    return NextResponse.json({ data: records });
  } catch (error) {
    console.error("Attendance GET error:", error);
    return NextResponse.json({ error: "Failed to fetch attendance" }, { status: 500 });
  }
}, { minRole: "teacher" });

export const POST = withAuth(async (request, { user }) => {
  try {
    const body = await request.json();
    const { date, subjectId, batchId, records } = body;

    if (!date || !records || !Array.isArray(records) || records.length === 0) {
      return NextResponse.json(
        { error: "Date and records array are required" },
        { status: 400 }
      );
    }

    const attendanceDate = new Date(date);

    // Delete existing records for the same date/subject/batch to allow re-marking
    if (subjectId) {
      const startOfDay = new Date(attendanceDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(attendanceDate);
      endOfDay.setHours(23, 59, 59, 999);

      await db.attendanceRecord.deleteMany({
        where: {
          date: { gte: startOfDay, lte: endOfDay },
          subjectId,
          ...(batchId ? { batchId } : {}),
        },
      });
    }

    const createdRecords = await db.attendanceRecord.createMany({
      data: records.map((record: { userId: string; status: string; remarks?: string }) => ({
        date: attendanceDate,
        status: sanitizeInput(record.status),
        remarks: record.remarks ? sanitizeInput(record.remarks) : null,
        userId: record.userId,
        subjectId: subjectId || null,
        batchId: batchId || null,
        markedBy: user.userId,
      })),
    });

    await createAuditLog({
      userId: user.userId,
      action: "create",
      resource: "attendance",
      details: { date, subjectId, batchId, count: records.length },
      ipAddress: ipFromRequest(request),
    });

    return NextResponse.json({
      data: { message: "Attendance marked successfully", count: createdRecords.count },
    }, { status: 201 });
  } catch (error) {
    console.error("Attendance POST error:", error);
    return NextResponse.json({ error: "Failed to mark attendance" }, { status: 500 });
  }
}, { minRole: "teacher" });
