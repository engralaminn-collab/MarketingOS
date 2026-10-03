import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/api-middleware";
import { sanitizeInput, createAuditLog, ipFromRequest } from "@/lib/security";

export const GET = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;
    const designation = await db.designation.findUnique({
      where: { id },
      include: {
        employees: {
          select: { id: true, user: { select: { id: true, name: true, email: true } } },
        },
        _count: { select: { employees: true } },
      },
    });

    if (!designation) {
      return NextResponse.json({ error: "Designation not found" }, { status: 404 });
    }

    return NextResponse.json({ data: designation });
  } catch (error) {
    console.error("Designation GET by id error:", error);
    return NextResponse.json({ error: "Failed to fetch designation" }, { status: 500 });
  }
});

export const PUT = withAuth(async (request, { params, user }) => {
  try {
    const { id } = await params;
    const existing = await db.designation.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Designation not found" }, { status: 404 });
    }

    const body = await request.json();
    const data: Record<string, unknown> = {};
    if (body.title !== undefined) data.title = sanitizeInput(body.title);
    if (body.level !== undefined) data.level = body.level;
    if (body.baseSalary !== undefined) data.baseSalary = body.baseSalary;
    if (body.isActive !== undefined) data.isActive = body.isActive;

    const designation = await db.designation.update({
      where: { id },
      data,
      include: { _count: { select: { employees: true } } },
    });

    await createAuditLog({
      userId: user.userId,
      action: "update",
      resource: "designation",
      resourceId: id,
      details: data,
      ipAddress: ipFromRequest(request),
    });

    return NextResponse.json({ data: designation });
  } catch (error) {
    console.error("Designation PUT error:", error);
    return NextResponse.json({ error: "Failed to update designation" }, { status: 500 });
  }
}, { minRole: "admin" });

export const DELETE = withAuth(async (request, { params, user }) => {
  try {
    const { id } = await params;
    const existing = await db.designation.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Designation not found" }, { status: 404 });
    }

    await db.designation.delete({ where: { id } });

    await createAuditLog({
      userId: user.userId,
      action: "delete",
      resource: "designation",
      resourceId: id,
      details: { title: existing.title },
      ipAddress: ipFromRequest(request),
    });

    return NextResponse.json({ data: { message: "Designation deleted successfully" } });
  } catch (error) {
    console.error("Designation DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete designation" }, { status: 500 });
  }
}, { minRole: "admin" });
