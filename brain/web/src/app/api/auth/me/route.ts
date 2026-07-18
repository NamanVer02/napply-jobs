import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isMultiTenant } from "@/lib/multi-tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isMultiTenant()) {
    return NextResponse.json({ multiTenant: false });
  }
  const username = await getSessionUser();
  if (!username) {
    return NextResponse.json({ multiTenant: true, username: null }, { status: 401 });
  }
  return NextResponse.json({ multiTenant: true, username });
}
