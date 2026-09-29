import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/api-middleware";
import { sanitizeInput, createAuditLog, ipFromRequest } from "@/lib/security";

export const GET = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;
    const batch = await db.batch.findUnique({
      where: { id },
      include: {
        program: { select: { id: true, name: true, code: true } },
        institution: { select: { id: true, name: true, shortName: true } },
        _count: { select: { enrollments: true, schedules: true, semesters: true } },
      },
    });

    if (!batch) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    return NextResponse.json({ data: batch });
  } catch (error) {
    console.error("Batch GET by id error:", error);
    return NextResponse.json({ error: "Failed to fetch batch" }, { status: 500 });
  }
}, { minRole: "admin" });

export const PUT = withAuth(async (request, { params, user }) => {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await db.batch.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = sanitizeInput(body.name);
    if (body.academicYear !== undefined) data.academicYear = sanitizeInput(body.academicYear);
    if (body.programId !== undefined) data.programId = body.programId || null;
    if (body.startDate !== undefined) data.startDate = body.startDate ? new Date(body.startDate) : null;
    if (body.endDate !== undefined) data.endDate = body.endDate ? new Date(body.endDate) : null;
    if (body.isActive !== undefined) data.isActive = body.isActive;

    const batch = await db.batch.update({
      where: { id },
      data,
      include: {
        program: { select: { id: true, name: true, code: true } },
        institution: { select: { id: true, name: true, shortName: true } },
      },
    });

    await createAuditLog({
      userId: user.userId,
      action: "update",
      resource: "batch",
      resourceId: id,
      details: data,
      ipAddress: ipFromRequest(request),
    });

    return NextResponse.json({ data: batch });
  } catch (error) {
    console.error("Batch PUT error:", error);
    return NextResponse.json({ error: "Failed to update batch" }, { status: 500 });
  }
}, { minRole: "admin" });

export const DELETE = withAuth(async (request, { params, user }) => {
  try {
    const { id } = await params;
    const existing = await db.batch.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    await db.batch.delete({ where: { id } });

    await createAuditLog({
      userId: user.userId,
      action: "delete",
      resource: "batch",
      resourceId: id,
      details: { name: existing.name },
      ipAddress: ipFromRequest(request),
    });

    return NextResponse.json({ data: { message: "Batch deleted successfully" } });
  } catch (error) {
    console.error("Batch DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete batch" }, { status: 500 });
  }
}, { minRole: "admin" });
