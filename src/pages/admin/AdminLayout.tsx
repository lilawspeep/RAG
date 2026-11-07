import { NavLink, Outlet } from 'react-router';
import { Activity, BookOpen, Building2, CalendarDays, FileText, Inbox, LayoutDashboard, ListChecks, Users } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';

export default function AdminLayout() {
  const { t } = useI18n();
  const items = [
    { to: '/admin', end: true, label: t.admin.overview, icon: LayoutDashboard },
    { to: '/admin/documents', label: t.admin.documents, icon: FileText },
    { to: '/admin/courses', label: t.admin.courses, icon: BookOpen },
    { to: '/admin/catalog', label: t.admin.catalog, icon: Building2 },
    { to: '/admin/plans', label: t.admin.plans, icon: ListChecks },
    { to: '/admin/sections', label: t.admin.sections, icon: CalendarDays },
    { to: '/admin/users', label: t.admin.users, icon: Users },
    { to: '/admin/messages', label: t.admin.messages, icon: Inbox },
    { to: '/admin/rag', label: t.admin.rag, icon: Activity },
  ];
  return (
    <div className="container-page py-8 sm:py-10">
      <h1 className="mb-6 text-3xl font-extrabold text-navy">{t.admin.title}</h1>
      <div className="grid gap-6 lg:grid-cols-[15rem_1fr]">
        <nav aria-label={t.admin.title} className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
          <ul className="flex gap-1 lg:sticky lg:top-24 lg:flex-col">
            {items.map(({ to, end, label, icon: Icon }) => (
              <li key={to} className="shrink-0">
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold whitespace-nowrap transition ${
                      isActive ? 'bg-navy text-white shadow-sm' : 'text-navy hover:bg-white hover:shadow-card'
                    }`
                  }
                >
                  <Icon className="size-4.5" aria-hidden />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0 space-y-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
