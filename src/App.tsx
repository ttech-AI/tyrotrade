import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { ProjectsPage } from "@/pages/ProjectsPage";
import { PLCostPage } from "@/pages/PLCostPage";
import { DataManagementPage } from "@/pages/DataManagementPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { HelpPage } from "@/pages/HelpPage";
import { AuthGate } from "@/components/auth/AuthGate";
import { shouldUseMock } from "@/lib/dataverse";
import { isAuthConfigured } from "@/lib/auth/msal";

export default function App() {
  // Auth required when:
  //   - VITE_USE_MOCK=false (we're hitting real Dataverse)
  //   - AND auth env vars are configured (otherwise we can't login anyway)
  // In dev with VITE_USE_MOCK=true, the gate is bypassed entirely.
  const requireAuth = !shouldUseMock() && isAuthConfigured;

  const shellTree = (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/:projectId" element={<ProjectsPage />} />
        <Route path="pl-cost" element={<PLCostPage />} />
        <Route path="data" element={<DataManagementPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="help" element={<HelpPage />} />
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
