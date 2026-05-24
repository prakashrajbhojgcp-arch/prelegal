import { DISCLAIMER_FULL } from "@/lib/disclaimer";

export function DraftDisclaimerBanner() {
  return (
    <div
      role="note"
      aria-label="Draft disclaimer"
      className="no-print flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900"
    >
      <span aria-hidden="true" className="mt-0.5 text-amber-600">
        ⚠
      </span>
      <p className="text-sm">{DISCLAIMER_FULL}</p>
    </div>
  );
}
