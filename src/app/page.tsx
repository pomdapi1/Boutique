import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { homeFor } from "@/lib/session";

export default async function Home() {
  const user = await currentUser();
  redirect(user ? homeFor(user.role) : "/login");
}
