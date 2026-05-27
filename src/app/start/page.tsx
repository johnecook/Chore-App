import { redirect } from "next/navigation";
import { currentUserHasHousehold, requireCurrentProfile } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function StartPage() {
  const profile = await requireCurrentProfile();

  if (profile.appRole === "child") {
    redirect("/kid");
  }

  if (!(await currentUserHasHousehold())) {
    redirect("/onboarding/household");
  }

  redirect("/parent");
}
