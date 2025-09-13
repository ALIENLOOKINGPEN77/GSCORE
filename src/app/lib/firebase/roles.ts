// /app/lib/firebase/roles.ts
// Updated client-side utilities for role management using Vercel API endpoints
// This replaces Firebase function calls with standard HTTP requests to your Vercel API

import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  onSnapshot, 
  query, 
  orderBy,
  where,
  Timestamp 
} from "firebase/firestore";
import { db, auth } from "./client";

// Types for our role system - these remain the same as before
export interface Role {
  label: string;
  modules: Record<string, 'r' | 'rw' | 'admin'>;
  description?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface UserRoleInfo {
  userId: string;
  roleId: string;
  roleLabel: string;
  assignedBy: string;
  assignedAt: Timestamp;
  userEmail?: string;
  userName?: string;
}

export interface UserPermissions {
  role?: string;
  roleLabel?: string;
  modules?: Record<string, 'r' | 'rw' | 'admin'>;
  isAdmin?: boolean;
}

/**
 * Helper function to get the current user's ID token for API authentication
 * This token proves to the server that the user is authenticated and includes their custom claims
 */
async function getCurrentUserToken(): Promise<string> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('No authenticated user found');
  }
  
  // Get fresh token with latest claims
  const idToken = await currentUser.getIdToken(true);
  return idToken;
}

/**
 * Helper function to make authenticated API calls to Vercel endpoints
 * This centralizes error handling and authentication for all API communications
 */
async function makeAuthenticatedAPICall(
  endpoint: string, 
  data: any
): Promise<any> {
  try {
    console.log(`[Roles] Making API call to: ${endpoint}`);
    
    // Get current user's authentication token
    const adminToken = await getCurrentUserToken();
    
    // Make the API call to your Vercel endpoint
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...data,
        adminToken // Include authentication token in request body
      })
    });

    // Parse the response
    const responseData = await response.json();
    
    // Handle different types of API responses
    if (!response.ok) {
      console.error(`[Roles] API call failed:`, {
        endpoint,
        status: response.status,
        error: responseData.error
      });
      
      // Throw specific error messages for different HTTP status codes
      switch (response.status) {
        case 401:
          throw new Error('Su sesión ha expirado. Por favor, inicie sesión nuevamente.');
        case 403:
          throw new Error('No tiene permisos para realizar esta acción.');
        case 404:
          throw new Error('El recurso solicitado no fue encontrado.');
        case 500:
          throw new Error('Error interno del servidor. Intente nuevamente más tarde.');
        default:
          throw new Error(responseData.error || `Error ${response.status}: ${response.statusText}`);
      }
    }

    console.log(`[Roles] API call successful:`, endpoint);
    return responseData;

  } catch (error) {
    console.error(`[Roles] API call error for ${endpoint}:`, error);
    
    // Re-throw the error with additional context
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error('Error de conexión. Verifique su conexión a internet.');
    }
  }
}

/**
 * Fetches all available roles from Firestore
 * This function remains unchanged as it reads directly from Firestore
 */
export async function fetchAllRoles(): Promise<Record<string, Role>> {
  try {
    console.log('[Roles] Fetching all roles...');
    const rolesRef = collection(db, 'roles');
    const q = query(rolesRef, orderBy('label'));
    const snapshot = await getDocs(q);
    
    const roles: Record<string, Role> = {};
    snapshot.docs.forEach(doc => {
      roles[doc.id] = doc.data() as Role;
    });
    
    console.log('[Roles] Loaded roles:', Object.keys(roles));
    return roles;
  } catch (error) {
    console.error('[Roles] Error fetching roles:', error);
    return {};
  }
}

/**
 * Fetches a specific role by ID
 * This function also remains unchanged as it reads directly from Firestore
 */
export async function fetchRole(roleId: string): Promise<Role | null> {
  try {
    const roleDoc = await getDoc(doc(db, 'roles', roleId));
    if (roleDoc.exists()) {
      return roleDoc.data() as Role;
    }
    return null;
  } catch (error) {
    console.error(`[Roles] Error fetching role ${roleId}:`, error);
    return null;
  }
}

/**
 * Subscribe to role changes in real-time
 * Useful for admin interfaces that need live updates
 */
export function subscribeToRoles(callback: (roles: Record<string, Role>) => void) {
  const rolesRef = collection(db, 'roles');
  const q = query(rolesRef, orderBy('label'));
  
  return onSnapshot(q, 
    (snapshot) => {
      const roles: Record<string, Role> = {};
      snapshot.docs.forEach(doc => {
        roles[doc.id] = doc.data() as Role;
      });
      callback(roles);
    },
    (error) => {
      console.error('[Roles] Error in roles subscription:', error);
      callback({});
    }
  );
}

/**
 * Fetches all user role assignments
 * This shows which users are assigned to which roles
 */
export async function fetchUserRoleAssignments(): Promise<UserRoleInfo[]> {
  try {
    console.log('[Roles] Fetching user role assignments...');
    const userRolesRef = collection(db, 'user_roles');
    const q = query(userRolesRef, orderBy('assignedAt', 'desc'));
    const snapshot = await getDocs(q);
    
    const assignments: UserRoleInfo[] = snapshot.docs.map(doc => ({
      ...doc.data(),
      userId: doc.id
    })) as UserRoleInfo[];
    
    console.log('[Roles] Loaded user assignments:', assignments.length);
    return assignments;
  } catch (error) {
    console.error('[Roles] Error fetching user assignments:', error);
    return [];
  }
}

/**
 * Subscribe to user role assignments in real-time
 */
export function subscribeToUserRoleAssignments(callback: (assignments: UserRoleInfo[]) => void) {
  const userRolesRef = collection(db, 'user_roles');
  const q = query(userRolesRef, orderBy('assignedAt', 'desc'));
  
  return onSnapshot(q,
    (snapshot) => {
      const assignments: UserRoleInfo[] = snapshot.docs.map(doc => ({
        ...doc.data(),
        userId: doc.id
      })) as UserRoleInfo[];
      callback(assignments);
    },
    (error) => {
      console.error('[Roles] Error in user assignments subscription:', error);
      callback([]);
    }
  );
}

/**
 * Assigns a role to a user using the Vercel API endpoint
 * This replaces the Firebase function call with an HTTP request to your Vercel API
 */
export async function assignRoleToUser(targetUserId: string, roleId: string): Promise<void> {
  try {
    console.log(`[Roles] Assigning role ${roleId} to user ${targetUserId}`);
    
    // Call the Vercel API endpoint for role assignment
    const result = await makeAuthenticatedAPICall('/api/admin/assign-role', {
      targetUserId,
      roleId
    });
    
    console.log('[Roles] Role assignment result:', result);
    
    // The API call succeeded if we reach this point
    // The server has updated the user's custom claims and stored the assignment record
    
  } catch (error) {
    console.error('[Roles] Error assigning role:', error);
    
    // The makeAuthenticatedAPICall function already handles different error types
    // and throws user-friendly error messages, so we just re-throw here
    throw error;
  }
}

/**
 * Removes a role from a user using the Vercel API endpoint
 */
export async function removeRoleFromUser(targetUserId: string): Promise<void> {
  try {
    console.log(`[Roles] Removing role from user ${targetUserId}`);
    
    // Call the Vercel API endpoint for role removal
    const result = await makeAuthenticatedAPICall('/api/admin/remove-role', {
      targetUserId
    });
    
    console.log('[Roles] Role removal result:', result);
    
  } catch (error) {
    console.error('[Roles] Error removing role:', error);
    throw error;
  }
}

/**
 * Creates the initial admin user using the Vercel API endpoint
 * This should only be called during system setup
 */
export async function createInitialAdmin(userEmail: string, setupKey: string): Promise<void> {
  try {
    console.log(`[Roles] Creating initial admin: ${userEmail}`);
    
    // Call the Vercel API endpoint for initial admin creation
    // Note: This endpoint doesn't require an admin token since it's for initial setup
    const response = await fetch('/api/admin/create-initial-admin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userEmail,
        setupKey
      })
    });

    const responseData = await response.json();
    
    if (!response.ok) {
      console.error('[Roles] Initial admin creation failed:', responseData.error);
      throw new Error(responseData.error || 'Error al crear el administrador inicial');
    }
    
    console.log('[Roles] Initial admin creation result:', responseData);
    
  } catch (error) {
    console.error('[Roles] Error creating initial admin:', error);
    
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error('Error inesperado al crear el administrador inicial');
    }
  }
}

/**
 * Extracts user permissions from Firebase Auth custom claims
 * This function remains unchanged as it reads from the authentication token
 */
export function extractUserPermissions(idTokenResult: any): UserPermissions {
  const claims = idTokenResult?.claims || {};
  
  return {
    role: claims.role,
    roleLabel: claims.roleLabel,
    modules: claims.modules || {},
    isAdmin: claims.isAdmin === true || claims.admin === true // Support both claim formats
  };
}

/**
 * Checks if a user has permission to access a specific module
 * This replaces your old checkUserAccess function
 */
export function hasModuleAccess(
  permissions: UserPermissions, 
  moduleCode: string, 
  requiredLevel: 'r' | 'rw' | 'admin' = 'r'
): boolean {
  // Admin users have access to everything
  if (permissions.isAdmin) {
    return true;
  }
  
  // Check if user has the module in their permissions
  const modules = permissions.modules || {};
  const userLevel = modules[moduleCode];
  
  if (!userLevel) {
    return false;
  }
  
  // Check if user's permission level meets the requirement
  const levelOrder: Record<string, number> = { 'r': 1, 'rw': 2, 'admin': 3 };
  const userLevelNum = levelOrder[userLevel] || 0;
  const requiredLevelNum = levelOrder[requiredLevel] || 0;
  
  return userLevelNum >= requiredLevelNum;
}

/**
 * Gets all modules that a user has access to
 * Useful for filtering available modules in the UI
 */
export function getUserAccessibleModules(permissions: UserPermissions): Set<string> {
  // Admin users have access to everything - return all modules from Firebase
  if (permissions.isAdmin) {
    return new Set(['*']); // Special case handled by the calling code
  }
  
  // Regular users only get their assigned modules
  const modules = permissions.modules || {};
  return new Set(Object.keys(modules));
}

/**
 * Utility to format role information for display
 */
export function formatRoleDisplay(role: Role): string {
  const moduleCount = Object.keys(role.modules).length;
  return `${role.label} (${moduleCount} módulos)`;
}

/**
 * Utility to get user's role display name from permissions
 */
export function getUserRoleDisplay(permissions: UserPermissions): string {
  if (permissions.isAdmin) {
    return 'Administrador';
  }
  
  return permissions.roleLabel || permissions.role || 'Sin rol asignado';
}

/**
 * Legacy compatibility function
 * This allows your existing code to work while transitioning to the new system
 */
export async function fetchAvailableModulesCompat(permissions: UserPermissions): Promise<Set<string>> {
  // If user is admin, fetch all modules from the old system for backward compatibility
  if (permissions.isAdmin) {
    try {
      const modulesRef = doc(db, "defaults", "modules");
      const snap = await getDoc(modulesRef);
      
      if (snap.exists()) {
        const data = snap.data();
        const list = Array.isArray(data?.modules_list) ? data.modules_list : [];
        return new Set(list.map((s: string) => String(s).trim().toUpperCase()));
      }
    } catch (error) {
      console.warn('[Roles] Error fetching legacy modules for admin:', error);
    }
    
    return new Set(); // Fallback for admin
  }
  
  // For regular users, return their assigned modules
  return getUserAccessibleModules(permissions);
}

/**
 * Health check function to verify the Vercel API is working
 * This is useful for debugging and monitoring your role management system
 */
export async function checkAPIHealth(): Promise<{
  isHealthy: boolean;
  error?: string;
  details?: any;
}> {
  try {
    console.log('[Roles] Checking API health...');
    
    const response = await fetch('/api/health', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status} ${response.statusText}`);
    }

    const healthData = await response.json();
    
    return {
      isHealthy: healthData.status === 'healthy',
      details: healthData
    };
    
  } catch (error) {
    console.error('[Roles] API health check failed:', error);
    return {
      isHealthy: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Utility function to refresh a user's permissions
 * This forces the client to get updated custom claims from the server
 */
export async function refreshUserPermissions(): Promise<UserPermissions> {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('No authenticated user found');
    }
    
    console.log('[Roles] Refreshing user permissions...');
    
    // Force refresh of the ID token to get latest custom claims
    const idTokenResult = await currentUser.getIdTokenResult(true);
    const permissions = extractUserPermissions(idTokenResult);
    
    console.log('[Roles] Permissions refreshed:', {
      role: permissions.role,
      roleLabel: permissions.roleLabel,
      isAdmin: permissions.isAdmin,
      moduleCount: Object.keys(permissions.modules || {}).length
    });
    
    return permissions;
    
  } catch (error) {
    console.error('[Roles] Error refreshing permissions:', error);
    throw new Error('Error al actualizar permisos. Intente cerrar sesión e iniciar sesión nuevamente.');
  }
}