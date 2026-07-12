const API_URL = import.meta.env.VITE_WORK_LOG_API_URL

function assertApiUrl() {
	if (!API_URL) {
		throw new Error(
			'尚未設定 VITE_WORK_LOG_API_URL，請檢查專案根目錄的 .env.local'
		)
	}
}

async function parseResponse(response) {
	if (!response.ok) {
		throw new Error(`API 請求失敗：HTTP ${response.status}`)
	}

	const result = await response.json()

	if (!result.success) {
		throw new Error(result.error || 'API 回傳未知錯誤')
	}

	return result
}

export async function apiGet(params = {}) {
	assertApiUrl()

	const url = new URL(API_URL)

	Object.entries(params).forEach(([key, value]) => {
		if (value !== undefined && value !== null && value !== '') {
			url.searchParams.set(key, String(value))
		}
	})

	const response = await fetch(url.toString(), {
		method: 'GET',
		redirect: 'follow',
	})

	return parseResponse(response)
}

export async function apiPost(action, payload = {}) {
	assertApiUrl()

	/*
	 * 不主動設定 application/json。
	 *
	 * Apps Script 仍可由 e.postData.contents 解析 JSON 字串，
	 * 同時可避免瀏覽器因自訂 Content-Type 先發送 OPTIONS 預檢。
	 */
	const response = await fetch(API_URL, {
		method: 'POST',
		redirect: 'follow',
		body: JSON.stringify({
			action,
			payload,
		}),
	})

	return parseResponse(response)
}