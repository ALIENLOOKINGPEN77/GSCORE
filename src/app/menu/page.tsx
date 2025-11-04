"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Search, XCircle } from "lucide-react";
import Protected from "../../components/protected";
import { useRouter, useSearchParams } from "next/navigation";
import { signOut } from "firebase/auth";
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

  // Dynamic module loader with better error handling
  const loadModule = useCallback(async (code: string): Promise<React.ComponentType<any> | null> => {
    if (!availableModuleFiles[code]) {
      console.log(`[Menu] No file found for module: ${code}`);
      return null;
    }

    try {
      setIsLoadingModule(true);
      console.log(`[Menu] Dynamically importing module: ${code}`);

      const moduleExport = await availableModuleFiles[code]();

      // Try to get the component in different ways
      let ModuleComponent = moduleExport.default || moduleExport;

      // If ModuleComponent is still an object, try to extract the component
      if (typeof ModuleComponent === 'object' && ModuleComponent !== null) {
        // Check if it has a default property
        if (ModuleComponent.default) {
          ModuleComponent = ModuleComponent.default;
        }
        // Check if it has the same name as the code
        else if (ModuleComponent[code]) {
          ModuleComponent = ModuleComponent[code];
        }
      }

      // Validate that we have a valid React component
      if (!isValidReactComponent(ModuleComponent)) {
        console.warn(`[Menu] Module ${code} does not export a valid React component:`, typeof ModuleComponent, ModuleComponent);
        return null;
      }

      console.log(`[Menu] Successfully loaded module: ${code}`);
      return ModuleComponent;
    } catch (error) {
      console.error(`[Menu] Failed to load module ${code}:`, error);
      return null;
    } finally {
      setIsLoadingModule(false);
    }
  }, [availableModuleFiles]);

  // React to ?m=CODE when the list has loaded
  useEffect(() => {
    const m = searchParams.get("m");
    if (!availableSet) return; // wait until list loads

    if (!m) {
      console.log("[Menu] No ?m param → background image");
      setActiveCode(null);
      setActiveModuleComponent(null);
      return;
    }

    const code = m.toUpperCase();
    console.log("[Menu] URL requested module:", code);

    // Load the module asynchronously
    (async () => {
      // Case (1): code not in Firestore list
      if (!availableSet.has(code)) {
        showToast(`Code "${code}" does not exist.`);
        setActiveCode(null);
        setActiveModuleComponent(null);
        return;
      }

      // Case (2): Check user access
      const hasAccess = await checkUserAccess(code);
      if (!hasAccess) {
        showToast("Access Denied");
        setActiveCode(null);
        setActiveModuleComponent(null);
        return;
      }


      if (!availableModuleFiles[code]) {
        showToast(`Module not developed yet: ${code}`);
        setActiveCode(null);
        setActiveModuleComponent(null);
        return;
      }

      // Case (4): exists and has file - try to load it
      console.log("[Menu] Loading module from URL:", code);
      const ModuleComponent = await loadModule(code);

      if (!ModuleComponent) {
        showToast(`Module not developed yet: ${code}`);
        setActiveCode(null);
        setActiveModuleComponent(null);
        return;
      }

      setActiveCode(code);
      setActiveModuleComponent(() => ModuleComponent);
    })();
  }, [searchParams, availableSet, availableModuleFiles, showToast, loadModule]);

  // Fake loading function
  const fakeLoad = useCallback(async () => {
    const duration = 1000 + Math.floor(Math.random() * 2000);
    console.log(`[Menu] Fake load start. Duration: ${duration}ms`);

    setIsFakeLoading(true);
    setLogoVisible(false);

    requestAnimationFrame(() => {
      setLogoVisible(true);
    });

    await new Promise((r) => setTimeout(r, duration));

    console.log("[Menu] Fake load fade-out");
    setLogoVisible(false);
    await new Promise((r) => setTimeout(r, 350));

    setIsFakeLoading(false);
    console.log("[Menu] Fake load end");
  }, []);

  // Handle search submit with dynamic module loading and access control
  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      const code = query.trim().toUpperCase();
      console.log("[Menu] Submitting T-Code:", code);

      if (!code) {
        showToast('Enter a T-Code (try "ECOM01" or "TEST01").');
        return;
      }

      if (!availableSet) {
        showToast("Loading modules…");
        return;
      }

      // Case (1): Not in Firebase list
      if (!availableSet.has(code)) {
        showToast(`Code "${code}" does not exist.`);
        return;
      }

      // Case (2): Check user access FIRST
      const hasAccess = await checkUserAccess(code);
      if (!hasAccess) {
        showToast("Access Denied");
        return;
      }

      // Case (3): In list but no file available
      if (!availableModuleFiles[code]) {
        showToast(`Module not developed yet: ${code}`);
        return;
      }

      // Case (4): Try to load the module
      console.log("[Menu] Loading module:", code);

      // Clear current module for loading overlay
      setActiveCode(null);
      setActiveModuleComponent(null);

      // Update URL
      const url = new URL(window.location.href);
      url.searchParams.set("m", code);
      router.replace(url.pathname + "?" + url.searchParams.toString());

      // Show fake loading overlay
      await fakeLoad();

      // Load the module
      const ModuleComponent = await loadModule(code);

      if (!ModuleComponent) {
        showToast(`Module not developed yet: ${code}`);
        return;
      }

      // Set the active module
      setActiveCode(code);
      setActiveModuleComponent(() => ModuleComponent);
    },
    [query, availableSet, availableModuleFiles, router, showToast, fakeLoad, loadModule]
  );

  // Enter key = submit
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") void handleSubmit();
  };

  // Clear module
  const clearModule = () => {
    console.log("[Menu] Clearing active module");
    setActiveCode(null);
    setActiveModuleComponent(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("m");
    router.replace(url.pathname + (url.search ? "?" + url.searchParams.toString() : ""));
  };

  // Logout
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

          {/* Sidebar body (placeholder) */}
          <div className="flex-1 p-4 overflow-hidden">
            <div className="bg-gray-100 h-full rounded-md">
              {/* You could show discovered modules here */}
              <div className="p-2">

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
              Cerrar sesión
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