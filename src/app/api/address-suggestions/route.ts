import { normalizeAddressSuggestions } from "@/lib/addressSuggestions";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query")?.trim() ?? "";

  if (query.length < 4) {
    return NextResponse.json({ suggestions: [] });
  }

  const providerParams = new URLSearchParams({
    q: query,
    format: "json",
    addressdetails: "1",
    countrycodes: "us",
    limit: "5",
  });

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?${providerParams}`,
      {
        cache: "no-store",
        headers: {
          accept: "application/json",
          "user-agent": "GreymatterFrontend/1.0",
        },
      },
    );

    if (!response.ok) {
      return NextResponse.json({ suggestions: [] }, { status: 502 });
    }

    const payload = (await response.json()) as unknown;
    return NextResponse.json({
      suggestions: normalizeAddressSuggestions(payload),
    });
  } catch {
    return NextResponse.json({ suggestions: [] }, { status: 502 });
  }
}
