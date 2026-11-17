import type { TagColour } from "./types";

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** Background + text classes for an apartment's tag colour. Use these, never literal colours. */
export const TAG_CLASSES: Record<TagColour, { bg: string; text: string; ring: string }> = {
  tag1: { bg: "bg-tag1", text: "text-tag1-ink", ring: "border-tag1-ink" },
  tag2: { bg: "bg-tag2", text: "text-tag2-ink", ring: "border-tag2-ink" },
  tag3: { bg: "bg-tag3", text: "text-tag3-ink", ring: "border-tag3-ink" },
  tag4: { bg: "bg-tag4", text: "text-tag4-ink", ring: "border-tag4-ink" },
};

export const tagClasses = (t: string | null | undefined) => TAG_CLASSES[(t as TagColour) ?? "tag1"] ?? TAG_CLASSES.tag1;

/** Channel pill classes. */
export const CHANNEL_CLASSES: Record<string, string> = {
  airbnb: "bg-airbnb-soft text-airbnb",
  booking: "bg-booking-soft text-booking",
  direct: "bg-direct-soft text-direct",
  other: "bg-other-soft text-other",
};

