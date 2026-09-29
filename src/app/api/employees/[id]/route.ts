import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/api-middleware";
import { sanitizeInput, createAuditLog, ipFromRequest } from "@/lib/security";

export const GET = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;
    const employee = await db.user.findUnique({
      where: { id },
      include: {
        employeeProfile: {
          include: {
            department: { select: { id: true, name: true, code: true } },
            designation: { select: { id: true, title: true, level: true, baseSalary: true } },
          },
        },
        institution: { select: { id: true, name: true, shortName: true } },
        leaveRequests: { orderBy: { createdAt: "desc" }, take: 10 },
        salaries: { orderBy: { createdAt: "desc" }, take: 10 },
      },
    });

    if (!employee || !employee.employeeProfile) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const { passwordHash: _, ...sanitized } = employee;
    return NextResponse.json({ data: sanitized });
  } catch (error) {
    console.error("Employee GET by id error:", error);
    return NextResponse.json({ error: "Failed to fetch employee" }, { status: 500 });
  }
}, { minRole: "admin" });

export const PUT = withAuth(async (request, { params, user }) => {
  try {
    const { id } = await params;
    const existing = await db.user.findUnique({
      where: { id },
      include: { employeeProfile: true },
    });

    if (!existing || !existing.employeeProfile) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const body = await request.json();
    const userData: Record<string, unknown> = {};

    if (body.name !== undefined) userData.name = sanitizeInput(body.name);
    if (body.phone !== undefined) userData.phone = body.phone ? sanitizeInput(body.phone) : null;
    if (body.avatar !== undefined) userData.avatar = body.avatar || null;
    if (body.isActive !== undefined) userData.isActive = body.isActive;
    if (body.role !== undefined) userData.role = sanitizeInput(body.role);

    // Update user
    const updatedUser = await db.user.update({
      where: { id },
      data: userData,
    });

    // Update employee profile
    if (body.employeeProfile) {
      const emp = body.employeeProfile;
      const profileData: Record<string, unknown> = {};

      if (emp.employeeId !== undefined) profileData.employeeId = sanitizeInput(emp.employeeId);
      if (emp.dateOfBirth !== undefined) profileData.dateOfBirth = emp.dateOfBirth ? new Date(emp.dateOfBirth) : null;
      if (emp.gender !== undefined) profileData.gender = emp.gender ? sanitizeInput(emp.gender) : null;
      if (emp.bloodGroup !== undefined) profileData.bloodGroup = emp.bloodGroup ? sanitizeInput(emp.bloodGroup) : null;
      if (emp.employmentType !== undefined) profileData.employmentType = sanitizeInput(emp.employmentType);
      if (emp.status !== undefined) profileData.status = sanitizeInput(emp.status);
      if (emp.departmentId !== undefined) profileData.departmentId = emp.departmentId || null;
      if (emp.designationId !== undefined) profileData.designationId = emp.designationId || null;
      if (emp.bankName !== undefined) profileData.bankName = emp.bankName ? sanitizeInput(emp.bankName) : null;
      if (emp.bankAccount !== undefined) profileData.bankAccount = emp.bankAccount ? sanitizeInput(emp.bankAccount) : null;
      if (emp.bankBranch !== undefined) profileData.bankBranch = emp.bankBranch ? sanitizeInput(emp.bankBranch) : null;
      if (emp.joinDate !== undefined) profileData.joinDate = emp.joinDate ? new Date(emp.joinDate) : null;
      if (emp.contractEnd !== undefined) profileData.contractEnd = emp.contractEnd ? new Date(emp.contractEnd) : null;

      if (Object.keys(profileData).length > 0) {
        await db.employeeProfile.update({
          where: { id: existing.employeeProfile.id },
          data: profileData,
        });
      }
    }

    // Re-fetch with relations
    const employee = await db.user.findUnique({
      where: { id },
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

    const { passwordHash: _, ...sanitized } = employee!;

    await createAuditLog({
      userId: user.userId,
      action: "update",
      resource: "employee",
      resourceId: id,
      details: { ...userData, employeeProfile: body.employeeProfile },
      ipAddress: ipFromRequest(request),
    });

    return NextResponse.json({ data: sanitized });
  } catch (error) {
    console.error("Employee PUT error:", error);
    return NextResponse.json({ error: "Failed to update employee" }, { status: 500 });
  }
}, { minRole: "admin" });

export const DELETE = withAuth(async (request, { params, user }) => {
  try {
    const { id } = await params;
    const existing = await db.user.findUnique({
      where: { id },
      include: { employeeProfile: true },
    });

    if (!existing || !existing.employeeProfile) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    await db.employeeProfile.delete({ where: { id: existing.employeeProfile.id } });
    await db.user.delete({ where: { id } });

    await createAuditLog({
      userId: user.userId,
      action: "delete",
      resource: "employee",
      resourceId: id,
      details: { name: existing.name, email: existing.email },
      ipAddress: ipFromRequest(request),
    });

    return NextResponse.json({ data: { message: "Employee deleted successfully" } });
  } catch (error) {
    console.error("Employee DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete employee" }, { status: 500 });
  }
}, { minRole: "admin" });
