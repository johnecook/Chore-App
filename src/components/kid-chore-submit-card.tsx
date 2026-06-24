import { submitChoreAction } from "@/app/kid/actions";
import { Button, TaskRow } from "@/components/rhythm-child-today-static";

type ChecklistItem = {
  id: string;
  label: string;
  required: boolean;
};

type KidChoreSubmitCardProps = {
  amount: string;
  approvalRequired: boolean;
  checklistItems: ChecklistItem[];
  due: string;
  householdName?: string;
  instanceId: string;
  isRejected: boolean;
  parentFeedback?: string | null;
  photoRequired: boolean;
  statusLabel: string;
  templateDescription?: string | null;
  title: string;
};

function CameraIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M5 8.5h3l1.3-2h5.4l1.3 2h3a2 2 0 0 1 2 2v6.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6.5a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path d="M12 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function NoteIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M6 4.5h12v15H6zM9 8h6M9 12h6M9 16h3"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path
        d="m5 12.5 4.5 4.5L19 7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
      />
    </svg>
  );
}

function DetailFields({
  approvalRequired,
  checklistItems,
  instanceId,
  isRejected,
  parentFeedback,
  photoRequired,
  templateDescription,
}: Pick<
  KidChoreSubmitCardProps,
  | "approvalRequired"
  | "checklistItems"
  | "instanceId"
  | "isRejected"
  | "parentFeedback"
  | "photoRequired"
  | "templateDescription"
>) {
  return (
    <form action={submitChoreAction} className="grid gap-3">
      <input name="instanceId" type="hidden" value={instanceId} />
      {templateDescription || parentFeedback ? (
        <div className="grid gap-2">
          {templateDescription ? (
            <p className="text-base text-[var(--muted)]">{templateDescription}</p>
          ) : null}
          {parentFeedback ? (
            <p className="rounded-2xl border border-[var(--line)] bg-[var(--surface-soft)] p-3 text-base">
              Parent note: {parentFeedback}
            </p>
          ) : null}
        </div>
      ) : null}
      {checklistItems.length ? (
        <fieldset className="grid gap-3">
          <legend className="text-base font-semibold">Checklist</legend>
          <div className="grid gap-2">
            {checklistItems.map((item) => (
              <label
                className="flex min-h-11 items-center gap-3 rounded-2xl border border-white/[0.10] bg-white/[0.06] px-3 py-2 text-base font-medium text-white"
                key={item.id}
              >
                <input
                  className="size-5"
                  name="checkedChecklistItemIds"
                  required={item.required}
                  type="checkbox"
                  value={item.id}
                />
                {item.label}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      {approvalRequired || isRejected ? (
        <label className="grid gap-2 text-base font-semibold">
          Note
          <textarea
            className="min-h-20 rounded-2xl border border-white/[0.10] bg-white/[0.06] px-4 py-3 text-base text-white"
            maxLength={500}
            name="note"
          />
        </label>
      ) : null}
      {photoRequired ? (
        <label className="grid gap-2 text-base font-semibold">
          Photo proof
          <input
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            className="min-h-12 rounded-2xl border border-white/[0.10] bg-white/[0.06] px-4 py-3 text-base file:mr-4 file:rounded-md file:border-0 file:bg-[#061842] file:px-3 file:py-2 file:text-base file:font-semibold file:text-[#AEEBF2]"
            name="photo"
            required
            type="file"
          />
        </label>
      ) : null}
      <Button>Submit</Button>
    </form>
  );
}

export function KidChoreSubmitCard({
  amount,
  approvalRequired,
  checklistItems,
  due,
  householdName,
  instanceId,
  isRejected,
  parentFeedback,
  photoRequired,
  statusLabel,
  templateDescription,
  title,
}: KidChoreSubmitCardProps) {
  const needsDetails = approvalRequired || photoRequired || checklistItems.length > 0 || Boolean(parentFeedback);
  const meta = `${due}${householdName ? ` • ${householdName}` : ""}`;

  if (!needsDetails) {
    return (
      <TaskRow
        action={
          <form action={submitChoreAction}>
            <input name="instanceId" type="hidden" value={instanceId} />
            <button
              aria-label={`Mark ${title} done`}
              className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#7FA0D8] text-transparent transition hover:border-[#45F1F1] hover:bg-[#45F1F1] hover:text-[#061842] focus-visible:border-[#45F1F1] focus-visible:bg-[#45F1F1] focus-visible:text-[#061842] focus-visible:outline-none"
              type="submit"
            >
              <CheckIcon />
            </button>
          </form>
        }
        amount={amount}
        icon={isRejected ? "↺" : "▭"}
        meta={meta}
        statusLabel={statusLabel}
        title={title}
      />
    );
  }

  return (
    <details className="group border-b border-white/[0.08] px-1 py-2.5 last:border-b-0">
      <summary className="cursor-pointer list-none rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#45F1F1] [&::-webkit-details-marker]:hidden">
        <div className="grid grid-cols-[44px_1fr_auto] items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#FFFFFF,#CFEFFF)] text-2xl shadow-[inset_0_0_0_1px_rgba(255,255,255,0.55)]">
            {isRejected ? "↺" : "▭"}
          </div>
          <div className="min-w-0">
            <p className="break-words text-base font-bold leading-snug text-white">{title}</p>
            <p className="text-sm font-semibold leading-snug text-white/85">
              {amount}
              <span className="font-medium text-white/60"> · {meta}</span>
            </p>
          </div>
          <span
            aria-label={`Add details for ${title}`}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#7FA0D8] bg-white/[0.04] text-[#D7E5FF] transition group-open:border-[#45F1F1] group-open:text-[#45F1F1]"
          >
            {photoRequired ? <CameraIcon /> : <NoteIcon />}
          </span>
        </div>
      </summary>
      <div className="mt-3 pl-[56px]">
        <DetailFields
          approvalRequired={approvalRequired}
          checklistItems={checklistItems}
          instanceId={instanceId}
          isRejected={isRejected}
          parentFeedback={parentFeedback}
          photoRequired={photoRequired}
          templateDescription={templateDescription}
        />
      </div>
    </details>
  );
}
