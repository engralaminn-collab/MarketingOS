import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/api-middleware";
import { sanitizeInput, createAuditLog, ipFromRequest } from "@/lib/security";

export const GET = withAuth(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const feeId = searchParams.get("feeId");
    const userId = searchParams.get("userId");
    const method = searchParams.get("method");

    const where: Record<string, unknown> = {};
    if (feeId) where.feeId = feeId;
    if (userId) where.userId = userId;
    if (method) where.method = method;

    const payments = await db.payment.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, avatar: true } },
        fee: { select: { id: true, amount: true, paidAmount: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: payments });
  } catch (error) {
    console.error("Payments GET error:", error);
    return NextResponse.json({ error: "Failed to fetch payments" }, { status: 500 });
  }
});

export const POST = withAuth(async (request, { user }) => {
  try {
    const body = await request.json();
    const feeId = body.feeId;
    const userId = body.userId;
    const amount = body.amount;
    const method = sanitizeInput(body.method || "cash");
    const transactionId = body.transactionId ? sanitizeInput(body.transactionId) : null;
    const remarks = body.remarks ? sanitizeInput(body.remarks) : null;

    if (!feeId || !userId || amount === undefined || amount === null) {
      return NextResponse.json({ error: "feeId, userId, and amount are required" }, { status: 400 });
    }

    const fee = await db.fee.findUnique({ where: { id: feeId } });
    if (!fee) {
      return NextResponse.json({ error: "Fee not found" }, { status: 404 });
    }

    // Generate receipt number
    const receiptNo = `RCP-${Date.now().toString(36).toUpperCase()}`;

    const payment = await db.payment.create({
      data: {
        feeId,
        userId,
        amount,
        method,
        transactionId,
        remarks,
        receiptNo,
        status: "completed",
        receivedBy: user.userId,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        fee: { select: { id: true, amount: true, paidAmount: true, status: true } },
      },
    });

    // Update fee paid amount and status
    const newPaidAmount = fee.paidAmount + amount;
    const newStatus = newPaidAmount >= fee.amount ? "paid" : "partial";

    await db.fee.update({
      where: { id: feeId },
      data: {
        paidAmount: newPaidAmount,
        status: newStatus,
      },
    });

    await createAuditLog({
      userId: user.userId,
      action: "create",
      resource: "payment",
      resourceId: payment.id,
      details: { feeId, userId, amount, method, receiptNo },
      ipAddress: ipFromRequest(request),
    });

    return NextResponse.json({ data: payment }, { status: 201 });
  } catch (error) {
    console.error("Payments POST error:", error);
    return NextResponse.json({ error: "Failed to record payment" }, { status: 500 });
  }
}, { minRole: "accountant" });
