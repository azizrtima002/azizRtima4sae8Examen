import { NextResponse, type NextRequest } from "next/server";
import { ApiError, handler } from "@/lib/api";
import { getOffer } from "@/lib/offers";

export const dynamic = "force-dynamic";

export const GET = handler(async (_req: NextRequest, { params }: { params: { id: string } }) => {
  const offer = await getOffer(params.id);
  if (!offer) throw new ApiError("not_found", "Offre introuvable");
  return NextResponse.json(offer);
});
