import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/api-middleware";
import { sanitizeInput, createAuditLog, ipFromRequest } from "@/lib/security";

export const GET = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;
    const assignment = await db.assignment.findUnique({ where: { id } });
    if (!assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    const submissions = await db.submission.findMany({
      where: { assignmentId: id },
      include: {
        user: { select: { id: true, name: true, email: true, avatar: true } },
      },
      orderBy: { submittedAt: "desc" },
    });

    return NextResponse.json({ data: submissions });
  } catch (error) {
    console.error("Submissions GET error:", error);
    return NextResponse.json({ error: "Failed to fetch submissions" }, { status: 500 });
  }
}, { minRole: "teacher" });

export const POST = withAuth(async (request, { user, params }) => {
  try {
    const { id: assignmentId } = await params;
    const body = await request.json();
    const content = body.content ? sanitizeInput(body.content) : null;
    const fileName = body.fileName ? sanitizeInput(body.fileName) : null;
    const fileUrl = body.fileUrl ? sanitizeInput(body.fileUrl) : null;

    const assignment = await db.assignment.findUnique({ where: { id: assignmentId } });
    if (!assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    // Check if user already submitted
    const existing = await db.submission.findFirst({
      where: { assignmentId, userId: user.userId },
    });
    if (existing) {
      return NextResponse.json({ error: "Already submitted for this assignment" }, { status: 409 });
    }

    const submission = await db.submission.create({
      data: {
        content,
        fileName,
        fileUrl,
        assignmentId,
        userId: user.userId,
        status: "submitted",
      },
      include: {
        user: { select: { id: true, name: true, email: true, avatar: true } },
      },
    });

    await createAuditLog({
      userId: user.userId,
      action: "create",
      resource: "submission",
      resourceId: submission.id,
      details: { assignmentId },
      ipAddress: ipFromRequest(request),
    });

    return NextResponse.json({ data: submission }, { status: 201 });
  } catch (error) {
    console.error("Submission POST error:", error);
    return NextResponse.json({ error: "Failed to submit assignment" }, { status: 500 });
  }
}, { minRole: "student" });
