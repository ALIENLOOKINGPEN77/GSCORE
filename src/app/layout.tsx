// /app/layout.tsx
// Wraps the whole app with AuthProvider so any page can read auth state.
// Keep your fonts and global styles as you already had.
import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "../components/auth-context";
import { ClientSuspenseWrapper } from "../components/ClientSuspenseWrapper";
import { InactivityDetector } from "../components/InactivityDetector";
import 'reactflow/dist/style.css';

export const metadata: Metadata = {
  title: "DEV - GS CORE",
  description: "Gs core es un sistema ERP diseÃ±ado para la facilidad de uso y cumplimiento de la ISO 9001 en los procesos de gs concretos S.A",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" translate="no">
      <body suppressHydrationWarning={true}>
        <AuthProvider>
          <ClientSuspenseWrapper>
            {children}
          </ClientSuspenseWrapper>
        </AuthProvider>
        <InactivityDetector />
      </body>
    </html>
  );
}