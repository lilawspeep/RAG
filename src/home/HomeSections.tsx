import { Link } from 'react-router';
import { ArrowLeft, ArrowRight, BookOpen, Bot, CircleCheck, GraduationCap, Library, MessagesSquare, Search, Sparkles, UserPlus } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { ContactForm } from '../components/ContactForm';
import logoSm from '../assets/alquds-logo-sm.png';

export function AdvisorIntro() {
  const { t } = useI18n();
  return (
    <section className="relative overflow-hidden py-20 sm:py-28" aria-labelledby="intro-title">
      <div className="container-page grid items-center gap-12 lg:grid-cols-2">
        <div>
          <p className="eyebrow mb-3">{t.intro.eyebrow}</p>
          <h2 id="intro-title" className="section-title">
            {t.intro.title}
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-muted">{t.intro.body}</p>
          <ul className="mt-6 space-y-3">
            {t.intro.points.map((p) => (
              <li key={p} className="flex items-start gap-3">
                <CircleCheck className="mt-0.5 size-5 shrink-0 text-gold-dark" aria-hidden />
                <span className="font-medium text-navy">{p}</span>
              </li>
            ))}
          </ul>
          <Link to="/advisor" className="btn-primary mt-8 px-6 py-3">
            <Sparkles className="size-4" aria-hidden />
            {t.intro.tryAdvisor}
          </Link>
        </div>
        <ChatPreview />
      </div>
    </section>
  );
}

function ChatPreview() {
  const { t } = useI18n();
  return (
    <figure className="relative" aria-label={t.intro.previewTitle}>
      <div aria-hidden className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-gold/20 via-transparent to-academic/15 blur-2xl" />
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-line bg-navy px-5 py-3.5 text-white">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-warm p-1">
              <img src={logoSm} alt="" width={28} height={27} className="h-auto w-7" loading="lazy" />
            </span>
            <div>
              <p className="text-sm font-bold">{t.advisor.title}</p>
              <p className="text-xs text-gold-light">{t.intro.previewTitle}</p>
            </div>
          </div>
          <span className="rounded-full bg-gold/20 px-2.5 py-1 text-[11px] font-bold text-gold-light">{t.intro.previewBadge}</span>
        </div>
        <div className="space-y-4 bg-mist/60 p-5">
          {t.intro.sampleQuestions.map((q) => (
            <div key={q} className="flex flex-col items-end">
              <span className="mb-1 text-[11px] font-semibold text-muted">{t.intro.sampleLabel}</span>
              <p className="max-w-[85%] rounded-2xl rounded-se-sm bg-academic px-4 py-2.5 text-sm text-white shadow-sm" dir="auto">
                {q}
              </p>
            </div>
          ))}
          <div className="flex items-start gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gold/20 text-gold-dark">
              <Bot className="size-4" aria-hidden />
            </span>
            <div className="max-w-[85%] rounded-2xl rounded-ss-sm border border-dashed border-gold/50 bg-white px-4 py-3 text-sm leading-relaxed text-muted">
              {t.intro.previewAnswer}
              <div className="mt-3 flex flex-wrap gap-1.5" aria-hidden>
                <span className="h-5 w-28 rounded-full bg-mist" />
                <span className="h-5 w-20 rounded-full bg-mist" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </figure>
  );
}

export function Features() {
  const { t, dir } = useI18n();
  const Arrow = dir === 'rtl' ? ArrowLeft : ArrowRight;
  const cards = [
    { to: '/syllabus', icon: Library, title: t.features.syllabusTitle, body: t.features.syllabusBody },
    { to: '/syllabus?focus=search', icon: BookOpen, title: t.features.coursesTitle, body: t.features.coursesBody },
    { to: '/advisor', icon: MessagesSquare, title: t.features.advisorTitle, body: t.features.advisorBody },
  ];
  return (
    <section className="bg-mist py-20 sm:py-24" aria-labelledby="features-title">
      <div className="container-page">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow mb-3">{t.features.eyebrow}</p>
          <h2 id="features-title" className="section-title">
            {t.features.title}
          </h2>
          <p className="mt-3 text-muted">{t.features.subtitle}</p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {cards.map(({ to, icon: Icon, title, body }) => (
            <Link
              key={title}
              to={to}
              className="group card relative flex flex-col overflow-hidden p-7 transition duration-300 hover:-translate-y-1 hover:border-gold/60 hover:shadow-lift"
            >
              <span aria-hidden className="absolute inset-x-0 top-0 h-1 origin-[inline-start] scale-x-0 bg-gradient-to-r from-gold to-gold-light transition-transform duration-300 group-hover:scale-x-100" />
              <span className="grid size-14 place-items-center rounded-2xl bg-navy text-gold-light transition group-hover:bg-academic">
                <Icon className="size-6" aria-hidden />
              </span>
              <h3 className="mt-5 text-xl font-bold text-navy">{title}</h3>
              <p className="mt-2 flex-1 leading-relaxed text-muted">{body}</p>
              <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-academic">
                {t.features.open}
                <Arrow className="size-4 transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1" aria-hidden />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HowItWorks() {
  const { t } = useI18n();
  const steps = [
    { icon: UserPlus, title: t.how.step1Title, body: t.how.step1Body, to: '/register' },
    { icon: Search, title: t.how.step2Title, body: t.how.step2Body, to: '/syllabus' },
    { icon: GraduationCap, title: t.how.step3Title, body: t.how.step3Body, to: '/advisor' },
  ];
  return (
    <section className="py-20 sm:py-24" aria-labelledby="how-title">
      <div className="container-page">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow mb-3">{t.how.eyebrow}</p>
          <h2 id="how-title" className="section-title">
            {t.how.title}
          </h2>
        </div>
        <ol className="relative mt-14 grid gap-10 md:grid-cols-3 md:gap-6">
          <span aria-hidden className="absolute inset-x-[16%] top-8 hidden h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent md:block" />
          {steps.map(({ icon: Icon, title, body, to }, i) => (
            <li key={title} className="relative flex flex-col items-center text-center">
              <Link to={to} className="group relative grid size-16 place-items-center rounded-full border-2 border-gold bg-warm text-navy shadow-card transition hover:bg-navy hover:text-gold-light">
                <Icon className="size-6" aria-hidden />
                <span className="absolute -top-1 -end-1 grid size-6 place-items-center rounded-full bg-navy text-xs font-bold text-gold-light group-hover:bg-gold group-hover:text-navy">
                  {i + 1}
                </span>
                <span className="sr-only">{title}</span>
              </Link>
              <h3 className="mt-5 text-lg font-bold text-navy">{title}</h3>
              <p className="mt-2 max-w-xs leading-relaxed text-muted">{body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function ContactSection() {
  const { t } = useI18n();
  return (
    <section id="contact" className="bg-mist py-20 sm:py-24" aria-labelledby="contact-title">
      <div className="container-page grid gap-10 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <p className="eyebrow mb-3">{t.contact.eyebrow}</p>
          <h2 id="contact-title" className="section-title">
            {t.contact.title}
          </h2>
          <p className="mt-4 leading-relaxed text-muted">{t.contact.subtitle}</p>
          <div className="tatreez-divider mt-8 max-w-48" aria-hidden />
        </div>
        <ContactForm />
      </div>
    </section>
  );
}
