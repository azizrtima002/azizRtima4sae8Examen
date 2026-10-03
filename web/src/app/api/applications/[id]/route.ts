import { NextResponse, type NextRequest } from "next/server";
import { ApiError, handler, readJson, requireUser } from "@/lib/api";
import { applicationInclude, toBoardCard } from "@/lib/applications";
import { prisma } from "@/lib/db";
import { isUuid } from "@/lib/offers";
import { updateApplicationSchema } from "../schema";

type Context = { params: { id: string } };

async function findOwned(id: string, userId: string) {
  const application = isUuid(id)
    ? await prisma.application.findFirst({ where: { id, userId }, select: { id: true } })
    : null;
  if (!application) throw new ApiError("not_found", "Candidature introuvable");
  return application;
}

export const PATCH = handler(async (req: NextRequest, { params }: Context) => {
  const user = await requireUser();
  const data = await readJson(req, updateApplicationSchema);
  await findOwned(params.id, user.id);
  const application = await prisma.application.update({
    where: { id: params.id },
    data: {
      ...(data.status && { status: data.status }),
      ...(data.notes !== undefined && { notes: data.notes }),
      ...(data.followUpDate !== undefined && {
        followUpDate: data.followUpDate ? new Date(`${data.followUpDate}T00:00:00Z`) : null,
      }),
    },
    include: applicationInclude,
  });
  return NextResponse.json({ application: toBoardCard(application) });
});

export const DELETE = handler(async (_req: NextRequest, { params }: Context) => {
  const user = await requireUser();
  await findOwned(params.id, user.id);
  await prisma.application.delete({ where: { id: params.id } });
  return new NextResponse(null, { status: 204 });
});
