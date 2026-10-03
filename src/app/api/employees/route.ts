import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/api-middleware";
import { sanitizeInput, createAuditLog, ipFromRequest } from "@/lib/security";
import { hashPassword } from "@/lib/auth";

export const GET = withAuth(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const departmentId = searchParams.get("departmentId");
    const designationId = searchParams.get("designationId");
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    const where: Record<string, unknown> = {
      employeeProfile: { isNot: null },
    };

    if (search) {
      const term = sanitizeInput(search);
      (where as Record<string, unknown>).OR = [
        { name: { contains: term } },
        { email: { contains: term } },
        { employeeProfile: { employeeId: { contains: term } } },
      ];
    }

    if (departmentId) {
      (where as Record<string, unknown>).employeeProfile = {
        ...(where.employeeProfile as Record<string, unknown> || {}),
        departmentId,
      };
    }

    if (designationId) {
      (where as Record<string, unknown>).employeeProfile = {
        ...(where.employeeProfile as Record<string, unknown> || {}),
        designationId,
      };
    }

    if (status) {
      (where as Record<string, unknown>).employeeProfile = {
        ...(where.employeeProfile as Record<string, unknown> || {}),
        status,
      };
    }

    const skip = (page - 1) * limit;
    const [employees, total] = await Promise.all([
      db.user.findMany({
        where,
        include: {
          employeeProfile: {
            include: {
              department: { select: { id: true, name: true, code: true } },
              designation: { select: { id: true, title: true, level: true, baseSalary: true } },
            },
          },
          institution: { select: { id: true, name: true, shortName: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.user.count({ where }),
    ]);

    // Remove passwordHash from response
    const sanitized = employees.map(({ passwordHash: _, ...rest }) => rest);

    return NextResponse.json({
      data: sanitized,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Employees GET error:", error);
    return NextResponse.json({ error: "Failed to fetch employees" }, { status: 500 });
  }
}, { minRole: "admin" });

export const POST = withAuth(async (request, { user }) => {
  try {
    const body = await request.json();
    const email = sanitizeInput(body.email);
    const name = sanitizeInput(body.name);
    const phone = body.phone ? sanitizeInput(body.phone) : null;
    const role = sanitizeInput(body.role || "employee");
    const institutionId = body.institutionId;

    const emp = body.employeeProfile || {};
    const employeeId = emp.employeeId ? sanitizeInput(emp.employeeId) : null;
    const joinDate = emp.joinDate ? new Date(emp.joinDate) : new Date();
    const employmentType = sanitizeInput(emp.employmentType || "full-time");
    const departmentId = emp.departmentId || null;
    const designationId = emp.designationId || null;
    const bankName = emp.bankName ? sanitizeInput(emp.bankName) : null;
    const bankAccount = emp.bankAccount ? sanitizeInput(emp.bankAccount) : null;
    const bankBranch = emp.bankBranch ? sanitizeInput(emp.bankBranch) : null;
    const password = body.password;

    if (!email || !name) {
      return NextResponse.json({ error: "Email and name are required" }, { status: 400 });
    }

    if (!password) {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email already exists" }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);

    const userData: Record<string, unknown> = {
      email,
      name,
      phone,
      passwordHash,
      role,
      institutionId: institutionId || null,
    };

    if (employeeId) {
      userData.employeeProfile = {
        create: {
          employeeId,
          joinDate,
          employmentType,
          departmentId,
          designationId,
          bankName,
          bankAccount,
          bankBranch,
          status: emp.status || "active",
          dateOfBirth: emp.dateOfBirth ? new Date(emp.dateOfBirth) : null,
          gender: emp.gender ? sanitizeInput(emp.gender) : null,
          bloodGroup: emp.bloodGroup ? sanitizeInput(emp.bloodGroup) : null,
          contractEnd: emp.contractEnd ? new Date(emp.contractEnd) : null,
        },
      };
    }

    const newEmployee = await db.user.create({
      data: userData as never,
      include: {
        employeeProfile: {
          include: {
            department: { select: { id: true, name: true, code: true } },
            designation: { select: { id: true, title: true, level: true, baseSalary: true } },
          },
        },
        institution: { select: { id: true, name: true, shortName: true } },
      },
    });

    const { passwordHash: _, ...sanitized } = newEmployee;

    await createAuditLog({
      userId: user.userId,
      action: "create",
      resource: "employee",
      resourceId: (sanitized as Record<string, unknown>).id as string,
      details: { name, email, role, employeeId },
      ipAddress: ipFromRequest(request),
    });

    return NextResponse.json({ data: sanitized }, { status: 201 });
  } catch (error) {
    console.error("Employees POST error:", error);
    return NextResponse.json({ error: "Failed to create employee" }, { status: 500 });
  }
}, { minRole: "admin" });
