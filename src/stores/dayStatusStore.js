import { missingDateRanges } from './../utils/missingDateRanges.js'
import { defineStore } from 'pinia'
import {
	deleteDayStatus,
	fetchDayStatuses,
	saveDayStatus,
} from '../api/workLogApi'

// 所有同一 Store 的日期查詢依序執行，避免背景預載與畫面請求重複抓取。
let pendingLoad = Promise.resolve()
let foregroundLoads = 0

export const useDayStatusStore = defineStore(
	'dayStatuses',
	{
		state: () => ({
			records: [],
			loadedDates: {},

			isLoading: false,
			isSaving: false,

			loadError: '',
			saveError: '',
		}),

		getters: {
			getStatusByDate: (state) => {
				return (date) =>
					state.records.find(
						(item) => item.date === date
					) ?? null
			},

			getStatusesByRange: (state) => {
				return (startDate, endDate) =>
					state.records.filter(
						(item) =>
							item.date >= startDate &&
							item.date <= endDate
					)
			},
		},

		actions: {
			upsertRecord(record) {
				const index = this.records.findIndex(
					(item) => item.date === record.date
				)

				if (index === -1) {
					this.records.push(record)
					return
				}

				this.records.splice(index, 1, record)
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
					return this.getStatusesByRange(startDate, endDate)
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
						const records = await fetchDayStatuses(from, to)
						if (force) {
							this.records = this.records.filter(
								item => item.date < from || item.date > to
							)
						}
						records.forEach(record => this.upsertRecord(record))
						this.markRangeLoaded(from, to)
					}
					return this.getStatusesByRange(startDate, endDate)
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

			async setStatus(date, status, hours = 0, label) {
				if (this.isSaving) return null

				this.isSaving = true
				this.saveError = ''

				try {
					if (status === 'none') {
						await deleteDayStatus(date)

						this.records = this.records.filter(
							(item) => item.date !== date
						)

						this.loadedDates[date] = true
						return null
					}

					const record = await saveDayStatus({
						date,
						status,
						hours: Number(hours) || 0,
						...(label !== undefined ? { label } : {}),
					})

					this.upsertRecord(record)
					this.loadedDates[date] = true

					return record
				} catch (error) {
					this.saveError =
						error instanceof Error
							? error.message
							: '日期狀態儲存失敗'

					throw error
				} finally {
					this.isSaving = false
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