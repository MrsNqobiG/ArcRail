'use client'

import { useEffect, useState } from 'react'
import { Shell, type ViewId } from '@/components/arcrail/shell'
import { OverviewView } from '@/components/arcrail/views/overview'
import { JourneyView } from '@/components/arcrail/views/journey'
import { PaymentsView } from '@/components/arcrail/views/payments'
import { LedgerView } from '@/components/arcrail/views/ledger'
import { LifecycleView } from '@/components/arcrail/views/lifecycle'
import { OpsView } from '@/components/arcrail/views/ops'
import { GatesView } from '@/components/arcrail/views/gates'
import { ModulesView } from '@/components/arcrail/views/modules'
import { VerificationView } from '@/components/arcrail/views/verification'
import { RisksView } from '@/components/arcrail/views/risks'
import { FactsView } from '@/components/arcrail/views/facts'
import { ReconView } from '@/components/arcrail/views/recon'
import { SettleView } from '@/components/arcrail/views/settle'
import { GuidedTour } from '@/components/arcrail/tour'

export default function Home() {
  const [view, setView] = useState<ViewId>('overview')
  const [tourOpen, setTourOpen] = useState(false)

  // Share links: ?tour=1 auto-starts the guided tour (for non-technical visitors).
  // Deferred via setTimeout so state is not set synchronously inside the effect.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('tour') !== '1') return
    const t = setTimeout(() => setTourOpen(true), 0)
    return () => clearTimeout(t)
  }, [])

  return (
    <>
      <Shell view={view} setView={setView} onStartTour={() => setTourOpen(true)}>
        {view === 'overview' && <OverviewView onStartTour={() => setTourOpen(true)} onOpenDesk={() => setView('settle')} />}
        {view === 'journey' && <JourneyView />}
        {view === 'settle' && <SettleView />}
        {view === 'payments' && <PaymentsView onGoToCases={() => setView('ops')} onGoToSettle={() => setView('settle')} />}
        {view === 'ledger' && <LedgerView />}
        {view === 'recon' && <ReconView onGoToCases={() => setView('ops')} />}
        {view === 'ops' && <OpsView />}
        {view === 'lifecycle' && <LifecycleView />}
        {view === 'gates' && <GatesView />}
        {view === 'modules' && <ModulesView />}
        {view === 'verification' && <VerificationView />}
        {view === 'risks' && <RisksView />}
        {view === 'facts' && <FactsView />}
      </Shell>
      {tourOpen && <GuidedTour setView={setView} onClose={() => setTourOpen(false)} />}
    </>
  )
}
