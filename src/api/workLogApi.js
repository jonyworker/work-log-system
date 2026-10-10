
import { supabase, requireUser, unwrap } from './apiClient'

const workSelect =
	'id,date,type,category_id,hours,comp_time_hours,content,sort_order,created_at,updated_at,categories(name)'

const statusSelect =
	'id,date,status,hours,label,created_at,updated_at'

const categorySelect =
	'id,name,bg_color,text_color,sort_order,is_active,description,created_at,updated_at'

const numeric = (value) => Number(value) || 0

const mapWork = (item) => ({
	id: item.id,
	date: item.date,
	type: item.type,
	category: item.categories?.name ?? '',
	categoryId: item.category_id,
	hours: numeric(item.hours),
	compTimeHours: numeric(item.comp_time_hours),
	content: item.content,
	sortOrder: item.sort_order,
	createdAt: item.created_at,
	updatedAt: item.updated_at,
})

const mapStatus = (item) => ({
	id: item.id,
	date: item.date,
	status: item.status,
	hours: numeric(item.hours),
	label: item.label,
	createdAt: item.created_at,
	updatedAt: item.updated_at,
})

const mapCategory = (item) => ({
	id: item.id,
	name: item.name,
	bgColor: item.bg_color,
	textColor: item.text_color,
	sortOrder: item.sort_order,
	isActive: item.is_active,
	description: item.description,
	createdAt: item.created_at,
	updatedAt: item.updated_at,
})

async function listAll(
	table,
	selection,
	startDate = '',
	endDate = ''
) {
	// Supabase Client 會自動附帶目前的登入工作階段；讀取權限由 RLS 驗證。
	// 不再為每次讀取額外呼叫 auth.getUser()，避免重複 Auth 請求。
	const batchSize = 1000
	const results = []

	for (let start = 0; ; start += batchSize) {
		let query = supabase.from(table).select(selection)

		if (startDate) {
			query = query.gte('date', startDate)
		}

		if (endDate) {
			query = query.lte('date', endDate)
		}

		const rows = unwrap(
			await query.range(start, start + batchSize - 1)
		) ?? []

		results.push(...rows)

		if (rows.length < batchSize) break
	}

	return results
}

// ========================
// Categories
// ========================

export async function fetchCategories() {
	return (
		await listAll('categories', categorySelect)
	)
		.map(mapCategory)
		.sort((a, b) => a.sortOrder - b.sortOrder)
}

// ========================
// Work Logs
// ========================

export async function fetchWorkLogs(
	startDate = '',
	endDate = ''
) {
	return (
		await listAll(
			'work_logs',
			workSelect,
			startDate,
			endDate
		)
	).map(mapWork)
}

// ========================
// Day Statuses
// ========================

export async function fetchDayStatuses(
	startDate = '',
	endDate = ''
) {
	return (
		await listAll(
			'day_statuses',
			statusSelect,
			startDate,
			endDate
		)
	).map(mapStatus)
}

// ========================
// Fetch All
// ========================

export async function fetchAllData() {
	const [workLogs, dayStatuses, categories] =
		await Promise.all([
			fetchWorkLogs(),
			fetchDayStatuses(),
			fetchCategories(),
		])

	return {
		workLogs,
		dayStatuses,
		categories,
	}
}

// ========================
// Category Lookup
// ========================

async function getCategoryId(name, user) {

	const data = unwrap(
		await supabase
			.from('categories')
			.select('id')
			.eq('owner_id', user.id)
			.eq('name', name)
			.single()
	)

	return data.id
}

function workData(payload, categoryId) {
	return {
		date: payload.date,
		type: payload.type,
		category_id: categoryId,
		hours: numeric(payload.hours),
		comp_time_hours: numeric(payload.compTimeHours),
		content: payload.content ?? '',
		sort_order: numeric(payload.sortOrder),
	}
}

// ========================
// Create Work Log
// ========================

export async function createWorkLog(payload) {
	const user = await requireUser()
	const categoryId = await getCategoryId(payload.category, user)

	const data = unwrap(
		await supabase
			.from('work_logs')
			.insert({
				...workData(payload, categoryId),
				owner_id: user.id,
			})
			.select(workSelect)
			.single()
	)

	return mapWork(data)
}

// ========================
// Update Work Log
// ========================

export async function updateWorkLog(payload) {
	const user = await requireUser()
	const categoryId = await getCategoryId(payload.category, user)

	const data = unwrap(
		await supabase
			.from('work_logs')
			.update(workData(payload, categoryId))
			.eq('id', payload.id)
			.eq('owner_id', user.id)
			.select(workSelect)
			.single()
	)

	return mapWork(data)
}

// ========================
// Delete Work Log
// ========================

export async function deleteWorkLog(id) {
	const user = await requireUser()

	unwrap(
		await supabase
			.from('work_logs')
			.delete()
			.eq('id', id)
			.eq('owner_id', user.id)
	)

	return { id }
}

// ========================
// Day Status Labels
// ========================

const statusLabels = {
	annualLeave: '特休',
	compLeave: '補休',
	personalLeave: '事假',
	sickLeave: '病假',
	makeupWork: '補班',
	typhoon: '颱風假',
	holiday: '國定假日',
}

// ========================
// Save Day Status
// ========================

export async function saveDayStatus(payload) {
	const user = await requireUser()

	const data = unwrap(
		await supabase
			.from('day_statuses')
			.upsert(
				{
					owner_id: user.id,
					date: payload.date,
					status: payload.status,
					hours: numeric(payload.hours),
					label:
						payload.label ??
						statusLabels[payload.status] ??
						'',
				},
				{
					onConflict: 'owner_id,date',
				}
			)
			.select(statusSelect)
			.single()
	)

	return mapStatus(data)
}

// ========================
// Delete Day Status
// ========================

export async function deleteDayStatus(date) {
	const user = await requireUser()

	unwrap(
		await supabase
			.from('day_statuses')
			.delete()
			.eq('date', date)
			.eq('owner_id', user.id)
	)

	return { date }
}

// ========================
// Comp Time Summary
// ========================

export async function fetchCompTimeSummary() {
	const [workLogs, statuses] = await Promise.all([
		listAll('work_logs', 'type,comp_time_hours'),
		listAll('day_statuses', 'status,hours'),
	])

	const earned = workLogs.reduce(
		(total, r) =>
			total +
			(r.type === 'overtime'
				? numeric(r.comp_time_hours)
				: 0),
		0
	)

	const used = statuses.reduce(
		(total, r) =>
			total +
			(r.status === 'compLeave'
				? numeric(r.hours)
				: 0),
		0
	)

	return {
		earned,
		used,
		balance: earned - used,
	}
}
