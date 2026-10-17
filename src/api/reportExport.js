/**
 * 工作報告匯出工具。只處理已儲存的快照，不讀寫資料庫或呼叫 AI。
 * PDF 透過瀏覽器原生列印功能輸出，確保繁體中文可使用使用者系統字型。
 */

const safe = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const text = (value) => String(value ?? '').trim()
const date = (value) => String(value || '').replaceAll('-', '/')
const hours = (value) => `${Math.round((Number(value) || 0) * 100) / 100} 小時`
export const EXPORT_SECTIONS = [
  { key: 'overview', label: '工時總覽' },
  { key: 'summary', label: 'AI 工作摘要（四段式）' },
  { key: 'projects', label: '各專案工時' },
  { key: 'categories', label: '各工作分類工時' },
  { key: 'details', label: '每日工作明細' },
]

function resolveSections(selection) {
  const keys = EXPORT_SECTIONS.map(s => s.key)
  if (selection == null) return keys
  if (!Array.isArray(selection)) throw new Error('匯出區塊設定有誤。')
  const chosen = [...new Set(selection)]
  if (!chosen.length || chosen.some(key => !keys.includes(key))) throw new Error('請至少選擇一個匯出區塊。')
  return chosen
}

const fileBase = (item) => (text(item.title) || '工作報告').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 80)

function normalize(item) {
  if (!item?.id || !item.report || !item.stats) throw new Error('請先開啟已儲存的報告。')
  const report = item.report
  return {
    title: text(item.title) || '工作報告',
    period: `${date(item.start_date)} ～ ${date(item.end_date)}`,
    created: item.created_at ? new Date(item.created_at).toLocaleString('zh-TW', { hour12: false }) : '',
    overview: text(report.overview),
    projects: Array.isArray(report.projectHighlights) ? report.projectHighlights : [],
    decisions: Array.isArray(report.decisions) ? report.decisions : [],
    followUps: Array.isArray(report.followUps) ? report.followUps : [],
    stats: item.stats,
    details: Array.isArray(item.details) ? [...item.details].sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || Number(a.sort_order || 0) - Number(b.sort_order || 0)) : [],
  }
}

const h = (title, body) => `<section class="section"><h2>${safe(title)}</h2>${body}</section>`
const p = (value) => `<p>${safe(text(value)).replace(/\n/g, '<br>')}</p>`
const empty = '<p class="muted">無紀錄。</p>'
const statsTable = (arr) => arr.length ? `<table><thead><tr><th>名稱</th><th class="numeric">工時</th></tr></thead><tbody>${arr.map(x=>`<tr><td>${safe(x.name)}</td><td class="numeric">${safe(hours(x.hours))}</td></tr>`).join('')}</tbody></table>` : empty

function buildHtml(item, sections) {
  const d = normalize(item)
  const included = new Set(resolveSections(sections))
  const summary = `
    ${h('一、本期工作概況', d.overview ? p(d.overview) : empty)}
    ${h('二、各專案工作成果', d.projects.length ? d.projects.map(x => `<article><h3>${safe(x.project)}</h3>${p(x.result)}</article>`).join('') : empty)}
    ${h('三、重要決議', d.decisions.length ? `<ol>${d.decisions.map(x => `<li>${safe(x)}</li>`).join('')}</ol>` : empty)}
    ${h('四、待追蹤事項', d.followUps.length ? d.followUps.map(x => `<article><h3>${safe(x.task)}${x.dueDate ? ` <span class="muted">${safe(x.dueDate)}</span>` : ''}</h3>${p(x.nextStep)}</article>`).join('') : empty)}
  `
  const stats = [
    ['總工時', hours(d.stats.totalHours)],
    ['一般工時', hours(d.stats.workHours)],
    ['加班工時', hours(d.stats.overtimeHours)],
    ['工作筆數', `${d.stats.recordCount ?? d.details.length} 筆`],
  ]
  const body = `
    <header><div class="eyebrow">WORK REPORT · 工作報告</div><h1>${safe(d.title)}</h1><p class="meta">報告期間：${safe(d.period)}　|　保存時間：${safe(d.created)}</p></header>
    ${included.has('overview') ? `<section class="section"><h2>工時總覽</h2><table class="summary"><tbody>${stats.map(([k,v])=>`<tr><th>${safe(k)}</th><td>${safe(v)}</td></tr>`).join('')}</tbody></table></section>` : ''}
    ${included.has('summary') ? summary : ''}
    ${included.has('projects') ? h('各專案工時', statsTable(Array.isArray(d.stats.projectStats) ? d.stats.projectStats : [])) : ''}
    ${included.has('categories') ? h('各工作分類工時', statsTable(Array.isArray(d.stats.categoryStats) ? d.stats.categoryStats : [])) : ''}
    ${included.has('details') ? h('每日工作明細', d.details.length ? `<table class="details"><thead><tr><th>日期</th><th>分類／類型</th><th class="numeric">時數</th><th>工作內容</th></tr></thead><tbody>${d.details.map(x=>`<tr><td>${safe(date(x.date))}</td><td>${safe(x.category || '未分類')} / ${x.type === 'overtime' ? '加班' : '一般'}</td><td class="numeric">${safe(hours(x.hours))}</td><td class="content">${safe(x.content)}</td></tr>`).join('')}</tbody></table>` : empty) : ''}
    <footer>本文件依已儲存的工作報告快照匯出，內容及工時以儲存當時資料為準。</footer>
  `
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><title>${safe(d.title)}</title><style>
  @page { size: A4; margin: 17mm 16mm 18mm; }
  * { box-sizing:border-box; }
  body { margin:0; background:#fff; font-family:-apple-system,BlinkMacSystemFont,'Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif; font-size:11pt; line-height:1.7; color:#243348; }
  h1 { font-size:23pt; margin:5px 0 9px; } h2 { font-size:14pt; border-bottom:1px solid #ccd7e5; padding-bottom:5px; margin:0 0 13px; } h3 { font-size:11pt; margin:0 0 4px; }
  .eyebrow { font-size:9pt; letter-spacing:1.2px; color:#546d8c; font-weight:bold; }
  .meta,.muted { color:#69798e; font-size:9.5pt; } .meta { margin:0; } header { padding-bottom:18px; border-bottom:2px solid #364f6f; }
  .section { margin-top:24px; page-break-inside:auto; } article { margin:0 0 15px; break-inside:avoid; }
  p { margin:3px 0 12px; white-space:normal; overflow-wrap:anywhere; } ol { padding-left:21px; } li { margin:0 0 10px; }
  table { width:100%; border-collapse:collapse; font-size:9.5pt; margin:8px 0 12px; table-layout:fixed; } th,td { text-align:left; border-bottom:1px solid #e1e8f0; padding:7px 8px; vertical-align:top; overflow-wrap:anywhere; }
  th { background:#f3f6fa; } .numeric { text-align:right; width:15%; white-space:nowrap; } .details th:nth-child(1) { width:16%; } .details th:nth-child(2) { width:19%; } .details th:nth-child(3) { width:16%; } .content { white-space:pre-wrap; }
  tr { break-inside:avoid; } thead { display:table-header-group; } footer { margin-top:28px; padding-top:9px; font-size:9pt; color:#78869a; border-top:1px solid #e3e8ef; }
  @media screen { body { max-width:210mm; margin:30px auto; padding:0 16mm; } }
  </style></head><body>${body}</body></html>`
}

export function printSavedReport(item, sections = null) {
  const chosen = resolveSections(sections)
  normalize(item)
  // 視窗必須在使用者點擊按鈕的同步事件中開啟，避免被瀏覽器阻擋。
  const win = window.open('', '_blank')
  if (!win) throw new Error('瀏覽器已阻擋列印視窗，請允許此網站開啟彈出式視窗。')
  try {
    win.document.open()
    win.document.write(buildHtml(item, chosen))
    win.document.close()
    let printed = false
    const doPrint = () => {
      if (printed) return
      printed = true
      win.focus()
      win.print()
    }
    win.addEventListener('load', doPrint, { once: true })
    // 某些瀏覽器的新空白視窗已完成 load，不會再次觸發。
    if (win.document.readyState === 'complete') {
      doPrint()
    }
  } catch (e) { win.close(); throw e }
}

export async function downloadSavedReportDocx(item, sections = null) {
  const chosen = new Set(resolveSections(sections))
  const d = normalize(item)
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, AlignmentType, WidthType, BorderStyle } = await import('docx')
  const para = (value, opt = {}) => new Paragraph({ text: text(value), spacing: { after: 135 }, ...opt })
  const heading = (value, level = HeadingLevel.HEADING_2) => new Paragraph({ text: value, heading: level, spacing: { before: 270, after: 100 }, keepWithNext: true })
  const cell = (value, bold = false) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: text(value), bold })] })] })
  const makeTable = (rows, header) => new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
    new TableRow({ children: header.map(x => cell(x, true)), tableHeader: true }),
    ...rows.map(row => new TableRow({ children: row.map(x => cell(x)) })),
  ], borders: { bottom: { style: BorderStyle.SINGLE, size: 2, color: 'E2E8F0' }, insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: 'E2E8F0' } } })
  const body = [
    new Paragraph({ text: d.title, heading: HeadingLevel.TITLE }),
    para(`報告期間：${d.period}　｜　保存時間：${d.created}`),
    ...(chosen.has('overview') ? [
      heading('工時總覽'),
      makeTable([
        ['總工時', hours(d.stats.totalHours)], ['一般工時', hours(d.stats.workHours)],
        ['加班工時', hours(d.stats.overtimeHours)], ['工作筆數', `${d.stats.recordCount ?? d.details.length} 筆`],
      ], ['統計項目', '數值']),
    ] : []),
    ...(chosen.has('summary') ? [
      heading('一、本期工作概況'), para(d.overview || '無紀錄。'),
      heading('二、各專案工作成果'),
      ...(!d.projects.length ? [para('無紀錄。')] : d.projects.flatMap(x => [heading(text(x.project), HeadingLevel.HEADING_3), para(x.result)])),
      heading('三、重要決議'),
      ...(!d.decisions.length ? [para('無紀錄。')] : d.decisions.map(x => new Paragraph({ text: text(x), bullet: { indent: 360 }, spacing: { after: 100 } }))),
      heading('四、待追蹤事項'),
      ...(!d.followUps.length ? [para('無紀錄。')] : d.followUps.flatMap(x => [heading(`${text(x.task)}${x.dueDate ? `（${x.dueDate}）` : ''}`, HeadingLevel.HEADING_3), para(x.nextStep)])),
    ] : []),
    ...(chosen.has('projects') ? [heading('各專案工時'), makeTable((d.stats.projectStats || []).map(x => [x.name, hours(x.hours)]), ['專案', '工時'])] : []),
    ...(chosen.has('categories') ? [heading('各工作分類工時'), makeTable((d.stats.categoryStats || []).map(x => [x.name, hours(x.hours)]), ['分類', '工時'])] : []),
    ...(chosen.has('details') ? [
      heading('每日工作明細'),
      ...(!d.details.length ? [para('無紀錄。')] : d.details.flatMap(x => [
        heading(`${date(x.date)}｜${x.category || '未分類'}｜${x.type === 'overtime' ? '加班' : '一般'}｜${hours(x.hours)}`, HeadingLevel.HEADING_3),
        para(x.content),
      ])),
    ] : []),
    para('本文件依已儲存的工作報告快照匯出，內容及工時以儲存當時資料為準。'),
  ]
  const doc = new Document({ styles: { default: { document: { run: { font: 'Microsoft JhengHei', size: 22 }, paragraph: { spacing: { line: 320 } } } } }, sections: [{ properties: {}, children: body }] })
  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${fileBase(item)}_${item.start_date}_${item.end_date}.docx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30000)
}
