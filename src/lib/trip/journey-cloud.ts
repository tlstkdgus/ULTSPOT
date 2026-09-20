import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { parseJourney, type Journey } from "./journey";

export const cloudEnabled = isSupabaseConfigured && process.env.NEXT_PUBLIC_ENABLE_CLOUD_TRIPS === "true";
export async function cloudJourney(action: "save" | "load" | "delete", snapshot?: Journey) {
  if (!cloudEnabled) throw new Error("Cloud storage is not enabled. You can save on this device or download your itinerary.");
  const checked = action === "save" ? parseJourney(snapshot) : null;
  if (action === "save" && !checked) throw new Error("Journey is invalid or too large.");
  const client = createClient();
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw new Error("Could not read your guest session. Your device copy is unchanged.");
  let user = sessionData.session?.user;
  if (!user && action === "save") {
    const { data, error } = await client.auth.signInAnonymously();
    if (error || !data.user) throw new Error("Guest storage is unavailable. Save on this device or download instead.");
    user = data.user;
  }
  if (!user) return null;
  if (action === "save") {

    const { error } = await client.from("guest_journeys").upsert({ owner_id: user.id, snapshot: checked }, { onConflict: "owner_id" });
    if (error) throw new Error("Cloud save failed. Your trip is still on screen; try saving on this device.");
    return checked!;
  }
  if (action === "delete") {
    const { error } = await client.from("guest_journeys").delete().eq("owner_id", user.id);
    if (error) throw new Error("Cloud deletion failed. Please try again.");
    return null;
  }
  const { data, error } = await client.from("guest_journeys").select("snapshot").eq("owner_id", user.id).maybeSingle();
  if (error) throw new Error("Cloud restore failed. Your current plan is unchanged.");
  if (!data) return null;
  const parsed = parseJourney(data.snapshot);
  if (!parsed) throw new Error("Saved trip is incompatible. Your current plan is unchanged.");
  return parsed;
}
