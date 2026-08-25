export type AppRole =
  | 'owner' | 'admin' | 'supervisor' | 'clinician'
  | 'peer' | 'case_manager' | 'qa' | 'billing' | 'readonly'

export const ROLES: { code: AppRole; label: string; what: string }[] = [
  { code: 'owner',        label: 'Owner',        what: 'Everything, including billing for the account' },
  { code: 'admin',        label: 'Administrator', what: 'Users, configuration, all charts' },
  { code: 'supervisor',   label: 'Supervisor',   what: 'All charts, co-signature, supervision log' },
  { code: 'clinician',    label: 'Clinician',    what: 'Charts, notes, treatment plans' },
  { code: 'peer',         label: 'Peer specialist', what: 'Peer notes and the charts they are on' },
  { code: 'case_manager', label: 'Case manager', what: 'Case management notes and coordination' },
  { code: 'qa',           label: 'QA / QI',      what: 'Read everything, unlock and correct' },
  { code: 'billing',      label: 'Billing',      what: 'Claims, authorizations, service hours' },
  { code: 'readonly',     label: 'Read only',    what: 'Look, do not touch' },
]

export type Profile = {
  id: string
  tenant_id: string
  full_name: string
  credential: string
  role: AppRole
  is_active: boolean
  created_at: string
}

export type Tenant = { id: string; name: string; created_at: string }
export type Facility = { id: string; tenant_id: string; name: string; is_active: boolean }

export type Invitation = {
  id: string
  tenant_id: string
  email: string
  full_name: string
  credential: string
  role: AppRole
  accepted_at: string | null
  created_at: string
}

export type ValueList = {
  id: string
  tenant_id: string
  key: string
  name: string
  owner: 'tenant' | 'system'
  scope: string
  used_by: string[]
}

export type ValueListItem = {
  id: string
  tenant_id: string
  list_id: string
  code: string
  label: string
  sort_order: number
  is_active: boolean
}

export type Client = {
  id: string
  tenant_id: string
  mrn: string
  first_name: string
  last_name: string
  preferred_name: string
  dob: string | null
  medicaid_id: string
  payer: string
  phone: string
  email: string
  notes: string
  flags: string[]
  is_active: boolean
  created_at: string
}

export type Episode = {
  id: string
  tenant_id: string
  client_id: string
  facility_id: string | null
  level_of_care: string
  admit_date: string
  discharge_date: string | null
  discharge_reason: string | null
  primary_counselor: string | null
  closed: boolean
}

/** Colour per level of care, matching the prototypes. */
export const LOC_COLOR: Record<string, string> = {
  '2.5': 'var(--loc-a)', '2.1': 'var(--loc-b)', '3.5': 'var(--loc-c)',
  '3.1': 'var(--loc-d)', '1.0': 'var(--loc-e)',
}
