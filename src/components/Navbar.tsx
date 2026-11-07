import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import { ChevronDown, Globe, LayoutDashboard, LogOut, Menu, ShieldCheck, X } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { useAuth } from '../auth/AuthProvider';
import logoSm from '../assets/alquds-logo-sm.png';

function useOverHero(enabled: boolean) {
  const [over, setOver] = useState(enabled);
  useEffect(() => {
    if (!enabled) {
      setOver(false);
      return;
    }
    const update = () => {
      const hero = document.getElementById('hero');
      const limit = hero ? hero.offsetTop + hero.offsetHeight - 72 : 0;
      setOver(window.scrollY < limit);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [enabled]);
  return over;
}

export function Navbar() {
  const { t, toggleLang } = useI18n();
  const { user, profile, isAdmin, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const dark = useOverHero(location.pathname === '/') && !mobileOpen;

  useEffect(() => {
    setMobileOpen(false);
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const links = [
    { to: '/', label: t.nav.home, end: true },
    { to: '/user', label: t.nav.user },
    { to: '/syllabus', label: t.nav.syllabus },
    { to: '/advisor', label: t.nav.advisor },
    { to: '/contact', label: t.nav.contact },
  ];

  const displayName = profile?.full_name || user?.email || '';
  const initials = displayName.trim().slice(0, 1).toUpperCase() || '؟';

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `relative rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
      dark
        ? isActive
          ? 'text-gold-light'
          : 'text-white/80 hover:text-white'
        : isActive
          ? 'text-academic'
          : 'text-navy/75 hover:text-navy'
    } ${isActive ? "after:absolute after:inset-x-3 after:-bottom-0.5 after:h-0.5 after:rounded-full after:bg-gold after:content-['']" : ''}`;

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <header
      className={`sticky top-0 z-50 transition-colors duration-300 ${
        dark ? 'bg-navy/70 text-white backdrop-blur-md' : 'border-b border-line/80 bg-warm/90 backdrop-blur-md'
      }`}
    >
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:start-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-navy">
        {t.common.skipToContent}
      </a>
      <nav aria-label={t.nav.mainNav} className="container-page flex h-16 items-center gap-3">
        <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label={t.meta.appName}>
          <span className="grid size-10 place-items-center rounded-xl bg-warm p-1 shadow-sm ring-1 ring-gold/30">
            <img src={logoSm} alt={t.hero.logoAlt} width={32} height={31} className="h-auto w-8" />
          </span>
          <span className="hidden leading-tight sm:block">
            <span className={`block text-sm font-extrabold ${dark ? 'text-white' : 'text-navy'}`}>{t.meta.appName}</span>
            <span className={`block text-xs ${dark ? 'text-gold-light' : 'text-gold-dark'}`}>{t.meta.university}</span>
          </span>
        </Link>

        <div className="ms-auto hidden items-center gap-0.5 lg:flex">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={linkCls}>
              {l.label}
            </NavLink>
          ))}
        </div>

        <div className="ms-auto flex items-center gap-2 lg:ms-3">
          <button
            type="button"
            onClick={toggleLang}
            aria-label={t.common.switchLanguageLabel}
            className={`btn px-3 py-2 ${dark ? 'text-white hover:bg-white/10' : 'text-navy hover:bg-mist'}`}
          >
            <Globe className="size-4" aria-hidden />
            <span>{t.common.switchLanguage}</span>
          </button>

          {user ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label={t.nav.profileMenu}
                onClick={() => setMenuOpen((o) => !o)}
                className={`flex items-center gap-1.5 rounded-full p-1 pe-2 transition ${dark ? 'hover:bg-white/10' : 'hover:bg-mist'}`}
              >
                <span className="grid size-8 place-items-center rounded-full bg-gold text-sm font-bold text-navy">{initials}</span>
                <ChevronDown className="size-4" aria-hidden />
              </button>
              {menuOpen && (
                <div role="menu" className="absolute end-0 mt-2 w-64 animate-fade-up overflow-hidden rounded-xl border border-line bg-white text-navy shadow-lift">
                  <div className="border-b border-line px-4 py-3">
                    <p className="truncate text-sm font-bold">{displayName}</p>
                    <p className="truncate text-xs text-muted">{user.email}</p>
                  </div>
                  <Link role="menuitem" to="/user" className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-mist">
                    <LayoutDashboard className="size-4 text-academic" aria-hidden />
                    {t.nav.dashboard}
                  </Link>
                  {isAdmin && (
                    <Link role="menuitem" to="/admin" className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-mist">
                      <ShieldCheck className="size-4 text-academic" aria-hidden />
                      {t.nav.admin}
                    </Link>
                  )}
                  <button role="menuitem" type="button" onClick={handleLogout} className="flex w-full items-center gap-2.5 border-t border-line px-4 py-2.5 text-start text-sm text-red-700 hover:bg-red-50">
                    <LogOut className="size-4" aria-hidden />
                    {t.nav.logout}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Link to="/login" className={`btn px-4 py-2 ${dark ? 'text-white hover:bg-white/10' : 'btn-ghost'}`}>
                {t.nav.login}
              </Link>
              <Link to="/register" className="btn-gold px-4 py-2">
                {t.nav.register}
              </Link>
            </div>
          )}

          <button
            type="button"
            className={`btn p-2 lg:hidden ${dark ? 'text-white hover:bg-white/10' : 'text-navy hover:bg-mist'}`}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            aria-label={mobileOpen ? t.nav.closeMenu : t.nav.openMenu}
            onClick={() => setMobileOpen((o) => !o)}
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <div id="mobile-nav" className="border-t border-line bg-warm lg:hidden">
          <div className="container-page flex flex-col gap-1 py-3">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  `rounded-xl px-4 py-3 text-base font-semibold ${isActive ? 'bg-academic/8 text-academic' : 'text-navy hover:bg-mist'}`
                }
              >
                {l.label}
              </NavLink>
            ))}
            {isAdmin && (
              <NavLink to="/admin" className="rounded-xl px-4 py-3 text-base font-semibold text-navy hover:bg-mist">
                {t.nav.admin}
              </NavLink>
            )}
            {!user && (
              <div className="mt-2 grid grid-cols-2 gap-2 border-t border-line pt-3">
                <Link to="/login" className="btn-outline">
                  {t.nav.login}
                </Link>
                <Link to="/register" className="btn-gold">
                  {t.nav.register}
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
