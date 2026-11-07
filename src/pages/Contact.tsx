import { useI18n } from '../i18n/I18nProvider';
import { ContactForm } from '../components/ContactForm';
import { BackendNotice } from '../components/BackendNotice';
import { PageHeader } from '../components/ui';

export default function Contact() {
  const { t } = useI18n();
  return (
    <div className="container-page max-w-3xl py-12 sm:py-16">
      <PageHeader eyebrow={t.contact.eyebrow} title={t.contact.title} subtitle={t.contact.subtitle} />
      <BackendNotice className="mt-6" />
      <div className="mt-8">
        <ContactForm />
      </div>
    </div>
  );
}
