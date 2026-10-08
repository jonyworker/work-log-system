export const DAY_STATUS_LABELS = {
  annualLeave: '特休',
  compLeave: '補休',
  personalLeave: '事假',
  sickLeave: '病假',
  makeupWork: '補班',
  typhoon: '颱風假',
  holiday: '國定假日',
}

export function getDayStatusLabel(status) {
  if (!status) return ''
  return String(status.label ?? '').trim() || DAY_STATUS_LABELS[status.status] || status.status || ''
}

export function getDayStatusColor(status) {
  return status?.status === 'holiday'
    ? 'bg-red-50 text-red-600'
    : 'bg-slate-100 text-slate-600'
}
