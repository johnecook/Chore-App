import { signOutAction } from "@/app/auth/actions";
import { Button } from "@/components/ui";

export function SignOutButton({ variant = "button" }: { variant?: "button" | "menu-item" }) {
  return (
    <form action={signOutAction}>
      {variant === "menu-item" ? (
        // Menu actions should match navigation rows, not standalone CTA buttons.
        <button className="w-full rounded-2xl px-4 py-3 text-left text-base font-semibold text-[var(--muted)]">
          Sign out
        </button>
      ) : (
      <Button className="min-h-11 px-4 py-2 text-base" variant="secondary">
        Sign out
      </Button>
      )}
    </form>
  );
}
