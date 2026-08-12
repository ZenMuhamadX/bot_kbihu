import { Scenes, Markup } from "telegraf";
import type { BotContext, WizardData } from "../types";
import { supabase } from "../supabase";
import { config } from "../config";
import { formatJamaahSummary, escapeHtml } from "../utils/format";
import { downloadAndUploadToSupabase, buildStoragePath } from "../utils/file";

// ─── Helper: Get wizard data safely ────────────────────────────────

function getWizardData(ctx: BotContext): WizardData {
  if (!ctx.session.wizardData) {
    ctx.session.wizardData = {};
  }
  return ctx.session.wizardData;
}

// ─── Helper: Get text from message ─────────────────────────────────

function getMessageText(ctx: BotContext): string | undefined {
  return ctx.message && "text" in ctx.message ? ctx.message.text : undefined;
}

// ─── Rekap Wizard Scene ────────────────────────────────────────────

export const rekapScene = new Scenes.WizardScene<BotContext>(
  "rekap-wizard",

  // ── Step 0: Tanya Nomor Porsi ──────────────────────────────────
  async (ctx) => {
    ctx.session.wizardData = {};
    await ctx.reply(
      "📝 <b>Rekap Data Jamaah Baru</b>\n\n" +
        "Silakan masukkan <b>Nomor Porsi</b> jamaah:",
      { parse_mode: "HTML" }
    );
    return ctx.wizard.next();
  },

  // ── Step 1: Terima Nomor Porsi & Cek Duplikasi ─────────────────
  async (ctx) => {
    const text = getMessageText(ctx);
    if (!text) {
      await ctx.reply("⚠️ Mohon masukkan Nomor Porsi dalam bentuk teks.");
      return;
    }

    const nomorPorsi = text.trim();

    // Cek duplikasi di Supabase
    const { data, error } = await supabase
      .from("jamaah")
      .select("nomor_porsi")
      .eq("nomor_porsi", nomorPorsi)
      .maybeSingle();

    if (error) {
      await ctx.reply("❌ <b>Error:</b> Gagal mengecek database. Silakan coba lagi.", {
        parse_mode: "HTML",
      });
      console.error("Supabase error:", error);
      return ctx.scene.leave();
    }

    if (data) {
      await ctx.reply(
        "⚠️ <b>Data Sudah Ada!</b>\n\n" +
          `Nomor Porsi <code>${escapeHtml(nomorPorsi)}</code> sudah terdaftar di database.\n` +
          "Gunakan perintah /update jika ingin mengubah data.",
        { parse_mode: "HTML" }
      );
      return ctx.scene.leave();
    }

    getWizardData(ctx).nomor_porsi = nomorPorsi;
    await ctx.reply("👤 Masukkan <b>Nama Lengkap</b> jamaah:", { parse_mode: "HTML" });
    return ctx.wizard.next();
  },

  // ── Step 2: Nama Lengkap ───────────────────────────────────────
  async (ctx) => {
    const text = getMessageText(ctx);
    if (!text) {
      await ctx.reply("⚠️ Mohon masukkan Nama Lengkap dalam bentuk teks.");
      return;
    }
    getWizardData(ctx).nama_lengkap = text.trim();
    await ctx.reply("👨 Masukkan <b>Nama Ayah</b> jamaah:", { parse_mode: "HTML" });
    return ctx.wizard.next();
  },

  // ── Step 3: Nama Ayah ──────────────────────────────────────────
  async (ctx) => {
    const text = getMessageText(ctx);
    if (!text) {
      await ctx.reply("⚠️ Mohon masukkan Nama Ayah dalam bentuk teks.");
      return;
    }
    getWizardData(ctx).nama_ayah = text.trim();
    await ctx.reply(
      "📅 Masukkan <b>Tanggal Lahir</b> jamaah:\n" +
        "<i>Format: YYYY-MM-DD (Contoh: 1980-05-15)</i>",
      { parse_mode: "HTML" }
    );
    return ctx.wizard.next();
  },

  // ── Step 4: Tanggal Lahir ──────────────────────────────────────
  async (ctx) => {
    const text = getMessageText(ctx);
    if (!text) {
      await ctx.reply("⚠️ Mohon masukkan Tanggal Lahir dalam bentuk teks.");
      return;
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(text.trim())) {
      await ctx.reply(
        "⚠️ Format tanggal tidak valid.\n" +
          "Gunakan format <b>YYYY-MM-DD</b> (Contoh: 1980-05-15)",
        { parse_mode: "HTML" }
      );
      return;
    }

    getWizardData(ctx).tgl_lahir = text.trim();
    await ctx.reply(
      "⚧ Pilih <b>Jenis Kelamin</b> jamaah:",
      {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard([
          Markup.button.callback("👨 Laki-laki", "gender_L"),
          Markup.button.callback("👩 Perempuan", "gender_P"),
        ]),
      }
    );
    return ctx.wizard.next();
  },

  // ── Step 5: Jenis Kelamin (via callback) ───────────────────────
  async (ctx) => {
    // Handle callback query for gender
    if (ctx.callbackQuery && "data" in ctx.callbackQuery) {
      await ctx.answerCbQuery();
      const gender = ctx.callbackQuery.data === "gender_L" ? "Laki-laki" : "Perempuan";
      getWizardData(ctx).jenis_kelamin = gender;

      await ctx.editMessageText(`⚧ Jenis Kelamin: <b>${gender}</b>`, { parse_mode: "HTML" });
      await ctx.reply("🏠 Masukkan <b>Alamat</b> jamaah:", { parse_mode: "HTML" });
      return ctx.wizard.next();
    }

    // If user types text instead of clicking button
    const text = getMessageText(ctx);
    if (text) {
      const lower = text.trim().toLowerCase();
      if (lower === "l" || lower === "laki-laki") {
        getWizardData(ctx).jenis_kelamin = "Laki-laki";
      } else if (lower === "p" || lower === "perempuan") {
        getWizardData(ctx).jenis_kelamin = "Perempuan";
      } else {
        await ctx.reply("⚠️ Pilih jenis kelamin: ketik <b>L</b> atau <b>P</b>, atau klik tombol di atas.", {
          parse_mode: "HTML",
        });
        return;
      }
      await ctx.reply("🏠 Masukkan <b>Alamat</b> jamaah:", { parse_mode: "HTML" });
      return ctx.wizard.next();
    }

    await ctx.reply("⚠️ Silakan pilih jenis kelamin menggunakan tombol di atas atau ketik L/P.");
  },

  // ── Step 6: Alamat ─────────────────────────────────────────────
  async (ctx) => {
    const text = getMessageText(ctx);
    if (!text) {
      await ctx.reply("⚠️ Mohon masukkan Alamat dalam bentuk teks.");
      return;
    }
    getWizardData(ctx).alamat = text.trim();
    await ctx.reply("🛂 Masukkan <b>Nomor Paspor</b> jamaah:", { parse_mode: "HTML" });
    return ctx.wizard.next();
  },

  // ── Step 7: Nomor Paspor ───────────────────────────────────────
  async (ctx) => {
    const text = getMessageText(ctx);
    if (!text) {
      await ctx.reply("⚠️ Mohon masukkan Nomor Paspor dalam bentuk teks.");
      return;
    }
    getWizardData(ctx).nomor_paspor = text.trim();
    await ctx.reply("💼 Masukkan <b>Jabatan</b> jamaah:", { parse_mode: "HTML" });
    return ctx.wizard.next();
  },

  // ── Step 8: Jabatan ────────────────────────────────────────────
  async (ctx) => {
    const text = getMessageText(ctx);
    if (!text) {
      await ctx.reply("⚠️ Mohon masukkan Jabatan dalam bentuk teks.");
      return;
    }
    getWizardData(ctx).jabatan = text.trim();
    await ctx.reply("🕌 Masukkan <b>Nama KBIHU</b>:", { parse_mode: "HTML" });
    return ctx.wizard.next();
  },

  // ── Step 9: Nama KBIHU & Simpan Data ──────────────────────────
  async (ctx) => {
    const text = getMessageText(ctx);
    if (!text) {
      await ctx.reply("⚠️ Mohon masukkan Nama KBIHU dalam bentuk teks.");
      return;
    }
    const wizardData = getWizardData(ctx);
    wizardData.nama_kbihu = text.trim();

    // Simpan ke Supabase
    const jamaahData = {
      nomor_porsi: wizardData.nomor_porsi!,
      nama_lengkap: wizardData.nama_lengkap!,
      nama_ayah: wizardData.nama_ayah!,
      tgl_lahir: wizardData.tgl_lahir!,
      jenis_kelamin: wizardData.jenis_kelamin!,
      alamat: wizardData.alamat!,
      nomor_paspor: wizardData.nomor_paspor!,
      jabatan: wizardData.jabatan!,
      nama_kbihu: wizardData.nama_kbihu!,
    };

    const { error } = await supabase.from("jamaah").insert(jamaahData);

    if (error) {
      await ctx.reply(
        "❌ <b>Error:</b> Gagal menyimpan data ke database.\n" +
          `Detail: <code>${escapeHtml(error.message)}</code>`,
        { parse_mode: "HTML" }
      );
      console.error("Supabase insert error:", error);
      return ctx.scene.leave();
    }

    await ctx.reply(formatJamaahSummary(jamaahData), { parse_mode: "HTML" });
    await ctx.reply(
      "📎 <b>Upload Dokumen</b>\n\n" +
        "Sekarang silakan kirim file dokumen (Foto/PDF) pertama Anda.\n" +
        "Atau ketik /end jika tidak ada dokumen yang ingin di-upload.",
      { parse_mode: "HTML" }
    );
    return ctx.wizard.next();
  },

  // ── Step 10: Terima File Dokumen ───────────────────────────────
  async (ctx) => {
    const text = getMessageText(ctx);

    // Cek /end command
    if (text === "/end") {
      await ctx.reply(
        "✅ <b>Rekap Selesai!</b>\n\n" +
          "Semua data jamaah telah berhasil disimpan.\n" +
          "Terima kasih! 🙏",
        { parse_mode: "HTML" }
      );
      ctx.session.wizardData = {};
      return ctx.scene.leave();
    }

    // Cek apakah ada file (photo atau document)
    let fileId: string | undefined;
    let fileName: string | undefined;

    if (ctx.message && "document" in ctx.message && ctx.message.document) {
      fileId = ctx.message.document.file_id;
      fileName = ctx.message.document.file_name || "dokumen.bin";
    } else if (ctx.message && "photo" in ctx.message && ctx.message.photo) {
      const photos = ctx.message.photo;
      const largestPhoto = photos[photos.length - 1];
      fileId = largestPhoto.file_id;
      fileName = "photo.jpg";
    }

    if (!fileId) {
      await ctx.reply(
        "⚠️ Mohon kirim file dokumen (Foto atau PDF).\n" +
          "Atau ketik /end jika sudah selesai.",
        { parse_mode: "HTML" }
      );
      return;
    }

    // Simpan file info ke wizard data
    const wizardData = getWizardData(ctx);
    wizardData.pendingFileId = fileId;
    wizardData.pendingFileName = fileName;

    // Tampilkan inline keyboard untuk pilihan jenis dokumen
    await ctx.reply(
      "📄 <b>Jenis Dokumen</b>\n\nIni dokumen apa?",
      {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback("🪪 KTP", "doc_KTP"),
            Markup.button.callback("🛂 Paspor", "doc_Paspor"),
          ],
          [
            Markup.button.callback("💳 Bukti Bayar", "doc_Bukti_Bayar"),
            Markup.button.callback("📄 Lainnya", "doc_Lainnya"),
          ],
        ]),
      }
    );
    return ctx.wizard.next();
  },

  // ── Step 11: Terima Jenis Dokumen & Download ───────────────────
  async (ctx) => {
    let jenisDokumen: string | undefined;

    // Handle callback query
    if (ctx.callbackQuery && "data" in ctx.callbackQuery) {
      await ctx.answerCbQuery();
      const cbData = ctx.callbackQuery.data;

      if (cbData.startsWith("doc_")) {
        jenisDokumen = cbData.replace("doc_", "").replace(/_/g, " ");
        await ctx.editMessageText(`📄 Jenis Dokumen: <b>${escapeHtml(jenisDokumen)}</b>`, {
          parse_mode: "HTML",
        });
      }
    }

    // Handle text input (jika user mengetik manual, misal untuk "Lainnya")
    if (!jenisDokumen) {
      const text = getMessageText(ctx);
      if (text) {
        jenisDokumen = text.trim();
      }
    }

    if (!jenisDokumen) {
      await ctx.reply("⚠️ Silakan pilih atau ketik jenis dokumen.");
      return;
    }

    const wizardData = getWizardData(ctx);
    const fileId = wizardData.pendingFileId;
    const fileName = wizardData.pendingFileName || "dokumen.bin";
    const nomorPorsi = wizardData.nomor_porsi!;

    if (!fileId) {
      await ctx.reply("❌ Terjadi error: data file tidak ditemukan. Silakan kirim ulang file.");
      // Kembali ke step terima file
      ctx.wizard.back();
      return;
    }

    // Upload file ke Supabase Storage
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
      // Kembali ke step terima file agar user bisa coba lagi
      ctx.wizard.back();
      return;
    }

    // Simpan metadata ke Supabase
    const namaFile = `${nomorPorsi}_${jenisDokumen.replace(/\s+/g, "_")}${getExtFromName(fileName)}`;
    const { error } = await supabase.from("dokumen").insert({
      nomor_porsi: nomorPorsi,
      jenis_dokumen: jenisDokumen,
      nama_file: namaFile,
    });

    if (error) {
      await ctx.reply(
        `❌ <b>Gagal menyimpan metadata dokumen:</b>\n<code>${escapeHtml(error.message)}</code>`,
        { parse_mode: "HTML" }
      );
      console.error("Supabase dokumen insert error:", error);
    } else {
      await ctx.reply(
        `✅ Dokumen <b>${escapeHtml(jenisDokumen)}</b> berhasil disimpan!`,
        { parse_mode: "HTML" }
      );
    }

    // Reset pending file
    wizardData.pendingFileId = undefined;
    wizardData.pendingFileName = undefined;

    // Tanya apakah ada dokumen lain
    await ctx.reply(
      "📎 Apakah ada dokumen lain yang ingin di-upload?\n\n" +
        "Silakan kirim file berikutnya, atau ketik /end jika sudah selesai.",
      {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("📤 Upload Dokumen Lagi", "upload_more")],
          [Markup.button.callback("✅ Selesai", "upload_done")],
        ]),
      }
    );

    // Kembali ke step terima file (step 10)
    ctx.wizard.back();
    return;
  }
);

// ─── Handle callback untuk Selesai / Upload Lagi ───────────────────

rekapScene.action("upload_more", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.editMessageText(
    "📎 Silakan kirim file dokumen berikutnya.",
    { parse_mode: "HTML" }
  );
});

rekapScene.action("upload_done", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.editMessageText(
    "✅ <b>Rekap Selesai!</b>\n\n" +
      "Semua data jamaah telah berhasil disimpan.\n" +
      "Terima kasih! 🙏",
    { parse_mode: "HTML" }
  );
  ctx.session.wizardData = {};
  await ctx.scene.leave();
});

// ─── Handle /end di dalam scene ────────────────────────────────────

rekapScene.command("end", async (ctx) => {
  await ctx.reply(
    "✅ <b>Rekap Selesai!</b>\n\n" +
      "Semua data jamaah telah berhasil disimpan.\n" +
      "Terima kasih! 🙏",
    { parse_mode: "HTML" }
  );
  ctx.session.wizardData = {};
  await ctx.scene.leave();
});

// ─── Utility ───────────────────────────────────────────────────────

function getExtFromName(name: string): string {
  const dotIndex = name.lastIndexOf(".");
  if (dotIndex === -1) return ".bin";
  return name.substring(dotIndex);
}
