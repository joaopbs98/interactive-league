import { Images } from "@/lib/assets";

/** Returns the FUT-style card frame artwork for a given overall rating. */
export function getCardFrame(rating: number) {
  if (rating >= 90) return Images.Card90to99;
  if (rating >= 88) return Images.Card88to89;
  if (rating >= 85) return Images.Card85to87;
  if (rating >= 83) return Images.Card83to84;
  if (rating >= 80) return Images.Card80to82;
  if (rating >= 75) return Images.Card75to79;
  if (rating >= 70) return Images.Card70to74;
  if (rating >= 65) return Images.Card65to69;
  if (rating >= 60) return Images.Card60to64;
  return Images.Card0to59;
}
