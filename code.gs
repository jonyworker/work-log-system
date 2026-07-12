const CONFIG = {
  WORK_LOG_SHEET: 'WorkLogs',
  DAY_STATUS_SHEET: 'DayStatus',
  CATEGORY_SHEET: 'Categories',
}

/**
 * GET
 *
 * 範例：
 * ?resource=workLogs&startDate=2026-07-06&endDate=2026-07-12
 * ?resource=dayStatuses&startDate=2026-07-06&endDate=2026-07-12
 * ?resource=all&startDate=2026-07-06&endDate=2026-07-12
 */
function doGet(e) {
  try {
    const params = e && e.parameter ? e.parameter : {}

    const resource = params.resource || 'all'
    const startDate = params.startDate || ''
    const endDate = params.endDate || ''

    const result = {
      success: true,
    }

    if (resource === 'workLogs' || resource === 'all') {
      result.workLogs = getRowsAsObjects_(
        CONFIG.WORK_LOG_SHEET,
        startDate,
        endDate
      )
    }

    if (resource === 'dayStatuses' || resource === 'all') {
      result.dayStatuses = getRowsAsObjects_(
        CONFIG.DAY_STATUS_SHEET,
        startDate,
        endDate
      )
    }

    if (resource === 'categories' || resource === 'all') {
      result.categories = getCategories_()
    }

    return jsonResponse_(result)
  } catch (error) {
    return errorResponse_(error)
  }
}

/**
 * POST
 *
 * 支援：
 * createWorkLog
 * updateWorkLog
 * deleteWorkLog
 * upsertDayStatus
 * deleteDayStatus
 */
function doPost(e) {
  const lock = LockService.getScriptLock()

  try {
    lock.waitLock(10000)

    if (!e || !e.postData || !e.postData.contents) {
      throw new Error('缺少請求內容')
    }

    const body = JSON.parse(e.postData.contents)
    const action = body.action
    const payload = body.payload || {}

    let result

    switch (action) {
      case 'createWorkLog':
        result = createWorkLog_(payload)
        break

      case 'updateWorkLog':
        result = updateWorkLog_(payload)
        break

      case 'deleteWorkLog':
        result = deleteById_(
          CONFIG.WORK_LOG_SHEET,
          payload.id
        )
        break

      case 'upsertDayStatus':
        result = upsertDayStatus_(payload)
        break

      case 'deleteDayStatus':
        result = deleteDayStatusByDate_(payload.date)
        break

      default:
        throw new Error(`不支援的 action：${action}`)
    }

    return jsonResponse_({
      success: true,
      data: result,
    })
  } catch (error) {
    return errorResponse_(error)
  } finally {
    lock.releaseLock()
  }
}

/**
 * 取得工作表資料並轉成物件陣列。
 */
function getRowsAsObjects_(sheetName, startDate, endDate) {
  const sheet = getSheet_(sheetName)
  const values = sheet.getDataRange().getDisplayValues()

  if (values.length <= 1) {
    return []
  }

  const headers = values[0]

  return values
    .slice(1)
    .filter(row => row.some(value => value !== ''))
    .map(row => {
      return headers.reduce((object, header, index) => {
        object[header] = row[index]
        return object
      }, {})
    })
    .filter(item => {
      if (!item.date) {
        return false
      }

      if (startDate && item.date < startDate) {
        return false
      }

      if (endDate && item.date > endDate) {
        return false
      }

      return true
    })
    .map(normalizeRow_)
}

/**
 * 新增工作紀錄。
 */
function createWorkLog_(payload) {
  validateRequiredFields_(payload, [
    'date',
    'type',
    'category',
    'hours',
    'content',
  ])

  const sheet = getSheet_(CONFIG.WORK_LOG_SHEET)
  const now = new Date().toISOString()

  const record = {
    id: payload.id || Utilities.getUuid(),
    date: payload.date,
    type: payload.type,
    category: payload.category,
    hours: Number(payload.hours),
    content: payload.content,
    sortOrder:
      Number(payload.sortOrder) ||
      getNextSortOrder_(
        payload.date,
        payload.type
      ),
    createdAt: payload.createdAt || now,
    updatedAt: now,
  }

  appendObject_(sheet, record)

  return record
}

/**
 * 修改工作紀錄。
 */
function updateWorkLog_(payload) {
  validateRequiredFields_(payload, ['id'])

  const sheet = getSheet_(CONFIG.WORK_LOG_SHEET)
  const rowNumber = findRowById_(sheet, payload.id)

  if (rowNumber === -1) {
    throw new Error(`找不到工作紀錄：${payload.id}`)
  }

  const current = getRowObject_(sheet, rowNumber)

  const updated = {
    ...current,
    ...payload,
    hours:
      payload.hours !== undefined
        ? Number(payload.hours)
        : Number(current.hours),
    sortOrder:
      payload.sortOrder !== undefined
        ? Number(payload.sortOrder)
        : Number(current.sortOrder),
    updatedAt: new Date().toISOString(),
  }

  writeObjectToRow_(sheet, rowNumber, updated)

  return updated
}

/**
 * 新增或更新日期覆寫狀態。
 *
 * 同一日期只保留一筆。
 */
function upsertDayStatus_(payload) {
  validateRequiredFields_(payload, [
    'date',
    'status',
  ])

  const labels = {
    annualLeave: '特休',
    makeupWork: '補班',
    typhoon: '颱風假',
  }

  if (!labels[payload.status]) {
    throw new Error(`不支援的日期狀態：${payload.status}`)
  }

  const sheet = getSheet_(CONFIG.DAY_STATUS_SHEET)
  const rowNumber = findRowByDate_(sheet, payload.date)
  const now = new Date().toISOString()

  if (rowNumber !== -1) {
    const current = getRowObject_(sheet, rowNumber)

    const updated = {
      ...current,
      status: payload.status,
      label: labels[payload.status],
      updatedAt: now,
    }

    writeObjectToRow_(sheet, rowNumber, updated)

    return updated
  }

  const record = {
    id: payload.id || Utilities.getUuid(),
    date: payload.date,
    status: payload.status,
    label: labels[payload.status],
    createdAt: now,
    updatedAt: now,
  }

  appendObject_(sheet, record)

  return record
}

/**
 * 依日期刪除日期覆寫狀態。
 */
function deleteDayStatusByDate_(date) {
  if (!date) {
    throw new Error('缺少 date')
  }

  const sheet = getSheet_(CONFIG.DAY_STATUS_SHEET)
  const rowNumber = findRowByDate_(sheet, date)

  if (rowNumber === -1) {
    return {
      deleted: false,
      date,
    }
  }

  sheet.deleteRow(rowNumber)

  return {
    deleted: true,
    date,
  }
}

/**
 * 依 ID 刪除資料。
 */
function deleteById_(sheetName, id) {
  if (!id) {
    throw new Error('缺少 id')
  }

  const sheet = getSheet_(sheetName)
  const rowNumber = findRowById_(sheet, id)

  if (rowNumber === -1) {
    throw new Error(`找不到資料：${id}`)
  }

  sheet.deleteRow(rowNumber)

  return {
    deleted: true,
    id,
  }
}

/**
 * 取得下一個排序值。
 */
function getNextSortOrder_(date, type) {
  const records = getRowsAsObjects_(
    CONFIG.WORK_LOG_SHEET,
    date,
    date
  ).filter(item => item.type === type)

  if (!records.length) {
    return 1
  }

  const maxOrder = Math.max(
    ...records.map(item => Number(item.sortOrder) || 0)
  )

  return maxOrder + 1
}

/**
 * 將物件新增至工作表末端。
 */
function appendObject_(sheet, object) {
  const headers = getHeaders_(sheet)

  const row = headers.map(header =>
    object[header] !== undefined
      ? object[header]
      : ''
  )

  sheet.appendRow(row)
}

/**
 * 將物件寫回指定列。
 */
function writeObjectToRow_(sheet, rowNumber, object) {
  const headers = getHeaders_(sheet)

  const row = headers.map(header =>
    object[header] !== undefined
      ? object[header]
      : ''
  )

  sheet
    .getRange(rowNumber, 1, 1, headers.length)
    .setValues([row])
}

/**
 * 取得某一列的物件資料。
 */
function getRowObject_(sheet, rowNumber) {
  const headers = getHeaders_(sheet)

  const row = sheet
    .getRange(rowNumber, 1, 1, headers.length)
    .getDisplayValues()[0]

  return headers.reduce((object, header, index) => {
    object[header] = row[index]
    return object
  }, {})
}

/**
 * 依 ID 尋找列號。
 */
function findRowById_(sheet, id) {
  const headers = getHeaders_(sheet)
  const idColumn = headers.indexOf('id')

  if (idColumn === -1) {
    throw new Error(`${sheet.getName()} 缺少 id 欄位`)
  }

  const lastRow = sheet.getLastRow()

  if (lastRow <= 1) {
    return -1
  }

  const values = sheet
    .getRange(2, idColumn + 1, lastRow - 1, 1)
    .getDisplayValues()
    .flat()

  const index = values.findIndex(value => value === id)

  return index === -1
    ? -1
    : index + 2
}

/**
 * 依日期尋找列號。
 */
function findRowByDate_(sheet, date) {
  const headers = getHeaders_(sheet)
  const dateColumn = headers.indexOf('date')

  if (dateColumn === -1) {
    throw new Error(`${sheet.getName()} 缺少 date 欄位`)
  }

  const lastRow = sheet.getLastRow()

  if (lastRow <= 1) {
    return -1
  }

  const values = sheet
    .getRange(2, dateColumn + 1, lastRow - 1, 1)
    .getDisplayValues()
    .flat()

  const index = values.findIndex(value => value === date)

  return index === -1
    ? -1
    : index + 2
}

/**
 * 取得工作表標題列。
 */
function getHeaders_(sheet) {
  const lastColumn = sheet.getLastColumn()

  if (lastColumn === 0) {
    throw new Error(`${sheet.getName()} 沒有欄位`)
  }

  return sheet
    .getRange(1, 1, 1, lastColumn)
    .getDisplayValues()[0]
}

/**
 * 取得工作表。
 */
function getSheet_(sheetName) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet()
  const sheet = spreadsheet.getSheetByName(sheetName)

  if (!sheet) {
    throw new Error(`找不到工作表：${sheetName}`)
  }

  return sheet
}

/**
 * 驗證必要欄位。
 */
function validateRequiredFields_(payload, fields) {
  fields.forEach(field => {
    const value = payload[field]

    if (
      value === undefined ||
      value === null ||
      value === ''
    ) {
      throw new Error(`缺少必要欄位：${field}`)
    }
  })
}

/**
 * 將 Sheet 字串轉成前端較適合的型別。
 */
function normalizeRow_(row) {
  const normalized = { ...row }

  if (normalized.hours !== undefined) {
    normalized.hours =
      normalized.hours === ''
        ? 0
        : Number(normalized.hours)
  }

  if (normalized.sortOrder !== undefined) {
    normalized.sortOrder =
      normalized.sortOrder === ''
        ? 0
        : Number(normalized.sortOrder)
  }

  return normalized
}

/**
 * 成功 JSON 回應。
 */
function jsonResponse_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON)
}

/**
 * 錯誤 JSON 回應。
 */
function errorResponse_(error) {
  console.error(error)

  return jsonResponse_({
    success: false,
    error: error.message || String(error),
  })
}

function testSetup() {
  const workLogSheet = getSheet_(
    CONFIG.WORK_LOG_SHEET
  )

  const dayStatusSheet = getSheet_(
    CONFIG.DAY_STATUS_SHEET
  )

  const categorySheet = getSheet_(
    CONFIG.CATEGORY_SHEET
  )

  console.log({
    workLogSheet: workLogSheet.getName(),
    workLogHeaders: getHeaders_(workLogSheet),
    dayStatusSheet: dayStatusSheet.getName(),
    dayStatusHeaders: getHeaders_(dayStatusSheet),
    categorySheet: categorySheet.getName(),
    categoryHeaders: getHeaders_(categorySheet),
  })
}

/**
 * 取得工作類別。
 */
function getCategories_() {
  const sheet = getSheet_(CONFIG.CATEGORY_SHEET)
  const values = sheet.getDataRange().getDisplayValues()

  if (values.length <= 1) {
    return []
  }

  const headers = values[0]

  return values
    .slice(1)
    .filter(row => row.some(value => value !== ''))
    .map(row => {
      return headers.reduce((object, header, index) => {
        object[header] = row[index]
        return object
      }, {})
    })
    .map(item => ({
      ...item,
      sortOrder: Number(item.sortOrder) || 0,
      isActive:
        String(item.isActive).toLowerCase() === 'true',
    }))
    .filter(item => item.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder)
}