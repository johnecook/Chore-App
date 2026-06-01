import Link from "next/link";
import { AuthFrame } from "@/components/auth-frame";

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const params = await searchParams;

  return (
    <AuthFrame
      footer={
        <>
          Already verified?{" "}
          <Link className="font-semibold text-[var(--accent-strong)]" href="/sign-in">
            Sign in
          </Link>
        </>
      }
      intro="We sent a verification link to your email address."
      title="Check your email"
    >
      <div className="grid gap-4 rounded-2xl border border-[var(--line)] bg-[var(--surface-soft)] p-4 text-base text-[var(--muted)]">
        <p>
          Open the email from Rhythm and verify your address before signing in.
        </p>
        {params.email ? (
          <p className="break-anywhere font-semibold text-white">{params.email}</p>
        ) : null}
        <p>
          If you do not see it, check spam or junk mail. The link may take a minute to arrive.
        </p>
      </div>
    </AuthFrame>
  );
}
