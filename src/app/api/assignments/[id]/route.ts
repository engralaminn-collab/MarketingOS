import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/api-middleware";
import { sanitizeInput, createAuditLog, ipFromRequest } from "@/lib/security";

export const GET = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;
    const assignment = await db.assignment.findUnique({
      where: { id },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        submissions: {
          include: {
            user: { select: { id: true, name: true, email: true, avatar: true } },
          },
        },
        _count: { select: { submissions: true } },
      },
    });

    if (!assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    return NextResponse.json({ data: assignment });
  } catch (error) {
    console.error("Assignment GET by id error:", error);
    return NextResponse.json({ error: "Failed to fetch assignment" }, { status: 500 });
  }
}, { minRole: "teacher" });

export const PUT = withAuth(async (request, { params, user }) => {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await db.assignment.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (body.title !== undefined) data.title = sanitizeInput(body.title);
    if (body.description !== undefined) data.description = body.description ? sanitizeInput(body.description) : null;
    if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    if (body.totalMarks !== undefined) data.totalMarks = Number(body.totalMarks);
    if (body.status !== undefined) data.status = sanitizeInput(body.status);

    const assignment = await db.assignment.update({
      where: { id },
      data,
      include: {
        subject: { select: { id: true, name: true, code: true } },
        _count: { select: { submissions: true } },
      },
    });

    await createAuditLog({
      userId: user.userId,
      action: "update",
      resource: "assignment",
      resourceId: id,
      details: data,
      ipAddress: ipFromRequest(request),
    });

    return NextResponse.json({ data: assignment });
  } catch (error) {
    console.error("Assignment PUT error:", error);
    return NextResponse.json({ error: "Failed to update assignment" }, { status: 500 });
  }
}, { minRole: "teacher" });

export const DELETE = withAuth(async (request, { params, user }) => {
  try {
    const { id } = await params;
    const existing = await db.assignment.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    await db.assignment.delete({ where: { id } });

    await createAuditLog({
      userId: user.userId,
      action: "delete",
      resource: "assignment",
      resourceId: id,
      details: { title: existing.title },
      ipAddress: ipFromRequest(request),
    });

    return NextResponse.json({ data: { message: "Assignment deleted successfully" } });
  } catch (error) {
    console.error("Assignment DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete assignment" }, { status: 500 });
  }
}, { minRole: "teacher" });
