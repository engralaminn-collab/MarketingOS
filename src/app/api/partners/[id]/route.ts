import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/api-middleware";
import { sanitizeInput, createAuditLog, ipFromRequest } from "@/lib/security";

export const GET = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;
    const partner = await db.partner.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, avatar: true, phone: true } },
      },
    });

    if (!partner) {
      return NextResponse.json({ error: "Partner not found" }, { status: 404 });
    }

    return NextResponse.json({ data: partner });
  } catch (error) {
    console.error("Partner GET by id error:", error);
    return NextResponse.json({ error: "Failed to fetch partner" }, { status: 500 });
  }
}, { minRole: "admin" });

export const PUT = withAuth(async (request, { params, user }) => {
  try {
    const { id } = await params;
    const existing = await db.partner.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Partner not found" }, { status: 404 });
    }

    const body = await request.json();
    const data: Record<string, unknown> = {};
    if (body.company !== undefined) data.company = sanitizeInput(body.company);
    if (body.contactPerson !== undefined) data.contactPerson = body.contactPerson ? sanitizeInput(body.contactPerson) : null;
    if (body.email !== undefined) data.email = body.email ? sanitizeInput(body.email) : null;
    if (body.phone !== undefined) data.phone = body.phone ? sanitizeInput(body.phone) : null;
    if (body.address !== undefined) data.address = body.address ? sanitizeInput(body.address) : null;
    if (body.agreementType !== undefined) data.agreementType = sanitizeInput(body.agreementType);
    if (body.commissionRate !== undefined) data.commissionRate = body.commissionRate;
    if (body.status !== undefined) data.status = sanitizeInput(body.status);
    if (body.startDate !== undefined) data.startDate = body.startDate ? new Date(body.startDate) : null;
    if (body.endDate !== undefined) data.endDate = body.endDate ? new Date(body.endDate) : null;
    if (body.notes !== undefined) data.notes = body.notes ? sanitizeInput(body.notes) : null;

    const partner = await db.partner.update({
      where: { id },
      data,
      include: {
        user: { select: { id: true, name: true, email: true, avatar: true, phone: true } },
      },
    });

    await createAuditLog({
      userId: user.userId,
      action: "update",
      resource: "partner",
      resourceId: id,
      details: data,
      ipAddress: ipFromRequest(request),
    });

    return NextResponse.json({ data: partner });
  } catch (error) {
    console.error("Partner PUT error:", error);
    return NextResponse.json({ error: "Failed to update partner" }, { status: 500 });
  }
}, { minRole: "admin" });

export const DELETE = withAuth(async (request, { params, user }) => {
  try {
    const { id } = await params;
    const existing = await db.partner.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Partner not found" }, { status: 404 });
    }

    const userId = existing.userId;
    await db.partner.delete({ where: { id } });

    // Optionally also delete the associated user
    if (userId) {
      await db.user.delete({ where: { id: userId } }).catch(() => {
        // User might have other records, ignore error
      });
    }

    await createAuditLog({
      userId: user.userId,
      action: "delete",
      resource: "partner",
      resourceId: id,
      details: { company: existing.company, contactPerson: existing.contactPerson },
      ipAddress: ipFromRequest(request),
    });

    return NextResponse.json({ data: { message: "Partner deleted successfully" } });
  } catch (error) {
    console.error("Partner DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete partner" }, { status: 500 });
  }
}, { minRole: "admin" });
