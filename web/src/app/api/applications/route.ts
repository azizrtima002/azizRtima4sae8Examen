import { NextResponse, type NextRequest } from "next/server";
import { ApiError, handler, readJson, requireUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { applicationInclude, toBoardCard } from "@/lib/applications";
import { createApplicationSchema } from "./schema";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const user = await requireUser();
  const applications = await prisma.application.findMany({
    where: { userId: user.id },
    include: applicationInclude,
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ applications: applications.map(toBoardCard) });
});

/** Add an offer to the board. Idempotent: returns the existing card if any. */
export const POST = handler(async (req: NextRequest) => {
  const user = await requireUser();
  const { offerId, status } = await readJson(req, createApplicationSchema);

  const existing = await prisma.application.findUnique({
    where: { userId_offerId: { userId: user.id, offerId } },
    include: applicationInclude,
  });
  if (existing) return NextResponse.json({ application: toBoardCard(existing), created: false });

  const offer = await prisma.offer.findUnique({ where: { id: offerId }, select: { id: true } });
  if (!offer) throw new ApiError("not_found", "Offre introuvable");

  const application = await prisma.application.create({
    data: { userId: user.id, offerId, status },
    include: applicationInclude,
  });
  return NextResponse.json({ application: toBoardCard(application), created: true }, { status: 201 });
});
