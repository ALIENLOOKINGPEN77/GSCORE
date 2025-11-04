// /app/lib/firebase/client.ts
// Centralized Firebase initialization for the client.
// Uses NEXT_PUBLIC_* env vars so this can run on the browser.
// Add your secrets in .env.local as usual.

import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Helpful console to confirm we’re reading envs correctly (don’t log keys in prod)
console.log("[firebase/client] Initializing Firebase app...");

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,               // required
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,       // required
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,         // required
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, // optional
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, // optional
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,                 // required
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
console.log("[firebase/client] Firebase app ready:", !!app);

export const auth = getAuth(app);
export const db = getFirestore(app);
