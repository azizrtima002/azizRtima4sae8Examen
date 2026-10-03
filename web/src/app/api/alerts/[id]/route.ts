import { NextResponse, type NextRequest } from "next/server";
import { ApiError, handler, requireUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isUuid } from "@/lib/offers";

export const DELETE = handler(async (_req: NextRequest, { params }: { params: { id: string } }) => {
  const user = await requireUser();
  const { count } = isUuid(params.id)
    ? await prisma.savedSearch.deleteMany({ where: { id: params.id, userId: user.id } })
    : { count: 0 };
  if (count === 0) throw new ApiError("not_found", "Alerte introuvable");
  return new NextResponse(null, { status: 204 });
});
