// 將日期區間拆成尚未載入的連續區段，避免重複查詢月份交界日期。
export function missingDateRanges(loadedDates, startDate, endDate) {
  const ranges = []
  const date = parseDate(startDate)
  const end = parseDate(endDate)
  let currentStart = null
  let previous = null
  while (date <= end) {
    const key = formatDate(date)
    if (!loadedDates[key]) {
      if (!currentStart) currentStart = key
      previous = key
    } else if (currentStart) {
      ranges.push([currentStart, previous])
      currentStart = null
    }
    date.setDate(date.getDate() + 1)
  }
  if (currentStart) ranges.push([currentStart, previous])
  return ranges
}

function parseDate(s) {
  const [y,m,d] = s.split('-').map(Number)
  return new Date(y,m-1,d)
}
function formatDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
