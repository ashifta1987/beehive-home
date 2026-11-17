import type { PettyCategory } from "@/lib/types";

export const PETTY_CATEGORIES = ["supplies", "laundry", "cleaning", "repairs", "transport", "guest", "other"] as const satisfies readonly PettyCategory[];
export const PETTY_TYPES = ["out", "in"] as const;
