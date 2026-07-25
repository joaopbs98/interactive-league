"use client";

import { useEffect, useState } from "react";
import { Images } from "@/lib/assets";

export function PlayerAvatar({
  src,
  alt,
  className,
}: {
  src?: string;
  alt: string;
  className?: string;
}) {
  const [imageSrc, setImageSrc] = useState<string>(src || Images.NoImage.src);

  useEffect(() => {
    if (src && src.startsWith("http")) {
      setImageSrc(`/api/proxy-image?url=${encodeURIComponent(src)}`);
    } else {
      setImageSrc(src || Images.NoImage.src);
    }
  }, [src]);

  return (
    <img
      src={imageSrc}
      alt={alt}
      className={className}
      onError={() => setImageSrc(Images.NoImage.src)}
      crossOrigin="anonymous"
    />
  );
}
