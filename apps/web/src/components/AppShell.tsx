import * as React from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { Logo } from './Logo';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';

/** Top bar + centered content column for the authenticated configuration app. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const navItems = [
    { to: '/app', label: 'Program' },
    { to: '/profile', label: 'Profile' },
  ] as const;

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <Link to="/app" className="transition-opacity hover:opacity-80">
            <Logo />
          </Link>
          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  'rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground',
                )}
                activeProps={{ className: 'text-foreground' }}
              >
                {item.label}
              </Link>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="ml-2 text-muted-foreground"
              onClick={async () => {
                await signOut();
                navigate({ to: '/signin' });
              }}
            >
              <LogOut className="size-4" />
              Sign out
            </Button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-10">{children}</main>
    </div>
  );
}
