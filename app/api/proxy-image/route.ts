import { NextRequest, NextResponse } from "next/server";
import { isAllowedImageProxyUrl } from "@/lib/security/productionGates.mjs";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get("url");

    if (!imageUrl) {
      return NextResponse.json({ error: "Image URL is required" }, { status: 400 });
    }

    if (!isAllowedImageProxyUrl(imageUrl)) {
      return NextResponse.json({ error: "Image host is not allowed" }, { status: 403 });
    }

    const response = await fetch(imageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "image/webp,image/apng,image/*,*/*;q=0.8",
      },
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok || response.body === null) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    const contentType = response.headers.get("content-type") || "image/png";
    if (!contentType.toLowerCase().startsWith("image/")) {
      return NextResponse.json({ error: "URL did not return an image" }, { status: 415 });
    }

    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Image is too large" }, { status: 413 });
    }

    const imageBuffer = await response.arrayBuffer();
    if (imageBuffer.byteLength === 0 || imageBuffer.byteLength > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Empty image" }, { status: 404 });
    }

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch image" }, { status: 500 });
  }
}






