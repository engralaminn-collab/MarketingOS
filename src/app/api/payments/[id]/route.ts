import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/api-middleware";

export const GET = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;
    const payment = await db.payment.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatar: true },
          include: { studentProfile: { select: { studentId: true } } },
        },
        fee: {
          select: { id: true, amount: true, paidAmount: true, status: true },
          include: { feeStructure: { select: { name: true, frequency: true } } },
        },
      },
    });

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    return NextResponse.json({ data: payment });
  } catch (error) {
    console.error("Payment GET by id error:", error);
    return NextResponse.json({ error: "Failed to fetch payment" }, { status: 500 });
  }
});
