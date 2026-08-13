import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getObligationForPacket } from '@/server/queries'
import { OBLIGATION_LABELS, RULES_BY_ID } from '@/rules'
import { daysBetween, formatDay } from '@/rules/dates'
import { PageHeader, Card } from '@/components/ui'

export const dynamic = 'force-dynamic'

/**
 * Filing packet.
 *
 * Everything an agency form needs, assembled from the master record so nobody
 * retypes a VIN into a seventh portal. The checklist below it is the honest part:
 * it names what is still missing before this can actually be submitted, rather than
 * producing a form that looks complete and is not.
 */

interface Field {
  label: string
  value: string | null
  /** Required by the agency form. A missing required field blocks submission. */
  required?: boolean
}

export default async function PacketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const obligation = await getObligationForPacket(id)
  if (!obligation) notFound()

  const asOf = new Date()
  const carrier = obligation.carrier
  const rule = RULES_BY_ID.get(obligation.ruleId)

  const credentialOf = (type: string) =>
    carrier.credentials.find((c) => c.type === type) ??
    obligation.truck?.credentials.find((c) => c.type === type) ??
    obligation.driver?.credentials.find((c) => c.type === type)

  // Fields common to essentially every agency form.
  const identity: Field[] = [
    { label: 'Legal name', value: carrier.legalName, required: true },
    { label: 'DBA', value: carrier.dba },
    { label: 'USDOT number', value: carrier.dotNumber, required: true },
    { label: 'MC number', value: carrier.mcNumber },
    { label: 'EIN', value: carrier.ein, required: true },
    {
      label: 'Principal address',
      value: `${carrier.addressLine}, ${carrier.city}, ${carrier.state} ${carrier.zip}`,
      required: true,
    },
    { label: 'Base jurisdiction', value: carrier.baseState, required: true },
    {
      label: 'Operation type',
      value: carrier.operationType === 'INTERSTATE' ? 'Interstate' : 'Intrastate',
      required: true,
    },
  ]

  const subject: Field[] = obligation.truck
    ? [
        { label: 'Unit number', value: obligation.truck.unitNumber, required: true },
        { label: 'VIN', value: obligation.truck.vin, required: true },
        {
          label: 'Year / make',
          value: `${obligation.truck.year} ${obligation.truck.make}`,
          required: true,
        },
        {
          label: 'Taxable gross weight',
          value: `${obligation.truck.grossWeightLbs.toLocaleString()} lbs`,
          required: true,
        },
        { label: 'Plate jurisdiction', value: obligation.truck.plateState, required: true },
        {
          label: 'Current plate expiry',
          value: (() => {
            const plate = obligation.truck.credentials.find((c) => c.type === 'IRP_PLATE')
            return plate?.expiresOn ? formatDay(plate.expiresOn) : null
          })(),
        },
      ]
    : obligation.driver
      ? [
          {
            label: 'Driver',
            value: `${obligation.driver.firstName} ${obligation.driver.lastName}`,
            required: true,
          },
          { label: 'CDL number', value: obligation.driver.cdlNumber, required: true },
          { label: 'CDL jurisdiction', value: obligation.driver.cdlState, required: true },
          { label: 'Hire date', value: formatDay(obligation.driver.hireDate) },
        ]
      : []

  const filing: Field[] = [
    { label: 'Filing', value: OBLIGATION_LABELS[obligation.type], required: true },
    { label: 'Period', value: obligation.periodLabel, required: true },
    { label: 'Due', value: formatDay(obligation.dueOn), required: true },
    {
      label: 'Earliest permitted start',
      value: obligation.earliestStart ? formatDay(obligation.earliestStart) : null,
    },
    { label: 'Authority', value: obligation.citation, required: true },
  ]

  // What actually stops this being submitted today.
  const missingFields = [...identity, ...subject, ...filing].filter((f) => f.required && !f.value)
  const unmetBlockers = obligation.blockedBy.filter((b) => !b.blocker.completedAt)
  const notYetOpen =
    obligation.earliestStart && obligation.earliestStart.getTime() > asOf.getTime()

  const attachments =
    obligation.type === 'IRP_RENEWAL'
      ? [
          {
            label: 'Stamped Schedule 1 (proof of heavy vehicle tax)',
            present: Boolean(credentialOf('HVUT_RECEIPT')),
          },
          {
            label: 'Emissions compliance confirmation',
            present: Boolean(credentialOf('EMISSIONS_CERT')),
          },
          { label: 'Proof of insurance', present: Boolean(credentialOf('INSURANCE')) },
        ]
      : obligation.type === 'HVUT_FORM_2290'
        ? [{ label: 'Prior year Schedule 1', present: Boolean(credentialOf('HVUT_RECEIPT')) }]
        : obligation.type === 'MEDICAL_CARD_RENEWAL'
          ? [
              {
                label: "Medical examiner's certificate",
                present: Boolean(credentialOf('MEDICAL_CARD')),
              },
            ]
          : []

  const blocked = missingFields.length > 0 || unmetBlockers.length > 0 || Boolean(notYetOpen)

  return (
    <>
      <PageHeader
        title={`Filing packet — ${OBLIGATION_LABELS[obligation.type]}`}
        subtitle={
          <>
            {carrier.legalName} · {obligation.periodLabel} · due {formatDay(obligation.dueOn)}
          </>
        }
        right={
          <Link
            href={`/clients/${carrier.dotNumber}`}
            className="text-[13px] text-brand hover:underline"
          >
            Back to carrier →
          </Link>
        }
      />

      <div className="px-8 py-6">
        <div
          className={`mb-6 rounded-lg border px-5 py-4 ${
            blocked
              ? 'border-high-edge bg-high-soft'
              : 'border-good-edge bg-good-soft'
          }`}
        >
          <div className={`text-[13px] font-semibold ${blocked ? 'text-high' : 'text-good'}`}>
            {blocked ? 'Not ready to submit' : 'Ready to submit'}
          </div>
          <ul className="mt-1.5 space-y-1 text-[13px] leading-relaxed text-ink-soft">
            {notYetOpen && (
              <li>
                The filing window does not open until{' '}
                {formatDay(obligation.earliestStart!)} —{' '}
                {daysBetween(asOf, obligation.earliestStart!)} days away.
              </li>
            )}
            {unmetBlockers.map((b) => (
              <li key={b.blockerId}>
                Blocked by {OBLIGATION_LABELS[b.blocker.type]}, due{' '}
                {formatDay(b.blocker.dueOn)}. {b.reason}
              </li>
            ))}
            {missingFields.map((f) => (
              <li key={f.label}>Missing required field: {f.label}.</li>
            ))}
            {!blocked && (
              <li>
                All required fields are populated from the master record and no prerequisite is
                outstanding.
              </li>
            )}
          </ul>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <FieldCard title="Carrier identity" fields={identity} />
          {subject.length > 0 && (
            <FieldCard
              title={obligation.truck ? 'Vehicle' : 'Driver'}
              fields={subject}
            />
          )}
          <FieldCard title="Filing" fields={filing} />

          {attachments.length > 0 && (
            <Card className="px-5 py-4">
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-soft">
                Attachments required
              </h2>
              <ul className="mt-3 space-y-2">
                {attachments.map((a) => (
                  <li key={a.label} className="flex items-start justify-between gap-3">
                    <span className="text-[13px] text-ink-soft">{a.label}</span>
                    <span
                      className={`shrink-0 rounded border px-1.5 py-0.5 text-[11px] font-medium ${
                        a.present
                          ? 'border-good-edge bg-good-soft text-good'
                          : 'border-critical-edge bg-critical-soft text-critical'
                      }`}
                    >
                      {a.present ? 'On file' : 'Missing'}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        {rule && (
          <Card className="mt-4 px-5 py-4">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-soft">
              Where this is filed
            </h2>
            <div className="mt-2 text-[13px] text-ink">
              {rule.citationDetail.agency} — {rule.citationDetail.authority}
            </div>
            {rule.citationDetail.form && (
              <div className="mt-0.5 text-[13px] text-ink-soft">{rule.citationDetail.form}</div>
            )}
            <a
              href={rule.citationDetail.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block break-all text-[11px] text-brand hover:underline"
            >
              {rule.citationDetail.url}
            </a>
            <p className="mt-3 border-t border-edge pt-3 text-[13px] leading-relaxed text-ink-faint">
              Submission itself is not automated — no agency portal integration exists here. This
              assembles the packet; a person still files it and records the confirmation.
            </p>
          </Card>
        )}
      </div>
    </>
  )
}

function FieldCard({ title, fields }: { title: string; fields: Field[] }) {
  return (
    <Card className="px-5 py-4">
      <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-soft">{title}</h2>
      <dl className="mt-3 space-y-1.5">
        {fields.map((f) => (
          <div key={f.label} className="flex items-baseline justify-between gap-4 border-b border-edge py-1">
            <dt className="text-[13px] text-ink-soft">
              {f.label}
              {f.required && <span className="ml-1 text-ink-faint">*</span>}
            </dt>
            <dd
              className={`numeric text-right text-[13px] ${
                f.value ? 'text-ink' : 'text-critical'
              }`}
            >
              {f.value ?? 'missing'}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}
