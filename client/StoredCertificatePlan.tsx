import React, { useEffect, useState } from 'react';
import { CertificateWorkflow } from './CertificateWorkflow';

type StoredPlan = {
  id: string;
  careerKey: string;
  careerTitle: string;
  courses: { id: string; title: string; skillCovered?: string }[];
};

// Resolve the immutable server plan, not browser-local CV data or matched roles.
export function StoredCertificatePlan({ planId, renderLearningOptions }: {
  planId: string;
  renderLearningOptions: React.ComponentProps<typeof CertificateWorkflow>['renderLearningOptions'];
}) {
  const [plan, setPlan] = useState<StoredPlan | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setPlan(null);
    setError('');
    fetch(`/api/certificate-plans/${encodeURIComponent(planId)}`, { credentials: 'include', signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error(response.status === 404 ? 'Career plan not found or unavailable to this account.' : 'Could not load your career plan. Please try again.');
        return response.json();
      })
      .then(setPlan)
      .catch(err => { if (!controller.signal.aborted) setError(err.message); });
    return () => controller.abort();
  }, [planId, retry]);
  return <section className="cert-workflow" aria-label="Career plan">
    <h1 className="text-2xl font-bold mb-4">{plan ? plan.careerTitle : 'Your career plan'}</h1>
    {error ? <div role="alert"><p>{error}</p><button className="cert-button cert-button--secondary" onClick={() => setRetry(n => n + 1)}>Try again</button></div> :
      !plan ? <p role="status">Loading your career plan…</p> :
      <CertificateWorkflow key={plan.id} planId={plan.id}
        role={{ id: plan.careerKey, title: plan.careerTitle, pathway: plan.courses }}
        renderLearningOptions={renderLearningOptions} />}
  </section>;
}
