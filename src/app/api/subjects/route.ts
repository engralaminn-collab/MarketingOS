import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/api-middleware";
import { sanitizeInput, createAuditLog, ipFromRequest } from "@/lib/security";

export const GET = withAuth(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get("departmentId");
    const batchId = searchParams.get("batchId");

    const where: Record<string, unknown> = {};
    if (departmentId) {
      where.departmentId = departmentId;
    }
    if (batchId) {
      // Find subjects that have schedules for this batch
      const scheduleSubjectIds = await db.classSchedule.findMany({
        where: { batchId },
        select: { subjectId: true },
        distinct: ["subjectId"],
      });
      where.id = { in: scheduleSubjectIds.map((s) => s.subjectId) };
    }

    const subjects = await db.subject.findMany({
      where,
      include: {
        department: { select: { id: true, name: true, code: true } },
        institution: { select: { id: true, name: true, shortName: true } },
        _count: { select: { assignments: true, schedules: true, exams: true } },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ data: subjects });
  } catch (error) {
    console.error("Subjects GET error:", error);
    return NextResponse.json({ error: "Failed to fetch subjects" }, { status: 500 });
  }
}, { minRole: "admin" });

export const POST = withAuth(async (request, { user }) => {
  try {
    const body = await request.json();
    const name = sanitizeInput(body.name);
    const code = body.code ? sanitizeInput(body.code) : null;
    const description = body.description ? sanitizeInput(body.description) : null;
    const creditHours = body.creditHours ?? 3;
    const subjectType = body.subjectType ? sanitizeInput(body.subjectType) : "theory";
    const institutionId = body.institutionId;
    const departmentId = body.departmentId || null;

    if (!name) {
      return NextResponse.json({ error: "Subject name is required" }, { status: 400 });
    }

    if (!institutionId) {
      return NextResponse.json({ error: "Institution ID is required" }, { status: 400 });
    }

    const subject = await db.subject.create({
      data: { name, code, description, creditHours, subjectType, institutionId, departmentId },
      include: {
        department: { select: { id: true, name: true, code: true } },
        institution: { select: { id: true, name: true, shortName: true } },
      },
    });

    await createAuditLog({
      userId: user.userId,
      action: "create",
      resource: "subject",
      resourceId: subject.id,
      details: { name, code },
      ipAddress: ipFromRequest(request),
    });

    return NextResponse.json({ data: subject }, { status: 201 });
  } catch (error) {
    console.error("Subjects POST error:", error);
    return NextResponse.json({ error: "Failed to create subject" }, { status: 500 });
  }
}, { minRole: "admin" });
