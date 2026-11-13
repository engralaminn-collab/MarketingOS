import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/api-middleware";
import { sanitizeInput, createAuditLog, ipFromRequest } from "@/lib/security";

const STATUSES = ["submitted", "graded", "late", "returned"] as const;

/**
 * /api/assignments/[id]/submissions/[submissionId] — grading.
 *
 * PUT records marks and feedback for one submission. The submission must belong
 * to the assignment in the URL, which prevents grading a submission through an
 * unrelated assignment id.
 */
export const PUT = withAuth(async (request, { user, params }) => {
  try {
    const { id: assignmentId, submissionId } = await params;

    const assignment = await db.assignment.findUnique({
      where: { id: assignmentId },
      select: { id: true, title: true, totalMarks: true },
    });
    if (!assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    const submission = await db.submission.findUnique({ where: { id: submissionId } });
    if (!submission || submission.assignmentId !== assignmentId) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "A JSON body is required" }, { status: 400 });
    }

    const marks = Number(body.marks);
    if (!Number.isFinite(marks) || marks < 0) {
      return NextResponse.json({ error: "marks must be a non-negative number" }, { status: 400 });
    }
    if (marks > assignment.totalMarks) {
      return NextResponse.json(
        { error: `marks cannot exceed the assignment total of ${assignment.totalMarks}` },
        { status: 400 },
      );
    }

    const feedback =
      typeof body.feedback === "string" && body.feedback.trim()
        ? sanitizeInput(body.feedback).slice(0, 2000)
        : null;
    const status = STATUSES.includes(body.status) ? body.status : "graded";

    const updated = await db.submission.update({
      where: { id: submission.id },
      data: { marks, feedback, status, gradedAt: new Date() },
      include: {
        user: { select: { id: true, name: true, email: true, avatar: true } },
      },
    });

    await createAuditLog({
      userId: user.userId,
      action: "update",
      resource: "submission",
      resourceId: submission.id,
      details: { assignmentId, marks, status },
      ipAddress: ipFromRequest(request),
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("Submission PUT error:", error);
    return NextResponse.json({ error: "Failed to grade submission" }, { status: 500 });
  }
}, { minRole: "teacher" });
