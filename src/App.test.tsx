import { describe, expect, it, vi, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { I18nProvider } from './i18n/I18nProvider';
import { AuthProvider } from './auth/AuthProvider';
import App from './App';
import { ar } from './i18n/ar';
import { en } from './i18n/en';

beforeAll(() => {
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  window.matchMedia ??= ((q: string) => ({
    matches: false,
    media: q,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  class IO {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver ??= IO;
});

function renderAt(path: string, lang: 'ar' | 'en' = 'ar') {
  localStorage.setItem('aq-lang', lang);
  return render(
    <MemoryRouter initialEntries={[path]}>
      <I18nProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </I18nProvider>
    </MemoryRouter>,
  );
}

describe('routes render in both languages', () => {
  it('home in Arabic is RTL with the hero and the unofficial disclaimer', async () => {
    renderAt('/', 'ar');
    expect(await screen.findByRole('heading', { level: 1, name: ar.hero.title })).toBeTruthy();
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
    expect(screen.getAllByText(ar.footer.unofficialEn).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: ar.hero.ctaStart })[0].getAttribute('href')).toBe('/register');
  });

  it('home in English is LTR', async () => {
    renderAt('/', 'en');
    expect(await screen.findByRole('heading', { level: 1, name: en.hero.title })).toBeTruthy();
    expect(document.documentElement.dir).toBe('ltr');
  });

  const pages: [string, (d: typeof ar) => string][] = [
    ['/login', (d) => d.auth.loginTitle],
    ['/register', (d) => d.auth.registerTitle],
    ['/syllabus', (d) => d.syllabus.title],
    ['/advisor', (d) => d.advisor.title],
    ['/forgot-password', (d) => d.auth.forgotTitle],
    ['/does-not-exist', (d) => d.notFound.title],
  ];
  for (const [path, title] of pages) {
    for (const [lang, dict] of [['ar', ar], ['en', en]] as const) {
      it(`${path} (${lang})`, async () => {
        renderAt(path, lang);
        expect(await screen.findByRole('heading', { name: title(dict) }, { timeout: 4000 })).toBeTruthy();
      });
    }
  }
});

describe('honest fallbacks without a backend', () => {
  it('login is disabled and labeled as pending integration', async () => {
    renderAt('/login', 'en');
    const submit = await screen.findByRole('button', { name: en.auth.submitLogin });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByText(new RegExp(en.config.backendMissingTitle)).length).toBeGreaterThan(0);
  });

  it('the advisor shows the not-configured state and cannot send', async () => {
    renderAt('/advisor', 'en');
    expect(await screen.findByText(en.advisor.notConfiguredTitle)).toBeTruthy();
    const box = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(box.disabled).toBe(true);
  });

  it('admin preview is clearly labeled and shows no data', async () => {
    renderAt('/admin', 'en');
    expect(await screen.findByText(en.common.previewMode)).toBeTruthy();
    await waitFor(() => expect(screen.getAllByText(en.admin.previewNote, { exact: false }).length).toBeGreaterThan(0));
  });

  it('the student dashboard never shows fabricated academic records', async () => {
    renderAt('/user', 'en');
    expect(await screen.findByText(en.user.noAcademicRecords, {}, { timeout: 4000 })).toBeTruthy();
    expect(screen.queryByText(/GPA\s*[:：]?\s*\d/)).toBeNull();
  });
});

describe('route guard with a configured backend', () => {
  it('blocks non-admins from admin routes even if they chose the admin tab', async () => {
    vi.resetModules();
    vi.doMock('./auth/AuthProvider', () => ({
      useAuth: () => ({ configured: true, loading: false, user: { id: 'u1' }, isAdmin: false }),
    }));
    const { RequireAuth } = await import('./auth/RequireAuth');
    const { I18nProvider: I18n } = await import('./i18n/I18nProvider');
    localStorage.setItem('aq-lang', 'en');
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <I18n>
          <Routes>
            <Route path="/admin" element={<RequireAuth admin><p>secret admin content</p></RequireAuth>} />
          </Routes>
        </I18n>
      </MemoryRouter>,
    );
    expect(screen.getByText(en.auth.adminRequired)).toBeTruthy();
    expect(screen.queryByText('secret admin content')).toBeNull();
    vi.doUnmock('./auth/AuthProvider');
  });

  it('redirects anonymous users to login', async () => {
    vi.resetModules();
    vi.doMock('./auth/AuthProvider', () => ({
      useAuth: () => ({ configured: true, loading: false, user: null, isAdmin: false }),
    }));
    const { RequireAuth } = await import('./auth/RequireAuth');
    const { I18nProvider: I18n } = await import('./i18n/I18nProvider');
    render(
      <MemoryRouter initialEntries={['/user']}>
        <I18n>
          <Routes>
            <Route path="/user" element={<RequireAuth><p>private</p></RequireAuth>} />
            <Route path="/login" element={<p>login page</p>} />
          </Routes>
        </I18n>
      </MemoryRouter>,
    );
    expect(screen.getByText('login page')).toBeTruthy();
    expect(screen.queryByText('private')).toBeNull();
    vi.doUnmock('./auth/AuthProvider');
  });
});
