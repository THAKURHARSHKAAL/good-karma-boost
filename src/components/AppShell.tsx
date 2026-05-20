import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { BottomNav } from "@/components/BottomNav";
import { Sparkles, Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";

export function AppShell({ children, title = "Karma" }: { children: ReactNode; title?: string }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-xl border-b border-border">
        <div className="mx-auto max-w-md flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <span className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </span>
            <span className="font-bold tracking-tight text-lg">{title}</span>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-md flex-1 pb-24">{children}</main>
      <BottomNav />
      <Toaster position="top-center" />
    </div>
  );
}
