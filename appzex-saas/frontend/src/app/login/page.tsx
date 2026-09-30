'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Building2, Eye, EyeOff, KeyRound, LayoutDashboard, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FullPageLoader } from '@/components/layout/role-gate';
import { FormField, fieldProps } from '@/components/shared/form-field';
import { InlineAlert } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCurrentUser, useLogin } from '@/hooks/use-auth';
import { ApiError, errorMessage } from '@/lib/api';
import type { SessionProfile } from '@/lib/types';

const DEMO_PASSWORD = 'Demo@12345';
const SHOW_DEMO_ACCOUNTS = process.env.NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS !== 'false';

const DEMO_ACCOUNTS = [
  { group: 'Platform', accounts: [{ label: 'Super Admin', email: 'superadmin@appzex-demo.com' }] },
  {
    group: 'BrightWave Digital',
    accounts: [
      { label: 'Agency Admin', email: 'agencyadmin@brightwave-demo.com' },
      { label: 'Team Member', email: 'team@brightwave-demo.com' },
      { label: 'Client · Acme', email: 'client@acme-demo.com' },
      { label: 'Client · Umbrella', email: 'client@umbrella-demo.com' },
    ],
  },
  {
    group: 'NorthStar Creative',
    accounts: [
      { label: 'Agency Admin', email: 'agencyadmin@northstar-demo.com' },
      { label: 'Team Member', email: 'team@northstar-demo.com' },
      { label: 'Client · Globex', email: 'client@globex-demo.com' },
    ],
  },
  { group: 'Pixel Harbor Studio (suspended)', accounts: [{ label: 'Agency Admin', email: 'agencyadmin@pixelharbor-demo.com' }] },
];

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});
type LoginValues = z.infer<typeof loginSchema>;

const PREFIX_BY_ROLE: Record<SessionProfile['user']['role'], string> = {
  SUPER_ADMIN: '/super-admin',
  AGENCY_ADMIN: '/app',
  AGENCY_MEMBER: '/app',
  CLIENT: '/client',
};

/** Only follow `next` when it is a relative path inside the user's own area. */
function destinationFor(profile: SessionProfile, next: string | null) {
  const prefix = PREFIX_BY_ROLE[profile.user.role];
  if (next && next.startsWith(`${prefix}/`) && !next.startsWith('//')) return next;
  return profile.home;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next');
  const reason = searchParams.get('reason');
  const { data: session, isLoading } = useCurrentUser();
  const login = useLogin();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });
  const { errors } = form.formState;

  useEffect(() => {
    if (session) router.replace(destinationFor(session, next));
  }, [next, router, session]);

  const onSubmit = form.handleSubmit((values) => {
    login.mutate(values, { onSuccess: (profile) => router.replace(destinationFor(profile, next)) });
  });

  const fillDemo = (email: string) => {
    form.reset({ email, password: DEMO_PASSWORD });
    login.reset();
  };

  if (isLoading || session) return <FullPageLoader label="Checking your session…" />;

  const loginError = login.error;
  const suspended = loginError instanceof ApiError && loginError.code === 'AGENCY_SUSPENDED';

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-slate-950 p-10 text-slate-200 lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">A</span>
          <span className="text-lg font-semibold text-white">AppZex</span>
        </div>
        <div className="max-w-md space-y-8">
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold leading-tight text-white">Every agency, every client, one secure platform.</h1>
            <p className="text-slate-400">
              Run projects, milestones and client feedback in isolated agency workspaces, with a dedicated portal for each client.
            </p>
          </div>
          <ul className="space-y-4 text-sm">
            {[
              { icon: ShieldCheck, title: 'Strict tenant isolation', text: 'Every query is scoped to your agency on the server.' },
              { icon: Users, title: 'Built-in client portal', text: 'Clients see only what you choose to share.' },
              { icon: Sparkles, title: 'AI project health', text: 'Risks and next actions from your real project data.' },
            ].map((feature) => (
              <li key={feature.title} className="flex gap-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-blue-300" aria-hidden>
                  <feature.icon className="size-4" />
                </span>
                <span>
                  <span className="block font-medium text-white">{feature.title}</span>
                  <span className="text-slate-400">{feature.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-slate-500">© AppZex Solutions · Demo environment</p>
      </aside>

      <main id="main-content" className="flex items-center justify-center bg-background px-4 py-10 sm:px-8">
        <div className="w-full max-w-md space-y-6">
          <div className="space-y-1.5">
            <div className="mb-6 flex items-center gap-2 lg:hidden">
              <span className="flex size-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">A</span>
              <span className="text-base font-semibold">AppZex</span>
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
            <p className="text-sm text-muted-foreground">Use your AppZex account to open your workspace.</p>
          </div>

          {reason === 'expired' && !loginError && (
            <InlineAlert tone="warning" title="Your session ended">
              Please sign in again to continue.
            </InlineAlert>
          )}
          {reason === 'suspended' && !loginError && (
            <InlineAlert tone="danger" title="Access suspended">
              Your agency account is currently suspended. Please contact support.
            </InlineAlert>
          )}
          {loginError && (
            <InlineAlert tone="danger" title={suspended ? 'Agency suspended' : 'Sign-in failed'}>
              {errorMessage(loginError)}
            </InlineAlert>
          )}

          <form onSubmit={onSubmit} noValidate className="space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-xs">
            <FormField label="Email" htmlFor="email" error={errors.email?.message} required>
              <Input type="email" autoComplete="email" placeholder="you@agency.com" {...fieldProps('email', errors.email?.message)} {...form.register('email')} />
            </FormField>
            <FormField label="Password" htmlFor="password" error={errors.password?.message} required>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="pr-10"
                  {...fieldProps('password', errors.password?.message)}
                  {...form.register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </FormField>
            <Button type="submit" className="w-full" size="lg" loading={login.isPending}>
              Sign in
            </Button>
          </form>

          {SHOW_DEMO_ACCOUNTS && (
            <section aria-labelledby="demo-accounts" className="rounded-2xl border border-border bg-surface p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 id="demo-accounts" className="flex items-center gap-2 text-sm font-semibold">
                  <KeyRound className="size-4 text-muted-foreground" aria-hidden /> Demo accounts
                </h3>
                <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs text-slate-700">{DEMO_PASSWORD}</span>
              </div>
              <div className="space-y-3">
                {DEMO_ACCOUNTS.map((group) => (
                  <div key={group.group}>
                    <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      {group.group === 'Platform' ? <LayoutDashboard className="size-3.5" aria-hidden /> : <Building2 className="size-3.5" aria-hidden />}
                      {group.group}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {group.accounts.map((account) => (
                        <button
                          key={account.email}
                          type="button"
                          onClick={() => fillDemo(account.email)}
                          className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:border-primary hover:text-primary"
                          title={account.email}
                        >
                          {account.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Click an account to fill the form, then sign in.</p>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<FullPageLoader label="Loading…" />}>
      <LoginForm />
    </Suspense>
  );
}
