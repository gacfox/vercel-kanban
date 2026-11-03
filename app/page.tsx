import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { countUsers } from "@/lib/db/queries/users";

export const instant = false;

export default async function HomePage() {
  const user = await getSessionUser();
  if (user) redirect("/projects");

  const initialized = (await countUsers()) > 0;
  redirect(initialized ? "/login" : "/setup");
}
