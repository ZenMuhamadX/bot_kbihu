import type { BotContext } from "../types";

// ─── Auth Guard Middleware ─────────────────────────────────────────

export function authGuard() {
  return (ctx: BotContext, next: () => Promise<void>) => {
    if (!ctx.session?.isAuthenticated) {
      ctx.reply(
        "🔒 <b>Akses Ditolak</b>\n\n" +
          "Anda belum melakukan autentikasi.\n" +
          'Silakan ketik /start untuk login terlebih dahulu.',
        { parse_mode: "HTML" }
      );
      return;
    }
    return next();
  };
}
