import { LoginForm } from "@/components/login-form";

export const metadata = {
  title: "Sign in · Prelegal",
};

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12 bg-slate-100">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-brand-navy">Prelegal</h1>
          <p className="mt-2 text-sm text-brand-gray">Sign in to continue.</p>
        </div>
        <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200 p-8">
          <LoginForm />
        </div>
        <p className="mt-6 text-xs text-center text-brand-gray">
          This is a development build. Any email + name lets you in.
        </p>
      </div>
    </main>
  );
}
