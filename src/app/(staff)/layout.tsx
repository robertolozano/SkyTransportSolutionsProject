import type { ReactNode } from 'react'
import { AppShell } from '@/components/AppShell'

/** Internal operations console — sidebar navigation, dense tables, staff language. */
export default function StaffLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>
}
