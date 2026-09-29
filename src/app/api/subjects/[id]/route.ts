import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/api-middleware";
import { sanitizeInput, createAuditLog, ipFromRequest } from "@/lib/security";

export const GET = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;
    const subject = await db.subject.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, name: true, code: true } },
        institution: { select: { id: true, name: true, shortName: true } },
        assignments: { select: { id: true, title: true, status: true } },
        exams: { select: { id: true, name: true, examType: true, status: true } },
        schedules: { select: { id: true, dayOfWeek: true, startTime: true, endTime: true } },
        _count: { select: { assignments: true, schedules: true, exams: true, attendanceRecords: true } },
      },
    });

    if (!subject) {
      return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    }

    return NextResponse.json({ data: subject });
  } catch (error) {
    console.error("Subject GET by id error:", error);
    return NextResponse.json({ error: "Failed to fetch subject" }, { status: 500 });
  }
}, { minRole: "admin" });

export const PUT = withAuth(async (request, { params, user }) => {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await db.subject.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = sanitizeInput(body.name);
    if (body.code !== undefined) data.code = body.code ? sanitizeInput(body.code) : null;
    if (body.description !== undefined) data.description = body.description ? sanitizeInput(body.description) : null;
    if (body.creditHours !== undefined) data.creditHours = Number(body.creditHours);
    if (body.subjectType !== undefined) data.subjectType = sanitizeInput(body.subjectType);
    if (body.departmentId !== undefined) data.departmentId = body.departmentId || null;
    if (body.isActive !== undefined) data.isActive = body.isActive;

    const subject = await db.subject.update({
      where: { id },
      data,
      include: {
        department: { select: { id: true, name: true, code: true } },
        institution: { select: { id: true, name: true, shortName: true } },
      },
    });

    await createAuditLog({
      userId: user.userId,
      action: "update",
      resource: "subject",
      resourceId: id,
      details: data,
      ipAddress: ipFromRequest(request),
    });

    return NextResponse.json({ data: subject });
  } catch (error) {
    console.error("Subject PUT error:", error);
    return NextResponse.json({ error: "Failed to update subject" }, { status: 500 });
  }
}, { minRole: "admin" });

export const DELETE = withAuth(async (request, { params, user }) => {
  try {
    const { id } = await params;
    const existing = await db.subject.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    }

    await db.subject.delete({ where: { id } });

    await createAuditLog({
      userId: user.userId,
      action: "delete",
      resource: "subject",
      resourceId: id,
      details: { name: existing.name },
      ipAddress: ipFromRequest(request),
    });

    return NextResponse.json({ data: { message: "Subject deleted successfully" } });
  } catch (error) {
    console.error("Subject DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete subject" }, { status: 500 });
  }
}, { minRole: "admin" });
