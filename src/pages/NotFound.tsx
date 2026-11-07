import { Link } from 'react-router';
import { Compass } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { EmptyState } from '../components/ui';

export default function NotFound() {
  const { t } = useI18n();
  return (
    <div className="container-page py-24">
      <EmptyState
        icon={<Compass className="size-6" />}
        title={t.notFound.title}
        body={t.notFound.body}
        action={
          <Link to="/" className="btn-primary">
            {t.notFound.home}
          </Link>
        }
      />
    </div>
  );
}
