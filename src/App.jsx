import { lazy, Suspense, useEffect, useState } from "react"
import { Routes, Route, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { onOpenChat } from "@/lib/chatBus"
import { useIsAuthenticated, useMsal } from "@azure/msal-react"
import { InteractionStatus } from "@azure/msal-browser"
import { isMsalConfigured, MOCK_LOGGED_IN_KEY } from "@/lib/msal"
import { Toaster } from "@/components/ui/sonner"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { SectionCards } from "@/components/dashboard/SectionCards"
import { DataTable } from "@/components/dashboard/DataTable"

// Code-split recharts out of the main bundle. recharts is ~500 KB minified
// and only used on /analytics — the dashboard/chat/settings routes don't
// need it. lazy() + Suspense lets the main chunk stay small, with a
// reserved-height skeleton placeholder so the layout doesn't jump when
// the chart chunk arrives.
const ChartAreaInteractive = lazy(() =>
  import("@/components/dashboard/ChartAreaInteractive").then((m) => ({
    default: m.ChartAreaInteractive,
  })),
)
import { HeroSection } from "@/components/dashboard/HeroSection"
import { AppLauncher } from "@/components/dashboard/AppLauncher"
import { ChatScreen } from "@/components/chat/ChatScreen"
import { SettingsPage } from "@/components/settings/SettingsPage"
import { HelpPage } from "@/components/help/HelpPage"
import { LoginPage } from "@/components/auth/LoginPage"

// MOCK_LOGGED_IN_KEY (from @/lib/msal) is the sessionStorage flag used only when MSAL
// isn't configured (no VITE_MSAL_CLIENT_ID), so login is required every browser session.
function readMockLoggedIn() {
  if (typeof window === "undefined") return false
  return window.sessionStorage.getItem(MOCK_LOGGED_IN_KEY) === "1"
}

const PATH_TO_ID = {
  "/dashboard": "dashboard",
  "/chat": "chat",
  "/analytics": "analytics",
  "/settings": "settings",
  "/help": "help",
}

const ID_TO_PATH = {
  dashboard: "/dashboard",
  chat: "/chat",
  analytics: "/analytics",
  settings: "/settings",
  help: "/help",
}

function AnalyticsContent() {
  return (
    <div className="@container/main flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="px-4 lg:px-6">
          <HeroSection />
        </div>
        <SectionCards />
        <div className="px-4 lg:px-6">
          <Suspense
            fallback={
              <div
                aria-hidden="true"
                className="h-[250px] w-full animate-pulse rounded-xl bg-muted/30"
              />
            }
          >
            <ChartAreaInteractive />
          </Suspense>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[720px] sm:min-w-0">
            <DataTable />
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Keeps ONE ChatScreen alive for the whole session instead of mounting it as
 * the /chat route element.
 *
 * An agent answer streams over an SSE connection owned by ChatScreen. As a
 * route element it was unmounted the moment the user navigated to the
 * dashboard — killing the reply they were waiting on and leaving a bubble
 * that says "yazıyor" forever when they came back. Since the whole point is
 * "ask, go do something else, get told when it's ready", the chat has to
 * outlive navigation.
 *
 * So it renders here, as a sibling of <Routes>, and only its VISIBILITY
 * changes with the route: `display: contents` while on /chat (transparent to
 * layout, so ChatScreen stays a direct flex child of <main> exactly as
 * before), `display: none` elsewhere. The /chat route element renders null.
 *
 * Two details that matter:
 *   • Lazy first mount — mounting at boot would open a Copilot conversation
 *     for every user who never opens the chat.
 *   • The `?reset=` / `?agent=` params are latched only while on /chat.
 *     Reading them live would remount the chat (new key) the instant the
 *     user navigated away and the query string disappeared — exactly the
 *     unmount this component exists to prevent.
 */
function PersistentChat({ isChat }) {
  const [params] = useSearchParams()
  // null when absent — the DISTINCTION matters, see below.
  const resetParam = params.get("reset")
  const agentParam = params.get("agent")

  // Latched during render (React's "adjust state when props change" pattern)
  // rather than in an effect: an effect would commit one frame with the old
  // key and then remount, and it trips the cascading-render lint rule.
  //
  // A new key is taken ONLY when a `reset` param is actually present. That is
  // what separates "start a new chat" (the sidebar's Yeni sohbet / an agent
  // card, both of which navigate with ?reset=<ts>) from "go back to the chat"
  // (the sidebar's Chat item, which navigates to a bare /chat). Keying off
  // the bare URL would wipe the running conversation on every return trip —
  // the exact opposite of what this component is for.
  const [latched, setLatched] = useState(() => ({
    mounted: isChat,
    key: resetParam ?? "0",
    agent: agentParam,
  }))
  const wantsNewChat =
    resetParam !== null && (resetParam !== latched.key || agentParam !== latched.agent)
  if (isChat && (!latched.mounted || wantsNewChat)) {
    setLatched({
      mounted: true,
      key: wantsNewChat ? resetParam : latched.key,
      agent: wantsNewChat ? agentParam : latched.agent,
    })
  }

  if (!latched.mounted) return null

  return (
    <div className={isChat ? "contents" : "hidden"}>
      <ChatScreen key={latched.key} initialAgent={latched.agent} onScreen={isChat} />
    </div>
  )
}

function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const { instance, inProgress } = useMsal()
  const isMsalAuthenticated = useIsAuthenticated()

  // While MSAL is starting up or processing a redirect callback, don't make
  // auth-gate decisions yet — useIsAuthenticated can briefly return false
  // before the active-account event propagates after handleRedirectPromise.
  const msalSettling = isMsalConfigured && inProgress !== InteractionStatus.None

  // Authoritative auth check: useIsAuthenticated for reactivity + direct
  // getActiveAccount() to cover the first render after redirect (the hook
  // sometimes lags by a tick on initial mount).
  const isAuthenticated = isMsalConfigured
    ? isMsalAuthenticated || !!instance.getActiveAccount()
    : readMockLoggedIn()

  const activeId = PATH_TO_ID[location.pathname] ?? "dashboard"
  const isChat = location.pathname === "/chat"

  // "Take me back to the conversation" — fired by an answer notification or
  // its in-app toast. No `reset` param: this must land on the RUNNING chat,
  // not start a new one.
  useEffect(() => {
    return onOpenChat(() => navigate("/chat"))
  }, [navigate])

  function handleActiveIdChange(id) {
    const path = ID_TO_PATH[id] ?? "/dashboard"
    navigate(path)
  }

  function handleNewChat() {
    navigate(`/chat?reset=${Date.now()}`)
  }

  function handleOpenChatWithAgent(agentId) {
    navigate(`/chat?agent=${encodeURIComponent(agentId)}&reset=${Date.now()}`)
  }

  // Authenticated user landing on /login (e.g. fresh AAD redirect back) →
  // skip the login page entirely.
  if (location.pathname === "/login" && isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  // Login is a standalone layout — no sidebar/header chrome
  if (location.pathname === "/login") {
    return (
      <>
        <LoginPage />
        <Toaster richColors position="bottom-center" />
      </>
    )
  }

  // MSAL still settling — render nothing rather than flashing the gate.
  if (msalSettling) {
    return null
  }

  // Auth gate — if not logged in, redirect to /login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return (
    <>
      <DashboardLayout
        activeId={activeId}
        onActiveIdChange={handleActiveIdChange}
        onNewChat={handleNewChat}
      >
        {/* Rendered outside <Routes> so navigating away hides it instead of
            unmounting it — see PersistentChat. */}
        <PersistentChat isChat={isChat} />
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route
            path="/dashboard"
            element={<AppLauncher onOpenChat={handleOpenChatWithAgent} onNewChat={handleNewChat} />}
          />
          {/* Element is null: PersistentChat above owns the chat UI. The route
              still has to exist so "/chat" doesn't fall through to the
              catch-all redirect. */}
          <Route path="/chat" element={null} />
          <Route path="/analytics" element={<AnalyticsContent />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </DashboardLayout>
      <Toaster richColors position="bottom-center" />
    </>
  )
}

export default App
