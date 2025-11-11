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
  try {
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
    
  } catch (error: any) {
    // Enhanced error logging for debugging
    console.error("[modules] ❌ Failed to fetch available modules:", {
      message: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack
    });
    
    // Check for specific error types
    if (error.code === 'unavailable') {
      console.error("[modules] 🔴 Firestore is UNAVAILABLE - Check internet connection or Firebase config");
    } else if (error.code === 'permission-denied') {
      console.error("[modules] 🔴 PERMISSION DENIED - Check Firestore security rules");
    } else if (error.code === 'not-found') {
      console.error("[modules] 🔴 Document NOT FOUND - Check if defaults/modules exists");
    } else if (error.code === 'unauthenticated') {
      console.error("[modules] 🔴 UNAUTHENTICATED - User needs to be logged in");
    }
    
    // Return empty set so the app can continue working (offline mode)
    console.warn("[modules] ⚠️ Returning empty set due to error");
    return new Set();
  }
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
  // if (!snap.exists()) return null;
  // const list = snap.data()?.[_email] ?? [];
  // return new Set(list.map((s: string) => s.toUpperCase()));
  console.log("[modules] fetchUserModulesByEmail() not wired yet (stub).");
  return null;
}