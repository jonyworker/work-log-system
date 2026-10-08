
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) {
	throw new Error(
		'請先在 .env.local 設定 VITE_SUPABASE_URL 與 VITE_SUPABASE_PUBLISHABLE_KEY'
	)
}

export const supabase = createClient(url, key)

export async function requireUser() {
	const {
		data: { user },
		error,
	} = await supabase.auth.getUser()

	if (error || !user) {
		throw new Error('登入已失效，請重新登入')
	}

	return user
}

export function unwrap(result) {
	if (result.error) throw result.error
	return result.data
}
