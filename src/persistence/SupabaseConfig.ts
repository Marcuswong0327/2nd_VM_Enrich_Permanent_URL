export type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

/** SRP: env bag → Supabase config. Returns null when the database is not configured. */
export function parseSupabaseConfig(env: NodeJS.Dict<string>): SupabaseConfig | null {
  const url = env.SUPABASE_URL?.trim().replace(/\/+$/, '');
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) return null;
  return { url, serviceRoleKey };
}
