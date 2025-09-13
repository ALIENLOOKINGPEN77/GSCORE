// /app/lib/firebase/admin-server.ts
// Corrected Firebase Admin SDK configuration with proper imports

import * as admin from 'firebase-admin';

// Interface for our admin app wrapper
interface FirebaseAdminApp {
  app: admin.app.App;
  auth: admin.auth.Auth;
  firestore: admin.firestore.Firestore;
}

// Cache the admin app to avoid re-initialization
let adminApp: FirebaseAdminApp | null = null;

/**
 * Initializes and returns the Firebase Admin SDK instance
 * Uses proper import syntax to avoid TypeScript conflicts
 */
export function getFirebaseAdminApp(): FirebaseAdminApp {
  if (adminApp) {
    console.log('[FirebaseAdmin] Returning existing admin app instance');
    return adminApp;
  }

  console.log('[FirebaseAdmin] Initializing new admin app instance');

  try {
    // Check if any Firebase Admin apps are already initialized
    const existingApps = admin.apps;
    let app: admin.app.App;

    if (existingApps.length > 0 && existingApps[0]) {
      console.log('[FirebaseAdmin] Using existing Firebase Admin app');
      app = existingApps[0];
    } else {
      console.log('[FirebaseAdmin] Creating new Firebase Admin app');
      
      // Initialize the admin app with service account credentials
      app = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
        projectId: process.env.FIREBASE_PROJECT_ID,
      });
    }

    // Get Auth and Firestore services from the admin app
    const auth = admin.auth(app);
    const firestore = admin.firestore(app);

    // Create and cache our admin app wrapper
    adminApp = {
      app,
      auth,
      firestore
    };

    console.log('[FirebaseAdmin] Admin app initialized successfully');
    return adminApp;

  } catch (error) {
    console.error('[FirebaseAdmin] Failed to initialize admin app:', error);
    
    // Provide helpful error messages for common configuration issues
    if (error instanceof Error) {
      if (error.message.includes('projectId')) {
        throw new Error('Firebase project ID is missing or invalid. Check your FIREBASE_PROJECT_ID environment variable.');
      } else if (error.message.includes('privateKey')) {
        throw new Error('Firebase private key is missing or invalid. Check your FIREBASE_PRIVATE_KEY environment variable.');
      } else if (error.message.includes('clientEmail')) {
        throw new Error('Firebase client email is missing or invalid. Check your FIREBASE_CLIENT_EMAIL environment variable.');
      }
    }
    
    throw new Error(`Failed to initialize Firebase Admin SDK: ${error}`);
  }
}

/**
 * Utility function to verify admin app configuration
 */
export async function verifyAdminAppConfiguration(): Promise<{
  isConfigured: boolean;
  projectId?: string;
  authEnabled: boolean;
  firestoreEnabled: boolean;
  error?: string;
}> {
  try {
    console.log('[FirebaseAdmin] Verifying admin app configuration...');
    
    const { app, auth, firestore } = getFirebaseAdminApp();
    
    // Basic configuration checks
    const projectId = app.options.projectId;
    
    // Test auth service
    let authEnabled = false;
    try {
      await auth.listUsers(1);
      authEnabled = true;
    } catch (authError) {
      console.warn('[FirebaseAdmin] Auth service test failed:', authError);
    }
    
    // Test Firestore service
    let firestoreEnabled = false;
    try {
      const testDoc = firestore.collection('_health_check').doc('test');
      await testDoc.get();
      firestoreEnabled = true;
    } catch (firestoreError) {
      console.warn('[FirebaseAdmin] Firestore service test failed:', firestoreError);
    }
    
    const result = {
      isConfigured: !!(projectId && authEnabled && firestoreEnabled),
      projectId,
      authEnabled,
      firestoreEnabled
    };
    
    console.log('[FirebaseAdmin] Configuration verification result:', result);
    return result;
    
  } catch (error) {
    console.error('[FirebaseAdmin] Configuration verification failed:', error);
    return {
      isConfigured: false,
      authEnabled: false,
      firestoreEnabled: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Utility function to safely get a user by email
 */
export async function getUserByEmailSafely(email: string): Promise<{
  user?: any;
  exists: boolean;
  error?: string;
}> {
  try {
    const { auth } = getFirebaseAdminApp();
    const userRecord = await auth.getUserByEmail(email);
    
    return {
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        emailVerified: userRecord.emailVerified,
        disabled: userRecord.disabled,
        customClaims: userRecord.customClaims || {}
      },
      exists: true
    };
  } catch (error: any) {
    if (error.code === 'auth/user-not-found') {
      return {
        exists: false,
        error: 'User not found'
      };
    }
    
    console.error('[FirebaseAdmin] Error getting user by email:', error);
    return {
      exists: false,
      error: error.message || 'Unknown error'
    };
  }
}

/**
 * Utility function to get current custom claims for a user
 */
export async function getUserCustomClaims(uid: string): Promise<{
  claims?: Record<string, any>;
  error?: string;
}> {
  try {
    const { auth } = getFirebaseAdminApp();
    const userRecord = await auth.getUser(uid);
    
    return {
      claims: userRecord.customClaims || {}
    };
  } catch (error: any) {
    console.error('[FirebaseAdmin] Error getting user custom claims:', error);
    return {
      error: error.message || 'Unknown error'
    };
  }
}

/**
 * Environment variables validation
 */
export function validateEnvironmentVariables(): {
  isValid: boolean;
  missingVariables: string[];
  warnings: string[];
} {
  const requiredVariables = [
    'FIREBASE_PROJECT_ID',
    'FIREBASE_CLIENT_EMAIL', 
    'FIREBASE_PRIVATE_KEY'
  ];
  
  const optionalVariables = [
    'INITIAL_ADMIN_SETUP_KEY'
  ];
  
  const missingVariables: string[] = [];
  const warnings: string[] = [];
  
  // Check required variables
  requiredVariables.forEach(varName => {
    if (!process.env[varName]) {
      missingVariables.push(varName);
    }
  });
  
  // Check optional variables
  optionalVariables.forEach(varName => {
    if (!process.env[varName]) {
      warnings.push(`Optional environment variable ${varName} is not set`);
    }
  });
  
  // Special validation for private key format
  if (process.env.FIREBASE_PRIVATE_KEY && !process.env.FIREBASE_PRIVATE_KEY.includes('BEGIN PRIVATE KEY')) {
    warnings.push('FIREBASE_PRIVATE_KEY may not be in the correct format');
  }
  
  return {
    isValid: missingVariables.length === 0,
    missingVariables,
    warnings
  };
}

/**
 * Health check endpoint helper
 */
export async function performHealthCheck(): Promise<{
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  checks: {
    environment: boolean;
    adminApp: boolean;
    auth: boolean;
    firestore: boolean;
  };
  details?: any;
  errors?: string[];
}> {
  const timestamp = new Date().toISOString();
  const errors: string[] = [];
  
  // Check environment variables
  const envCheck = validateEnvironmentVariables();
  if (!envCheck.isValid) {
    errors.push(`Missing environment variables: ${envCheck.missingVariables.join(', ')}`);
  }
  
  // Check admin app configuration
  let adminCheck;
  try {
    adminCheck = await verifyAdminAppConfiguration();
    if (!adminCheck.isConfigured) {
      errors.push('Admin app configuration failed');
    }
  } catch (error) {
    errors.push(`Admin app initialization failed: ${error}`);
    adminCheck = {
      isConfigured: false,
      authEnabled: false,
      firestoreEnabled: false
    };
  }
  
  const checks = {
    environment: envCheck.isValid,
    adminApp: adminCheck.isConfigured,
    auth: adminCheck.authEnabled,
    firestore: adminCheck.firestoreEnabled
  };
  
  const allChecksPass = Object.values(checks).every(check => check === true);
  
  return {
    status: allChecksPass ? 'healthy' : 'unhealthy',
    timestamp,
    checks,
    details: {
      projectId: adminCheck.projectId,
      environmentWarnings: envCheck.warnings
    },
    errors: errors.length > 0 ? errors : undefined
  };
}