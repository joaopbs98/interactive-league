import { NextRequest, NextResponse } from "next/server";

const SUPABASE_FUNCTION_URL = "https://ejpuiyhiyzynqbaansat.supabase.co/functions/v1/createLeague";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const authHeader = req.headers.get("authorization");

  const response = await fetch(SUPABASE_FUNCTION_URL, {
    method: "POST",
    headers: {
      "authorization": authHeader || "",
      "content-type": "application/json",
    },
    body,
  });

  const text = await response.text();
  try {
    return NextResponse.json(JSON.parse(text), { status: response.status });
  } catch {
    return new NextResponse(text, { status: response.status });
  }
}