import Page from './Page';
import { useMeta } from '../hooks/useMeta';

export default function PlansPage() {
  useMeta({ title: 'Plans', description: 'Compare plans and choose the one that fits you.' });
  return (
    <Page title="Plans">
      <p className="muted">Choose the plan that fits you.</p>
    </Page>
  );
}
