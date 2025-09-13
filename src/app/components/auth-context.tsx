// /app/components/auth-context.tsx
// Enhanced authentication context that includes role and permission management
// This replaces your existing auth-context.tsx with role-based access control

"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "../lib/firebase/client";
import { 
  extractUserPermissions, 
  getUserAccessibleModules,
  type UserPermissions 
} from "../lib/firebase/roles";

// Enhanced context type that includes role information
type AuthCtx = {
  user: User | null;
  loading: boolean;
  error: Error | null;
  // New role-based properties
  permissions: UserPermissions;
  isAdmin: boolean;
  accessibleModules: Set<string>;
  hasModuleAccess: (moduleCode: string, requiredLevel?: 'r' | 'rw' | 'admin') => boolean;
  refreshPermissions: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx>({
  user: null,
  loading: true,
  error: null,
  permissions: {},
  isAdmin: false,
  accessibleModules: new Set(),
  hasModuleAccess: () => false,
  refreshPermissions: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [permissions, setPermissions] = useState<UserPermissions>({});

  // Function to refresh user permissions from their ID token
  const refreshPermissions = async () => {
    if (!user) {
      setPermissions({});
      return;
    }

    try {
      console.log('[AuthContext] Refreshing user permissions...');
      
      // Get fresh ID token with custom claims
      const idTokenResult = await user.getIdTokenResult(true); // Force refresh
      const newPermissions = extractUserPermissions(idTokenResult);
      
      console.log('[AuthContext] Permissions updated:', {
        role: newPermissions.role,
        roleLabel: newPermissions.roleLabel,
        isAdmin: newPermissions.isAdmin,
        moduleCount: Object.keys(newPermissions.modules || {}).length
      });
      
      setPermissions(newPermissions);
    } catch (err) {
      console.error('[AuthContext] Error refreshing permissions:', err);
      setError(err as Error);
    }
  };

  // Subscribe to authentication state changes
  useEffect(() => {
    console.log("[AuthContext] Subscribing to onAuthStateChanged...");
    
    const unsubscribe = onAuthStateChanged(
      auth,
      async (newUser) => {
        console.log("[AuthContext] Auth state changed:", newUser ? `user:${newUser.uid}` : "no user");
        
        setUser(newUser);
        setLoading(false);

        // If user is authenticated, load their permissions
        if (newUser) {
          try {
            const idTokenResult = await newUser.getIdTokenResult();
            const userPermissions = extractUserPermissions(idTokenResult);
            setPermissions(userPermissions);
            
            console.log('[AuthContext] Initial permissions loaded:', {
              role: userPermissions.role,
              isAdmin: userPermissions.isAdmin,
              hasModules: Object.keys(userPermissions.modules || {}).length > 0
            });
          } catch (err) {
            console.error('[AuthContext] Error loading initial permissions:', err);
            setError(err as Error);
          }
        } else {
          // Clear permissions when user signs out
          setPermissions({});
        }
      },
      (err) => {
        console.log("[AuthContext] Auth error handled:", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => {
      console.log("[AuthContext] Unsubscribing from onAuthStateChanged");
      unsubscribe();
    };
  }, []);

  // Computed values based on user permissions
  const computedValues = useMemo(() => {
    // Check if user is admin
    const isAdmin = permissions.isAdmin === true;
    
    // Get accessible modules for this user
    const accessibleModules = getUserAccessibleModules(permissions);
    
    // Function to check module access with permission level
    const hasModuleAccess = (
      moduleCode: string, 
      requiredLevel: 'r' | 'rw' | 'admin' = 'r'
    ): boolean => {
      // Admin users have access to everything
      if (isAdmin) {
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
    };

    return {
      isAdmin,
      accessibleModules,
      hasModuleAccess
    };
  }, [permissions]);

  // Create the context value
  const contextValue = useMemo(() => ({
    user,
    loading,
    error,
    permissions,
    isAdmin: computedValues.isAdmin,
    accessibleModules: computedValues.accessibleModules,
    hasModuleAccess: computedValues.hasModuleAccess,
    refreshPermissions
  }), [user, loading, error, permissions, computedValues, refreshPermissions]);

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

// Helper hook for role-specific logic
export function useRoles() {
  const { permissions, isAdmin, hasModuleAccess, refreshPermissions } = useAuth();
  
  return {
    userRole: permissions.role,
    userRoleLabel: permissions.roleLabel,
    isAdmin,
    hasModuleAccess,
    refreshPermissions,
    // Helper to check if user has any of the specified roles
    hasAnyRole: (roles: string[]): boolean => {
      if (isAdmin) return true;
      return roles.includes(permissions.role || '');
    },
    // Helper to get user's permission level for a specific module
    getModulePermission: (moduleCode: string): 'r' | 'rw' | 'admin' | null => {
      if (isAdmin) return 'admin';
      const modules = permissions.modules || {};
      return modules[moduleCode] || null;
    }
  };
}