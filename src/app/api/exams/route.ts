import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/api-middleware";
import { sanitizeInput, createAuditLog, ipFromRequest } from "@/lib/security";

export const GET = withAuth(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const subjectId = searchParams.get("subjectId");
    const status = searchParams.get("status");

    const where: Record<string, unknown> = {};
    if (subjectId) where.subjectId = subjectId;
    if (status) where.status = sanitizeInput(status);

    const exams = await db.exam.findMany({
      where,
      include: {
        subject: { select: { id: true, name: true, code: true } },
        _count: { select: { results: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: exams });
  } catch (error) {
    console.error("Exams GET error:", error);
    return NextResponse.json({ error: "Failed to fetch exams" }, { status: 500 });
  }
}, { minRole: "teacher" });

export const POST = withAuth(async (request, { user }) => {
  try {
    const body = await request.json();
    const name = sanitizeInput(body.name);
    const examType = body.examType ? sanitizeInput(body.examType) : "midterm";
    const totalMarks = body.totalMarks ?? 100;
    const startDate = body.startDate ? new Date(body.startDate) : null;
    const endDate = body.endDate ? new Date(body.endDate) : null;
    const status = body.status ? sanitizeInput(body.status) : "upcoming";
    const subjectId = body.subjectId;

    if (!name || !subjectId) {
      return NextResponse.json(
        { error: "Name and subject ID are required" },
        { status: 400 }
      );
    }

    const exam = await db.exam.create({
      data: {
        name,
        examType,
        totalMarks,
        startDate,
        endDate,
        status,
        subjectId,
        createdBy: user.userId,
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        _count: { select: { results: true } },
      },
    });

    await createAuditLog({
      userId: user.userId,
      action: "create",
      resource: "exam",
      resourceId: exam.id,
      details: { name, subjectId },
      ipAddress: ipFromRequest(request),
    });

    return NextResponse.json({ data: exam }, { status: 201 });
  } catch (error) {
    console.error("Exams POST error:", error);
    return NextResponse.json({ error: "Failed to create exam" }, { status: 500 });
  }
}, { minRole: "teacher" });
