import { NextResponse } from "next/server";
import { isCanonicalMainnetAsset, ROBINHOOD_ASSETS_URL } from "@/lib/robinhood";

export const revalidate = 300;

export async function GET() {
  const response = await fetch(ROBINHOOD_ASSETS_URL, { next: { revalidate: 300 } });
  if (!response.ok) return NextResponse.json({ assets: [], error: "Robinhood asset registry unavailable" }, { status: 502 });
  const payload = await response.json();
  const assets = Array.isArray(payload.assets) ? payload.assets.filter(isCanonicalMainnetAsset) : [];
  return NextResponse.json({ assets });
}
