import * as React from 'react';
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  useNavigate,
} from '@tanstack/react-router';
import { useAuth } from '@/auth/AuthProvider';
import { useMe } from '@/lib/queries';
import { FullPageLoader } from '@/components/Loader';
import { SignIn } from '@/screens/SignIn';
import { Onboarding } from '@/screens/Onboarding';
import { Templates } from '@/screens/Templates';
import { Editor } from '@/screens/Editor';
import { Profile } from '@/screens/Profile';

/** Redirects an unauthenticated visitor to sign-in; otherwise renders the app. */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  React.useEffect(() => {
    if (!loading && !session) navigate({ to: '/signin' });
  }, [loading, session, navigate]);
  if (loading || !session) return <FullPageLoader />;
  return <>{children}</>;
}

/** Landing route: sends the visitor to sign-in, onboarding, or the editor. */
function Index() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const me = useMe(!loading && !!session);

  React.useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: '/signin' });
  }, [loading, session, navigate]);

  React.useEffect(() => {
    if (me.data) navigate({ to: me.data.onboarded ? '/app' : '/onboarding' });
  }, [me.data, navigate]);

  return <FullPageLoader label="Getting things ready…" />;
}

const rootRoute = createRootRoute({ component: () => <Outlet /> });

const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: Index });
const signinRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/signin',
  component: SignIn,
});
const onboardingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/onboarding',
  component: () => (
    <RequireAuth>
      <Onboarding />
    </RequireAuth>
  ),
});
const templatesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/templates',
  component: () => (
    <RequireAuth>
      <Templates />
    </RequireAuth>
  ),
});
const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/app',
  component: () => (
    <RequireAuth>
      <Editor />
    </RequireAuth>
  ),
});
const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/profile',
  component: () => (
    <RequireAuth>
      <Profile />
    </RequireAuth>
  ),
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  signinRoute,
  onboardingRoute,
  templatesRoute,
  appRoute,
  profileRoute,
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
