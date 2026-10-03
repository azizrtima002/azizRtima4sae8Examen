import { NextResponse, type NextRequest } from "next/server";
import { MAX_ALERTS_PER_USER } from "@/lib/alerts";
import { ApiError, handler, readJson, requireUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { createAlertSchema } from "./schema";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const user = await requireUser();
  const alerts = await prisma.savedSearch.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ alerts });
});

export const POST = handler(async (req: NextRequest) => {
  const user = await requireUser();
  const data = await readJson(req, createAlertSchema);

  const count = await prisma.savedSearch.count({ where: { userId: user.id } });
  if (count >= MAX_ALERTS_PER_USER) throw new ApiError("conflict", "Limite de 10 alertes atteinte");

  const duplicate = await prisma.savedSearch.findFirst({ where: { userId: user.id, ...data } });
  if (duplicate) return NextResponse.json({ alert: duplicate, created: false });

  const alert = await prisma.savedSearch.create({ data: { ...data, userId: user.id } });
  return NextResponse.json({ alert, created: true }, { status: 201 });
});
