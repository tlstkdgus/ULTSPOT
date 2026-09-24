import { TripPlanner } from "@/components/trip-planner";
import { seoulDate } from "@/lib/seoul-date";
import { connection } from "next/server";
import { messages } from "@/i18n/messages";
import { getLocale } from "@/i18n/server";
export async function generateMetadata() { return { title: messages[await getLocale()].meta.plan }; }
export default async function PlanPage() {
  await connection();
  const today = seoulDate();
  return <TripPlanner today={today} />;
}
