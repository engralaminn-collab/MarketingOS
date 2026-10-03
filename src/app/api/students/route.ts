import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/api-middleware";
import { sanitizeInput, createAuditLog, ipFromRequest } from "@/lib/security";
import { hashPassword } from "@/lib/auth";

export const GET = withAuth(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const programId = searchParams.get("programId");
    const batchId = searchParams.get("batchId");
    const status = searchParams.get("status");
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 20));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { role: "student" };

    if (search) {
      const term = sanitizeInput(search);
      where.OR = [
        { name: { contains: term } },
        { email: { contains: term } },
        { studentProfile: { studentId: { contains: term } } },
      ];
    }

    if (status) {
      where.studentProfile = { status: sanitizeInput(status) };
    }

    if (programId || batchId) {
      const enrollmentFilter: Record<string, unknown> = {};
      if (programId) enrollmentFilter.programId = programId;
      if (batchId) enrollmentFilter.batchId = batchId;
      where.enrollments = { some: enrollmentFilter };
    }

    const [students, total] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          id: true, name: true, email: true, phone: true, avatar: true,
          isActive: true, role: true, createdAt: true,
          studentProfile: true,
          enrollments: {
            include: {
              program: { select: { id: true, name: true, code: true } },
              batch: { select: { id: true, name: true, academicYear: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.user.count({ where }),
    ]);

    return NextResponse.json({
      data: students,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Students GET error:", error);
    return NextResponse.json({ error: "Failed to fetch students" }, { status: 500 });
  }
}, { minRole: "teacher" });

export const POST = withAuth(async (request, { user }) => {
  try {
    const body = await request.json();
    const email = sanitizeInput(body.email).toLowerCase();
    const name = sanitizeInput(body.name);
    const phone = body.phone ? sanitizeInput(body.phone) : null;
    const password = body.password;
    const institutionId = body.institutionId;

    // Student profile fields
    const dateOfBirth = body.dateOfBirth ? new Date(body.dateOfBirth) : null;
    const gender = body.gender ? sanitizeInput(body.gender) : null;
    const bloodGroup = body.bloodGroup ? sanitizeInput(body.bloodGroup) : null;
    const religion = body.religion ? sanitizeInput(body.religion) : null;
    const nationality = body.nationality ? sanitizeInput(body.nationality) : "Bangladeshi";
    const address = body.address ? sanitizeInput(body.address) : null;
    const city = body.city ? sanitizeInput(body.city) : null;
    const guardianName = body.guardianName ? sanitizeInput(body.guardianName) : null;
    const guardianPhone = body.guardianPhone ? sanitizeInput(body.guardianPhone) : null;
    const guardianRelation = body.guardianRelation ? sanitizeInput(body.guardianRelation) : null;
    const emergencyContact = body.emergencyContact ? sanitizeInput(body.emergencyContact) : null;
    const admissionDate = body.admissionDate ? new Date(body.admissionDate) : new Date();
    const admissionStatus = body.admissionStatus ? sanitizeInput(body.admissionStatus) : "active";

    // Enrollment fields
    const programId = body.programId || null;
    const batchId = body.batchId || null;
    const semesterId = body.semesterId || null;

    if (!email || !name || !password) {
      return NextResponse.json(
        { error: "Email, name, and password are required" },
        { status: 400 }
      );
    }

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email already exists" }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);

    const student = await db.user.create({
      data: {
        email,
        name,
        phone,
        passwordHash,
        role: "student",
        institutionId: institutionId || null,
        studentProfile: {
          create: {
            dateOfBirth,
            gender,
            bloodGroup,
            religion,
            nationality,
            address,
            city,
            guardianName,
            guardianPhone,
            guardianRelation,
            emergencyContact,
            admissionDate,
            admissionStatus,
          },
        },
        ...(programId && {
          enrollments: {
            create: {
              programId,
              batchId,
              semesterId,
              status: "active",
            },
          },
        }),
      },
      include: {
        studentProfile: true,
        enrollments: {
          include: {
            program: { select: { id: true, name: true, code: true } },
            batch: { select: { id: true, name: true, academicYear: true } },
          },
        },
      },
    });

    await createAuditLog({
      userId: user.userId,
      action: "create",
      resource: "student",
      resourceId: student.id,
      details: { name, email },
      ipAddress: ipFromRequest(request),
    });

    // Omit passwordHash from response
    const { passwordHash: _, ...studentData } = student as Record<string, unknown>;

    return NextResponse.json({ data: studentData }, { status: 201 });
  } catch (error) {
    console.error("Students POST error:", error);
    return NextResponse.json({ error: "Failed to create student" }, { status: 500 });
  }
}, { minRole: "admin" });
