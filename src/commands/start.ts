import { Markup } from "telegraf";
import type { Telegraf } from "telegraf";
import type { BotContext } from "../types";
import { config } from "../config";
import { escapeHtml } from "../utils/format";

// ─── Main Menu Keyboard ────────────────────────────────────────────

const mainMenuKeyboard = Markup.keyboard([
  ["📝 Rekap Baru", "🔍 Cari Data"],
  ["✏️ Update Data"],
])
  .resize()
  .oneTime(false);

// ─── Register /start Command ──────────────────────────────────────

export function registerStartCommand(bot: Telegraf<BotContext>): void {
  bot.start(async (ctx) => {
    // Jika sudah login
    if (ctx.session.isAuthenticated) {
      await ctx.reply(
        "✅ <b>Anda sudah login!</b>\n\n" +
          "Silakan pilih menu di bawah ini atau gunakan perintah:\n\n" +
          "📝 /rekap — Input data jamaah baru\n" +
          "🔍 /cari — Cari data jamaah\n" +
          "✏️ /update — Perbarui data jamaah",
        { parse_mode: "HTML", ...mainMenuKeyboard }
      );
      return;
    }

    // Minta password
    ctx.session.awaitingPassword = true;
    await ctx.reply(
      "🔒 <b>Autentikasi Diperlukan</b>\n\n" +
        "Selamat datang di <b>Bot Rekap Haji</b>.\n" +
        "Silakan masukkan password internal untuk mengakses sistem:",
      { parse_mode: "HTML" }
    );
  });

  // Handle password input
  bot.on("text", async (ctx, next) => {
    if (!ctx.session.awaitingPassword) {
      return next();
    }

    const input = ctx.message.text.trim();

    if (input === config.INTERNAL_PASSWORD) {
      ctx.session.isAuthenticated = true;
      ctx.session.awaitingPassword = false;

      await ctx.reply(
        "✅ <b>Login Berhasil!</b>\n\n" +
          "Selamat datang di sistem Rekap Data Jamaah Haji.\n" +
          "Silakan pilih menu di bawah ini:\n\n" +
          "📝 /rekap — Input data jamaah baru\n" +
          "🔍 /cari — Cari data jamaah\n" +
          "✏️ /update — Perbarui data jamaah",
        { parse_mode: "HTML", ...mainMenuKeyboard }
      );
    } else {
      ctx.session.awaitingPassword = false;
      await ctx.reply(
        "❌ <b>Password Salah!</b>\n\n" +
          "Akses ditolak. Silakan coba lagi dengan /start.",
        { parse_mode: "HTML" }
      );
    }
  });

  // Handle reply keyboard buttons
  bot.hears("📝 Rekap Baru", async (ctx) => {
    if (!ctx.session.isAuthenticated) {
      await ctx.reply("🔒 Silakan login terlebih dahulu dengan /start.");
      return;
    }
    await ctx.scene.enter("rekap-wizard");
  });

  bot.hears("🔍 Cari Data", async (ctx) => {
    if (!ctx.session.isAuthenticated) {
      await ctx.reply("🔒 Silakan login terlebih dahulu dengan /start.");
      return;
    }
    await ctx.reply(
      "🔍 <b>Cari Data Jamaah</b>\n\n" +
        "Gunakan format:\n<code>/cari [nomor_porsi]</code>\n\n" +
        "Contoh: <code>/cari 123456</code>",
      { parse_mode: "HTML" }
    );
  });

  bot.hears("✏️ Update Data", async (ctx) => {
    if (!ctx.session.isAuthenticated) {
      await ctx.reply("🔒 Silakan login terlebih dahulu dengan /start.");
      return;
    }
    await ctx.reply(
      "✏️ <b>Update Data Jamaah</b>\n\n" +
        "Gunakan format:\n<code>/update [nomor_porsi]</code>\n\n" +
        "Contoh: <code>/update 123456</code>",
      { parse_mode: "HTML" }
    );
  });
}
