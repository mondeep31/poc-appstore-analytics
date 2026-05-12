"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearAuth, getUser } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  MessageSquare,
  LogOut,
  LayoutDashboard,
  Smartphone,
  Bug,
} from "lucide-react";

const APPSTORE_NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/reviews", label: "Reviews", icon: MessageSquare },
];

const PLAYSTORE_NAV = [
  { href: "/playstore", label: "Overview", icon: LayoutDashboard },
  { href: "/playstore/reviews", label: "Reviews", icon: MessageSquare },
  { href: "/playstore/crashes", label: "Crashes", icon: Bug },
];

function isNavActive(href: string, pathname: string | null): boolean {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  if (href === "/playstore") return pathname === "/playstore";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  item,
  pathname,
}: {
  item: { href: string; label: string; icon: typeof LayoutDashboard };
  pathname: string | null;
}) {
  const isActive = isNavActive(item.href, pathname);
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
        isActive
          ? "bg-primary/12 text-primary font-medium"
          : "text-sidebar-foreground/70 hover:bg-accent hover:text-sidebar-foreground",
      )}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      {item.label}
      {isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = getUser();

  function handleLogout() {
    clearAuth();
    router.push("/login");
  }

  return (
    <aside className="flex h-full w-56 flex-col border-r border-border bg-sidebar shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-border">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/30">
          <BarChart3 className="h-3.5 w-3.5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight truncate">App</p>
          <p className="text-[10px] text-muted-foreground leading-tight">App Analytics</p>
        </div>
      </div>

      {/* Platform badge */}
      <div className="px-3 py-2.5 border-b border-border">
        <div className="flex items-center gap-2 rounded-md bg-primary/8 px-2.5 py-1.5">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-primary shrink-0">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
          </svg>
          <span className="text-[11px] font-medium text-primary">App Store Connect</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 flex flex-col gap-0.5 overflow-y-auto">
        {APPSTORE_NAV.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}

        <div className="px-2.5 pt-4 pb-1">
          <div className="flex items-center gap-2 rounded-md bg-emerald-500/10 px-2 py-1.5 ring-1 ring-emerald-500/20">
            <Smartphone className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">Google Play</span>
          </div>
        </div>
        {PLAYSTORE_NAV.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}
      </nav>

      {/* User + logout */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground uppercase">
            {user?.username?.[0] ?? "A"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium truncate">{user?.username ?? "Admin"}</p>
            <p className="text-[10px] text-muted-foreground truncate">{user?.role}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
