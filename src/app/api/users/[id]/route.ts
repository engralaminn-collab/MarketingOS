import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/api-middleware";
import { hashPassword } from "@/lib/auth";
import {
  createAuditLog,
  ipFromRequest,
  sanitizeInput,
} from "@/lib/security";

// GET /api/users/[id] — Get single user
export const GET = withAuth(
  async (_request, _context) => {
    try {
      const { id } = await _context.params!;

      const scope = _context.user.companyId
        ? { companyUsers: { some: { companyId: _context.user.companyId } } }
        : _context.user.institutionId ? { institutionId: _context.user.institutionId } : null;
      if (!scope) return NextResponse.json({ error: "User not found" }, { status: 404 });
      const userRecord = await db.user.findFirst({
        where: { id, ...scope },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          avatar: true,
          role: true,
          isActive: true,
          isSuperAdmin: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
          institutionId: true,
          roleId: true,
          institution: { select: { id: true, name: true, shortName: true, logo: true } },
          roleRel: { select: { id: true, name: true, displayName: true, permissions: true, level: true } },
          studentProfile: {
            select: {
              id: true, studentId: true, dateOfBirth: true, gender: true,
              bloodGroup: true, address: true, city: true, guardianName: true,
              guardianPhone: true, guardianRelation: true, emergencyContact: true,
              admissionDate: true, admissionStatus: true, currentSemester: true,
              cgpa: true, totalCredits: true, status: true,
            },
          },
          employeeProfile: {
            select: {
              id: true, employeeId: true, dateOfBirth: true, gender: true,
              joinDate: true, contractEnd: true, employmentType: true,
              status: true, department: { select: { id: true, name: true, code: true } },
              designation: { select: { id: true, title: true } },
            },
          },
        },
      });

      if (!userRecord) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      return NextResponse.json({ data: userRecord });
    } catch (error) {
      console.error("Error fetching user:", error);
      return NextResponse.json(
        { error: "Failed to fetch user" },
        { status: 500 }
      );
    }
  },
  { minRole: "admin" }
);

// PUT /api/users/[id] — Update user
export const PUT = withAuth(
  async (request, { user, params }) => {
    try {
      const { id } = await params!;
      const systemAdmin = user.sessionId && (await db.user.findUnique({ where: { id: user.userId }, select: { isSuperAdmin: true } }))?.isSuperAdmin;
      if (!systemAdmin) return NextResponse.json({ error: "Global account changes require an interactive system administrator. Use team membership controls for workspace access." }, { status: 403 });
      const body = await request.json();

      const existing = await db.user.findUnique({ where: { id } });
      if (!existing) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      const updateData: Record<string, unknown> = {};
      const updatedFields: string[] = [];

      // Name
      if (body.name !== undefined) {
        const val = sanitizeInput(String(body.name));
        if (!val) {
          return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
        }
        updateData.name = val;
        updatedFields.push("name");
      }

      // Email
      if (body.email !== undefined) {
        const val = sanitizeInput(String(body.email)).toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
          return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
        }
        if (val !== existing.email) {
          const duplicate = await db.user.findUnique({ where: { email: val } });
          if (duplicate) {
            return NextResponse.json(
              { error: "A user with this email already exists" },
              { status: 409 }
            );
          }
        }
        updateData.email = val;
        updatedFields.push("email");
      }

      // Phone
      if (body.phone !== undefined) {
        updateData.phone = body.phone ? sanitizeInput(String(body.phone)) : null;
        updatedFields.push("phone");
      }

      // Role
      if (body.role !== undefined) {
        const val = sanitizeInput(String(body.role)).toLowerCase();
        const validRoles = ["student", "teacher", "employee", "admin", "accountant", "parent", "partner"];
        if (!validRoles.includes(val)) {
          return NextResponse.json(
            { error: `Invalid role. Must be one of: ${validRoles.join(", ")}` },
            { status: 400 }
          );
        }
        updateData.role = val;
        updatedFields.push("role");

        // Also update roleId if a matching role record exists
        const roleRecord = await db.role.findFirst({ where: { name: val } });
        if (roleRecord) {
          updateData.roleId = roleRecord.id;
        }
      }

      // Active status
      if (body.isActive !== undefined) {
        updateData.isActive = Boolean(body.isActive);
        updatedFields.push("isActive");
      }

      // Password (hashed)
      if (body.password !== undefined) {
        const rawPassword = String(body.password);
        if (rawPassword.length < 12 || rawPassword.length > 128) {
          return NextResponse.json(
            { error: "Password must be 12–128 characters" },
            { status: 400 }
          );
        }
        updateData.passwordHash = await hashPassword(rawPassword);
        updatedFields.push("password");
      }

      // Institution
      if (body.institutionId !== undefined) {
        if (body.institutionId) {
          const inst = await db.institution.findUnique({ where: { id: String(body.institutionId) } });
          if (!inst) {
            return NextResponse.json({ error: "Institution not found" }, { status: 400 });
          }
        }
        updateData.institutionId = body.institutionId ? String(body.institutionId) : null;
        updatedFields.push("institutionId");
      }

      if (Object.keys(updateData).length === 0) {
        return NextResponse.json(
          { error: "No fields to update" },
          { status: 400 }
        );
      }

      const updatedUser = await db.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true, email: true, name: true, phone: true, avatar: true,
          role: true, isActive: true, isSuperAdmin: true, lastLoginAt: true,
          createdAt: true, updatedAt: true, institutionId: true, roleId: true,
          institution: { select: { id: true, name: true, shortName: true } },
          roleRel: { select: { id: true, name: true, displayName: true } },
        },
      });

      await createAuditLog({
        userId: user.userId,
        action: "update",
        resource: "user",
        resourceId: id,
        details: { targetEmail: updatedUser.email, updatedFields },
        ipAddress: ipFromRequest(request),
      });

      return NextResponse.json({ data: updatedUser });
    } catch (error) {
      console.error("Error updating user:", error);
      return NextResponse.json(
        { error: "Failed to update user" },
        { status: 500 }
      );
    }
  },
  { minRole: "admin" }
);

// DELETE /api/users/[id] — Soft-delete user (deactivate)
export const DELETE = withAuth(
  async (request, { user, params }) => {
    try {
      const { id } = await params!;
      const systemAdmin = user.sessionId && (await db.user.findUnique({ where: { id: user.userId }, select: { isSuperAdmin: true } }))?.isSuperAdmin;
      if (!systemAdmin) return NextResponse.json({ error: "Global account changes require an interactive system administrator. Use team membership controls for workspace access." }, { status: 403 });

      // Prevent self-deletion
      if (id === user.userId) {
        return NextResponse.json(
          { error: "Cannot deactivate your own account" },
          { status: 400 }
        );
      }

      const existing = await db.user.findUnique({ where: { id } });
      if (!existing) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      const updatedUser = await db.user.update({
        where: { id },
        data: { isActive: false },
        select: {
          id: true, email: true, name: true, isActive: true,
          institution: { select: { id: true, name: true } },
          roleRel: { select: { id: true, name: true, displayName: true } },
        },
      });

      await createAuditLog({
        userId: user.userId,
        action: "delete",
        resource: "user",
        resourceId: id,
        details: { targetEmail: existing.email, targetName: existing.name },
        ipAddress: ipFromRequest(request),
      });

      return NextResponse.json({ data: updatedUser, message: "User deactivated successfully" });
    } catch (error) {
      console.error("Error deactivating user:", error);
      return NextResponse.json(
        { error: "Failed to deactivate user" },
        { status: 500 }
      );
    }
  },
  { minRole: "admin" }
);
