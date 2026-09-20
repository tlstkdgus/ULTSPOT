import { TripPlanner } from "@/components/trip-planner";
import { connection } from "next/server";
import { messages } from "@/i18n/messages";
import { getLocale } from "@/i18n/server";
export async function generateMetadata() { return { title: messages[await getLocale()].meta.plan }; }
export default async function PlanPage() {
  await connection();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return <TripPlanner today={today} />;
}
