// ─── Environment Configuration ─────────────────────────────────────

function getEnvOrThrow(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`❌ Environment variable "${key}" is required but not set.`);
  }
  return value;
}

export const config = {
  BOT_TOKEN: getEnvOrThrow("BOT_TOKEN"),
  SUPABASE_URL: getEnvOrThrow("SUPABASE_URL"),
  SUPABASE_SERVICE_ROLE_KEY: getEnvOrThrow("SUPABASE_SERVICE_ROLE_KEY"),
  INTERNAL_PASSWORD: getEnvOrThrow("INTERNAL_PASSWORD"),
  STORAGE_BUCKET: "dokumen-jamaah",
} as const;
