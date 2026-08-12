import type { Jamaah } from "../types";

// ─── HTML Escaping ─────────────────────────────────────────────────

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Format Jamaah Detail ──────────────────────────────────────────

export function formatJamaahDetail(data: Jamaah): string {
  return [
    `📋 <b>Data Jamaah Haji</b>`,
    ``,
    `🔢 <b>Nomor Porsi:</b> <code>${escapeHtml(data.nomor_porsi)}</code>`,
    `👤 <b>Nama Lengkap:</b> ${escapeHtml(data.nama_lengkap)}`,
    `👨 <b>Nama Ayah:</b> ${escapeHtml(data.nama_ayah)}`,
    `📅 <b>Tanggal Lahir:</b> ${escapeHtml(data.tgl_lahir)}`,
    `⚧ <b>Jenis Kelamin:</b> ${escapeHtml(data.jenis_kelamin)}`,
    `🏠 <b>Alamat:</b> ${escapeHtml(data.alamat)}`,
    `🛂 <b>Nomor Paspor:</b> <code>${escapeHtml(data.nomor_paspor)}</code>`,
    `💼 <b>Jabatan:</b> ${escapeHtml(data.jabatan)}`,
    `🕌 <b>Nama KBIHU:</b> ${escapeHtml(data.nama_kbihu)}`,
  ].join("\n");
}

// ─── Format Ringkasan Singkat ──────────────────────────────────────

export function formatJamaahSummary(data: Jamaah): string {
  return [
    `✅ <b>Data berhasil disimpan!</b>`,
    ``,
    `🔢 Nomor Porsi: <code>${escapeHtml(data.nomor_porsi)}</code>`,
    `👤 Nama: ${escapeHtml(data.nama_lengkap)}`,
    `🛂 Paspor: <code>${escapeHtml(data.nomor_paspor)}</code>`,
  ].join("\n");
}
