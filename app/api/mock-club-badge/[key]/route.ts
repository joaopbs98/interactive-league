import { NextResponse } from "next/server";
import { MOCK_CLUB_CATALOGUE } from "@/lib/mock-clubs/catalogue.mjs";

type ClubIdentity = (typeof MOCK_CLUB_CATALOGUE)[number];

function badgeBody(club: ClubIdentity) {
  const primary = club.primaryColor;
  const secondary = club.secondaryColor;
  const acronym = club.acronym;
  const common = `<text x="60" y="72" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" font-weight="800" fill="${secondary}">${acronym}</text>`;

  switch (club.badge) {
    case "roundel":
      return `<circle cx="60" cy="60" r="50" fill="${primary}" stroke="${secondary}" stroke-width="8"/><circle cx="60" cy="60" r="34" fill="none" stroke="${secondary}" stroke-width="3"/>${common}`;
    case "diamond":
      return `<path d="M60 5 112 60 60 115 8 60Z" fill="${primary}" stroke="${secondary}" stroke-width="7"/><path d="M60 20 97 60 60 100 23 60Z" fill="none" stroke="${secondary}" stroke-width="3"/>${common}`;
    case "tower":
      return `<path d="M18 15h18v14h15V15h18v14h15V15h18v88L60 117 18 103Z" fill="${primary}" stroke="${secondary}" stroke-width="6"/><path d="M34 49h52v48L60 108 34 97Z" fill="none" stroke="${secondary}" stroke-width="3"/>${common}`;
    case "wings":
      return `<path d="M60 18 42 7 7 29l31 20-27 9 35 18 14 39 14-39 35-18-27-9 31-20L78 7Z" fill="${primary}" stroke="${secondary}" stroke-width="6"/>${common}`;
    case "shield_star":
      return `<path d="M13 12h94v58c0 25-19 39-47 48C32 109 13 95 13 70Z" fill="${primary}" stroke="${secondary}" stroke-width="7"/><path d="m60 25 7 14 16 2-12 11 3 16-14-8-14 8 3-16-12-11 16-2Z" fill="${secondary}"/>${common}`;
    default:
      return `<path d="M13 12h94v58c0 25-19 39-47 48C32 109 13 95 13 70Z" fill="${primary}" stroke="${secondary}" stroke-width="7"/><path d="M30 29h60v54L60 104 30 83Z" fill="none" stroke="${secondary}" stroke-width="3"/>${common}`;
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ key: string }> },
) {
  const { key } = await context.params;
  const club = MOCK_CLUB_CATALOGUE.find((identity) => identity.key === key);

  if (!club) {
    return new NextResponse("Badge not found", { status: 404 });
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="img" aria-labelledby="title"><title id="title">${club.name} badge</title>${badgeBody(club)}</svg>`;
  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
