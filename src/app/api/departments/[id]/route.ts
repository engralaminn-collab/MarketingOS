import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/api-middleware";
import { sanitizeInput, createAuditLog, ipFromRequest } from "@/lib/security";

export const GET = withAuth(async (request, { params, user }) => {
  try {
    const { id } = await params;
    const department = await db.department.findUnique({
      where: { id },
      include: {
        head: { select: { id: true, name: true, email: true, avatar: true } },
        institution: { select: { id: true, name: true, shortName: true } },
        programs: { select: { id: true, name: true, code: true, isActive: true } },
        subjects: { select: { id: true, name: true, code: true, isActive: true } },
        employees: {
          select: { id: true, user: { select: { id: true, name: true, email: true } } },
        },
        _count: { select: { programs: true, subjects: true, employees: true } },
      },
    });

    if (!department) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 });
    }

    return NextResponse.json({ data: department });
  } catch (error) {
    console.error("Department GET by id error:", error);
    return NextResponse.json({ error: "Failed to fetch department" }, { status: 500 });
  }
}, { minRole: "admin" });

export const PUT = withAuth(async (request, { params, user }) => {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await db.department.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = sanitizeInput(body.name);
    if (body.code !== undefined) data.code = body.code ? sanitizeInput(body.code) : null;
    if (body.description !== undefined) data.description = body.description ? sanitizeInput(body.description) : null;
    if (body.headId !== undefined) data.headId = body.headId || null;
    if (body.isActive !== undefined) data.isActive = body.isActive;

    const department = await db.department.update({
      where: { id },
      data,
      include: {
        head: { select: { id: true, name: true, email: true } },
        institution: { select: { id: true, name: true, shortName: true } },
      },
    });

    await createAuditLog({
      userId: user.userId,
      action: "update",
      resource: "department",
      resourceId: id,
      details: data,
      ipAddress: ipFromRequest(request),
    });

    return NextResponse.json({ data: department });
  } catch (error) {
    console.error("Department PUT error:", error);
    return NextResponse.json({ error: "Failed to update department" }, { status: 500 });
  }
}, { minRole: "admin" });

export const DELETE = withAuth(async (request, { params, user }) => {
  try {
    const { id } = await params;
    const existing = await db.department.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 });
    }

    await db.department.delete({ where: { id } });

    await createAuditLog({
      userId: user.userId,
      action: "delete",
      resource: "department",
      resourceId: id,
      details: { name: existing.name },
      ipAddress: ipFromRequest(request),
    });

    return NextResponse.json({ data: { message: "Department deleted successfully" } });
  } catch (error) {
    console.error("Department DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete department" }, { status: 500 });
  }
}, { minRole: "admin" });
