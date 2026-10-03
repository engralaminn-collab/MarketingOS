import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/api-middleware";
import { createAuditLog, ipFromRequest } from "@/lib/security";

export const GET = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;
    const salary = await db.salary.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatar: true },
          include: {
            employeeProfile: {
              include: {
                department: { select: { name: true } },
                designation: { select: { title: true } },
              },
            },
          },
        },
      },
    });

    if (!salary) {
      return NextResponse.json({ error: "Salary not found" }, { status: 404 });
    }

    return NextResponse.json({ data: salary });
  } catch (error) {
    console.error("Salary GET by id error:", error);
    return NextResponse.json({ error: "Failed to fetch salary" }, { status: 500 });
  }
}, { minRole: "accountant" });

export const PUT = withAuth(async (request, { params, user }) => {
  try {
    const { id } = await params;
    const existing = await db.salary.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Salary not found" }, { status: 404 });
    }

    const body = await request.json();
    const data: Record<string, unknown> = {};

    if (body.basicSalary !== undefined) data.basicSalary = body.basicSalary;
    if (body.houseRent !== undefined) data.houseRent = body.houseRent;
    if (body.medicalAllowance !== undefined) data.medicalAllowance = body.medicalAllowance;
    if (body.transportAllowance !== undefined) data.transportAllowance = body.transportAllowance;
    if (body.bonus !== undefined) data.bonus = body.bonus;
    if (body.deduction !== undefined) data.deduction = body.deduction;
    if (body.tax !== undefined) data.tax = body.tax;
    if (body.status !== undefined) data.status = body.status;
    if (body.payDate !== undefined) data.payDate = body.payDate ? new Date(body.payDate) : new Date();

    // Recalculate net salary
    const bs = (data.basicSalary ?? existing.basicSalary) as number;
    const hr = (data.houseRent ?? existing.houseRent) as number;
    const ma = (data.medicalAllowance ?? existing.medicalAllowance) as number;
    const ta = (data.transportAllowance ?? existing.transportAllowance) as number;
    const bon = (data.bonus ?? existing.bonus) as number;
    const ded = (data.deduction ?? existing.deduction) as number;
    const tx = (data.tax ?? existing.tax) as number;
    data.netSalary = bs + hr + ma + ta + bon - ded - tx;

    const salary = await db.salary.update({
      where: { id },
      data,
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    await createAuditLog({
      userId: user.userId,
      action: "update",
      resource: "salary",
      resourceId: id,
      details: data,
      ipAddress: ipFromRequest(request),
    });

    return NextResponse.json({ data: salary });
  } catch (error) {
    console.error("Salary PUT error:", error);
    return NextResponse.json({ error: "Failed to update salary" }, { status: 500 });
  }
}, { minRole: "accountant" });
