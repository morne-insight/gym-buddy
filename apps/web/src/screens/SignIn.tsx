import * as React from 'react';
import { useNavigate } from '@tanstack/react-router';
import { MailCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Mode = 'signin' | 'signup';

export function SignIn() {
  const navigate = useNavigate();
  const [mode, setMode] = React.useState<Mode>('signin');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  // When set, email confirmation is pending for this address — show the
  // "check your inbox" view instead of the form.
  const [pendingEmail, setPendingEmail] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result =
        mode === 'signin'
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({
              email,
              password,
              options: { emailRedirectTo: window.location.origin },
            });

      if (result.error) {
        // Signing in before confirming the email — route to the pending view.
        if (mode === 'signin' && /confirm/i.test(result.error.message)) {
          setPendingEmail(email);
          return;
        }
        throw result.error;
      }

      // With email confirmation ON, sign-up returns no session until the user
      // clicks the link. Show the pending view rather than a dead-end redirect.
      if (mode === 'signup' && !result.data.session) {
        setPendingEmail(email);
        return;
      }

      navigate({ to: '/' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (authError) setError(authError.message);
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden border-r border-border/60 p-12 lg:flex">
        <Logo />
        <div className="space-y-5">
          <h1 className="text-5xl font-extrabold leading-[1.05]">
            Build the plan.
            <br />
            <span className="text-primary">Show up</span> for it.
          </h1>
          <p className="max-w-sm text-muted-foreground">
            Set up your training, pick your Buddy, and let them hold you to it — every session,
            no excuses.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Your Buddy is watching the calendar, not the clock.
        </p>
      </div>

      {/* Right panel */}
      <div className="flex items-center justify-center p-6">
        {pendingEmail ? (
          <CheckEmail
            email={pendingEmail}
            onBack={() => {
              setPendingEmail(null);
              setMode('signin');
              setError(null);
            }}
          />
        ) : (
          <div className="w-full max-w-sm">
            <div className="mb-8 lg:hidden">
              <Logo />
            </div>
            <h2 className="text-2xl font-extrabold">
              {mode === 'signin' ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === 'signin'
                ? 'Sign in to keep configuring your training.'
                : 'Sign up to start building your plan.'}
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1.5"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1.5"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}

              <Button type="submit" size="lg" className="w-full" disabled={busy}>
                {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}
              </Button>
            </form>

            <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              OR
              <span className="h-px flex-1 bg-border" />
            </div>

            <Button variant="outline" size="lg" className="w-full" onClick={handleGoogle}>
              Continue with Google
            </Button>

            <p className="mt-8 text-center text-sm text-muted-foreground">
              {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'signin' ? 'signup' : 'signin');
                  setError(null);
                }}
                className="font-semibold text-primary hover:underline"
              >
                {mode === 'signin' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/** "Check your inbox" view shown while an email confirmation is pending. */
function CheckEmail({ email, onBack }: { email: string; onBack: () => void }) {
  const [resending, setResending] = React.useState(false);
  const [resent, setResent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function resend() {
    setResending(true);
    setError(null);
    try {
      const { error: resendError } = await supabase.auth.resend({ type: 'signup', email });
      if (resendError) throw resendError;
      setResent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend');
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="w-full max-w-sm text-center">
      <div className="mb-8 flex justify-center lg:hidden">
        <Logo />
      </div>
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/15 text-primary">
        <MailCheck className="size-7" />
      </span>
      <h2 className="mt-6 text-2xl font-extrabold">Check your inbox</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        We sent a confirmation link to <span className="font-semibold text-foreground">{email}</span>.
        Click it to activate your account — this page will sign you in automatically once you do.
      </p>

      {error && (
        <p className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Button
        variant="outline"
        size="lg"
        className="mt-6 w-full"
        onClick={resend}
        disabled={resending || resent}
      >
        {resent ? 'Confirmation resent ✓' : resending ? 'Resending…' : 'Resend confirmation email'}
      </Button>

      <button
        type="button"
        onClick={onBack}
        className="mt-6 text-sm font-semibold text-primary hover:underline"
      >
        Back to sign in
      </button>
    </div>
  );
}
