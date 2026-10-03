import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/api-middleware";

export const GET = withAuth(
  async () => {
    try {
      const institution = await db.institution.findFirst({
        orderBy: { createdAt: "asc" },
        include: {
          _count: {
            select: {
              departments: true,
              programs: true,
              batches: true,
              users: true,
              subjects: true,
              announcements: true,
              feeStructures: true,
            },
          },
        },
      });

      if (!institution) {
        return NextResponse.json(
          { error: "No institution found" },
          { status: 404 }
        );
      }

      return NextResponse.json({ data: institution });
    } catch (error) {
      console.error("Institution fetch error:", error);
      return NextResponse.json(
        { error: "Failed to fetch institution" },
        { status: 500 }
      );
    }
  },
  { allowPublic: true }
);
