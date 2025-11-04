// /app/lib/module-discovery.ts

// --- FIX START ---
// This block tells TypeScript about the Webpack-specific `require.context` function.
// It augments the global 'require' type to include the 'context' method,
// which prevents the "Property 'context' does not exist" error.
declare global {
  interface NodeRequire {
    context: (
      directory: string,
      useSubdirectories?: boolean,
      regExp?: RegExp
    ) => {
      (key: string): any;
      keys(): string[];
      resolve(key: string): string;
      id: string;
    };
  }
}
// --- FIX END ---


// Enhanced utilities for dynamic module discovery and management

export interface ModuleInfo {
  code: string;
  hasFile: boolean;
  inFirebase: boolean;
  status: 'available' | 'file-missing' | 'not-in-firebase' | 'unknown';
  lastLoaded?: Date;
  loadError?: string;
}

export interface ModuleRegistry {
  modules: Map<string, ModuleInfo>;
  loadModule: (code: string) => Promise<React.ComponentType<any> | null>;
  getModuleStatus: (code: string) => ModuleInfo['status'];
  getAvailableModules: () => ModuleInfo[];
  refreshRegistry: (firebaseModules: Set<string>) => void;
}

/**
 * Discovers all available module files in the components/modules directory
 * Uses webpack's require.context for automatic discovery
 */
export function discoverModuleFiles(): Record<string, () => Promise<any>> {
  const moduleFiles: Record<string, () => Promise<any>> = {};
  
  try {
    // Get all .tsx files in components/modules directory
    const context = require.context('../components/modules', false, /\.tsx$/);
    
    context.keys().forEach((filePath: string) => {
      // Extract clean module name: "./ECOM01.tsx" -> "ECOM01"
      const moduleName = filePath
        .replace(/^\.\//, '') // Remove leading "./"
        .replace(/\.tsx$/, '') // Remove .tsx extension
        .toUpperCase(); // Normalize to uppercase
      
      // Skip invalid module names or system files
      if (!isValidModuleName(moduleName)) {
        console.warn(`[ModuleDiscovery] Skipping invalid module name: ${moduleName}`);
        return;
      }
      
      // Create dynamic import function for this module
      moduleFiles[moduleName] = () => import(`../components/modules/${moduleName}.tsx`);
    });
    
    console.log('[ModuleDiscovery] Discovered modules:', {
      count: Object.keys(moduleFiles).length,
      modules: Object.keys(moduleFiles)
    });
    
  } catch (error) {
    console.error('[ModuleDiscovery] Failed to discover modules:', error);
  }
  
  return moduleFiles;
}

/**
 * Validates module name format (should be uppercase alphanumeric codes)
 */
function isValidModuleName(name: string): boolean {
  // Module names should be uppercase alphanumeric codes (e.g., ECOM01, TEST01)
  const moduleNamePattern = /^[A-Z][A-Z0-9]{2,9}$/;
  return moduleNamePattern.test(name) && !name.startsWith('INDEX');
}

/**
 * Creates a comprehensive module registry that manages all module states
 */
export function createModuleRegistry(
  firebaseModules: Set<string>, 
  moduleFiles: Record<string, () => Promise<any>>
): ModuleRegistry {
  
  const modules = new Map<string, ModuleInfo>();
  
  // Helper to update or create module info
  const updateModuleInfo = (code: string, updates: Partial<ModuleInfo>) => {
    const existing = modules.get(code) || {
      code,
      hasFile: false,
      inFirebase: false,
      status: 'unknown' as const
    };
    
    modules.set(code, { ...existing, ...updates });
  };
  
  // Process Firebase modules
  firebaseModules.forEach(code => {
    updateModuleInfo(code, {
      inFirebase: true,
      hasFile: code in moduleFiles,
    });
  });
  
  // Process discovered files
  Object.keys(moduleFiles).forEach(code => {
    updateModuleInfo(code, {
      hasFile: true,
      inFirebase: firebaseModules.has(code),
    });
  });
  
  // Calculate status for each module
  modules.forEach((info, code) => {
    let status: ModuleInfo['status'];
    
    if (info.inFirebase && info.hasFile) {
      status = 'available';
    } else if (info.inFirebase && !info.hasFile) {
      status = 'file-missing';
    } else if (!info.inFirebase && info.hasFile) {
      status = 'not-in-firebase';
    } else {
      status = 'unknown';
    }
    
    modules.set(code, { ...info, status });
  });
  
  console.log('[ModuleRegistry] Registry created:', {
    total: modules.size,
    available: Array.from(modules.values()).filter(m => m.status === 'available').length,
    fileMissing: Array.from(modules.values()).filter(m => m.status === 'file-missing').length,
    notInFirebase: Array.from(modules.values()).filter(m => m.status === 'not-in-firebase').length
  });
  
  // Module loading function with error handling
  const loadModule = async (code: string): Promise<React.ComponentType<any> | null> => {
    const upperCode = code.toUpperCase();
    const moduleInfo = modules.get(upperCode);
    
    if (!moduleInfo?.hasFile || !moduleFiles[upperCode]) {
      const error = `Module file not found: ${upperCode}`;
      console.error(`[ModuleRegistry] ${error}`);
      
      // Update module info with error
      if (moduleInfo) {
        modules.set(upperCode, { ...moduleInfo, loadError: error });
      }
      
      return null;
    }
    
    try {
      console.log(`[ModuleRegistry] Loading module: ${upperCode}`);
      
      const moduleExport = await moduleFiles[upperCode]();
      const ModuleComponent = moduleExport.default || moduleExport;
      
      if (!ModuleComponent || typeof ModuleComponent !== 'function') {
        throw new Error(`Invalid module export: expected React component`);
      }
      
      // Update success info
      modules.set(upperCode, { 
        ...moduleInfo, 
        lastLoaded: new Date(),
        loadError: undefined
      });
      
      console.log(`[ModuleRegistry] Successfully loaded: ${upperCode}`);
      return ModuleComponent;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[ModuleRegistry] Failed to load ${upperCode}:`, error);
      
      // Update module info with error
      modules.set(upperCode, { 
        ...moduleInfo, 
        loadError: errorMessage 
      });
      
      return null;
    }
  };
  
  // Get module status
  const getModuleStatus = (code: string): ModuleInfo['status'] => {
    return modules.get(code.toUpperCase())?.status || 'unknown';
  };
  
  // Get all available modules (sorted by status and name)
  const getAvailableModules = (): ModuleInfo[] => {
    return Array.from(modules.values()).sort((a, b) => {
      // Sort by status priority, then by name
      const statusOrder = { 'available': 0, 'file-missing': 1, 'not-in-firebase': 2, 'unknown': 3 };
      const statusDiff = statusOrder[a.status] - statusOrder[b.status];
      return statusDiff !== 0 ? statusDiff : a.code.localeCompare(b.code);
    });
  };
  
  // Refresh registry when Firebase modules change
  const refreshRegistry = (newFirebaseModules: Set<string>) => {
    console.log('[ModuleRegistry] Refreshing with new Firebase modules');
    
    // Update all modules' Firebase status
    modules.forEach((info, code) => {
      const inFirebase = newFirebaseModules.has(code);
      let status: ModuleInfo['status'];
      
      if (inFirebase && info.hasFile) {
        status = 'available';
      } else if (inFirebase && !info.hasFile) {
        status = 'file-missing';
      } else if (!inFirebase && info.hasFile) {
        status = 'not-in-firebase';
      } else {
        status = 'unknown';
      }
      
      modules.set(code, { ...info, inFirebase, status });
    });
    
    // Add any new Firebase modules not yet in registry
    newFirebaseModules.forEach(code => {
      if (!modules.has(code)) {
        modules.set(code, {
          code,
          hasFile: code in moduleFiles,
          inFirebase: true,
          status: (code in moduleFiles) ? 'available' : 'file-missing'
        });
      }
    });
  };
  
  return {
    modules,
    loadModule,
    getModuleStatus,
    getAvailableModules,
    refreshRegistry
  };
}

/**
 * Generates a module template for new modules
 */
export function generateModuleTemplate(code: string, description: string): string {
  const upperCode = code.toUpperCase();
  
  return `// /components/modules/${upperCode}.tsx
// ${upperCode} – ${description}

"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

// Define your form data type here
type ${upperCode}Data = {
  // Add your fields here, example:
  // fecha: string;
  // descripcion: string;
};

export default function ${upperCode}Module() {
  // Form state
  const initialForm: ${upperCode}Data = useMemo(() => ({
    // Initialize your fields here
  }), []);

  const [form, setForm] = useState<${upperCode}Data>(initialForm);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    console.log("[${upperCode}] Module mounted – ${description}");
  }, []);

  // Update form field helper
  const updateField = useCallback(
    (key: keyof ${upperCode}Data) => 
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = e.target.value;
      console.log(\`[${upperCode}] Field "\${String(key)}" changed:\`, value);
      setForm(prev => ({ ...prev, [key]: value }));
    },
    []
  );

  // Form submission handler
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("[${upperCode}] Submitting form:", form);
    
    setLoading(true);
    try {
      // Add your submission logic here
      await new Promise(resolve => setTimeout(resolve, 1000)); // Mock API call
      console.log("[${upperCode}] Form submitted successfully");
      // Show success message or redirect
    } catch (error) {
      console.error("[${upperCode}] Submission failed:", error);
      // Handle error
    } finally {
      setLoading(false);
    }
  }, [form]);

  // Reset form
  const handleReset = useCallback(() => {
    console.log("[${upperCode}] Resetting form");
    setForm(initialForm);
  }, [initialForm]);

  return (
    <section className="h-full w-full p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">
          ${upperCode} – ${description}
        </h1>
        <p className="text-gray-600 mt-1">
          Add your module description here.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="bg-white border rounded-lg p-6 shadow-sm max-w-6xl"
        noValidate
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Add your form fields here */}
          
        </div>

        {/* Form Actions */}
        <div className="mt-8 flex gap-3 pt-4 border-t">
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {loading ? "Guardando..." : "Guardar"}
          </button>
          
          <button
            type="button"
            onClick={handleReset}
            disabled={loading}
            className="bg-gray-100 text-gray-700 px-6 py-2 rounded-md hover:bg-gray-200 disabled:opacity-50 transition-colors font-medium"
          >
            Limpiar
          </button>
        </div>
      </form>
    </section>
  );
}`;
}

/**
 * Utility to log module registry statistics
 */
export function logModuleStats(registry: ModuleRegistry): void {
  const modules = registry.getAvailableModules();
  const stats = {
    total: modules.length,
    available: modules.filter(m => m.status === 'available').length,
    fileMissing: modules.filter(m => m.status === 'file-missing').length,
    notInFirebase: modules.filter(m => m.status === 'not-in-firebase').length,
    unknown: modules.filter(m => m.status === 'unknown').length
  };
  
  console.table(stats);
  console.log('[ModuleRegistry] Detailed module list:', modules);
}