import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/api-middleware";
import { sanitizeInput, createAuditLog, ipFromRequest } from "@/lib/security";

export const GET = withAuth(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const programId = searchParams.get("programId");

    const where: Record<string, unknown> = {};
    if (programId) where.programId = programId;

    const feeStructures = await db.feeStructure.findMany({
      where,
      include: {
        program: { select: { id: true, name: true, code: true } },
        institution: { select: { id: true, name: true, shortName: true } },
        _count: { select: { fees: true } },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ data: feeStructures });
  } catch (error) {
    console.error("FeeStructures GET error:", error);
    return NextResponse.json({ error: "Failed to fetch fee structures" }, { status: 500 });
  }
});

export const POST = withAuth(async (request, { user }) => {
  try {
    const body = await request.json();
    const name = sanitizeInput(body.name);
    const amount = body.amount;
    const frequency = sanitizeInput(body.frequency || "semester");
    const institutionId = body.institutionId;
    const programId = body.programId || null;

    if (!name || amount === undefined || amount === null) {
      return NextResponse.json({ error: "Name and amount are required" }, { status: 400 });
    }

    if (!institutionId) {
      return NextResponse.json({ error: "Institution ID is required" }, { status: 400 });
    }

    const feeStructure = await db.feeStructure.create({
      data: { name, amount, frequency, institutionId, programId },
      include: {
        program: { select: { id: true, name: true, code: true } },
        institution: { select: { id: true, name: true, shortName: true } },
        _count: { select: { fees: true } },
      },
    });

    await createAuditLog({
      userId: user.userId,
      action: "create",
      resource: "fee_structure",
      resourceId: feeStructure.id,
      details: { name, amount, frequency, programId },
      ipAddress: ipFromRequest(request),
    });

    return NextResponse.json({ data: feeStructure }, { status: 201 });
  } catch (error) {
    console.error("FeeStructures POST error:", error);
    return NextResponse.json({ error: "Failed to create fee structure" }, { status: 500 });
  }
}, { minRole: "admin" });
