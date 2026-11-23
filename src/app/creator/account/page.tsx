import { requireCreator } from "@/lib/auth";
import { AccountPage } from "@/components/account-page";

export default async function CreatorAccountPage() {
  const { user } = await requireCreator();
  return <AccountPage email={user.email} />;
}
