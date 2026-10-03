import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/api-middleware";
import { sanitizeInput, createAuditLog, ipFromRequest } from "@/lib/security";

export const GET = withAuth(async () => {
  try {
    const designations = await db.designation.findMany({
      include: {
        _count: { select: { employees: true } },
      },
      orderBy: { level: "asc" },
    });

    return NextResponse.json({ data: designations });
  } catch (error) {
    console.error("Designations GET error:", error);
    return NextResponse.json({ error: "Failed to fetch designations" }, { status: 500 });
  }
});

export const POST = withAuth(async (request, { user }) => {
  try {
    const body = await request.json();
    const title = sanitizeInput(body.title);
    const level = body.level ?? 1;
    const baseSalary = body.baseSalary ?? 0;

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const designation = await db.designation.create({
      data: { title, level, baseSalary },
      include: { _count: { select: { employees: true } } },
    });

    await createAuditLog({
      userId: user.userId,
      action: "create",
      resource: "designation",
      resourceId: designation.id,
      details: { title, level, baseSalary },
      ipAddress: ipFromRequest(request),
    });

    return NextResponse.json({ data: designation }, { status: 201 });
  } catch (error) {
    console.error("Designations POST error:", error);
    return NextResponse.json({ error: "Failed to create designation" }, { status: 500 });
  }
}, { minRole: "admin" });
