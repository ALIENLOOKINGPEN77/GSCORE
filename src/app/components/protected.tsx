// /app/components/protected.tsx
// Enhanced protected component that handles both authentication and role-based access control
// This replaces your existing protected.tsx with additional role checking capabilities

"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "./auth-context";
import { usePathname, useRouter } from "next/navigation";
import { Shield, AlertCircle, RefreshCw } from "lucide-react";

// Props for the enhanced Protected component
interface ProtectedProps {
  children: React.ReactNode;
  // Optional role requirements
  requireAdmin?: boolean;
  requireAnyRole?: string[]; // User must have one of these roles
  requireAllRoles?: string[]; // User must have all of these roles
  requireModule?: string; // User must have access to this specific module
  requireModuleLevel?: 'r' | 'rw' | 'admin'; // Required permission level for the module
  // Custom access check function
  customAccessCheck?: (permissions: any) => boolean;
  // Fallback redirect path for insufficient permissions
  insufficientPermissionsPath?: string;
}

export default function Protected({ 
  children,
  requireAdmin = false,
  requireAnyRole = [],
  requireAllRoles = [],
  requireModule,
  requireModuleLevel = 'r',
  customAccessCheck,
  insufficientPermissionsPath = '/menu'
}: ProtectedProps) {
  const { user, loading, permissions, isAdmin, hasModuleAccess, refreshPermissions } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [permissionCheckComplete, setPermissionCheckComplete] = useState(false);
  const [hasRequiredPermissions, setHasRequiredPermissions] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  // Function to check if user meets all permission requirements
  const checkPermissions = React.useCallback(() => {
    console.log("[Protected] Checking permissions for path:", pathname);
    
    // Reset states
    setPermissionError(null);
    setPermissionCheckComplete(false);
    
    // If no user is authenticated, we'll handle this in the main effect
    if (!user) {
      setPermissionCheckComplete(true);
      setHasRequiredPermissions(false);
      return;
    }

    // If permissions haven't loaded yet, wait
    if (!permissions || Object.keys(permissions).length === 0) {
      console.log("[Protected] Waiting for permissions to load...");
      setPermissionCheckComplete(false);
      return;
    }

    console.log("[Protected] Evaluating permission requirements:", {
      requireAdmin,
      requireAnyRole,
      requireAllRoles,
      requireModule,
      requireModuleLevel,
      userIsAdmin: isAdmin,
      userRole: permissions.role,
      userModules: Object.keys(permissions.modules || {})
    });

    // Check admin requirement
    if (requireAdmin && !isAdmin) {
      console.log("[Protected] Admin access required but user is not admin");
      setPermissionError("Se requieren permisos de administrador para acceder a esta página");
      setHasRequiredPermissions(false);
      setPermissionCheckComplete(true);
      return;
    }

    // Check if user needs any of the specified roles
    if (requireAnyRole.length > 0) {
      const userRole = permissions.role;
      const hasAnyRequiredRole = requireAnyRole.includes(userRole || '') || isAdmin;
      
      if (!hasAnyRequiredRole) {
        console.log("[Protected] User does not have any of the required roles:", requireAnyRole);
        setPermissionError(`Se requiere uno de estos roles: ${requireAnyRole.join(', ')}`);
        setHasRequiredPermissions(false);
        setPermissionCheckComplete(true);
        return;
      }
    }

    // Check if user has all specified roles (less common, but supported)
    if (requireAllRoles.length > 0) {
      const userRole = permissions.role;
      const hasAllRequiredRoles = requireAllRoles.every(role => role === userRole) || isAdmin;
      
      if (!hasAllRequiredRoles) {
        console.log("[Protected] User does not have all required roles:", requireAllRoles);
        setPermissionError(`Se requieren todos estos roles: ${requireAllRoles.join(', ')}`);
        setHasRequiredPermissions(false);
        setPermissionCheckComplete(true);
        return;
      }
    }

    // Check module access requirement
    if (requireModule) {
      const moduleAccess = hasModuleAccess(requireModule, requireModuleLevel);
      
      if (!moduleAccess) {
        console.log("[Protected] User does not have required module access:", {
          module: requireModule,
          requiredLevel: requireModuleLevel,
          userModules: permissions.modules
        });
        setPermissionError(`Se requiere acceso al módulo ${requireModule} con nivel ${requireModuleLevel}`);
        setHasRequiredPermissions(false);
        setPermissionCheckComplete(true);
        return;
      }
    }

    // Check custom access function
    if (customAccessCheck) {
      const customResult = customAccessCheck(permissions);
      if (!customResult) {
        console.log("[Protected] Custom access check failed");
        setPermissionError("No tiene los permisos necesarios para acceder a esta página");
        setHasRequiredPermissions(false);
        setPermissionCheckComplete(true);
        return;
      }
    }

    // If we get here, all permission checks passed
    console.log("[Protected] All permission checks passed");
    setHasRequiredPermissions(true);
    setPermissionCheckComplete(true);
  }, [
    user, 
    permissions, 
    isAdmin, 
    hasModuleAccess, 
    requireAdmin, 
    requireAnyRole, 
    requireAllRoles, 
    requireModule, 
    requireModuleLevel, 
    customAccessCheck, 
    pathname
  ]);

  // Main authentication and authorization effect
  useEffect(() => {
    console.log("[Protected] Auth state:", { 
      loading, 
      hasUser: !!user, 
      hasPermissions: !!(permissions && Object.keys(permissions).length > 0)
    });

    // Still loading authentication state
    if (loading) {
      return;
    }

    // User not authenticated - redirect to login
    if (!user) {
      const from = pathname ? `?from=${encodeURIComponent(pathname)}` : "";
      console.log("[Protected] No user → redirect to /login");
      router.replace(`/login${from}`);
      return;
    }

    // User authenticated - check permissions
    checkPermissions();
  }, [user, loading, permissions, pathname, router, checkPermissions]);

  // Handle permission refresh
  const handleRefreshPermissions = async () => {
    console.log("[Protected] Refreshing user permissions...");
    try {
      await refreshPermissions();
      // Recheck permissions after refresh
      setTimeout(() => {
        checkPermissions();
      }, 100);
    } catch (error) {
      console.error("[Protected] Error refreshing permissions:", error);
      setPermissionError("Error al actualizar permisos. Intente nuevamente.");
    }
  };

  // Handle navigation to insufficient permissions page
  const handleInsufficientPermissions = () => {
    console.log("[Protected] Redirecting due to insufficient permissions");
    router.replace(insufficientPermissionsPath);
  };

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <RefreshCw className="animate-spin mx-auto mb-4 text-blue-600" size={24} />
          <p className="text-gray-600">Verificando autenticación...</p>
        </div>
      </div>
    );
  }

  // Show loading state while checking permissions
  if (user && !permissionCheckComplete) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Shield className="animate-pulse mx-auto mb-4 text-blue-600" size={24} />
          <p className="text-gray-600">Verificando permisos...</p>
          <p className="text-sm text-gray-500 mt-2">
            Validando acceso para: {permissions?.roleLabel || 'usuario'}
          </p>
        </div>
      </div>
    );
  }

  // Show permission denied screen
  if (permissionCheckComplete && !hasRequiredPermissions && permissionError) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="mb-6">
              <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="text-red-600" size={32} />
              </div>
            </div>
            
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Acceso Restringido
            </h2>
            
            <p className="text-gray-600 mb-6">
              {permissionError}
            </p>
            
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-600">
                <strong>Su rol actual:</strong> {permissions?.roleLabel || 'No asignado'}
              </p>
              {permissions?.role && (
                <p className="text-sm text-gray-600 mt-1">
                  <strong>Módulos disponibles:</strong> {Object.keys(permissions.modules || {}).length}
                </p>
              )}
            </div>
            
            <div className="flex flex-col gap-3">
              <button
                onClick={handleRefreshPermissions}
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw size={16} />
                Actualizar Permisos
              </button>
              
              <button
                onClick={handleInsufficientPermissions}
                className="bg-gray-100 text-gray-700 px-6 py-2 rounded-md hover:bg-gray-200 transition-colors"
              >
                Volver al Menú Principal
              </button>
            </div>
            
            <p className="text-xs text-gray-500 mt-6">
              Si cree que esto es un error, contacte al administrador del sistema.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // All checks passed - render the protected content
  if (user && hasRequiredPermissions) {
    return <>{children}</>;
  }

  // Fallback loading state (shouldn't normally reach here)
  return (
    <div className="w-full h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <RefreshCw className="animate-spin mx-auto mb-4 text-blue-600" size={24} />
        <p className="text-gray-600">Cargando...</p>
      </div>
    </div>
  );
}

// Higher-order component for easier role-based protection
export function withRoleProtection<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  protectionConfig: Omit<ProtectedProps, 'children'>
) {
  const ProtectedComponent = (props: P) => {
    return (
      <Protected {...protectionConfig}>
        <WrappedComponent {...props} />
      </Protected>
    );
  };

  ProtectedComponent.displayName = `withRoleProtection(${WrappedComponent.displayName || WrappedComponent.name})`;
  return ProtectedComponent;
}

// Utility hook for checking permissions in components
export function usePermissionCheck() {
  const { isAdmin, hasModuleAccess, permissions } = useAuth();

  return {
    canAccessModule: (moduleCode: string, level: 'r' | 'rw' | 'admin' = 'r') => {
      return isAdmin || hasModuleAccess(moduleCode, level);
    },
    hasRole: (roleCode: string) => {
      return isAdmin || permissions.role === roleCode;
    },
    hasAnyRole: (roleCodes: string[]) => {
      return isAdmin || roleCodes.includes(permissions.role || '');
    },
    isAdmin,
    userRole: permissions.role,
    userRoleLabel: permissions.roleLabel
  };
}