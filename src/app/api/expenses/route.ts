import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/api-middleware";
import { sanitizeInput, createAuditLog, ipFromRequest } from "@/lib/security";

export const GET = withAuth(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    const where: Record<string, unknown> = {};
    if (category) where.category = category;
    if (from || to) {
      const dateFilter: Record<string, Date> = {};
      if (from) dateFilter.gte = new Date(from);
      if (to) dateFilter.lte = new Date(to);
      where.expenseDate = dateFilter;
    }

    const skip = (page - 1) * limit;
    const [expenses, total] = await Promise.all([
      db.expense.findMany({
        where,
        include: {
          institution: { select: { id: true, name: true, shortName: true } },
        },
        orderBy: { expenseDate: "desc" },
        skip,
        take: limit,
      }),
      db.expense.count({ where }),
    ]);

    return NextResponse.json({
      data: expenses,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Expenses GET error:", error);
    return NextResponse.json({ error: "Failed to fetch expenses" }, { status: 500 });
  }
});

export const POST = withAuth(async (request, { user }) => {
  try {
    const body = await request.json();
    const description = sanitizeInput(body.description);
    const amount = body.amount;
    const category = body.category ? sanitizeInput(body.category) : null;
    const expenseDate = body.expenseDate ? new Date(body.expenseDate) : new Date();
    const institutionId = body.institutionId;
    const receiptUrl = body.receiptUrl || null;

    if (!description || amount === undefined || amount === null) {
      return NextResponse.json({ error: "Description and amount are required" }, { status: 400 });
    }

    if (!institutionId) {
      return NextResponse.json({ error: "Institution ID is required" }, { status: 400 });
    }

    const expense = await db.expense.create({
      data: {
        description,
        amount,
        category,
        expenseDate,
        institutionId,
        approvedBy: user.userId,
        receiptUrl,
      },
      include: {
        institution: { select: { id: true, name: true, shortName: true } },
      },
    });

    await createAuditLog({
      userId: user.userId,
      action: "create",
      resource: "expense",
      resourceId: expense.id,
      details: { description, amount, category, expenseDate: body.expenseDate },
      ipAddress: ipFromRequest(request),
    });

    return NextResponse.json({ data: expense }, { status: 201 });
  } catch (error) {
    console.error("Expenses POST error:", error);
    return NextResponse.json({ error: "Failed to create expense" }, { status: 500 });
  }
}, { minRole: "accountant" });
