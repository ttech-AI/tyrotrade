import { LogOut, Settings } from "lucide-react";
import { useMsal } from "@azure/msal-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useThemeAccent } from "./theme-accent";
import { isAuthConfigured } from "@/lib/auth/msal";
import { shouldUseMock } from "@/lib/dataverse";

interface ProfileMenuProps {
  /** When true, render the full row with name + email beside the avatar.
   *  When false, render only the avatar circle (sidebar collapsed). */
  expanded: boolean;
}

/** Mock-mode + missing-account fallback so the avatar always has SOME
 *  identity to render. Real auth fills these in from the MSAL account. */
const FALLBACK_NAME = "TYRO Kullanıcı";
const FALLBACK_EMAIL = "";

/** Two-letter initials from a "First Last" string. Falls back to the
 *  first two letters of the email local-part when the name is missing
 *  or single-token. */
function computeInitials(name: string, email: string): string {
  const trimmed = (name ?? "").trim();
  if (trimmed) {
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
    }
    if (parts.length === 1 && parts[0]!.length >= 2) {
      return parts[0]!.slice(0, 2).toUpperCase();
    }
  }
  const local = (email ?? "").split("@")[0] ?? "";
  if (local.length >= 2) return local.slice(0, 2).toUpperCase();
  return "TY";
}

export function ProfileMenu({ expanded }: ProfileMenuProps) {
  const accent = useThemeAccent();
  // useMsal is safe even when no MsalProvider is mounted in mock mode —
  // it returns an empty `accounts` array and a no-op instance. We still
  // gate the actual logout call behind `isAuthConfigured` so that mock
  // sessions don't try to redirect to an empty endpoint.
  const { instance, accounts } = useMsal();

  // Real account → use the AAD-resolved display name + UPN (email).
  // Mock / unauthenticated → fall back so the sidebar always renders
  // a valid name + email pair.
  const account = accounts[0] ?? instance.getActiveAccount() ?? null;
  const NAME = (account?.name ?? "").trim() || FALLBACK_NAME;
  const EMAIL = (account?.username ?? "").trim() || FALLBACK_EMAIL;
  const INITIALS = computeInitials(NAME, EMAIL);

  const handleLogout = () => {
    if (isAuthConfigured && !shouldUseMock()) {
      const account = instance.getActiveAccount() ?? instance.getAllAccounts()[0];
      void instance.logoutRedirect({
        account: account ?? undefined,
        // Land back on the login page after sign-out completes.
        postLogoutRedirectUri: window.location.origin + import.meta.env.BASE_URL,
      });
      return;
    }
    // Mock / dev mode: just bounce to /login (HashRouter).
    window.location.hash = "#/login";
  };

  const avatar = (
    <span
      className="size-9 rounded-full grid place-items-center text-white text-[11.5px] font-semibold shrink-0 shadow-sm"
      style={{
        background: accent.gradient,
        boxShadow: `0 0 0 1.5px ${accent.ring}, 0 1px 2px rgba(0,0,0,0.18)`,
      }}
      aria-hidden
    >
      {INITIALS}
    </span>
  );

  const trigger = (
    <button
      type="button"
      aria-label="Profil menüsünü aç"
      className={cn(
        // Profile row sits one notch taller than nav (h-12 vs h-10) so
        // identity reads as a distinct anchor, not "just another nav
        // entry". Avatar size-9 + 14px name + 11px email fits cleanly
        // inside 48px without crowding. Typography aligned to the new
        // 14px SaaS sidebar baseline.
        "group flex items-center rounded-xl transition-colors relative shrink-0 outline-none",
        "focus-visible:ring-2 focus-visible:ring-[var(--sb-active-ring)]",
        expanded
          ? "h-12 w-full px-2.5 gap-3 hover:bg-[var(--sb-hover-bg)]"
          : "h-11 w-11 justify-center px-0"
      )}
    >
      {avatar}
      {expanded && (
        <span className="min-w-0 flex-1 text-left">
          <span className="block text-[13.5px] font-semibold leading-tight truncate text-[var(--sb-text)]">
            {NAME}
          </span>
          <span className="block text-[11px] leading-tight truncate text-[var(--sb-text-faint)] mt-0.5">
            {EMAIL}
          </span>
        </span>
      )}
    </button>
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        {expanded ? (
          trigger
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>{trigger}</TooltipTrigger>
            <TooltipContent side="right">{NAME}</TooltipContent>
          </Tooltip>
        )}
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="end"
        sideOffset={12}
        className={cn(
          "w-72 p-0 overflow-hidden",
          "ring-1 ring-white/55",
          "shadow-[0_28px_70px_-14px_rgba(15,23,42,0.45)]"
        )}
      >
        <div className="relative px-4 py-3 border-b border-white/30 flex items-center gap-3">
          <span
            className="size-11 rounded-full grid place-items-center text-white text-sm font-semibold shrink-0 shadow-sm"
            style={{
              background: accent.gradient,
              boxShadow: `0 0 0 2px ${accent.ring}, 0 1px 2px rgba(0,0,0,0.08)`,
            }}
          >
            {INITIALS}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold truncate">{NAME}</div>
            <div className="text-[11px] text-muted-foreground truncate">
              {EMAIL}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              TYRO International Trade
            </div>
          </div>
        </div>
        <div className="p-1.5">
          <button
            type="button"
            className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-foreground/80 hover:text-foreground hover:bg-foreground/[0.05] transition-colors"
          >
            <Settings className="size-4" />
            Hesap Ayarları
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-rose-700 hover:bg-rose-500/10 transition-colors"
          >
            <LogOut className="size-4" />
            Çıkış Yap
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
