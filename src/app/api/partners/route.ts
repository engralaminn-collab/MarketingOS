import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/api-middleware";
import { sanitizeInput, createAuditLog, ipFromRequest } from "@/lib/security";

export const GET = withAuth(async () => {
  try {
    const partners = await db.partner.findMany({
      include: {
        user: { select: { id: true, name: true, email: true, avatar: true, phone: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: partners });
  } catch (error) {
    console.error("Partners GET error:", error);
    return NextResponse.json({ error: "Failed to fetch partners" }, { status: 500 });
  }
}, { minRole: "admin" });

export const POST = withAuth(async (request, { user }) => {
  try {
    const body = await request.json();
    const company = sanitizeInput(body.company);
    const contactPerson = body.contactPerson ? sanitizeInput(body.contactPerson) : null;
    const email = body.email ? sanitizeInput(body.email) : null;
    const phone = body.phone ? sanitizeInput(body.phone) : null;
    const address = body.address ? sanitizeInput(body.address) : null;
    const agreementType = sanitizeInput(body.agreementType || "referral");
    const commissionRate = body.commissionRate ?? 0;
    const startDate = body.startDate ? new Date(body.startDate) : null;
    const endDate = body.endDate ? new Date(body.endDate) : null;
    const notes = body.notes ? sanitizeInput(body.notes) : null;

    // Need to create a user account for the partner
    const partnerEmail = email || `${company.toLowerCase().replace(/\s+/g, ".")}@partner.local`;
    const partnerName = contactPerson || company;

    // Check if user with this email already exists
    let userId = body.userId || null;
    if (!userId) {
      const existingUser = await db.user.findUnique({ where: { email: partnerEmail } });
      if (existingUser) {
        userId = existingUser.id;
      } else {
        // Create a new user for the partner
        const { hashPassword } = await import("@/lib/auth");
        const passwordHash = await hashPassword("Partner@123456");
        const newUser = await db.user.create({
          data: {
            email: partnerEmail,
            name: partnerName,
            phone,
            passwordHash,
            role: "partner",
          },
        });
        userId = newUser.id;
      }
    }

    const partner = await db.partner.create({
      data: {
        company,
        contactPerson,
        email,
        phone,
        address,
        agreementType,
        commissionRate,
        startDate,
        endDate,
        notes,
        userId,
      },
      include: {
        user: { select: { id: true, name: true, email: true, avatar: true, phone: true } },
      },
    });

    await createAuditLog({
      userId: user.userId,
      action: "create",
      resource: "partner",
      resourceId: partner.id,
      details: { company, contactPerson, email, agreementType, commissionRate },
      ipAddress: ipFromRequest(request),
    });

    return NextResponse.json({ data: partner }, { status: 201 });
  } catch (error) {
    console.error("Partners POST error:", error);
    return NextResponse.json({ error: "Failed to create partner" }, { status: 500 });
  }
}, { minRole: "admin" });
