import { NextResponse, type NextRequest } from "next/server";
import { handler } from "@/lib/api";
import { listOffers } from "@/lib/offers";
import { parseOfferFilters } from "@/lib/search";

export const dynamic = "force-dynamic";

/** GET /api/offers?q=&city=&domain=&type=&freshness=&page= */
export const GET = handler(async (req: NextRequest) => {
  const filters = parseOfferFilters(req.nextUrl.searchParams);
  const page = await listOffers(filters);
  return NextResponse.json({ ...page, filters });
});
