import { requireAdmin } from "@/lib/auth";
import { AccountPage } from "@/components/account-page";

export default async function AdminAccountPage() {
  const user = await requireAdmin();
  return <AccountPage email={user.email} />;
}
