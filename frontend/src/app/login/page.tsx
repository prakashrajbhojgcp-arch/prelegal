import { AuthForm } from "@/components/auth-form";
import { DISCLAIMER_FULL } from "@/lib/disclaimer";

export const metadata = {
  title: "Sign in · Prelegal",
};

export default function LoginPage() {
  return (
    <main className="min-h-screen grid grid-cols-1 md:grid-cols-2 bg-slate-100 text-brand-navy">
      <section className="hidden md:flex flex-col justify-between bg-brand-navy text-white px-12 py-16">
        <div>
          <p className="text-2xl font-bold text-brand-yellow">Prelegal</p>
          <p className="mt-4 text-3xl font-semibold leading-tight">
            Draft legal documents in minutes, with AI.
          </p>
          <ul className="mt-10 space-y-3 text-sm text-white/85">
            <li>· 12 Common Paper templates ready out of the box</li>
            <li>· Guided AI chat fills your cover page as you talk</li>
            <li>· Instant PDF export, ready for legal review</li>
          </ul>
        </div>
        <p className="mt-12 text-xs text-white/60 max-w-xs">
          {DISCLAIMER_FULL}
        </p>
      </section>

      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="md:hidden text-center mb-8">
            <h1 className="text-3xl font-semibold tracking-tight">Prelegal</h1>
            <p className="mt-2 text-sm text-brand-gray">
              Draft legal documents in minutes.
            </p>
          </div>
          <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200 p-8">
            <AuthForm />
          </div>
        </div>
      </section>
    </main>
  );
}
