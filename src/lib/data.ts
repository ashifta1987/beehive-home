import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Apartment } from "./types";

/** All apartments in display order (cached per request). Staff only (RLS). */
export const getApartments = cache(async (): Promise<Apartment[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("beehive_apartments").select("*").order("sort");
  return (data ?? []) as Apartment[];
});

export const aptMap = (apts: Apartment[]) => Object.fromEntries(apts.map((a) => [a.id, a])) as Record<string, Apartment>;
