import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/api-middleware";
import { sanitizeInput, createAuditLog, ipFromRequest } from "@/lib/security";

export const GET = withAuth(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");

    const where: Record<string, unknown> = {};
    if (search) {
      const term = sanitizeInput(search);
      where.OR = [
        { name: { contains: term } },
        { code: { contains: term } },
      ];
    }

    const departments = await db.department.findMany({
      where,
      include: {
        head: { select: { id: true, name: true, email: true, avatar: true } },
        institution: { select: { id: true, name: true, shortName: true } },
        _count: { select: { programs: true, subjects: true, employees: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: departments });
  } catch (error) {
    console.error("Departments GET error:", error);
    return NextResponse.json({ error: "Failed to fetch departments" }, { status: 500 });
  }
}, { minRole: "admin" });

export const POST = withAuth(async (request, { user }) => {
  try {
    const body = await request.json();
    const name = sanitizeInput(body.name);
    const code = body.code ? sanitizeInput(body.code) : null;
    const description = body.description ? sanitizeInput(body.description) : null;
    const institutionId = body.institutionId;
    const headId = body.headId || null;

    if (!name) {
      return NextResponse.json({ error: "Department name is required" }, { status: 400 });
    }

    if (!institutionId) {
      return NextResponse.json({ error: "Institution ID is required" }, { status: 400 });
    }

    const department = await db.department.create({
      data: { name, code, description, institutionId, headId },
      include: {
        head: { select: { id: true, name: true, email: true } },
        institution: { select: { id: true, name: true, shortName: true } },
      },
    });

    await createAuditLog({
      userId: user.userId,
      action: "create",
      resource: "department",
      resourceId: department.id,
      details: { name, code },
      ipAddress: ipFromRequest(request),
    });

    return NextResponse.json({ data: department }, { status: 201 });
  } catch (error) {
    console.error("Departments POST error:", error);
    return NextResponse.json({ error: "Failed to create department" }, { status: 500 });
  }
}, { minRole: "admin" });
