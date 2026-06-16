import { supabase } from './supabase'

export async function getShopName(): Promise<string> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return 'My Shop'

    const { data } = await supabase
      .from('shop_settings')
      .select('shop_name')
      .eq('user_id', user.id)
      .single()

    return data?.shop_name ?? 'My Shop'
  } catch {
    return 'My Shop'
  }
}

export async function saveShopName(shopName: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('shop_settings')
    .upsert({ user_id: user.id, shop_name: shopName, updated_at: new Date().toISOString() })
}
