"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Search, XCircle, ChevronRight, ChevronDown } from "lucide-react";
import Protected from "../../components/protected";
import { useRouter, useSearchParams } from "next/navigation";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { auth } from "../../lib/firebase/client";
import { fetchAvailableModules } from "../../lib/firebase/modules";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase/client";

// Dynamic module discovery using webpack's require.context
function getAvailableModuleFiles(): Record<string, () => Promise<any>> {
  const moduleFiles: Record<string, () => Promise<any>> = {};

  try {
    // Use require.context to get all .tsx files in components/modules
    const context = require.context('../../components/modules', false, /\.tsx$/);

    context.keys().forEach((filePath: string) => {
      // Extract filename without extension (e.g., "./ECOM01.tsx" -> "ECOM01")
      const moduleName = filePath.replace('./', '').replace('.tsx', '').toUpperCase();

      // Create dynamic import function
      moduleFiles[moduleName] = () => import(`../../components/modules/${moduleName}`);
    });

    console.log('[Menu] Discovered module files:', Object.keys(moduleFiles));
  } catch (error) {
    console.warn('[Menu] Could not discover modules dynamically:', error);
  }

  return moduleFiles;
}

// Function to check user access to a specific module
const checkUserAccess = async (moduleCode: string): Promise<boolean> => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.email) {
      console.log("[Menu] No authenticated user found");
      return false;
    }

    console.log("[Menu] Checking access for user:", currentUser.email, "module:", moduleCode);

    // Get the users_parameters document
    const userParamsRef = doc(db, "defaults", "users_parameters");
    const userParamsSnap = await getDoc(userParamsRef);

    if (!userParamsSnap.exists()) {
      console.log("[Menu] users_parameters document not found");
      return false;
    }

    const userParamsData = userParamsSnap.data();
    const userEmail = currentUser.email;

    // Check if user exists in the parameters
    if (!userParamsData[userEmail]) {
      console.log("[Menu] User not found in parameters:", userEmail);
      return false;
    }

    const userData = userParamsData[userEmail];
    const moduleAccess = userData.module_access;

    if (!Array.isArray(moduleAccess)) {
      console.log("[Menu] module_access is not an array for user:", userEmail);
      return false;
    }

    const hasAccess = moduleAccess.includes(moduleCode);
    console.log("[Menu] Access check result:", hasAccess, "Available modules:", moduleAccess);

    return hasAccess;
  } catch (error) {
    console.error("[Menu] Error checking user access:", error);
    return false;
  }
};

// Background images array
const BACKGROUND_IMAGES = [
  "/erp-background.png",
  "/backgrounds/erp-bg-1.jpg",
  "/backgrounds/erp-bg-2.jpg",
  "/backgrounds/erp-bg-3.jpg",
  "/backgrounds/erp-bg-4.jpg",
  "/backgrounds/erp-bg-5.jpg",
];

const getRandomBackgroundImage = (): string => {
  const randomIndex = Math.floor(Math.random() * BACKGROUND_IMAGES.length);
  return BACKGROUND_IMAGES[randomIndex];
};

// Helper function to validate if something is a valid React component
const isValidReactComponent = (component: any): component is React.ComponentType<any> => {
  return (
    typeof component === 'function' ||
    (typeof component === 'object' && component !== null && typeof component.render === 'function')
  );
};

export default function MenuPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Search input
  const [query, setQuery] = useState("");

  // Available modules from Firestore
  const [availableSet, setAvailableSet] = useState<Set<string> | null>(null);

  // Currently active module code and component
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [ActiveModuleComponent, setActiveModuleComponent] = useState<React.ComponentType<any> | null>(null);

  // Loading state for dynamic imports
  const [isLoadingModule, setIsLoadingModule] = useState(false);

  // Random background image state
  const [backgroundImage, setBackgroundImage] = useState<string>("");

  // Toast message
  const [toast, setToast] = useState<string | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fake loading overlay state
  const [isFakeLoading, setIsFakeLoading] = useState(false);
  const [logoVisible, setLogoVisible] = useState(false);

  // Get available module files (this runs once at component mount)
  const availableModuleFiles = useMemo(() => getAvailableModuleFiles(), []);

  // Module navigation suits state
  const [moduleSuits, setModuleSuits] = useState<Record<string, string[]>>({});
  const [expandedSuits, setExpandedSuits] = useState<Set<string>>(new Set());
  const [userModuleAccess, setUserModuleAccess] = useState<string[]>([]);
  const [isLoadingSuits, setIsLoadingSuits] = useState(true);
  
  // NEW: Track if auth is ready
  const [authReady, setAuthReady] = useState(false);

  // Set random background image on mount
  useEffect(() => {
    const randomBg = getRandomBackgroundImage();
    console.log("[Menu] Selected random background:", randomBg);
    setBackgroundImage(randomBg);
  }, []);

  // Helper: show toast with auto-hide
  const showToast = useCallback((message: string) => {
    console.log("[Menu] Toast:", message);
    setToast(message);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  // Add this useEffect right after the background image useEffect
  useEffect(() => {
    const m = searchParams.get("m");
    if (m) {
      console.log("[Menu] Page reload detected with module parameter, redirecting to clean URL");
      // Clear the URL parameter and redirect
      router.replace("/menu");
    }
  }, []); // Empty dependency array ensures this only runs once on mount

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  // NEW: Wait for auth to be ready
  useEffect(() => {
    console.log("[Menu] Setting up auth state listener");
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log("[Menu] Auth state changed:", user ? user.email : "No user");
      setAuthReady(true);
    });

    return () => {
      console.log("[Menu] Cleaning up auth state listener");
      unsubscribe();
    };
  }, []);

  // Load available modules from Firestore on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const s = await fetchAvailableModules();
        if (mounted) setAvailableSet(s);
      } catch (err) {
        console.warn("[Menu] fetchAvailableModules failed:", err);
        showToast("Could not load available modules. Try again later.");
        if (mounted) setAvailableSet(new Set());
      }
    })();
    return () => {
      mounted = false;
    };
  }, [showToast]);

  // Load module navigation data from Firestore
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const modulesDocRef = doc(db, "defaults", "modules");
        const modulesSnap = await getDoc(modulesDocRef);

        if (modulesSnap.exists() && mounted) {
          const data = modulesSnap.data();
          if (data.module_nav) {
            console.log("[Menu] Loaded module_nav:", data.module_nav);
            console.log("[Menu] Module_nav suits:", Object.keys(data.module_nav));
            setModuleSuits(data.module_nav);
          } else {
            console.warn("[Menu] module_nav field not found in modules document");
          }
        } else {
          console.warn("[Menu] modules document does not exist");
        }
      } catch (err) {
        console.error("[Menu] Failed to load module navigation:", err);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // FIXED: Load user's module access - now waits for auth to be ready
  useEffect(() => {
    // Don't run until auth is ready
    if (!authReady) {
      console.log("[Menu] Waiting for auth to be ready...");
      return;
    }

    let mounted = true;

    (async () => {
      try {
        const currentUser = auth.currentUser;
        console.log("[Menu] Loading user module access, current user:", currentUser?.email);

        if (!currentUser || !currentUser.email) {
          console.log("[Menu] No authenticated user found for module access");
          if (mounted) {
            setIsLoadingSuits(false);
          }
          return;
        }

        const userParamsRef = doc(db, "defaults", "users_parameters");
        const userParamsSnap = await getDoc(userParamsRef);

        if (!userParamsSnap.exists()) {
          console.warn("[Menu] users_parameters document does not exist");
          if (mounted) {
            setIsLoadingSuits(false);
          }
          return;
        }

        if (mounted) {
          const userParamsData = userParamsSnap.data();
          console.log("[Menu] User params data keys:", Object.keys(userParamsData));

          const userData = userParamsData[currentUser.email];

          if (!userData) {
            console.warn("[Menu] No data found for user:", currentUser.email);
            setIsLoadingSuits(false);
            return;
          }

          if (Array.isArray(userData.module_access)) {
            console.log("[Menu] User module access loaded:", userData.module_access);
            setUserModuleAccess(userData.module_access);
          } else {
            console.warn("[Menu] module_access is not an array:", userData.module_access);
          }
          setIsLoadingSuits(false);
        }
      } catch (err: any) {
        console.error("[Menu] Failed to load user module access:", err);
        console.error("[Menu] Error details:", {
          code: err.code,
          message: err.message
        });
        if (mounted) {
          setIsLoadingSuits(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [authReady]); // NOW depends on authReady instead of empty array

  // Dynamic module loader with better error handling
  const loadModule = useCallback(async (code: string): Promise<React.ComponentType<any> | null> => {
    if (!availableModuleFiles[code]) {
      console.log(`[Menu] No file found for module: ${code}`);
      return null;
    }

    try {
      console.log(`[Menu] Loading module file: ${code}`);
      const imported = await availableModuleFiles[code]();

      console.log(`[Menu] Module ${code} imported:`, imported);

      // Try to find the actual component in different export patterns
      let ComponentToUse: any = null;

      // Check for default export
      if (imported.default) {
        ComponentToUse = imported.default;
      }
      // Check for named export matching the module code
      else if (imported[code]) {
        ComponentToUse = imported[code];
      }
      // Check for any other exported component
      else {
        const exportKeys = Object.keys(imported);
        console.log(`[Menu] Available exports for ${code}:`, exportKeys);
        if (exportKeys.length > 0) {
          ComponentToUse = imported[exportKeys[0]];
        }
      }

      if (!ComponentToUse) {
        console.error(`[Menu] No valid component found in ${code}`);
        return null;
      }

      // Validate the component
      if (isValidReactComponent(ComponentToUse)) {
        console.log(`[Menu] Successfully loaded ${code}`);
        return ComponentToUse;
      } else {
        console.error(`[Menu] ${code} is not a valid React component`);
        return null;
      }
    } catch (err) {
      console.error(`[Menu] Failed to load ${code}:`, err);
      return null;
    }
  }, [availableModuleFiles]);

  // Handle module click from navigation
  const handleModuleClick = useCallback(async (code: string) => {
    console.log(`[Menu] Module clicked: ${code}`);

    // Check if module is available
    if (!availableSet || !availableSet.has(code)) {
      console.log(`[Menu] Module ${code} not in available set`);
      showToast(`Módulo ${code} no está disponible en Firestore`);
      return;
    }

    // Check if user has access
    const hasAccess = await checkUserAccess(code);
    if (!hasAccess) {
      console.log(`[Menu] User does not have access to ${code}`);
      showToast(`No tienes acceso al módulo ${code}`);
      return;
    }

    // Show fake loading overlay with logo
    setIsFakeLoading(true);
    setLogoVisible(false);

    // Fade in the logo after a brief delay
    setTimeout(() => {
      setLogoVisible(true);
    }, 50);

    // Wait for minimum display time
    await new Promise(resolve => setTimeout(resolve, 1200));

    setIsLoadingModule(true);
    const Component = await loadModule(code);
    setIsLoadingModule(false);

    if (Component) {
      setActiveCode(code);
      setActiveModuleComponent(() => Component);
      console.log(`[Menu] Active module set to: ${code}`);
    } else {
      showToast(`No se pudo cargar el módulo ${code}`);
    }

    // Hide the fake loading overlay
    setIsFakeLoading(false);
    setLogoVisible(false);
  }, [availableSet, loadModule, showToast]);

  // Clear active module
  const clearModule = useCallback(() => {
    console.log("[Menu] Clearing active module");
    setActiveCode(null);
    setActiveModuleComponent(null);
  }, []);

  // Search form submit handler
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim().toUpperCase();
    if (!trimmed) return;

    console.log(`[Menu] Searching for module: ${trimmed}`);

    // Check availability first
    if (!availableSet || !availableSet.has(trimmed)) {
      console.log(`[Menu] Module ${trimmed} not found in available set`);
      showToast(`Módulo ${trimmed} no encontrado`);
      return;
    }

    // Check user access
    const hasAccess = await checkUserAccess(trimmed);
    if (!hasAccess) {
      console.log(`[Menu] User does not have access to ${trimmed}`);
      showToast(`No tienes acceso al módulo ${trimmed}`);
      return;
    }

    // Show fake loading overlay with logo
    setIsFakeLoading(true);
    setLogoVisible(false);

    // Fade in the logo after a brief delay
    setTimeout(() => {
      setLogoVisible(true);
    }, 50);

    // Wait for minimum display time
    await new Promise(resolve => setTimeout(resolve, 300));

    setIsLoadingModule(true);
    const Component = await loadModule(trimmed);
    setIsLoadingModule(false);

    if (Component) {
      setActiveCode(trimmed);
      setActiveModuleComponent(() => Component);
      setQuery("");
      console.log(`[Menu] Active module set via search: ${trimmed}`);
    } else {
      showToast(`No se pudo cargar el módulo ${trimmed}`);
    }

    // Hide the fake loading overlay
    setIsFakeLoading(false);
    setLogoVisible(false);
  }, [availableSet, loadModule, query, showToast]);

  // Handle Escape key to clear search or close module
  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      if (query) {
        setQuery("");
      } else if (activeCode) {
        clearModule();
      }
    }
  }, [query, activeCode, clearModule]);

  // Compute accessible suits based on user's module access
  const accessibleSuits = useMemo(() => {
    console.log("[Menu] Computing accessible suits");
    console.log("[Menu] User module access:", userModuleAccess);
    console.log("[Menu] Module suits:", Object.keys(moduleSuits));

    if (userModuleAccess.length === 0 || Object.keys(moduleSuits).length === 0) {
      console.log("[Menu] No accessible suits - user access or suits empty");
      return [];
    }

    const userAccessSet = new Set(userModuleAccess);
    const result: [string, string[]][] = [];

    Object.entries(moduleSuits).forEach(([suitName, modules]) => {
      const accessibleModules = modules
        .filter(mod => userAccessSet.has(mod))
        .sort(); // Sort modules alphabetically
      if (accessibleModules.length > 0) {
        result.push([suitName, accessibleModules]);
        console.log(`[Menu] Suit ${suitName} has ${accessibleModules.length} accessible modules:`, accessibleModules);
      }
    });

    console.log("[Menu] Total accessible suits:", result.length);
    return result.sort((a, b) => a[0].localeCompare(b[0])); // Sort suits alphabetically
  }, [userModuleAccess, moduleSuits]);

  // Toggle suit expansion
  const toggleSuit = useCallback((suitName: string) => {
    setExpandedSuits(prev => {
      const newSet = new Set(prev);
      if (newSet.has(suitName)) {
        newSet.delete(suitName);
      } else {
        newSet.add(suitName);
      }
      return newSet;
    });
  }, []);

  // Logout handler
  const handleLogout = async () => {
    console.log("[Menu] Signing out...");
    try {
      await signOut(auth);
      console.log("[Menu] Signed out successfully");
    } catch {
      console.log("[Menu] Sign out failed (handled silently).");
    }
  };

  return (
    <Protected>
      <div className="flex h-screen bg-gray-50 text-gray-800 overflow-hidden">
        {/* Sidebar - Fixed position */}
        <aside className="w-72 h-full bg-white flex flex-col border-r border-gray-200 shadow-sm shrink-0">
          {/* Logo */}
          <div className="p-6 border-b border-gray-200 shrink-0">
            <Image
              src="/logo.png"
              alt="ERP System Logo"
              width={180}
              height={60}
              priority
              style={{ objectFit: "contain", width: "auto", height: "auto" }}
            />
          </div>

          {/* Search Bar */}
          <div className="p-4 shrink-0">
            <form className="relative" onSubmit={handleSubmit}>
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                size={20}
                aria-hidden
              />
              <input
                type="text"
                placeholder='Búsqueda de Módulos'
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                aria-label="T-Code search"
                disabled={isLoadingModule}
              />
            </form>
            <p className="mt-2 text-xs text-gray-500">
              Pulse Enter para abrir el módulo.
            </p>
          </div>


          {/* Module Navigation */}
          <div className="flex-1 p-4 overflow-hidden flex flex-col">
            <div className="bg-gray-100 h-full rounded-md flex flex-col overflow-hidden">
             
              <div className="flex-1 overflow-y-auto p-2">
                {isLoadingSuits ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                      <p className="text-xs text-gray-500">Cargando módulos...</p>
                    </div>
                  </div>
                ) : accessibleSuits.length === 0 ? (
                  <p className="text-xs text-gray-500 p-2">No hay módulos disponibles</p>
                ) : (
                  <div className="space-y-1">
                    {accessibleSuits.map(([suitName, modules]) => (
                      <div key={suitName} className="border-b border-gray-200 pb-1">
                        {/* Suit Header - Clickable to expand/collapse */}
                        <button
                          onClick={() => toggleSuit(suitName)}
                          disabled={isLoadingModule || isFakeLoading}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 text-left rounded hover:bg-gray-200 transition-colors ${isLoadingModule || isFakeLoading ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                        >
                          {expandedSuits.has(suitName) ? (
                            <ChevronDown size={16} className="text-gray-600 shrink-0" />
                          ) : (
                            <ChevronRight size={16} className="text-gray-600 shrink-0" />
                          )}
                          <span className="text-sm font-medium text-gray-700 truncate">
                            {suitName}
                          </span>
                        </button>

                        {/* Module List - Shown when expanded */}
                        {expandedSuits.has(suitName) && (
                          <div className="mt-1 ml-6 space-y-0.5">
                            {modules.map((moduleCode) => (
                              <button
                                key={moduleCode}
                                onClick={() => handleModuleClick(moduleCode)}
                                disabled={isLoadingModule || isFakeLoading}
                                className={`w-full text-left px-2 py-1 text-sm rounded hover:bg-blue-50 hover:text-blue-600 transition-colors ${activeCode === moduleCode
                                    ? 'bg-blue-100 text-blue-700 font-medium'
                                    : 'text-gray-600'
                                  } ${isLoadingModule || isFakeLoading ? 'opacity-50 cursor-not-allowed' : ''
                                  }`}
                              >
                                {moduleCode}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer + Logout */}
          <div className="p-4 text-center text-xs text-gray-400 border-t border-gray-200 shrink-0">
            <p>&copy; {new Date().getFullYear()} GS CONCRETOS S.A</p>
            <button
              onClick={handleLogout}
              className="mt-3 text-gray-700 border px-3 py-1 rounded hover:bg-gray-50"
            >
              Cerrar Sesión
            </button>
          </div>
        </aside>

        {/* Main Content Area - Now uses flex-1 and proper overflow handling */}
        <main className="flex-1 flex flex-col min-w-0 relative">
          {/* Loading overlay - Positioned absolute to cover entire main area */}
          {(isFakeLoading || isLoadingModule) && (
            <div
              className="absolute inset-0 flex items-center justify-center bg-white z-50"
              aria-live="polite"
              role="status"
            >
              <Image
                src="/logoSolo.png"
                alt="Loading"
                width={220}
                height={80}
                className={`transition-opacity duration-300 ${(logoVisible || isLoadingModule) ? "opacity-100" : "opacity-0"
                  }`}
                priority
                style={{ objectFit: "contain", width: "auto", height: "auto" }}
              />
            </div>
          )}

          {/* Content - Either module or background */}
          {ActiveModuleComponent ? (
            <div className="flex-1 flex flex-col bg-white min-h-0">
              {/* Module header - Always visible at top */}
              <header className="bg-gray-50 border-b px-4 py-2 flex items-center justify-between shrink-0">
                <span className="text-sm text-gray-600">
                  Modulo Activo: <strong>{activeCode}</strong>
                </span>
                <button
                  onClick={clearModule}
                  className="text-gray-700 border px-3 py-1 rounded hover:bg-gray-100"
                >
                  Cerrar
                </button>
              </header>

              {/* Module content - This is the ONLY scrollable area */}
              <div className="flex-1 overflow-auto">
                {React.isValidElement(ActiveModuleComponent) ? (
                  ActiveModuleComponent
                ) : (
                  <ActiveModuleComponent />
                )}
              </div>
            </div>
          ) : (
            <div
              className="flex-1 bg-cover bg-center bg-no-repeat brightness-100"
              style={{ backgroundImage: `url('${backgroundImage}')` }}
            />
          )}
        </main>

        {/* Bottom Toast */}
        {toast && (
          <div
            role="alert"
            aria-live="polite"
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[min(95vw,420px)] shadow-lg border border-gray-200 bg-white px-4 py-3 rounded-md text-sm flex items-center gap-2"
          >
            <XCircle className="text-red-500 shrink-0" size={18} aria-hidden />
            <span className="text-gray-800">{toast}</span>
            <button
              onClick={() => setToast(null)}
              className="ml-auto text-gray-500 hover:text-gray-700"
              aria-label="Dismiss message"
            >
              Cerrar
            </button>
          </div>
        )}
      </div>
    </Protected>
  );
}