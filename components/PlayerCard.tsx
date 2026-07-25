"use client";

import React from "react";
import { Images } from "@/lib/assets";
import { getCardFrame } from "@/lib/cardFrame";

export interface PlayerCardPlayer {
  name: string;
  full_name?: string;
  positions?: string;
  overall_rating: number;
  image?: string;
  country_flag?: string | null;
  country_name?: string | null;
}

interface PlayerCardProps {
  player: PlayerCardPlayer;
  /** "lg" = full FUT-style reveal card with name below the face. "sm"/"md" = compact thumbnail for tokens/lists. */
  size?: "sm" | "md" | "lg";
  className?: string;
}

/** A FUT/FC-style player card: tier frame artwork with rating, position(s), nationality flag and face overlaid. */
export function PlayerCard({
  player,
  size = "lg",
  className = "",
}: PlayerCardProps) {
  const rating = player.overall_rating ?? 0;
  const frame = getCardFrame(rating);

  const positionsList = player.positions
    ? player.positions
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean)
    : [];
  const primaryPosition = positionsList[0] || "";
  const rawName = (player.full_name || player.name || "")
    .replace(/\s*-\s*$/, "")
    .trim();
  const nameParts = rawName.split(/\s+/).filter(Boolean);
  const displayName =
    nameParts.length <= 1 ? rawName : `${nameParts[0][0]}. ${nameParts.slice(1).join(" ")}`;

  const imageSrc = player.image?.startsWith("http")
    ? `/api/proxy-image?url=${encodeURIComponent(player.image)}`
    : player.image || Images.NoImage.src;

  const flagSrc = player.country_flag?.startsWith("http")
    ? `/api/proxy-image?url=${encodeURIComponent(player.country_flag)}`
    : player.country_flag || undefined;

  const isLarge = size === "lg";

  return (
    <div
      className={`relative aspect-square select-none ${className}`}
      style={{ containerType: "inline-size" } as React.CSSProperties}
    >
      {/* Frame artwork */}
      <img
        src={frame.src}
        alt=""
        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
        draggable={false}
      />

      {/* Player face. On "lg" the photo fills nearly the whole shield (object-cover, cropped) so
          it reads as the dominant element instead of a small sticker floating in empty card art. */}
      {isLarge ? (
        <div className="absolute left-[9%] right-[9%] top-[10%] bottom-[16%] overflow-hidden">
          <img
            src={imageSrc}
            alt=""
            className="w-full h-full object-cover object-top"
            onError={(e) => {
              (e.target as HTMLImageElement).src = Images.NoImage.src;
            }}
          />
        </div>
      ) : (
        <img
          src={imageSrc}
          alt=""
          className="absolute left-1/2 -translate-x-1/2 object-contain object-top top-[19%] w-[58%]"
          onError={(e) => {
            (e.target as HTMLImageElement).src = Images.NoImage.src;
          }}
        />
      )}

      {isLarge && (
        <>
          {/* Transparent gradient scrim under the lower third — darkens just enough for text
              to always read, but shifts with whatever art/photo is behind it instead of a flat
              opaque box sitting on top. */}
          <div className="absolute inset-x-0 bottom-[6%] h-[30%] z-[5] bg-gradient-to-t from-black/75 via-black/25 to-transparent pointer-events-none" />

          {/* Rating / position - plain bold white, drop-shadow only (no background), top-left.
              Anchor calibrated against the frame PNG's actual alpha channel: the shield has a
              cut/notched top-left corner, so anything closer than ~left-20/top-11 lands on the
              transparent margin outside the card, not on the card itself. */}
          <div
            className="absolute left-[20%] top-[11%] flex flex-col items-start leading-none z-10 text-white"
            style={{ textShadow: "0 1px 3px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.6)" }}
          >
            <span
              className="font-black tabular-nums"
              style={{ fontSize: "clamp(13px, 13cqw, 28px)" }}
            >
              {rating}
            </span>
            {primaryPosition && (
              <span
                className="font-bold uppercase tracking-wide"
                style={{ fontSize: "clamp(8px, 5cqw, 13px)" }}
              >
                {primaryPosition}
              </span>
            )}
          </div>

          {/* Nationality - top-right, plain with drop-shadow ring, no chip. Same calibration as
              above but mirrored: the opaque card body on this frame only extends to ~79% from
              the left, so anchor from the right at ~21% instead of guessing 9%. */}
          {flagSrc && (
            <img
              src={flagSrc}
              alt={player.country_name || ""}
              title={player.country_name || undefined}
              className="absolute right-[21%] top-[12%] w-[13%] min-w-[14px] max-w-[20px] h-auto object-contain rounded-[2px] ring-1 ring-white/40 z-10"
              style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.7))" }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          )}

          {/* Name - plain text on the gradient scrim, no solid chip. Bottom-center of the shield
              fades to transparent past ~y=90%, and the corners fade earlier than the center, so
              this stays inset and above that line. */}
          <div className="absolute inset-x-[16%] bottom-[12%] z-10">
            <p
              className="max-w-full truncate font-bold uppercase tracking-wide text-white text-center leading-tight"
              style={{ fontSize: "clamp(9px, 6cqw, 15px)", textShadow: "0 1px 3px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.7)" }}
            >
              {displayName}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
