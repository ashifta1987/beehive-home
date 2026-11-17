import { ImageResponse } from "next/og";
import { BrandIcon } from "@/components/portal/brand-icon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon for iOS (iOS rounds the corners itself, so the art is full-bleed). */
export default function AppleIcon() {
  return new ImageResponse(<BrandIcon size={180} variant="full" />, size);
}
