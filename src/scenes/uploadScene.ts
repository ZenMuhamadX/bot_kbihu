import { Scenes, Markup } from "telegraf";
import type { BotContext } from "../types";
import { supabase } from "../supabase";
import { config } from "../config";
import { escapeHtml } from "../utils/format";
import { downloadAndUploadToSupabase, buildStoragePath } from "../utils/file";

// ─── Helper ────────────────────────────────────────────────────────

function getMessageText(ctx: BotContext): string | undefined {
  return ctx.message && "text" in ctx.message ? ctx.message.text : undefined;
}

function getExtFromName(name: string): string {
  const dotIndex = name.lastIndexOf(".");
  if (dotIndex === -1) return ".bin";
  return name.substring(dotIndex);
}

// ─── Upload Scene (untuk tambah dokumen via /update) ───────────────

export const uploadScene = new Scenes.WizardScene<BotContext>(
  "upload-wizard",

  // ── Step 0: Minta file dokumen ─────────────────────────────────
  async (ctx) => {
    const nomorPorsi = ctx.session.updateNomorPorsi;
    if (!nomorPorsi) {
      await ctx.reply("❌ Nomor Porsi tidak ditemukan. Silakan mulai ulang dengan /update.");
      return ctx.scene.leave();
    }

    if (!ctx.session.wizardData) {
      ctx.session.wizardData = { nomor_porsi: nomorPorsi };
    }

    await ctx.reply(
      `📎 <b>Upload Dokumen</b>\n\n` +
        `Nomor Porsi: <code>${escapeHtml(nomorPorsi)}</code>\n\n` +
        `Silakan kirim file dokumen (Foto/PDF).\n` +
        `Atau ketik /end jika sudah selesai.`,
      { parse_mode: "HTML" }
    );
    return ctx.wizard.next();
  },

  // ── Step 1: Terima file ────────────────────────────────────────
  async (ctx) => {
    const text = getMessageText(ctx);

    if (text === "/end") {
      await ctx.reply(
        "✅ <b>Upload Selesai!</b>\n\nSemua dokumen telah disimpan. Terima kasih! 🙏",
        { parse_mode: "HTML" }
      );
      ctx.session.wizardData = {};
      return ctx.scene.leave();
    }

    let fileId: string | undefined;
    let fileName: string | undefined;

    if (ctx.message && "document" in ctx.message && ctx.message.document) {
      fileId = ctx.message.document.file_id;
      fileName = ctx.message.document.file_name || "dokumen.bin";
    } else if (ctx.message && "photo" in ctx.message && ctx.message.photo) {
      const photos = ctx.message.photo;
      fileId = photos[photos.length - 1].file_id;
      fileName = "photo.jpg";
    }

    if (!fileId) {
      await ctx.reply(
        "⚠️ Mohon kirim file dokumen (Foto atau PDF).\nAtau ketik /end jika sudah selesai."
      );
      return;
    }

    ctx.session.wizardData!.pendingFileId = fileId;
    ctx.session.wizardData!.pendingFileName = fileName;

    await ctx.reply(
      "📄 <b>Jenis Dokumen</b>\n\nIni dokumen apa?",
      {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback("🪪 KTP", "udoc_KTP"),
            Markup.button.callback("🛂 Paspor", "udoc_Paspor"),
          ],
          [
            Markup.button.callback("💳 Bukti Bayar", "udoc_Bukti_Bayar"),
            Markup.button.callback("📄 Lainnya", "udoc_Lainnya"),
          ],
        ]),
      }
    );
    return ctx.wizard.next();
  },

  // ── Step 2: Terima jenis dokumen & download ────────────────────
  async (ctx) => {
    let jenisDokumen: string | undefined;

    if (ctx.callbackQuery && "data" in ctx.callbackQuery) {
      await ctx.answerCbQuery();
      const cbData = ctx.callbackQuery.data;
      if (cbData.startsWith("udoc_")) {
        jenisDokumen = cbData.replace("udoc_", "").replace(/_/g, " ");
        await ctx.editMessageText(`📄 Jenis Dokumen: <b>${escapeHtml(jenisDokumen)}</b>`, {
          parse_mode: "HTML",
        });
      }
    }

    if (!jenisDokumen) {
      const text = getMessageText(ctx);
      if (text) jenisDokumen = text.trim();
    }

    if (!jenisDokumen) {
      await ctx.reply("⚠️ Silakan pilih atau ketik jenis dokumen.");
      return;
    }

    const wizardData = ctx.session.wizardData!;
    const fileId = wizardData.pendingFileId;
    const fileName = wizardData.pendingFileName || "dokumen.bin";
    const nomorPorsi = wizardData.nomor_porsi!;

    if (!fileId) {
      await ctx.reply("❌ Data file tidak ditemukan. Silakan kirim ulang file.");
      ctx.wizard.back();
      return;
    }

    const storagePath = buildStoragePath(nomorPorsi, jenisDokumen, fileName);

    try {
      await ctx.reply("⏳ Mengunduh dan menyimpan file...");
      await downloadAndUploadToSupabase(fileId, storagePath, config.BOT_TOKEN);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await ctx.reply(
        `❌ <b>Gagal mengunduh file:</b>\n<code>${escapeHtml(errMsg)}</code>`,
        { parse_mode: "HTML" }
      );
      console.error("Download error:", err);
      ctx.wizard.back();
      return;
    }

    const namaFile = `${nomorPorsi}_${jenisDokumen.replace(/\s+/g, "_")}${getExtFromName(fileName)}`;
    const { error } = await supabase.from("dokumen").insert({
      nomor_porsi: nomorPorsi,
      jenis_dokumen: jenisDokumen,
      nama_file: namaFile,
    });

    if (error) {
      await ctx.reply(
        `❌ <b>Gagal menyimpan metadata:</b>\n<code>${escapeHtml(error.message)}</code>`,
        { parse_mode: "HTML" }
      );
      console.error("Supabase error:", error);
    } else {
      await ctx.reply(
        `✅ Dokumen <b>${escapeHtml(jenisDokumen)}</b> berhasil disimpan!`,
        { parse_mode: "HTML" }
      );
    }

    wizardData.pendingFileId = undefined;
    wizardData.pendingFileName = undefined;

    await ctx.reply(
      "📎 Apakah ada dokumen lain yang ingin di-upload?\n\n" +
        "Silakan kirim file berikutnya, atau ketik /end jika sudah selesai.",
      {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("📤 Upload Lagi", "upl_more")],
          [Markup.button.callback("✅ Selesai", "upl_done")],
        ]),
      }
    );

    ctx.wizard.back();
    return;
  }
);

// ─── Callback Handlers ────────────────────────────────────────────

uploadScene.action("upl_more", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.editMessageText("📎 Silakan kirim file dokumen berikutnya.", {
    parse_mode: "HTML",
  });
});

uploadScene.action("upl_done", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.editMessageText(
    "✅ <b>Upload Selesai!</b>\n\nSemua dokumen telah disimpan. Terima kasih! 🙏",
    { parse_mode: "HTML" }
  );
  ctx.session.wizardData = {};
  await ctx.scene.leave();
});

uploadScene.command("end", async (ctx) => {
  await ctx.reply(
    "✅ <b>Upload Selesai!</b>\n\nSemua dokumen telah disimpan. Terima kasih! 🙏",
    { parse_mode: "HTML" }
  );
  ctx.session.wizardData = {};
  await ctx.scene.leave();
});
