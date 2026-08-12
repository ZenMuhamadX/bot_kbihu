import { Context, Scenes } from "telegraf";

// ─── Database Models ───────────────────────────────────────────────

export interface Jamaah {
  nomor_porsi: string;
  nama_lengkap: string;
  nama_ayah: string;
  tgl_lahir: string; // format: YYYY-MM-DD
  jenis_kelamin: string;
  alamat: string;
  nomor_paspor: string;
  jabatan: string;
  nama_kbihu: string;
}

export interface Dokumen {
  id?: string; // UUID, auto-generated
  nomor_porsi: string;
  jenis_dokumen: string;
  nama_file: string;
  storage_path?: string; // path di Supabase Storage
}

// ─── Session & Context ─────────────────────────────────────────────

export interface WizardData {
  nomor_porsi?: string;
  nama_lengkap?: string;
  nama_ayah?: string;
  tgl_lahir?: string;
  jenis_kelamin?: string;
  alamat?: string;
  nomor_paspor?: string;
  jabatan?: string;
  nama_kbihu?: string;
  // Upload state
  pendingFileId?: string;
  pendingFileName?: string;
  pendingFileUniqueId?: string;
}

export interface SessionData extends Scenes.WizardSession<Scenes.WizardSessionData> {
  isAuthenticated?: boolean;
  awaitingPassword?: boolean;
  wizardData?: WizardData;
  updateNomorPorsi?: string;
}

export interface BotContext extends Context {
  session: SessionData;
  scene: Scenes.SceneContextScene<BotContext, Scenes.WizardSessionData>;
  wizard: Scenes.WizardContextWizard<BotContext>;
}
