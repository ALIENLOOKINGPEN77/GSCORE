// /app/lib/firebase/modules.ts
// Helpers to read the module registry from Firestore.
// Design per your plan: collection "defaults", doc "modules", field "modules_list": string[]

import { doc, getDoc } from "firebase/firestore";
import { db } from "./client";

/**
 * Reads defaults/modules.modules_list and returns a Set of uppercased T-codes.
 * If the doc or field is missing, returns an empty Set (and logs a console warning).
 */
export async function fetchAvailableModules(): Promise<Set<string>> {
  console.log("[modules] Fetching defaults/modules.modules_list...");
  const ref = doc(db, "defaults", "modules"); // (collection, doc)
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    console.warn("[modules] Document defaults/modules not found. Returning empty set.");
    return new Set();
  }

  const data = snap.data();
  const list = Array.isArray(data?.modules_list) ? data.modules_list : [];

  // Normalize to uppercase codes to match lookups
  const set = new Set<string>(list.map((s: string) => String(s).trim().toUpperCase()));
  console.log("[modules] Available modules:", Array.from(set));
  return set;
}

/**
 * (Optional) Per-user overrides:
 * If you later add "access/modules_by_user" with a map { [email: string]: string[] },
 * you can intersect with the defaults list.
 * Kept here as a stub to avoid assumptions in your current DB structure.
 */
export async function fetchUserModulesByEmail(_email: string): Promise<Set<string> | null> {
  // Example shape (uncomment & adapt when ready):
  // const ref = doc(db, "access", "modules_by_user");
  // const snap = await getDoc(ref);
  // if (!snap.exists()) return null;git push -u origin main
  // const list = snap.data()?.[_email] ?? [];
  // return new Set(list.map((s: string) => s.toUpperCase()));
  console.log("[modules] fetchUserModulesByEmail() not wired yet (stub).");
  return null;
}
