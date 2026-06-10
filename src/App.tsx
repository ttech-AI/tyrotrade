import * as React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { AuthGate } from "@/components/auth/AuthGate";
import { shouldUseMock } from "@/lib/dataverse";
import { isAuthConfigured } from "@/lib/auth/msal";
import {
  DEFAULT_ALLOWED_ROUTE,
  useCanSeeRestricted,
} from "@/lib/auth/restrictedNav";

// Lazy-load every page so each route's JS chunk is fetched on first visit
// rather than bundled into the main entry. AppShell and AuthGate stay eager
// because they render on every authenticated route.
const LoginPage = React.lazy(() =>
  import("@/pages/LoginPage").then((m) => ({ default: m.LoginPage }))
);
const DashboardPage = React.lazy(() =>
  import("@/pages/DashboardPage").then((m) => ({ default: m.DashboardPage }))
);
const ProjectsPage = React.lazy(() =>
  import("@/pages/ProjectsPage").then((m) => ({ default: m.ProjectsPage }))
);
const PLCostPage = React.lazy(() =>
  import("@/pages/PLCostPage").then((m) => ({ default: m.PLCostPage }))
);
const DataManagementPage = React.lazy(() =>
  import("@/pages/DataManagementPage").then((m) => ({
    default: m.DataManagementPage,
  }))
);
const SettingsPage = React.lazy(() =>
  import("@/pages/SettingsPage").then((m) => ({ default: m.SettingsPage }))
);
const HelpPage = React.lazy(() =>
  import("@/pages/HelpPage").then((m) => ({ default: m.HelpPage }))
);
const VesselMapPage = React.lazy(() =>
  import("@/pages/VesselMapPage").then((m) => ({ default: m.VesselMapPage }))
);
const OverviewPage = React.lazy(() =>
  import("@/pages/OverviewPage").then((m) => ({ default: m.OverviewPage }))
);

// Wraps a lazy page in a Suspense boundary. Each route gets its own boundary
// so AppShell stays rendered while the page chunk is loading — only the
// main content area shows nothing during the brief fetch.
function S({ children }: { children: React.ReactNode }) {
  return <React.Suspense fallback={null}>{children}</React.Suspense>;
}

/**
 * Kısıtlı rota guard'ı (Anasayfa + Trade Cost). İzinli olmayan kullanıcı
 * bu rotalara — özellikle ilk açılışta varsayılan `/` rotasına — geldiğinde
 * Sefer Takibi'ne yönlendirilir. Mock/dev modunda + izinli maillerde sayfa
 * normal render olur. Sidebar linkleri zaten `RESTRICTED_NAV_ROUTES` ile
 * gizli; bu guard sayfanın kendisini de kapatır.
 */
function RestrictedRoute({ children }: { children: React.ReactNode }) {
  const canSeeRestricted = useCanSeeRestricted();
  if (!canSeeRestricted) {
    return <Navigate to={DEFAULT_ALLOWED_ROUTE} replace />;
  }
  return <>{children}</>;
}

export default function App() {
  // Auth required when:
  //   - VITE_USE_MOCK=false (we're hitting real Dataverse)
  //   - AND auth env vars are configured (otherwise we can't login anyway)
  // In dev with VITE_USE_MOCK=true, the gate is bypassed entirely.
  const requireAuth = !shouldUseMock() && isAuthConfigured;

  const shellTree = (
    <Routes>
      <Route path="/login" element={<S><LoginPage /></S>} />
      <Route element={<AppShell />}>
        <Route
          index
          element={
            <RestrictedRoute>
              <S><DashboardPage /></S>
            </RestrictedRoute>
          }
        />
        {/* Genel Bakış — herkese açık gemi projesi grup/segment özeti
            (RestrictedRoute YOK; Anasayfa'dan farklı olarak tüm
            kullanıcılar görür). */}
        <Route path="overview" element={<S><OverviewPage /></S>} />
        <Route path="projects" element={<S><ProjectsPage /></S>} />
        <Route path="projects/:projectId" element={<S><ProjectsPage /></S>} />
        <Route
          path="pl-cost"
          element={
            <RestrictedRoute>
              <S><PLCostPage /></S>
            </RestrictedRoute>
          }
        />
        <Route path="data" element={<S><DataManagementPage /></S>} />
        <Route path="vessel-map" element={<S><VesselMapPage /></S>} />
        <Route path="settings" element={<S><SettingsPage /></S>} />
        <Route path="help" element={<S><HelpPage /></S>} />
      </Route>
      <Route path="*" element={<Navigate to="/projects" replace />} />
    </Routes>
  );

  return (
    <>
      {requireAuth ? <AuthGate>{shellTree}</AuthGate> : shellTree}
      {/* Global toast viewport. richColors gives us proper success/error
          tinting; closeButton shows an X so users can dismiss long-lived
          toasts manually. Top-right placement matches the user's request. */}
      <Toaster
        position="top-right"
        richColors
        closeButton
        expand
        offset={16}
        toastOptions={{
          className:
            "!rounded-2xl !shadow-[0_18px_40px_-12px_rgba(15,23,42,0.32)]",
        }}
      />
    </>
  );
}
