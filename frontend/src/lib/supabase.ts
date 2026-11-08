import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase authentication is not configured. Set the public Supabase URL and anon key.");
  }

  if (!supabaseClient) {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { flowType: "pkce" },
    });
  }

  return supabaseClient;
}

export async function getAuthorizationHeaders(headers?: HeadersInit): Promise<Headers> {
  const { data, error } = await getSupabaseClient().auth.getSession();
  if (error) {
    throw error;
  }

  const accessToken = data.session?.access_token;
  if (!accessToken) {
    throw new Error("Sign in with Google before using this feature.");
  }

  const authorizationHeaders = new Headers(headers);
  authorizationHeaders.set("Authorization", `Bearer ${accessToken}`);
  return authorizationHeaders;
}
