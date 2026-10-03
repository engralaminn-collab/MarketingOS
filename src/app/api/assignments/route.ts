import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/api-middleware";
import { sanitizeInput, createAuditLog, ipFromRequest } from "@/lib/security";

export const GET = withAuth(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const subjectId = searchParams.get("subjectId");
    const status = searchParams.get("status");
    const batchId = searchParams.get("batchId");

    const where: Record<string, unknown> = {};
    if (subjectId) where.subjectId = subjectId;
    if (status) where.status = sanitizeInput(status);

    let assignments;
    if (batchId) {
      // Find subjects associated with this batch via schedules
      const subjectIds = await db.classSchedule.findMany({
        where: { batchId },
        select: { subjectId: true },
        distinct: ["subjectId"],
      });
      const subjectIdList = subjectIds.map((s) => s.subjectId).filter(Boolean);
      assignments = await db.assignment.findMany({
        where: { ...where, subjectId: { in: subjectIdList } },
        include: {
          subject: { select: { id: true, name: true, code: true } },
          _count: { select: { submissions: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    } else {
      assignments = await db.assignment.findMany({
        where,
        include: {
          subject: { select: { id: true, name: true, code: true } },
          _count: { select: { submissions: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    }

    return NextResponse.json({ data: assignments });
  } catch (error) {
    console.error("Assignments GET error:", error);
    return NextResponse.json({ error: "Failed to fetch assignments" }, { status: 500 });
  }
}, { minRole: "teacher" });

export const POST = withAuth(async (request, { user }) => {
  try {
    const body = await request.json();
    const title = sanitizeInput(body.title);
    const description = body.description ? sanitizeInput(body.description) : null;
    const dueDate = body.dueDate ? new Date(body.dueDate) : null;
    const totalMarks = body.totalMarks ?? 100;
    const status = body.status ? sanitizeInput(body.status) : "active";
    const subjectId = body.subjectId;

    if (!title || !subjectId) {
      return NextResponse.json(
        { error: "Title and subject ID are required" },
        { status: 400 }
      );
    }

    const assignment = await db.assignment.create({
      data: {
        title,
        description,
        dueDate,
        totalMarks,
        status,
        subjectId,
        assignedById: user.userId,
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        _count: { select: { submissions: true } },
      },
    });

    await createAuditLog({
      userId: user.userId,
      action: "create",
      resource: "assignment",
      resourceId: assignment.id,
      details: { title, subjectId },
      ipAddress: ipFromRequest(request),
    });

    return NextResponse.json({ data: assignment }, { status: 201 });
  } catch (error) {
    console.error("Assignments POST error:", error);
    return NextResponse.json({ error: "Failed to create assignment" }, { status: 500 });
  }
}, { minRole: "teacher" });
