"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Compass, FileText, GitCompareArrows, LogIn, LogOut, Menu, Moon, PlusCircle, Sun, UserPlus, X } from "lucide-react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const navItems = [
  { href: "/new", label: "Analyze Article", icon: PlusCircle },
  { href: "/articles", label: "My Articles", icon: FileText },
  { href: "/compare", label: "Compare", icon: GitCompareArrows },
  { href: "/explore", label: "Explore", icon: Compass },
];

function Brand() {
  return (
    <Link href="/new" className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
        AI
      </div>
      <span className="font-semibold">Article Analyzer</span>
    </Link>
  );
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useAuth({ redirect: false });
  const { theme, setTheme } = useTheme();

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <>
      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
              pathname === item.href
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="p-4 space-y-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-3"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="ml-3">Toggle theme</span>
        </Button>

        <Separator />

        {user ? (
          <div className="flex items-center gap-3 px-3 py-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 truncate">
              <p className="text-sm font-medium truncate">{user.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={logout} title="Log out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="space-y-1">
            <Link href="/login" onClick={onNavigate}>
              <Button variant="ghost" size="sm" className="w-full justify-start gap-3">
                <LogIn className="h-4 w-4" />
                Sign in
              </Button>
            </Link>
            <Link href="/register" onClick={onNavigate}>
              <Button variant="ghost" size="sm" className="w-full justify-start gap-3">
                <UserPlus className="h-4 w-4" />
                Create account
              </Button>
            </Link>
          </div>
        )}
      </div>
    </>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Prevent background scroll while the drawer is open.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b bg-card p-4 md:hidden">
        <Brand />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden h-screen w-64 flex-col border-r bg-card md:flex">
        <div className="flex items-center gap-2 p-6">
          <Brand />
        </div>
        <Separator />
        <SidebarBody />
      </aside>

      {/* Mobile drawer backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity md:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* Mobile drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 max-w-[80%] flex-col border-r bg-card transition-transform duration-300 ease-in-out md:hidden",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between p-4">
          <Brand />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <Separator />
        <SidebarBody onNavigate={() => setOpen(false)} />
      </aside>
    </>
  );
}
