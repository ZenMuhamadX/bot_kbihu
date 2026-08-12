import type { Telegraf } from "telegraf";
import type { BotContext, Jamaah, Dokumen } from "../types";
import { supabase } from "../supabase";
import { formatJamaahDetail, escapeHtml } from "../utils/format";
import { downloadFromSupabase, buildStoragePath } from "../utils/file";
import { authGuard } from "../middleware/auth";

// ─── Register /cari Command ───────────────────────────────────────

export function registerCariCommand(bot: Telegraf<BotContext>): void {
  bot.command("cari", authGuard(), async (ctx) => {
    const args = ctx.message.text.split(/\s+/).slice(1);
    const nomorPorsi = args[0];

    if (!nomorPorsi) {
      await ctx.reply(
        "🔍 <b>Pencarian Data Jamaah</b>\n\n" +
          "Gunakan format:\n<code>/cari [nomor_porsi]</code>\n\n" +
          "Contoh: <code>/cari 123456</code>",
        { parse_mode: "HTML" }
      );
      return;
    }

    // Cari data jamaah
    const { data: jamaah, error: jamaahError } = await supabase
      .from("jamaah")
      .select("*")
      .eq("nomor_porsi", nomorPorsi)
      .maybeSingle();

    if (jamaahError) {
      await ctx.reply(
        `❌ <b>Error Database:</b>\n<code>${escapeHtml(jamaahError.message)}</code>`,
        { parse_mode: "HTML" }
      );
      console.error("Supabase query error:", jamaahError);
      return;
    }

    if (!jamaah) {
      await ctx.reply(
        `🔍 <b>Data Tidak Ditemukan</b>\n\n` +
          `Nomor Porsi <code>${escapeHtml(nomorPorsi)}</code> tidak terdaftar dalam database.`,
        { parse_mode: "HTML" }
      );
      return;
    }

    // Tampilkan data jamaah
    await ctx.reply(formatJamaahDetail(jamaah as Jamaah), { parse_mode: "HTML" });

    // Cari dokumen terkait
    const { data: dokumenList, error: dokError } = await supabase
      .from("dokumen")
      .select("*")
      .eq("nomor_porsi", nomorPorsi);

    if (dokError) {
      await ctx.reply(
        `⚠️ <b>Gagal mengambil data dokumen:</b>\n<code>${escapeHtml(dokError.message)}</code>`,
        { parse_mode: "HTML" }
      );
      console.error("Dokumen query error:", dokError);
      return;
    }

    if (!dokumenList || dokumenList.length === 0) {
      await ctx.reply("📂 <i>Tidak ada dokumen yang terunggah untuk jamaah ini.</i>", {
        parse_mode: "HTML",
      });
      return;
    }

    await ctx.reply(
      `📂 <b>Dokumen Terunggah:</b> ${dokumenList.length} file\n` +
        `<i>Mengirim file...</i>`,
      { parse_mode: "HTML" }
    );

    // Kirim setiap file dari Supabase Storage
    for (const dok of dokumenList as Dokumen[]) {
      const storagePath = `${nomorPorsi}/${dok.nama_file}`;

      try {
        const fileBuffer = await downloadFromSupabase(storagePath);
        const ext = dok.nama_file.substring(dok.nama_file.lastIndexOf(".")).toLowerCase();

        if ([".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(ext)) {
          await ctx.replyWithPhoto(
            { source: fileBuffer, filename: dok.nama_file },
            {
              caption: `📄 ${escapeHtml(dok.jenis_dokumen)}`,
              parse_mode: "HTML",
            }
          );
        } else {
          await ctx.replyWithDocument(
            { source: fileBuffer, filename: dok.nama_file },
            {
              caption: `📄 ${escapeHtml(dok.jenis_dokumen)}`,
              parse_mode: "HTML",
            }
          );
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        await ctx.reply(
          `⚠️ Gagal mengirim file <b>${escapeHtml(dok.nama_file)}</b>:\n` +
            `<code>${escapeHtml(errMsg)}</code>`,
          { parse_mode: "HTML" }
        );
        console.error(`File send error for ${dok.nama_file}:`, err);
      }
    }

    await ctx.reply("✅ Semua dokumen telah dikirim.", { parse_mode: "HTML" });
  });
}
