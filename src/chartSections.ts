/**
 * The chart's group/section taxonomy, settled in the prototypes (see
 * client-chart.html's groupnav + rail). ClientChart.tsx renders it, and a
 * form's placements (which group/section it should show up under) target
 * these same names — one list, so a form always points at a real place in
 * the chart, never a typo of one.
 */
export const CHART_SECTIONS: { g: string; items: string[] }[] = [
  { g: 'Overview',      items: ['Face sheet', 'Needs attention', 'Consents', 'Releases of information'] },
  { g: 'Documentation', items: ['Clinical', 'Medical / nursing', 'Peer', 'Case management', 'Group notes', 'Assessments'] },
  { g: 'Care plan',     items: ['Problems & objectives', 'ISP', '30-day reviews'] },
  { g: 'Billing',       items: ['Service hours', 'Authorizations', 'Claims', 'Do not bill'] },
]

export type Placement = { g: string; item: string }
