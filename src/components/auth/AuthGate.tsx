import * as React from "react";
import { useMsal } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";
import { loginRequest } from "@/lib/auth/msal";
import { LoginPage } from "@/pages/LoginPage";

interface AuthGateProps {
  children: React.ReactNode;
}

/**
 * Show login UI when no signed-in account; otherwise render children.
 *
 * Auth is single-shot: `loginRequest` carries `extraScopesToConsent` for
 * the Copilot Studio scope, so the user sees ONE consent screen for both
 * Dataverse + Copilot Studio. The chat acquires its token silently via
 * `acquireTokenSilent` later — no second redirect needed.
 */
export function AuthGate({ children }: AuthGateProps) {
  const { instance, accounts, inProgress } = useMsal();

  const isAuthenticated = accounts.length > 0;
  const isLoading =
    inProgress !== InteractionStatus.None &&
    inProgress !== InteractionStatus.HandleRedirect;

  React.useEffect(() => {
    if (isAuthenticated && !instance.getActiveAccount()) {
      instance.setActiveAccount(accounts[0]);
    }
  }, [accounts, isAuthenticated, instance]);

  if (!isAuthenticated || isLoading) {
    return (
      <LoginPage
        onLogin={() => instance.loginRedirect(loginRequest)}
        isLoading={isLoading}
      />
    );
  }

  return <>{children}</>;
}
