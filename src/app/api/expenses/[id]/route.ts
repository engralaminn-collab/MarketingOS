import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/api-middleware";
import { sanitizeInput, createAuditLog, ipFromRequest } from "@/lib/security";

export const GET = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;
    const expense = await db.expense.findUnique({
      where: { id },
      include: {
        institution: { select: { id: true, name: true, shortName: true } },
      },
    });

    if (!expense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    return NextResponse.json({ data: expense });
  } catch (error) {
    console.error("Expense GET by id error:", error);
    return NextResponse.json({ error: "Failed to fetch expense" }, { status: 500 });
  }
});

export const PUT = withAuth(async (request, { params, user }) => {
  try {
    const { id } = await params;
    const existing = await db.expense.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    const body = await request.json();
    const data: Record<string, unknown> = {};
    if (body.description !== undefined) data.description = sanitizeInput(body.description);
    if (body.amount !== undefined) data.amount = body.amount;
    if (body.category !== undefined) data.category = body.category ? sanitizeInput(body.category) : null;
    if (body.expenseDate !== undefined) data.expenseDate = body.expenseDate ? new Date(body.expenseDate) : new Date();
    if (body.receiptUrl !== undefined) data.receiptUrl = body.receiptUrl || null;

    const expense = await db.expense.update({
      where: { id },
      data,
      include: {
        institution: { select: { id: true, name: true, shortName: true } },
      },
    });

    await createAuditLog({
      userId: user.userId,
      action: "update",
      resource: "expense",
      resourceId: id,
      details: data,
      ipAddress: ipFromRequest(request),
    });

    return NextResponse.json({ data: expense });
  } catch (error) {
    console.error("Expense PUT error:", error);
    return NextResponse.json({ error: "Failed to update expense" }, { status: 500 });
  }
}, { minRole: "accountant" });

export const DELETE = withAuth(async (request, { params, user }) => {
  try {
    const { id } = await params;
    const existing = await db.expense.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    await db.expense.delete({ where: { id } });

    await createAuditLog({
      userId: user.userId,
      action: "delete",
      resource: "expense",
      resourceId: id,
      details: { description: existing.description, amount: existing.amount },
      ipAddress: ipFromRequest(request),
    });

    return NextResponse.json({ data: { message: "Expense deleted successfully" } });
  } catch (error) {
    console.error("Expense DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete expense" }, { status: 500 });
  }
}, { minRole: "accountant" });
