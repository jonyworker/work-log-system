import { defineStore } from 'pinia'
import {
	createWorkLog,
	deleteWorkLog,
	fetchWorkLogs,
	updateWorkLog,
} from '../api/workLogApi'

export const useWorkLogStore = defineStore(
	'workLogs',
	{
		state: () => ({
			records: [],

			// 紀錄哪些日期已經讀取過
			loadedDates: {},

			isLoading: false,
			isSaving: false,
			deletingIds: [],

			loadError: '',
			saveError: '',
		}),

		getters: {
			getLogsByDate: (state) => {
				return (date) =>
					state.records
						.filter((item) => item.date === date)
						.sort((a, b) => {
							if (a.type !== b.type) {
								return a.type === 'work' ? -1 : 1
							}

							return (
								Number(a.sortOrder) -
								Number(b.sortOrder)
							)
						})
			},

			getLogsByRange: (state) => {
				return (startDate, endDate) =>
					state.records
						.filter(
							(item) =>
								item.date >= startDate &&
								item.date <= endDate
						)
						.sort((a, b) => {
							if (a.date !== b.date) {
								return a.date.localeCompare(b.date)
							}

							if (a.type !== b.type) {
								return a.type === 'work' ? -1 : 1
							}

							return (
								Number(a.sortOrder) -
								Number(b.sortOrder)
							)
						})
			},

			isDeleting: (state) => {
				return (id) =>
					state.deletingIds.includes(id)
			},
		},

		actions: {
			upsertRecord(record) {
				const index = this.records.findIndex(
					(item) => item.id === record.id
				)

				if (index === -1) {
					this.records.push(record)
					return
				}

				this.records.splice(index, 1, record)
			},

			mergeRecords(records) {
				records.forEach((record) => {
					this.upsertRecord(record)
				})
			},

			markRangeLoaded(startDate, endDate) {
				const cursor = parseDate(startDate)
				const end = parseDate(endDate)

				while (cursor <= end) {
					this.loadedDates[formatDate(cursor)] = true
					cursor.setDate(cursor.getDate() + 1)
				}
			},

			isRangeLoaded(startDate, endDate) {
				const cursor = parseDate(startDate)
				const end = parseDate(endDate)

				while (cursor <= end) {
					if (!this.loadedDates[formatDate(cursor)]) {
						return false
					}

					cursor.setDate(cursor.getDate() + 1)
				}

				return true
			},

			async loadRange(
				startDate,
				endDate,
				force = false
			) {
				if (
					!force &&
					this.isRangeLoaded(startDate, endDate)
				) {
					return this.getLogsByRange(
						startDate,
						endDate
					)
				}

				this.isLoading = true
				this.loadError = ''

				try {
					const records = await fetchWorkLogs(
						startDate,
						endDate
					)

					/*
					 * 強制重新讀取時，先移除該範圍的舊資料，
					 * 避免後端已刪除的資料仍留在 Pinia。
					 */
					if (force) {
						this.records = this.records.filter(
							(item) =>
								item.date < startDate ||
								item.date > endDate
						)
					}

					this.mergeRecords(records)
					this.markRangeLoaded(startDate, endDate)

					return records
				} catch (error) {
					this.loadError =
						error instanceof Error
							? error.message
							: '工作紀錄載入失敗'

					throw error
				} finally {
					this.isLoading = false
				}
			},

			async addRecord(payload) {
				if (this.isSaving) return null

				this.isSaving = true
				this.saveError = ''

				try {
					const sameGroup = this.records.filter(
						(item) =>
							item.date === payload.date &&
							item.type === payload.type
					)

					const record = await createWorkLog({
						...payload,
						sortOrder: sameGroup.length + 1,
					})

					this.upsertRecord(record)
					this.loadedDates[payload.date] = true

					return record
				} catch (error) {
					this.saveError =
						error instanceof Error
							? error.message
							: '新增工作紀錄失敗'

					throw error
				} finally {
					this.isSaving = false
				}
			},

			async updateRecord(payload) {
				if (this.isSaving) return null

				this.isSaving = true
				this.saveError = ''

				try {
					const record =
						await updateWorkLog(payload)

					this.upsertRecord(record)
					this.loadedDates[record.date] = true

					return record
				} catch (error) {
					this.saveError =
						error instanceof Error
							? error.message
							: '修改工作紀錄失敗'

					throw error
				} finally {
					this.isSaving = false
				}
			},

			async removeRecord(record) {
				if (
					this.deletingIds.includes(record.id)
				) {
					return
				}

				this.deletingIds.push(record.id)
				this.saveError = ''

				try {
					await deleteWorkLog(record.id)

					this.records = this.records.filter(
						(item) => item.id !== record.id
					)
				} catch (error) {
					this.saveError =
						error instanceof Error
							? error.message
							: '刪除工作紀錄失敗'

					throw error
				} finally {
					this.deletingIds =
						this.deletingIds.filter(
							(id) => id !== record.id
						)
				}
			},
		},
	}
)

function parseDate(dateString) {
	const [year, month, day] =
		dateString.split('-').map(Number)

	return new Date(year, month - 1, day)
}

function formatDate(date) {
	const year = date.getFullYear()
	const month = String(
		date.getMonth() + 1
	).padStart(2, '0')
	const day = String(
		date.getDate()
	).padStart(2, '0')

	return `${year}-${month}-${day}`
}