import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/api-middleware";
import { sanitizeInput, createAuditLog, ipFromRequest } from "@/lib/security";

export const GET = withAuth(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get("departmentId");

    const where: Record<string, unknown> = {};
    if (departmentId) {
      where.departmentId = departmentId;
    }

    const programs = await db.program.findMany({
      where,
      include: {
        department: { select: { id: true, name: true, code: true } },
        institution: { select: { id: true, name: true, shortName: true } },
        _count: { select: { batches: true, enrollments: true, feeStructures: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: programs });
  } catch (error) {
    console.error("Programs GET error:", error);
    return NextResponse.json({ error: "Failed to fetch programs" }, { status: 500 });
  }
}, { minRole: "admin" });

export const POST = withAuth(async (request, { user }) => {
  try {
    const body = await request.json();
    const name = sanitizeInput(body.name);
    const code = body.code ? sanitizeInput(body.code) : null;
    const description = body.description ? sanitizeInput(body.description) : null;
    const duration = body.duration ?? 4;
    const durationUnit = body.durationUnit ? sanitizeInput(body.durationUnit) : "years";
    const totalCredits = body.totalCredits ?? 0;
    const institutionId = body.institutionId;
    const departmentId = body.departmentId || null;

    if (!name) {
      return NextResponse.json({ error: "Program name is required" }, { status: 400 });
    }

    if (!institutionId) {
      return NextResponse.json({ error: "Institution ID is required" }, { status: 400 });
    }

    const program = await db.program.create({
      data: {
        name, code, description, duration, durationUnit, totalCredits,
        institutionId, departmentId,
      },
      include: {
        department: { select: { id: true, name: true, code: true } },
        institution: { select: { id: true, name: true, shortName: true } },
      },
    });

    await createAuditLog({
      userId: user.userId,
      action: "create",
      resource: "program",
      resourceId: program.id,
      details: { name, code },
      ipAddress: ipFromRequest(request),
    });

    return NextResponse.json({ data: program }, { status: 201 });
  } catch (error) {
    console.error("Programs POST error:", error);
    return NextResponse.json({ error: "Failed to create program" }, { status: 500 });
  }
}, { minRole: "admin" });
