import { missingDateRanges } from '../utils/missingDateRanges'
import { defineStore } from 'pinia'
import {
	createWorkLog,
	deleteWorkLog,
	fetchWorkLogs,
	fetchCompTimeSummary,
	updateWorkLog,
} from '../api/workLogApi'

// 所有同一 Store 的日期查詢依序執行，避免背景預載與畫面請求重複抓取。
let pendingLoad = Promise.resolve()
let foregroundLoads = 0

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

			compTimeSummary: { earned: 0, used: 0, balance: 0 },
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
			async loadCompTimeSummary() {
				this.compTimeSummary = await fetchCompTimeSummary()
				return this.compTimeSummary
			},

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

			async loadRange(startDate, endDate, force = false, background = false) {
				if (!force && this.isRangeLoaded(startDate, endDate)) {
					return this.getLogsByRange(startDate, endDate)
				}
				if (!background) {
					foregroundLoads++
					this.isLoading = true
					this.loadError = ''
				}
				const task = async () => {
					const ranges = force
						? [[startDate, endDate]]
						: missingDateRanges(this.loadedDates, startDate, endDate)
					for (const [from, to] of ranges) {
						const records = await fetchWorkLogs(from, to)
						if (force) {
							this.records = this.records.filter(
								item => item.date < from || item.date > to
							)
						}
						this.mergeRecords(records)
						this.markRangeLoaded(from, to)
					}
					return this.getLogsByRange(startDate, endDate)
				}
				// 即使前一個讀取失敗，也允許後續範圍正常嘗試。
				const promise = pendingLoad.then(task, task)
				pendingLoad = promise.catch(() => {})
				try {
					return await promise
				} catch (error) {
					if (!background) {
						this.loadError = error instanceof Error ? error.message : '資料載入失敗'
					}
					throw error
				} finally {
						if (!background) {
						foregroundLoads--
						this.isLoading = foregroundLoads > 0
					}
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
					await this.loadCompTimeSummary()

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
					await this.loadCompTimeSummary()

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
					await this.loadCompTimeSummary()
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