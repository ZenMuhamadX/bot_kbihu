import { Telegraf, Scenes, session } from "telegraf";
import type { BotContext } from "./types";
import { config } from "./config";
import { ensureBucketExists } from "./utils/file";

// Import scenes
import { rekapScene } from "./scenes/rekapScene";
import { uploadScene } from "./scenes/uploadScene";
import { updateTextScene } from "./scenes/updateTextScene";

// Import command handlers
import { registerStartCommand } from "./commands/start";
import { registerCariCommand } from "./commands/cari";
import { registerUpdateCommand } from "./commands/update";

// ─── Initialize Bot ────────────────────────────────────────────────

const bot = new Telegraf<BotContext>(config.BOT_TOKEN);

// ─── Session Middleware ────────────────────────────────────────────

bot.use(session());

// ─── Scene Stage ───────────────────────────────────────────────────

const stage = new Scenes.Stage<BotContext>([rekapScene, uploadScene, updateTextScene]);
bot.use(stage.middleware());

// ─── Register Commands ─────────────────────────────────────────────

registerStartCommand(bot);
registerCariCommand(bot);
registerUpdateCommand(bot);

// ─── /rekap Command (enter wizard) ─────────────────────────────────

bot.command("rekap", async (ctx) => {
  if (!ctx.session.isAuthenticated) {
    await ctx.reply(
      "🔒 <b>Akses Ditolak</b>\n\nSilakan login terlebih dahulu dengan /start.",
      { parse_mode: "HTML" }
    );
    return;
  }
  await ctx.scene.enter("rekap-wizard");
});

// ─── /help Command ─────────────────────────────────────────────────

bot.command("help", async (ctx) => {
  await ctx.reply(
    "📖 <b>Panduan Bot Rekap Haji</b>\n\n" +
      "Berikut daftar perintah yang tersedia:\n\n" +
      "🔐 /start — Login ke sistem\n" +
      "📝 /rekap — Input data jamaah baru\n" +
      "🔍 /cari <code>[nomor_porsi]</code> — Cari data jamaah\n" +
      "✏️ /update <code>[nomor_porsi]</code> — Update data jamaah\n" +
      "📖 /help — Tampilkan panduan ini\n\n" +
      "<i>Hubungi admin jika mengalami kendala.</i>",
    { parse_mode: "HTML" }
  );
});

// ─── Global Error Handler ──────────────────────────────────────────

bot.catch((err, ctx) => {
  console.error(`❌ Error for ${ctx.updateType}:`, err);
  ctx.reply(
    "❌ <b>Terjadi kesalahan sistem.</b>\n\n" +
      "Silakan coba lagi atau hubungi admin.",
    { parse_mode: "HTML" }
  ).catch(console.error);
});

// ─── Launch Bot ────────────────────────────────────────────────────

async function main() {
  console.log("🚀 Bot Rekap Haji sedang dimulai...");

  // Pastikan bucket Supabase Storage tersedia
  await ensureBucketExists();

  await bot.launch({
    dropPendingUpdates: true,
  });

  console.log("✅ Bot berhasil berjalan! Tekan Ctrl+C untuk menghentikan.");
}

main().catch((err) => {
  console.error("❌ Gagal menjalankan bot:", err);
  process.exit(1);
});

// ─── Graceful Stop ─────────────────────────────────────────────────

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

