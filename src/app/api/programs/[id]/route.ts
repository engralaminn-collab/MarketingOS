import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/api-middleware";
import { sanitizeInput, createAuditLog, ipFromRequest } from "@/lib/security";

export const GET = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;
    const program = await db.program.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, name: true, code: true } },
        institution: { select: { id: true, name: true, shortName: true } },
        batches: { select: { id: true, name: true, academicYear: true, isActive: true } },
        _count: { select: { enrollments: true, batches: true, feeStructures: true } },
      },
    });

    if (!program) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }

    return NextResponse.json({ data: program });
  } catch (error) {
    console.error("Program GET by id error:", error);
    return NextResponse.json({ error: "Failed to fetch program" }, { status: 500 });
  }
}, { minRole: "admin" });

export const PUT = withAuth(async (request, { params, user }) => {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await db.program.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = sanitizeInput(body.name);
    if (body.code !== undefined) data.code = body.code ? sanitizeInput(body.code) : null;
    if (body.description !== undefined) data.description = body.description ? sanitizeInput(body.description) : null;
    if (body.duration !== undefined) data.duration = Number(body.duration);
    if (body.durationUnit !== undefined) data.durationUnit = sanitizeInput(body.durationUnit);
    if (body.totalCredits !== undefined) data.totalCredits = Number(body.totalCredits);
    if (body.departmentId !== undefined) data.departmentId = body.departmentId || null;
    if (body.isActive !== undefined) data.isActive = body.isActive;

    const program = await db.program.update({
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
      resource: "program",
      resourceId: id,
      details: data,
      ipAddress: ipFromRequest(request),
    });

    return NextResponse.json({ data: program });
  } catch (error) {
    console.error("Program PUT error:", error);
    return NextResponse.json({ error: "Failed to update program" }, { status: 500 });
  }
}, { minRole: "admin" });

export const DELETE = withAuth(async (request, { params, user }) => {
  try {
    const { id } = await params;
    const existing = await db.program.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }

    await db.program.delete({ where: { id } });

    await createAuditLog({
      userId: user.userId,
      action: "delete",
      resource: "program",
      resourceId: id,
      details: { name: existing.name },
      ipAddress: ipFromRequest(request),
    });

    return NextResponse.json({ data: { message: "Program deleted successfully" } });
  } catch (error) {
    console.error("Program DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete program" }, { status: 500 });
  }
}, { minRole: "admin" });
