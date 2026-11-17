import "server-only";
import enPortal from "../../../messages/en/portal.json";
import mlPortal from "../../../messages/ml/portal.json";
import hiPortal from "../../../messages/hi/portal.json";
import type { PortalMessages } from "./portal-ui";

type Obj = Record<string, unknown>;

function merge(base: Obj, over: Obj): Obj {
  const out: Obj = { ...base };
  for (const [k, v] of Object.entries(over)) {
    const b = out[k];
    out[k] =
      v && typeof v === "object" && !Array.isArray(v) && b && typeof b === "object" && !Array.isArray(b)
        ? merge(b as Obj, v as Obj)
        : v;
  }
  return out;
}

/** The portal namespace in all three languages (missing ml/hi strings fall back to English). */
export function portalMessages(): PortalMessages {
  const en = enPortal as Obj;
  return {
    en: { portal: en },
    ml: { portal: merge(en, mlPortal as Obj) },
    hi: { portal: merge(en, hiPortal as Obj) },
  };
}
