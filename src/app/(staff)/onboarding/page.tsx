import { PageHeader } from '@/components/ui'
import { OnboardingAdvisor } from './OnboardingAdvisor'

export default function OnboardingPage() {
  return (
    <>
      <PageHeader
        title="Onboarding"
        subtitle="The same domain model, run forward. Instead of asking when an existing carrier's filings are due, this answers what a new one actually needs — in the order the work has to happen."
      />
      <div className="px-8 py-6">
        <OnboardingAdvisor />
      </div>
    </>
  )
}
