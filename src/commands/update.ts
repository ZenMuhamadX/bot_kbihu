import { Markup } from "telegraf";
import type { Telegraf } from "telegraf";
import type { BotContext } from "../types";
import { supabase } from "../supabase";
import { escapeHtml } from "../utils/format";
import { authGuard } from "../middleware/auth";

// ─── Register /update Command ─────────────────────────────────────

export function registerUpdateCommand(bot: Telegraf<BotContext>): void {
  bot.command("update", authGuard(), async (ctx) => {
    const args = ctx.message.text.split(/\s+/).slice(1);
    const nomorPorsi = args[0];

    if (!nomorPorsi) {
      await ctx.reply(
        "✏️ <b>Update Data Jamaah</b>\n\n" +
          "Gunakan format:\n<code>/update [nomor_porsi]</code>\n\n" +
          "Contoh: <code>/update 123456</code>",
        { parse_mode: "HTML" }
      );
      return;
    }

    // Cek keberadaan data
    const { data, error } = await supabase
      .from("jamaah")
      .select("nomor_porsi, nama_lengkap")
      .eq("nomor_porsi", nomorPorsi)
      .maybeSingle();

    if (error) {
      await ctx.reply(
        `❌ <b>Error Database:</b>\n<code>${escapeHtml(error.message)}</code>`,
        { parse_mode: "HTML" }
      );
      console.error("Supabase error:", error);
      return;
    }

    if (!data) {
      await ctx.reply(
        `⚠️ <b>Data Tidak Ditemukan</b>\n\n` +
          `Nomor Porsi <code>${escapeHtml(nomorPorsi)}</code> tidak terdaftar.\n` +
          `Gunakan /rekap untuk menambahkan data baru.`,
        { parse_mode: "HTML" }
      );
      return;
    }

    // Simpan nomor porsi di session untuk scene
    ctx.session.updateNomorPorsi = nomorPorsi;

    await ctx.reply(
      `✏️ <b>Update Data</b>\n\n` +
        `Jamaah: <b>${escapeHtml(data.nama_lengkap)}</b>\n` +
        `Nomor Porsi: <code>${escapeHtml(nomorPorsi)}</code>\n\n` +
        `Pilih jenis pembaruan:`,
      {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("📝 Update Data Teks", "action_update_text")],
          [Markup.button.callback("📎 Tambah Dokumen", "action_upload_doc")],
        ]),
      }
    );
  });

  // Handle callback: update text
  bot.action("action_update_text", async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText("📝 <b>Memulai proses update data teks...</b>", {
      parse_mode: "HTML",
    });
    await ctx.scene.enter("update-text-wizard");
  });

  // Handle callback: upload document
  bot.action("action_upload_doc", async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText("📎 <b>Memulai proses upload dokumen...</b>", {
      parse_mode: "HTML",
    });
    await ctx.scene.enter("upload-wizard");
  });
}
