"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Images } from "@/lib/assets";
import { formatPlayerName } from "@/utils/playerUtils";
import { Position } from "@/lib/formationPositions";
import { getRatingColorClasses } from "@/utils/ratingColors";

// Helper component for player images with fallback
const PlayerImage = ({ src, alt, width = 48, height = 48, className }: {
  src?: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
}) => {
  const [imageSrc, setImageSrc] = useState<string>(src || Images.NoImage.src);
  
  useEffect(() => {
    if (src && src.startsWith('http')) {
      // Use proxy route for external URLs to bypass CORS
      const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(src)}`;
      setImageSrc(proxyUrl);
    } else {
      // Use local images directly
      setImageSrc(src || Images.NoImage.src);
    }
  }, [src]);

  return (
    <img
      src={imageSrc}
      alt={alt}
      width={width}
      height={height}
      className={className}
      onError={() => {
        setImageSrc(Images.NoImage.src);
      }}
      crossOrigin="anonymous"
    />
  );
};

interface Player {
  player_id: string;
  name: string;
  full_name?: string;
  positions: string;
  overall_rating: number;
  image?: string;
}

interface TeamFormationDisplayProps {
  formation: string;
  positions: Position[];
  players: Player[];
  onPlayerClick?: (index: number) => void;
  className?: string;
}

const TeamFormationDisplay: React.FC<TeamFormationDisplayProps> = ({
  formation,
  positions,
  players,
  onPlayerClick,
  className = ""
}) => {
  return (
    <div className={`relative w-full aspect-[4/3] rounded-lg overflow-hidden ${className}`}>
      <Image
        src={Images.Field}
        fill
        alt="Football Field"
        className="object-cover"
      />
      {positions.map((pos, idx) => {
        const player = players[idx] || {
          player_id: `empty-${idx}`,
          name: "No Player",
          positions: pos.label,
          overall_rating: 50
        };

        return (
          <div
            key={idx}
            className="absolute flex flex-col items-center transform -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            onClick={() => onPlayerClick?.(idx)}
          >
            <div className="relative group cursor-pointer">
              <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-neutral-800 group-hover:border-green-600 transition-colors bg-gray-800">
                <PlayerImage
                  src={player.image}
                  alt={player.name}
                  width={48}
                  height={48}
                  className="object-cover"
                />
              </div>
              <Badge className={`absolute -right-2 -top-2 ${getRatingColorClasses(player.overall_rating)}`}>
                {player.overall_rating}
              </Badge>
            </div>
            <div className="mt-1 text-center">
              <p className="text-sm font-medium whitespace-nowrap">
                {formatPlayerName(player.full_name || player.name)}
              </p>
              <Badge variant="outline" className="mt-1 text-xs">
                {pos.label}
              </Badge>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TeamFormationDisplay;