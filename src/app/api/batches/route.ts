import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/api-middleware";
import { sanitizeInput, createAuditLog, ipFromRequest } from "@/lib/security";

export const GET = withAuth(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const programId = searchParams.get("programId");

    const where: Record<string, unknown> = {};
    if (programId) {
      where.programId = programId;
    }

    const batches = await db.batch.findMany({
      where,
      include: {
        program: { select: { id: true, name: true, code: true } },
        institution: { select: { id: true, name: true, shortName: true } },
        _count: { select: { enrollments: true, schedules: true, semesters: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: batches });
  } catch (error) {
    console.error("Batches GET error:", error);
    return NextResponse.json({ error: "Failed to fetch batches" }, { status: 500 });
  }
}, { minRole: "admin" });

export const POST = withAuth(async (request, { user }) => {
  try {
    const body = await request.json();
    const name = sanitizeInput(body.name);
    const academicYear = sanitizeInput(body.academicYear);
    const institutionId = body.institutionId;
    const programId = body.programId || null;
    const startDate = body.startDate ? new Date(body.startDate) : null;
    const endDate = body.endDate ? new Date(body.endDate) : null;

    if (!name) {
      return NextResponse.json({ error: "Batch name is required" }, { status: 400 });
    }

    if (!academicYear) {
      return NextResponse.json({ error: "Academic year is required" }, { status: 400 });
    }

    if (!institutionId) {
      return NextResponse.json({ error: "Institution ID is required" }, { status: 400 });
    }

    const batch = await db.batch.create({
      data: { name, academicYear, institutionId, programId, startDate, endDate },
      include: {
        program: { select: { id: true, name: true, code: true } },
        institution: { select: { id: true, name: true, shortName: true } },
      },
    });

    await createAuditLog({
      userId: user.userId,
      action: "create",
      resource: "batch",
      resourceId: batch.id,
      details: { name, academicYear },
      ipAddress: ipFromRequest(request),
    });

    return NextResponse.json({ data: batch }, { status: 201 });
  } catch (error) {
    console.error("Batches POST error:", error);
    return NextResponse.json({ error: "Failed to create batch" }, { status: 500 });
  }
}, { minRole: "admin" });
