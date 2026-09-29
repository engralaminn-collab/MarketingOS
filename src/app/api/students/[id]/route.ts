import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/api-middleware";
import { sanitizeInput, createAuditLog, ipFromRequest } from "@/lib/security";
import type { Prisma } from "@prisma/client";

/**
 * Builds the nested StudentProfile write for a User.update.
 * `profileData` is assembled field-by-field above from validated request body
 * values, so it is narrowed to the Prisma input type at this single boundary
 * rather than being spread untyped into the update.
 */
function buildProfileWrite(
  hasProfile: boolean,
  profileData: Record<string, unknown>
): Pick<Prisma.UserUpdateInput, "studentProfile"> {
  if (Object.keys(profileData).length === 0) return {};
  return hasProfile
    ? { studentProfile: { update: profileData as Prisma.StudentProfileUpdateWithoutUserInput } }
    : { studentProfile: { create: profileData as Prisma.StudentProfileCreateWithoutUserInput } };
}


export const GET = withAuth(async (request, { params }) => {
  try {
    const { id } = await params;
    const student = await db.user.findUnique({
      where: { id },
      include: {
        studentProfile: true,
        enrollments: {
          include: {
            program: { select: { id: true, name: true, code: true } },
            batch: { select: { id: true, name: true, academicYear: true } },
            semester: { select: { id: true, name: true, number: true } },
          },
        },
        institution: { select: { id: true, name: true, shortName: true } },
      },
    });

    if (!student || student.role !== "student") {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const { passwordHash: _, ...studentData } = student as unknown as Record<string, unknown>;

    return NextResponse.json({ data: studentData });
  } catch (error) {
    console.error("Student GET by id error:", error);
    return NextResponse.json({ error: "Failed to fetch student" }, { status: 500 });
  }
}, { minRole: "teacher" });

export const PUT = withAuth(async (request, { params, user }) => {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await db.user.findUnique({
      where: { id },
      include: { studentProfile: true },
    });
    if (!existing || existing.role !== "student") {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    // Update user fields
    const userData: Record<string, unknown> = {};
    if (body.name !== undefined) userData.name = sanitizeInput(body.name);
    if (body.phone !== undefined) userData.phone = body.phone ? sanitizeInput(body.phone) : null;
    if (body.isActive !== undefined) userData.isActive = body.isActive;

    // Update student profile fields
    const profileData: Record<string, unknown> = {};
    if (body.dateOfBirth !== undefined) profileData.dateOfBirth = body.dateOfBirth ? new Date(body.dateOfBirth) : null;
    if (body.gender !== undefined) profileData.gender = body.gender ? sanitizeInput(body.gender) : null;
    if (body.bloodGroup !== undefined) profileData.bloodGroup = body.bloodGroup ? sanitizeInput(body.bloodGroup) : null;
    if (body.religion !== undefined) profileData.religion = body.religion ? sanitizeInput(body.religion) : null;
    if (body.nationality !== undefined) profileData.nationality = body.nationality ? sanitizeInput(body.nationality) : null;
    if (body.address !== undefined) profileData.address = body.address ? sanitizeInput(body.address) : null;
    if (body.city !== undefined) profileData.city = body.city ? sanitizeInput(body.city) : null;
    if (body.guardianName !== undefined) profileData.guardianName = body.guardianName ? sanitizeInput(body.guardianName) : null;
    if (body.guardianPhone !== undefined) profileData.guardianPhone = body.guardianPhone ? sanitizeInput(body.guardianPhone) : null;
    if (body.guardianRelation !== undefined) profileData.guardianRelation = body.guardianRelation ? sanitizeInput(body.guardianRelation) : null;
    if (body.emergencyContact !== undefined) profileData.emergencyContact = body.emergencyContact ? sanitizeInput(body.emergencyContact) : null;
    if (body.admissionStatus !== undefined) profileData.admissionStatus = sanitizeInput(body.admissionStatus);
    if (body.currentSemester !== undefined) profileData.currentSemester = Number(body.currentSemester);
    if (body.cgpa !== undefined) profileData.cgpa = Number(body.cgpa);
    if (body.totalCredits !== undefined) profileData.totalCredits = Number(body.totalCredits);
    if (body.status !== undefined) profileData.status = sanitizeInput(body.status);

    const student = await db.user.update({
      where: { id },
      data: {
        ...userData,
        ...buildProfileWrite(Boolean(existing.studentProfile), profileData),
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
      action: "update",
      resource: "student",
      resourceId: id,
      details: { ...userData, ...profileData },
      ipAddress: ipFromRequest(request),
    });

    const { passwordHash: _, ...studentData } = student as unknown as Record<string, unknown>;

    return NextResponse.json({ data: studentData });
  } catch (error) {
    console.error("Student PUT error:", error);
    return NextResponse.json({ error: "Failed to update student" }, { status: 500 });
  }
}, { minRole: "admin" });

export const DELETE = withAuth(async (request, { params, user }) => {
  try {
    const { id } = await params;
    const existing = await db.user.findUnique({ where: { id } });
    if (!existing || existing.role !== "student") {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    await db.user.delete({ where: { id } });

    await createAuditLog({
      userId: user.userId,
      action: "delete",
      resource: "student",
      resourceId: id,
      details: { name: existing.name, email: existing.email },
      ipAddress: ipFromRequest(request),
    });

    return NextResponse.json({ data: { message: "Student deleted successfully" } });
  } catch (error) {
    console.error("Student DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete student" }, { status: 500 });
  }
}, { minRole: "admin" });
