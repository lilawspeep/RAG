import { Link } from 'react-router';
import { MapPin } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import logoSm from '../assets/alquds-logo-sm.png';

export function Footer() {
  const { t } = useI18n();
  return (
    <footer className="mt-auto bg-navy text-white/80">
      <div className="tatreez-divider opacity-60" aria-hidden />
      <div className="container-page grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-3">
            <span className="grid size-14 place-items-center rounded-2xl bg-warm p-1.5 ring-1 ring-gold/40">
              <img src={logoSm} alt={t.hero.logoAlt} width={44} height={43} className="h-auto w-11" loading="lazy" />
            </span>
            <div>
              <p className="text-lg font-extrabold text-white">{t.meta.appName}</p>
              <p className="text-sm text-gold-light">{t.meta.university}</p>
            </div>
          </div>
          <p className="mt-4 max-w-md text-sm leading-relaxed">{t.footer.tagline}</p>
          <p className="mt-3 flex items-center gap-1.5 text-sm">
            <MapPin className="size-4 text-gold" aria-hidden />
            {t.meta.location}
          </p>
        </div>
        <div>
          <p className="mb-3 text-sm font-bold text-gold-light">{t.footer.explore}</p>
          <ul className="space-y-2 text-sm">
            <li><Link className="hover:text-white" to="/">{t.nav.home}</Link></li>
            <li><Link className="hover:text-white" to="/syllabus">{t.nav.syllabus}</Link></li>
            <li><Link className="hover:text-white" to="/advisor">{t.nav.advisor}</Link></li>
            <li><Link className="hover:text-white" to="/contact">{t.nav.contact}</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-3 text-sm font-bold text-gold-light">{t.footer.account}</p>
          <ul className="space-y-2 text-sm">
            <li><Link className="hover:text-white" to="/login">{t.nav.login}</Link></li>
            <li><Link className="hover:text-white" to="/register">{t.nav.register}</Link></li>
            <li><Link className="hover:text-white" to="/user">{t.nav.user}</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-page space-y-2 py-6 text-xs leading-relaxed text-white/60">
          <p className="font-semibold text-gold-light" lang="en" dir="ltr">
            {t.footer.unofficialEn}
          </p>
          <p>{t.footer.disclaimer}</p>
          <p>{t.footer.rights}</p>
        </div>
      </div>
    </footer>
  );
}
