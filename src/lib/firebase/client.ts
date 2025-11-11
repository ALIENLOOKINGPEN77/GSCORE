// /app/lib/firebase/client.ts
// Centralized Firebase initialization for the client.
// Uses NEXT_PUBLIC_* env vars so this can run on the browser.
// Add your secrets in .env.local as usual.

import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

console.log("[firebase/client] Initializing Firebase app...");

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,               // required
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,       // required
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,         // required
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, // optional
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, // optional
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,                 // optional
};

// Validate required config
const requiredFields = ['apiKey', 'authDomain', 'projectId'];
const missingFields = requiredFields.filter(field => !firebaseConfig[field as keyof typeof firebaseConfig]);

if (missingFields.length > 0) {
  console.error("[firebase/client] ❌ MISSING REQUIRED FIREBASE CONFIG:");
  console.error(`Missing fields: ${missingFields.join(', ')}`);
  console.error("Check your .env.local file and ensure these variables are set:");
  missingFields.forEach(field => {
    console.error(`  - NEXT_PUBLIC_FIREBASE_${field.replace(/([A-Z])/g, '_$1').toUpperCase()}`);
  });
  throw new Error(`Firebase config incomplete: missing ${missingFields.join(', ')}`);
}

// Log config status (don't log actual values in production)
console.log("[firebase/client] Config check:", {
  hasApiKey: !!firebaseConfig.apiKey,
  hasAuthDomain: !!firebaseConfig.authDomain,
  hasProjectId: !!firebaseConfig.projectId,
  projectId: firebaseConfig.projectId, // Safe to log project ID
  hasStorageBucket: !!firebaseConfig.storageBucket,
  hasMessagingSenderId: !!firebaseConfig.messagingSenderId,
  hasAppId: !!firebaseConfig.appId
});

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
console.log("[firebase/client] ✅ Firebase app ready");

export const auth = getAuth(app);
export const db = getFirestore(app);