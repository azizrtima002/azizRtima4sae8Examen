import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const GET = handler(async () => NextResponse.json({ user: await getCurrentUser() }));
