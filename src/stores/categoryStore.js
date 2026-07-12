import { defineStore } from 'pinia'
import { fetchCategories } from '../api/workLogApi'

export const useCategoryStore = defineStore('categories', {
	state: () => ({
		categories: [],
		isLoading: false,
		error: '',
		hasLoaded: false,
	}),

	getters: {
		activeCategories(state) {
			return [...state.categories]
				.filter(category => category.isActive !== false)
				.sort(
					(a, b) =>
						Number(a.sortOrder) - Number(b.sortOrder)
				)
		},

		categoryMap(state) {
			return state.categories.reduce(
				(map, category) => {
					map[category.name] = category
					return map
				},
				{}
			)
		},
	},

	actions: {
		setCategories(records) {
			this.categories = Array.isArray(records)
				? records
				: []

			this.hasLoaded = true
		},

		async loadCategories(force = false) {
			if (this.hasLoaded && !force) {
				return this.categories
			}

			this.isLoading = true
			this.error = ''

			try {
				const records = await fetchCategories()

				this.setCategories(records)

				return records
			} catch (error) {
				this.error =
					error instanceof Error
						? error.message
						: '分類載入失敗'

				throw error
			} finally {
				this.isLoading = false
			}
		},

		getCategory(name) {
			return this.categories.find(
				category => category.name === name
			) ?? null
		},
	},
})