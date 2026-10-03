import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/api-middleware";
import { createAuditLog, ipFromRequest } from "@/lib/security";

function calculateGrade(marksObtained: number, totalMarks: number): string {
  const pct = (marksObtained / totalMarks) * 100;
  if (pct >= 90) return "A+";
  if (pct >= 85) return "A";
  if (pct >= 80) return "B+";
  if (pct >= 75) return "B";
  if (pct >= 70) return "C+";
  if (pct >= 60) return "C";
  if (pct >= 50) return "D";
  return "F";
}

export const GET = withAuth(async (request, { params }) => {
  try {
    const { id: examId } = await params;

    const exam = await db.exam.findUnique({ where: { id: examId } });
    if (!exam) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    }

    const results = await db.examResult.findMany({
      where: { examId },
      include: {
        user: { select: { id: true, name: true, email: true, avatar: true } },
      },
      orderBy: { marksObtained: "desc" },
    });

    return NextResponse.json({ data: results });
  } catch (error) {
    console.error("Exam results GET error:", error);
    return NextResponse.json({ error: "Failed to fetch exam results" }, { status: 500 });
  }
}, { minRole: "teacher" });

export const POST = withAuth(async (request, { user, params }) => {
  try {
    const { id: examId } = await params;
    const body = await request.json();
    const { results } = body;

    if (!results || !Array.isArray(results) || results.length === 0) {
      return NextResponse.json(
        { error: "Results array is required" },
        { status: 400 }
      );
    }

    const exam = await db.exam.findUnique({ where: { id: examId } });
    if (!exam) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    }

    const created = await Promise.all(
      results.map((r: { userId: string; marksObtained: number; remarks?: string }) => {
        const marksObtained = Number(r.marksObtained);
        const grade = calculateGrade(marksObtained, exam.totalMarks);
        return db.examResult.create({
          data: {
            marksObtained,
            grade,
            remarks: r.remarks || null,
            userId: r.userId,
            examId,
          },
          include: {
            user: { select: { id: true, name: true, email: true, avatar: true } },
          },
        });
      })
    );

    await createAuditLog({
      userId: user.userId,
      action: "create",
      resource: "exam_result",
      resourceId: examId,
      details: { examId, count: results.length },
      ipAddress: ipFromRequest(request),
    });

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    console.error("Exam results POST error:", error);
    return NextResponse.json({ error: "Failed to add exam results" }, { status: 500 });
  }
}, { minRole: "teacher" });

export const PUT = withAuth(async (request, { user, params }) => {
  try {
    const { id: examId } = await params;
    const body = await request.json();
    const { resultId, marksObtained, remarks } = body;

    if (!resultId) {
      return NextResponse.json({ error: "Result ID is required" }, { status: 400 });
    }

    const existing = await db.examResult.findFirst({
      where: { id: resultId, examId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Exam result not found" }, { status: 404 });
    }

    const exam = await db.exam.findUnique({ where: { id: examId } });
    const data: Record<string, unknown> = {};
    if (marksObtained !== undefined) {
      const marks = Number(marksObtained);
      data.marksObtained = marks;
      if (exam) {
        data.grade = calculateGrade(marks, exam.totalMarks);
      }
    }
    if (remarks !== undefined) data.remarks = remarks || null;

    const updated = await db.examResult.update({
      where: { id: resultId },
      data,
      include: {
        user: { select: { id: true, name: true, email: true, avatar: true } },
      },
    });

    await createAuditLog({
      userId: user.userId,
      action: "update",
      resource: "exam_result",
      resourceId: resultId,
      details: data,
      ipAddress: ipFromRequest(request),
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("Exam results PUT error:", error);
    return NextResponse.json({ error: "Failed to update exam result" }, { status: 500 });
  }
}, { minRole: "teacher" });
