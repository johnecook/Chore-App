import Link from "next/link";
import { AuthFrame } from "@/components/auth-frame";
import { ResetPasswordForm } from "./reset-password-form";

export default function ResetPasswordPage() {
  return (
    <AuthFrame
      footer={
        <>
          Need a new link?{" "}
          <Link className="font-semibold text-[var(--accent-strong)]" href="/forgot-password">
            Request another reset
          </Link>
        </>
      }
      intro="Choose a new password for your Rhythm account."
      title="Set new password"
    >
      <ResetPasswordForm />
    </AuthFrame>
  );
}
