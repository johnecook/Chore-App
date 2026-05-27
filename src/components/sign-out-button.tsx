import { signOutAction } from "@/app/auth/actions";

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <button className="rounded-lg border border-[var(--line)] bg-white px-4 py-2 text-base font-semibold">
        Sign out
      </button>
    </form>
  );
}
