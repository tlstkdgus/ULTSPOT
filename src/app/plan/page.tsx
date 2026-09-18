import { TripPlanner } from "@/components/trip-planner";
import { connection } from "next/server";
export const metadata = { title: "Plan your day" };
export default async function PlanPage() {
  await connection();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return <TripPlanner today={today} />;
}
