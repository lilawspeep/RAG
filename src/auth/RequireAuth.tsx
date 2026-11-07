import type { ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { useI18n } from '../i18n/I18nProvider';
import { EmptyState, Notice, PageLoader } from '../components/ui';

/**
 * Client-side route guard. It only controls what the UI renders; data access is enforced
 * server-side by Row Level Security and the edge functions' role checks.
 * Without a configured backend, pages render as an explicitly labeled, data-less preview.
 */
export function RequireAuth({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { configured, loading, user, isAdmin } = useAuth();
  const { t } = useI18n();
  const location = useLocation();

  if (!configured) {
    return (
      <>
        <div className="container-page pt-6">
          <Notice tone="warning" title={t.common.previewMode}>
            {t.config.authPending} {admin ? t.admin.previewNote : ''}
          </Notice>
        </div>
        {children}
      </>
    );
  }
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to={`/login${admin ? '?as=admin' : ''}`} replace state={{ from: location.pathname, reason: 'login' }} />;
  if (admin && !isAdmin) {
    return (
      <div className="container-page py-20">
        <EmptyState
          icon={<ShieldAlert className="size-6" />}
          title={t.auth.adminRequired}
          action={
            <Link to="/user" className="btn-primary">
              {t.nav.dashboard}
            </Link>
          }
        />
      </div>
    );
  }
  return <>{children}</>;
}
