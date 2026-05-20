import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Loader2, MapPin, ImagePlus, X } from "lucide-react";

export const Route = createFileRoute("/add")({
  component: () => (
    <AppShell title="New Karma post">
      <AddPost />
    </AppShell>
  ),
});

const schema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(1000).optional(),
  post_type: z.enum(["help", "donation", "volunteer", "kindness", "other"]),
});

function AddPost() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [postType, setPostType] = useState<z.infer<typeof schema>["post_type"]>("kindness");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const detectLocation = () => {
    if (!navigator.geolocation) return toast.error("Geolocation not supported");
    navigator.geolocation.getCurrentPosition(
      (p) =>
        setCoords({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          name: `${p.coords.latitude.toFixed(3)}, ${p.coords.longitude.toFixed(3)}`,
        }),
      () => toast.error("Could not detect location"),
    );
  };

  const onFile = (f: File | null) => {
    setFile(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const submit = async () => {
    const parsed = schema.safeParse({ title, description: description || undefined, post_type: postType });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    if (!user) return;
    setBusy(true);
    try {
      let image_url: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("post-media").upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        image_url = supabase.storage.from("post-media").getPublicUrl(path).data.publicUrl;
      }
      const { error } = await supabase.from("posts").insert({
        user_id: user.id,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        post_type: parsed.data.post_type,
        image_url,
        location_lat: coords?.lat ?? null,
        location_lng: coords?.lng ?? null,
        location_name: coords?.name ?? null,
      });
      if (error) throw error;
      toast.success("Post shared!");
      navigate({ to: "/" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to post");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <label className="block">
        <input type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
        <div className="relative aspect-square bg-muted rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground cursor-pointer overflow-hidden">
          {preview ? (
            <>
              <img src={preview} alt="" className="absolute inset-0 w-full h-full object-cover" />
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  onFile(null);
                }}
                className="absolute top-2 right-2 bg-background/90 rounded-full p-1.5"
              >
                <X className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <ImagePlus className="h-8 w-8 mb-2" />
              <span className="text-sm">Add photo proof (optional)</span>
            </>
          )}
        </div>
      </label>

      <div className="space-y-1.5">
        <Label>Title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What did you do?" maxLength={120} />
      </div>

      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Tell the story…"
          rows={4}
          maxLength={1000}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Type</Label>
        <Select value={postType} onValueChange={(v) => setPostType(v as typeof postType)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="kindness">Kindness</SelectItem>
            <SelectItem value="help">Help</SelectItem>
            <SelectItem value="donation">Donation</SelectItem>
            <SelectItem value="volunteer">Volunteer</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button variant="outline" onClick={detectLocation} className="w-full">
        <MapPin className="h-4 w-4 mr-2" />
        {coords ? coords.name : "Tag your location"}
      </Button>

      <Button onClick={submit} disabled={busy} className="w-full h-11">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Share good deed"}
      </Button>
    </div>
  );
}
