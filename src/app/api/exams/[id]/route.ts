import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/api-middleware";
import { sanitizeInput, createAuditLog, ipFromRequest } from "@/lib/security";

export const GET = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;
    const exam = await db.exam.findUnique({
      where: { id },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        results: {
          include: {
            user: { select: { id: true, name: true, email: true, avatar: true } },
          },
        },
        _count: { select: { results: true } },
      },
    });

    if (!exam) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    }

    return NextResponse.json({ data: exam });
  } catch (error) {
    console.error("Exam GET by id error:", error);
    return NextResponse.json({ error: "Failed to fetch exam" }, { status: 500 });
  }
}, { minRole: "teacher" });

export const PUT = withAuth(async (request, { params, user }) => {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await db.exam.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = sanitizeInput(body.name);
    if (body.examType !== undefined) data.examType = sanitizeInput(body.examType);
    if (body.totalMarks !== undefined) data.totalMarks = Number(body.totalMarks);
    if (body.startDate !== undefined) data.startDate = body.startDate ? new Date(body.startDate) : null;
    if (body.endDate !== undefined) data.endDate = body.endDate ? new Date(body.endDate) : null;
    if (body.status !== undefined) data.status = sanitizeInput(body.status);

    const exam = await db.exam.update({
      where: { id },
      data,
      include: {
        subject: { select: { id: true, name: true, code: true } },
        _count: { select: { results: true } },
      },
    });

    await createAuditLog({
      userId: user.userId,
      action: "update",
      resource: "exam",
      resourceId: id,
      details: data,
      ipAddress: ipFromRequest(request),
    });

    return NextResponse.json({ data: exam });
  } catch (error) {
    console.error("Exam PUT error:", error);
    return NextResponse.json({ error: "Failed to update exam" }, { status: 500 });
  }
}, { minRole: "teacher" });

export const DELETE = withAuth(async (request, { params, user }) => {
  try {
    const { id } = await params;
    const existing = await db.exam.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    }

    await db.exam.delete({ where: { id } });

    await createAuditLog({
      userId: user.userId,
      action: "delete",
      resource: "exam",
      resourceId: id,
      details: { name: existing.name },
      ipAddress: ipFromRequest(request),
    });

    return NextResponse.json({ data: { message: "Exam deleted successfully" } });
  } catch (error) {
    console.error("Exam DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete exam" }, { status: 500 });
  }
}, { minRole: "teacher" });
