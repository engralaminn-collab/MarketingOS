import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/api-middleware";
import { sanitizeInput, createAuditLog, ipFromRequest } from "@/lib/security";

export const GET = withAuth(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const month = searchParams.get("month");
    const year = searchParams.get("year") ? parseInt(searchParams.get("year")!, 10) : undefined;

    const where: Record<string, unknown> = {};
    if (userId) where.userId = userId;
    if (month) where.month = month;
    if (year) where.year = year;

    const salaries = await db.salary.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, avatar: true } },
      },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });

    return NextResponse.json({ data: salaries });
  } catch (error) {
    console.error("Salary GET error:", error);
    return NextResponse.json({ error: "Failed to fetch salaries" }, { status: 500 });
  }
}, { minRole: "accountant" });

export const POST = withAuth(async (request, { user }) => {
  try {
    const body = await request.json();
    const userId = body.userId;
    const month = sanitizeInput(body.month);
    const year = body.year;
    const basicSalary = body.basicSalary ?? 0;
    const houseRent = body.houseRent ?? 0;
    const medicalAllowance = body.medicalAllowance ?? 0;
    const transportAllowance = body.transportAllowance ?? 0;
    const bonus = body.bonus ?? 0;
    const deduction = body.deduction ?? 0;
    const tax = body.tax ?? 0;

    if (!userId || !month || !year) {
      return NextResponse.json({ error: "userId, month, and year are required" }, { status: 400 });
    }

    // Check if salary already exists for this user/month/year
    const existing = await db.salary.findFirst({
      where: { userId, month, year },
    });
    if (existing) {
      return NextResponse.json({ error: "Salary already generated for this employee and period" }, { status: 409 });
    }

    const netSalary = basicSalary + houseRent + medicalAllowance + transportAllowance + bonus - deduction - tax;

    const salary = await db.salary.create({
      data: {
        userId,
        month,
        year,
        basicSalary,
        houseRent,
        medicalAllowance,
        transportAllowance,
        bonus,
        deduction,
        tax,
        netSalary,
        status: body.status || "paid",
        payDate: body.payDate ? new Date(body.payDate) : new Date(),
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    await createAuditLog({
      userId: user.userId,
      action: "create",
      resource: "salary",
      resourceId: salary.id,
      details: { userId, month, year, netSalary, status: salary.status },
      ipAddress: ipFromRequest(request),
    });

    return NextResponse.json({ data: salary }, { status: 201 });
  } catch (error) {
    console.error("Salary POST error:", error);
    return NextResponse.json({ error: "Failed to generate salary" }, { status: 500 });
  }
}, { minRole: "accountant" });
