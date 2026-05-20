import { Link, useLocation } from "@tanstack/react-router";
import { Home, PlusSquare, Trophy, HandHelping, User } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = { to: "/" | "/leaderboard" | "/add" | "/help" | "/profile"; icon: typeof Home; label: string; primary?: boolean };
const tabs: Tab[] = [
  { to: "/", icon: Home, label: "Feed" },
  { to: "/leaderboard", icon: Trophy, label: "Ranks" },
  { to: "/add", icon: PlusSquare, label: "Post", primary: true },
  { to: "/help", icon: HandHelping, label: "Help" },
  { to: "/profile", icon: User, label: "Me" },
];

export function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/85 backdrop-blur-xl">
      <div className="mx-auto max-w-md grid grid-cols-5 h-16 px-2">
        {tabs.map(({ to, icon: Icon, label, primary }) => {
          const active = pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span
                className={cn(
                  "flex items-center justify-center transition-all",
                  primary
                    ? "h-10 w-10 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 -mt-3"
                    : "h-6 w-6",
                  active && !primary && "scale-110",
                )}
              >
                <Icon className={primary ? "h-5 w-5" : "h-5 w-5"} />
              </span>
              {!primary && <span>{label}</span>}
            </Link>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
