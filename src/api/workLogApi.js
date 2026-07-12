import { apiGet, apiPost } from './apiClient'

export async function fetchAllData() {
	const result = await apiGet({
		resource: 'all',
	})

	return {
		workLogs: result.workLogs ?? [],
		dayStatuses: result.dayStatuses ?? [],
		categories: result.categories ?? [],
	}
}

export async function fetchWorkLogs(
	startDate = '',
	endDate = ''
) {
	const result = await apiGet({
		resource: 'workLogs',
		startDate,
		endDate,
	})

	return result.workLogs ?? []
}

export async function fetchDayStatuses(
	startDate = '',
	endDate = ''
) {
	const result = await apiGet({
		resource: 'dayStatuses',
		startDate,
		endDate,
	})

	return result.dayStatuses ?? []
}

export async function fetchCategories() {
	const result = await apiGet({
		resource: 'categories',
	})

	return result.categories ?? []
}

export async function createWorkLog(payload) {
	const result = await apiPost(
		'createWorkLog',
		payload
	)

	return result.data
}

export async function updateWorkLog(payload) {
	const result = await apiPost(
		'updateWorkLog',
		payload
	)

	return result.data
}

export async function deleteWorkLog(id) {
	const result = await apiPost(
		'deleteWorkLog',
		{
			id,
		}
	)

	return result.data
}

export async function saveDayStatus(payload) {
	const result = await apiPost(
		'upsertDayStatus',
		payload
	)

	return result.data
}

export async function deleteDayStatus(date) {
	const result = await apiPost(
		'deleteDayStatus',
		{
			date,
		}
	)

	return result.data
}