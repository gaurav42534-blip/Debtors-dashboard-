import { supabase } from './supabase'

export async function getShopName(): Promise<string> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return 'My Shop'

    const { data } = await supabase
      .from('shop_settings')
      .select('shop_name')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()

    return data?.shop_name ?? 'My Shop'
  } catch {
    return 'My Shop'
  }
}

export async function saveShopName(shopName: string): Promise<{ error: string | null }> {
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return { error: 'Not logged in' }

  const { error } = await supabase
    .from('shop_settings')
    .upsert(
      { user_id: user.id, shop_name: shopName, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )

  return { error: error?.message ?? null }
}
