import { Scenes, Markup } from "telegraf";
import type { BotContext } from "../types";
import { supabase } from "../supabase";
import { escapeHtml } from "../utils/format";

// ─── Helper ────────────────────────────────────────────────────────

function getMessageText(ctx: BotContext): string | undefined {
  return ctx.message && "text" in ctx.message ? ctx.message.text : undefined;
}

// ─── Field definitions ─────────────────────────────────────────────

const FIELDS = [
  { key: "nama_lengkap", label: "Nama Lengkap", emoji: "👤" },
  { key: "nama_ayah", label: "Nama Ayah", emoji: "👨" },
  { key: "tgl_lahir", label: "Tanggal Lahir (YYYY-MM-DD)", emoji: "📅" },
  { key: "jenis_kelamin", label: "Jenis Kelamin (L/P)", emoji: "⚧" },
  { key: "alamat", label: "Alamat", emoji: "🏠" },
  { key: "nomor_paspor", label: "Nomor Paspor", emoji: "🛂" },
  { key: "jabatan", label: "Jabatan", emoji: "💼" },
  { key: "nama_kbihu", label: "Nama KBIHU", emoji: "🕌" },
] as const;

type FieldKey = (typeof FIELDS)[number]["key"];

// ─── Update Text Scene ────────────────────────────────────────────

export const updateTextScene = new Scenes.WizardScene<BotContext>(
  "update-text-wizard",

  // ── Step 0: Tampilkan data saat ini & mulai update ─────────────
  async (ctx) => {
    const nomorPorsi = ctx.session.updateNomorPorsi;
    if (!nomorPorsi) {
      await ctx.reply("❌ Nomor Porsi tidak ditemukan. Silakan mulai ulang.");
      return ctx.scene.leave();
    }

    // Fetch current data
    const { data, error } = await supabase
      .from("jamaah")
      .select("*")
      .eq("nomor_porsi", nomorPorsi)
      .single();

    if (error || !data) {
      await ctx.reply("❌ Gagal mengambil data jamaah dari database.");
      return ctx.scene.leave();
    }

    // Store current data
    ctx.session.wizardData = {
      nomor_porsi: nomorPorsi,
      nama_lengkap: data.nama_lengkap,
      nama_ayah: data.nama_ayah,
      tgl_lahir: data.tgl_lahir,
      jenis_kelamin: data.jenis_kelamin,
      alamat: data.alamat,
      nomor_paspor: data.nomor_paspor,
      jabatan: data.jabatan,
      nama_kbihu: data.nama_kbihu,
    };

    let msg = `✏️ <b>Update Data Jamaah</b>\n\n`;
    msg += `🔢 Nomor Porsi: <code>${escapeHtml(nomorPorsi)}</code>\n\n`;
    msg += `<b>Data saat ini:</b>\n`;

    for (const field of FIELDS) {
      const value = data[field.key] || "-";
      msg += `${field.emoji} ${field.label}: <b>${escapeHtml(String(value))}</b>\n`;
    }

    msg += `\n<i>Kirim nilai baru untuk setiap field.\nKetik <code>-</code> untuk melewati (tidak mengubah).</i>\n`;
    msg += `\n${FIELDS[0].emoji} Masukkan <b>${FIELDS[0].label}</b> baru:`;

    await ctx.reply(msg, { parse_mode: "HTML" });
    return ctx.wizard.next();
  },

  // Steps 1-8: Each field update
  ...FIELDS.map((field, index) => {
    return async (ctx: BotContext) => {
      const text = getMessageText(ctx);
      if (!text) {
        await ctx.reply(`⚠️ Mohon masukkan ${field.label} dalam bentuk teks, atau ketik <code>-</code> untuk skip.`, {
          parse_mode: "HTML",
        });
        return;
      }

      const value = text.trim();

      // Validasi tanggal lahir
      if (field.key === "tgl_lahir" && value !== "-") {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(value)) {
          await ctx.reply(
            "⚠️ Format tanggal tidak valid. Gunakan <b>YYYY-MM-DD</b> atau ketik <code>-</code> untuk skip.",
            { parse_mode: "HTML" }
          );
          return;
        }
      }

      // Validasi jenis kelamin
      if (field.key === "jenis_kelamin" && value !== "-") {
        const lower = value.toLowerCase();
        if (!["l", "p", "laki-laki", "perempuan"].includes(lower)) {
          await ctx.reply(
            "⚠️ Ketik <b>L</b> (Laki-laki) atau <b>P</b> (Perempuan), atau <code>-</code> untuk skip.",
            { parse_mode: "HTML" }
          );
          return;
        }
      }

      // Update wizard data if not skipped
      if (value !== "-") {
        let finalValue = value;
        if (field.key === "jenis_kelamin") {
          const lower = value.toLowerCase();
          finalValue = lower === "l" || lower === "laki-laki" ? "Laki-laki" : "Perempuan";
        }
        (ctx.session.wizardData as any)[field.key] = finalValue;
      }

      // Check if this is the last field
      const nextIndex = index + 1;
      if (nextIndex < FIELDS.length) {
        const nextField = FIELDS[nextIndex];
        const currentVal = (ctx.session.wizardData as any)?.[nextField.key] || "-";
        await ctx.reply(
          `${nextField.emoji} Masukkan <b>${nextField.label}</b> baru:\n` +
            `<i>Saat ini: ${escapeHtml(String(currentVal))}</i>`,
          { parse_mode: "HTML" }
        );
        return ctx.wizard.next();
      }

      // Last field — save to database
      const wizardData = ctx.session.wizardData!;
      const updatePayload: Record<string, string> = {};

      for (const f of FIELDS) {
        const val = (wizardData as any)[f.key];
        if (val) {
          updatePayload[f.key] = val;
        }
      }

      const { error } = await supabase
        .from("jamaah")
        .update(updatePayload)
        .eq("nomor_porsi", wizardData.nomor_porsi!);

      if (error) {
        await ctx.reply(
          `❌ <b>Gagal memperbarui data:</b>\n<code>${escapeHtml(error.message)}</code>`,
          { parse_mode: "HTML" }
        );
        console.error("Supabase update error:", error);
      } else {
        await ctx.reply(
          "✅ <b>Data berhasil diperbarui!</b>\n\n" +
            `Nomor Porsi: <code>${escapeHtml(wizardData.nomor_porsi!)}</code>\n` +
            "Gunakan /cari untuk melihat data terbaru.",
          { parse_mode: "HTML" }
        );
      }

      ctx.session.wizardData = {};
      return ctx.scene.leave();
    };
  })
);
