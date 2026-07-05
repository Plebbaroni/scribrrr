import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let supabaseClient: SupabaseClient | null = null;

function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY environment variables."
    );
  }

  supabaseClient = createClient(supabaseUrl, supabaseKey);
  return supabaseClient;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getSupabaseClient(), prop, receiver);
  },
});

const store: Record<string, any[]> = {};

export const db = {
  table(name: string) {
    if (!store[name]) store[name] = [];
    return store[name];
  },
  insert(table: string, row: any) {
    if (!store[table]) store[table] = [];
    store[table].push(row);
    return row;
  },
  find(table: string, key: string, val: any) {
    return (store[table] || []).filter((r: any) => r[key] === val);
  },
  findOne(table: string, key: string, val: any) {
    return (store[table] || []).find((r: any) => r[key] === val) || null;
  },
};
