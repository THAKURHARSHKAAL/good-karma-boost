import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Plus, MapPin, Loader2, Check } from "lucide-react";
import { timeAgo } from "@/lib/karma";

export const Route = createFileRoute("/help")({
  component: () => (
    <AppShell title="Help requests">
      <HelpRequests />
    </AppShell>
  ),
});

type Req = {
  id: string;
  user_id: string;
  helper_id: string | null;
  title: string;
  description: string | null;
  location_name: string | null;
  status: string;
  requester_confirmed: boolean;
  helper_confirmed: boolean;
  created_at: string;
  profile: { username: string; display_name: string | null; avatar_url: string | null } | null;
};

const schema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(1000).optional(),
});

function HelpRequests() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Req[] | null>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("help_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(80);
    if (!data) return setRows([]);
    const ids = [...new Set(data.map((r) => r.user_id))];
    const { data: profs } = await supabase
      .from("profiles")
      .select("id,username,display_name,avatar_url")
      .in("id", ids);
    const m = new Map(profs?.map((p) => [p.id, p]) ?? []);
    setRows(data.map((r) => ({ ...r, profile: m.get(r.user_id) ?? null })) as Req[]);
  };

  useEffect(() => {
    load();
  }, []);

  const detect = () => {
    navigator.geolocation?.getCurrentPosition((p) =>
      setCoords({
        lat: p.coords.latitude,
        lng: p.coords.longitude,
        name: `${p.coords.latitude.toFixed(3)}, ${p.coords.longitude.toFixed(3)}`,
      }),
    );
  };

  const submit = async () => {
    if (!user) return;
    const parsed = schema.safeParse({ title, description: desc || undefined });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setBusy(true);
    const { error } = await supabase.from("help_requests").insert({
      user_id: user.id,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      location_lat: coords?.lat ?? null,
      location_lng: coords?.lng ?? null,
      location_name: coords?.name ?? null,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Help request posted");
      setTitle("");
      setDesc("");
      setOpen(false);
      load();
    }
  };

  const offer = async (r: Req) => {
    if (!user) return;
    const { error } = await supabase
      .from("help_requests")
      .update({ helper_id: user.id, status: "accepted" })
      .eq("id", r.id);
    if (error) toast.error(error.message);
    else {
      toast.success("You offered help");
      load();
    }
  };

  const confirm = async (r: Req) => {
    if (!user) return;
    const patch =
      user.id === r.user_id ? { requester_confirmed: true } : user.id === r.helper_id ? { helper_confirmed: true } : null;
    if (!patch) return;
    const { error } = await supabase.from("help_requests").update(patch).eq("id", r.id);
    if (error) toast.error(error.message);
    else load();
  };

  if (rows === null)
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );

  return (
    <div className="p-4 space-y-4">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="w-full h-11">
            <Plus className="h-4 w-4 mr-2" /> Ask for help
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Need a hand?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>What do you need?</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
            </div>
            <div className="space-y-1.5">
              <Label>Details</Label>
              <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} maxLength={1000} />
            </div>
            <Button variant="outline" onClick={detect} className="w-full">
              <MapPin className="h-4 w-4 mr-2" />
              {coords?.name || "Tag location"}
            </Button>
            <Button onClick={submit} disabled={busy} className="w-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post request"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {rows.length === 0 ? (
        <div className="text-center py-16 text-sm text-muted-foreground">No help requests yet.</div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const mine = r.user_id === user?.id;
            const iHelp = r.helper_id === user?.id;
            return (
              <li key={r.id} className="border border-border rounded-2xl p-4 bg-card">
                <div className="flex items-center gap-3 mb-2">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={r.profile?.avatar_url ?? undefined} />
                    <AvatarFallback>{(r.profile?.display_name || r.profile?.username || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{r.profile?.display_name || r.profile?.username}</div>
                    <div className="text-xs text-muted-foreground">{timeAgo(r.created_at)}{r.location_name ? ` · ${r.location_name}` : ""}</div>
                  </div>
                  <Badge variant={r.status === "completed" ? "default" : "secondary"} className="capitalize">
                    {r.status}
                  </Badge>
                </div>
                <h3 className="font-semibold">{r.title}</h3>
                {r.description && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{r.description}</p>}

                <div className="mt-3 flex gap-2">
                  {r.status === "open" && !mine && (
                    <Button size="sm" onClick={() => offer(r)}>I can help</Button>
                  )}
                  {r.status === "accepted" && (mine || iHelp) && (
                    <Button
                      size="sm"
                      variant={(mine && r.requester_confirmed) || (iHelp && r.helper_confirmed) ? "outline" : "default"}
                      disabled={(mine && r.requester_confirmed) || (iHelp && r.helper_confirmed)}
                      onClick={() => confirm(r)}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      {(mine && r.requester_confirmed) || (iHelp && r.helper_confirmed) ? "Confirmed" : "Confirm completed"}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
