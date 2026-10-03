import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { getSyncStatus } from "@/lib/sync";

export const dynamic = "force-dynamic";

export const GET = handler(async () => NextResponse.json(await getSyncStatus()));
