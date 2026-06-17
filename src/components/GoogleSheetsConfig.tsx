/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  FileSpreadsheet, 
  Settings, 
  HelpCircle, 
  Copy, 
  Check, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle,
  Code,
  Link2,
  ClipboardList,
  UserPlus,
  ShieldCheck,
  Trash2,
  Lock,
  MessageSquare,
  Phone
} from 'lucide-react';
import { SheetsConfig, Ustadz } from '../types';

interface GoogleSheetsConfigProps {
  config: SheetsConfig;
  onSaveConfig: (newConfig: SheetsConfig) => void;
  onSync: () => Promise<void>;
  isSyncing: boolean;
  ustadzList: Ustadz[];
  onAddUstadz: (newU: Ustadz) => void;
  onDeleteUstadz: (username: string) => void;
  currentUstadz: Ustadz | null;
  onLogoutUstadz: () => void;
}

export const DEFAULT_WALI_TEMPLATE = `*LAPORAN PERSETUJUAN IZIN KELUAR SANTRI*
 
Assalamu'alaikum Wr. Wb.
Berikut disampaikan rincian data perizinan santri Pondok Pesantren:
 
• *Nama Santri*: {{nama}}
• *Kelas*: {{kelas}}
• *Asrama*: {{asrama}}
• *Jenis Izin*: {{jenis_izin}}
• *Keperluan*: "{{keperluan}}"
• *Mulai Izin*: {{mulai}}
• *Batas Kembali*: {{selesai}} pukul {{jam_kembali}} WIB
• *Penangung Jawab/Wali*: {{wali}}
• *Kontak Wali*: {{kontak_wali}}
• *Status*: 🟢 DISETUJUI
 
Mohon bimbingan pengawasan dari wali santri agar santri dapat kembali tepat waktu. Sebagai peringatan, santri yang terlambat melebihi batas jam kepulangan sebanyak 3 kali dalam sebulan akan otomatis terkena sanksi BLACKLIST sistem perizinan. Terima kasih jazaakumullah khairan.
 
Wassalamu'alaikum Wr. Wb.
_Kantor Pengasuhan Pondok Pesantren_`;

export const DEFAULT_SATPAM_TEMPLATE = `*PEMBERITAHUAN IZIN SANTRI UNTUK SATPAM / POS GERBANG*
 
Yth. Petugas Keamanan / Satpam,
Berikut dilaporkan data santri yang sedang diizinkan keluar asrama:
 
• *Nama*: {{nama}}
• *Kelas*: {{kelas}}
• *ID Perizinan*: {{id}}
• *Jenis Izin*: {{jenis_izin}}
• *Keperluan*: "{{keperluan}}"
• *Mulai Izin*: {{mulai}}
• *Batas Kembali*: {{selesai}} pukul {{jam_kembali}} WIB
• *Wali Santri*: {{wali}}
• *Kontak Wali*: {{kontak_wali}}
• *Status*: SEDANG DI LUAR PONDOK
 
Mohon verifikasi kepulangan santri ketika kembali ke asrama melalui aplikasi E-Zen. Ingatkan wali santri untuk mengawal kepulangan tepat waktu karena terlambat 3 kali akan terkena blacklist sistem perizinan.`;

export const DEFAULT_GROUP_TEMPLATE = `*INFORMASI PERIZINAN SANTRI (GRUP KESANTRIAN)*
 
Assalamu'alaikum Wr. Wb.
Menginfokan data perizinan santri aktif berikut:
 
• *Nama Santri*: {{nama}}
• *Kelas*: {{kelas}}
• *Jenis Izin*: {{jenis_izin}}
• *Keperluan*: "{{keperluan}}"
• *Batas Kembali*: {{selesai}} pukul {{jam_kembali}} WIB
• *Status*: 🟢 DISETUJUI / SEDANG BERJALAN
 
Dimohon kepada wali santri dan pihak terkait untuk mengawal kepulangan santri tepat waktu sesuai batas izin. Keterlambatan mengembalikan santri sebanyak 3 kali akan mengakibatkan santri masuk ke daftar hitam (blacklist) perizinan. Syukron.
 
Wassalamu'alaikum Wr. Wb.
_Kantor Pengasuhan Pondok Pesantren_`;

export default function GoogleSheetsConfig({ 
  config, 
  onSaveConfig, 
  onSync, 
  isSyncing,
  ustadzList,
  onAddUstadz,
  onDeleteUstadz,
  currentUstadz,
  onLogoutUstadz
}: GoogleSheetsConfigProps) {
  const [sheetUrl, setSheetUrl] = useState(config.sheetUrl);
  const [appsScriptUrl, setAppsScriptUrl] = useState(config.appsScriptUrl);
  const [whatsappGroupLink, setWhatsappGroupLink] = useState(config.whatsappGroupLink || '');
  const [useWhatsAppGroup, setUseWhatsAppGroup] = useState(!!config.useWhatsAppGroup);
  const [satpamPhone, setSatpamPhone] = useState(config.satpamPhone || '');
  const [satpamName, setSatpamName] = useState(config.satpamName || '');
  const [satpamPhone2, setSatpamPhone2] = useState(config.satpamPhone2 || '');
  const [satpamName2, setSatpamName2] = useState(config.satpamName2 || '');
  const [satpamPhone3, setSatpamPhone3] = useState(config.satpamPhone3 || '');
  const [satpamName3, setSatpamName3] = useState(config.satpamName3 || '');
  const [satpamPhone4, setSatpamPhone4] = useState(config.satpamPhone4 || '');
  const [satpamName4, setSatpamName4] = useState(config.satpamName4 || '');
  const [satpamPhone5, setSatpamPhone5] = useState(config.satpamPhone5 || '');
  const [satpamName5, setSatpamName5] = useState(config.satpamName5 || '');
  
  const [waTemplateWali, setWaTemplateWali] = useState(config.waTemplateWali || DEFAULT_WALI_TEMPLATE);
  const [waTemplateSatpam, setWaTemplateSatpam] = useState(config.waTemplateSatpam || DEFAULT_SATPAM_TEMPLATE);
  const [waTemplateGroup, setWaTemplateGroup] = useState(config.waTemplateGroup || DEFAULT_GROUP_TEMPLATE);

  const [copiedScript, setCopiedScript] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Ustadz registration states
  const [regUsername, setRegUsername] = useState('');
  const [regName, setRegName] = useState('');
  const [regPasscode, setRegPasscode] = useState('');
  const [regSuccess, setRegSuccess] = useState<string | null>(null);
  const [regError, setRegError] = useState<string | null>(null);

  // Extract sheet ID from standard Google Sheet URL
  const extractSheetId = (url: string): string => {
    const matches = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return matches && matches[1] ? matches[1] : '';
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(false);
    setErrorMsg(null);

    if (sheetUrl.trim() && !sheetUrl.includes('docs.google.com/spreadsheets')) {
      setErrorMsg('Tautan Google Sheet tidak valid. Masukkan teks URL spreadsheets yang benar.');
      return;
    }

    const sheetId = sheetUrl.trim() ? extractSheetId(sheetUrl) : '';

    onSaveConfig({
      sheetUrl: sheetUrl.trim(),
      sheetId,
      apiKey: '',
      appsScriptUrl: appsScriptUrl.trim(),
      syncEnabled: !!sheetId,
      whatsappGroupLink: whatsappGroupLink.trim(),
      useWhatsAppGroup,
      satpamPhone: satpamPhone.trim(),
      satpamName: satpamName.trim(),
      satpamPhone2: satpamPhone2.trim(),
      satpamName2: satpamName2.trim(),
      satpamPhone3: satpamPhone3.trim(),
      satpamName3: satpamName3.trim(),
      satpamPhone4: satpamPhone4.trim(),
      satpamName4: satpamName4.trim(),
      satpamPhone5: satpamPhone5.trim(),
      satpamName5: satpamName5.trim(),
      waTemplateWali: waTemplateWali.trim(),
      waTemplateSatpam: waTemplateSatpam.trim(),
      waTemplateGroup: waTemplateGroup.trim(),
    });

    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleRegisterUstadz = (e: React.FormEvent) => {
    e.preventDefault();
    setRegSuccess(null);
    setRegError(null);

    const cleanUsername = regUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!cleanUsername) {
      setRegError('Username tidak valid. Gunakan huruf kecil dan angka saja.');
      return;
    }

    if (ustadzList.some(u => u.username === cleanUsername)) {
      setRegError('Username Ustadz tersebut sudah terdaftar.');
      return;
    }

    if (!regName.trim() || !regPasscode.trim()) {
      setRegError('Nama Lengkap & PIN Keamanan wajib diisi.');
      return;
    }

    if (regPasscode.length < 4) {
      setRegError('PIN Rahasia minimal 4 karakter demi keamanan.');
      return;
    }

    onAddUstadz({
      username: cleanUsername,
      name: regName.trim(),
      passcode: regPasscode.trim()
    });

    setRegSuccess(`Sukses mendaftarkan ${regName.trim()} (${cleanUsername}) sebagai ustadz baru!`);
    setRegUsername('');
    setRegName('');
    setRegPasscode('');
    setTimeout(() => setRegSuccess(null), 4000);
  };

  // Google Apps Script source code
  const appsScriptCode = `// 1. Buka Google Sheet Anda
// 2. Klik menu 'Extensions' -> 'Apps Script'
// 3. Hapus semua baris teks default, lalu tempelkan kode di bawah ini:

function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getDataRange().getValues();
  var result = [];
  
  // Asumsi baris 1 adalah header
  var headers = data[0];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j];
    }
    result.push(obj);
  }
  
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  
  try {
    var rawData = e.postData.contents;
    var payload = JSON.parse(rawData);
    
    // Header format yang disinkronkan:
    // id, studentId, studentName, className, roomName, guardianName, guardianPhone, leaveType, reason, startDate, endDate, status, createdAt
    
    sheet.appendRow([
      payload.id,
      payload.studentId,
      payload.studentName,
      payload.className,
      payload.roomName,
      payload.guardianName,
      payload.guardianPhone,
      payload.leaveType,
      payload.reason,
      payload.startDate,
      payload.endDate,
      payload.status,
      payload.createdAt
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Data perizinan berhasil disimpan di Sheet" }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeader("Access-Control-Allow-Origin", "*");
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeader("Access-Control-Allow-Origin", "*");
  }
}
`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(appsScriptCode);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      
      {/* Configuration Form & Active Ustadz Banner */}
      <div className="lg:col-span-3 space-y-6">
        
        {/* Active Ustadz session control banner card */}
        {currentUstadz && (
          <div className="bg-red-900 text-white rounded-xl p-4 flex justify-between items-center shadow-xs">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-white/10 rounded-lg text-red-200">
                <ShieldCheck className="w-5 h-5" />
              </span>
              <div>
                <span className="text-[10px] text-red-200 uppercase tracking-wider block font-bold">Ustadz Aktif Login</span>
                <span className="text-xs font-bold block">{currentUstadz.name} (@{currentUstadz.username})</span>
              </div>
            </div>
            <button
              onClick={() => {
                if (window.confirm('Keluar dari sesi administrator Ustadz ini?')) {
                  onLogoutUstadz();
                }
              }}
              className="text-xs bg-red-950/50 hover:bg-red-950 px-3 py-1.5 font-bold rounded-lg transition-colors cursor-pointer text-red-200"
            >
              Keluar Sesi (Logout)
            </button>
          </div>
        )}

        {/* Sync config form */}
        <div className="bg-white rounded-xl border border-red-100 p-6 md:p-7 shadow-xs space-y-5">
          <div className="border-b border-gray-100 pb-3 flex justify-between items-center">
            <div>
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <Settings className="w-4.5 h-4.5 text-red-800" />
                Integrasi Database Google Sheets
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Sambungkan spreadsheets Google Sheet Anda sebagai database perizinan santri.</p>
            </div>
            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-sm border ${
              config.syncEnabled ? 'bg-red-50 border-red-200 text-red-700' : 'bg-gray-50 border-gray-100 text-gray-400'
            }`}>
              {config.syncEnabled ? '🔗 Terhubung' : '🔌 Belum Terhubung'}
            </span>
          </div>

          {saved && (
            <div className="p-3 bg-red-50 border border-red-100 text-red-800 rounded-lg text-xs font-semibold flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-red-650" />
              Konfigurasi tautan berhasil disimpan ke local storage!
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-100 text-rose-800 rounded-lg text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-750 mb-1.5 flex items-center gap-1">
                <Link2 className="w-4 h-4 text-gray-400" />
                Tautan Google Sheets (Spreadsheet URL)
              </label>
              <input
                type="text"
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-220 rounded-lg text-xs focus:outline-hidden focus:border-red-600 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-750 mb-1.5 flex items-center gap-1">
                <Code className="w-4 h-4 text-gray-400" />
                Tautan Web App Google Apps Script
              </label>
              <input
                type="text"
                value={appsScriptUrl}
                onChange={(e) => setAppsScriptUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-220 rounded-lg text-xs focus:outline-hidden focus:border-red-600 transition-colors"
              />
              <span className="text-[10px] text-gray-450 mt-1 block">Silakan ikuti panduan naskah kode di panel sebelah kanan untuk pengerjaan Script.</span>
            </div>

            <div className="border-t border-red-50 pt-4 mt-3 space-y-3.5">
              <h3 className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-emerald-600" />
                Setelan Pengiriman Berita / Notifikasi WhatsApp
              </h3>
              
              <div>
                <label className="block text-xs font-semibold text-gray-750 mb-1.5 flex items-center gap-1">
                  <Link2 className="w-4 h-4 text-gray-400" />
                  Tautan Grup WhatsApp (WhatsApp Group Link)
                </label>
                <input
                  type="text"
                  value={whatsappGroupLink}
                  onChange={(e) => setWhatsappGroupLink(e.target.value)}
                  placeholder="https://chat.whatsapp.com/GoupID..."
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-220 rounded-lg text-xs focus:outline-hidden focus:border-red-650 transition-colors"
                />
                <span className="text-[10px] text-gray-450 mt-1 block leading-normal">
                  Jika tautan grup diisi, admin dapat langsung membagikan pesan perizinan santri ke grup WhatsApp (seperti grup wali santri atau grup pengajar) terutama apabila nomor WhatsApp pribadi wali dikosongkan.
                </span>
              </div>

              <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-dashed border-red-200">
                <span className="block text-xs font-bold text-red-800 flex items-center gap-1.5 uppercase tracking-wider mb-2">
                  <Phone className="w-4 h-4 text-red-650 shrink-0" />
                  Daftar No. WA Satpam / Pos Gerbang (Maksimal 5 Pos / Pilihan)
                </span>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4">
                  {/* Pos 1 */}
                  <div className="p-3 bg-white border border-slate-200/60 rounded-lg space-y-2">
                    <span className="block text-[10px] font-black text-red-700 uppercase tracking-widest">
                      Satpam / Pos 1 (Utama Bawaan)
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Nomor WA</label>
                        <input
                          type="text"
                          value={satpamPhone}
                          onChange={(e) => setSatpamPhone(e.target.value)}
                          placeholder="Contoh: 081234567890"
                          className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs focus:outline-hidden focus:border-red-650 transition-colors font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Nama Satpam</label>
                        <input
                          type="text"
                          value={satpamName}
                          onChange={(e) => setSatpamName(e.target.value)}
                          placeholder="Contoh: Pak Slamet"
                          className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs focus:outline-hidden focus:border-red-650 transition-colors"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Pos 2 */}
                  <div className="p-3 bg-white border border-slate-200/60 rounded-lg space-y-2">
                    <span className="block text-[10px] font-black text-slate-700 uppercase tracking-widest">
                      Satpam / Pos 2 (Tambahan)
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Nomor WA</label>
                        <input
                          type="text"
                          value={satpamPhone2}
                          onChange={(e) => setSatpamPhone2(e.target.value)}
                          placeholder="Contoh: 081234567891"
                          className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs focus:outline-hidden focus:border-red-650 transition-colors font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Nama Satpam</label>
                        <input
                          type="text"
                          value={satpamName2}
                          onChange={(e) => setSatpamName2(e.target.value)}
                          placeholder="Contoh: Pak Widodo"
                          className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs focus:outline-hidden focus:border-red-650 transition-colors"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Pos 3 */}
                  <div className="p-3 bg-white border border-slate-200/60 rounded-lg space-y-2">
                    <span className="block text-[10px] font-black text-slate-700 uppercase tracking-widest">
                      Satpam / Pos 3 (Tambahan)
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Nomor WA</label>
                        <input
                          type="text"
                          value={satpamPhone3}
                          onChange={(e) => setSatpamPhone3(e.target.value)}
                          placeholder="Contoh: 081234567892"
                          className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs focus:outline-hidden focus:border-red-650 transition-colors font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Nama Satpam</label>
                        <input
                          type="text"
                          value={satpamName3}
                          onChange={(e) => setSatpamName3(e.target.value)}
                          placeholder="Contoh: Pak Junaedi"
                          className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs focus:outline-hidden focus:border-red-650 transition-colors"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Pos 4 */}
                  <div className="p-3 bg-white border border-slate-200/60 rounded-lg space-y-2">
                    <span className="block text-[10px] font-black text-slate-700 uppercase tracking-widest">
                      Satpam / Pos 4 (Tambahan)
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Nomor WA</label>
                        <input
                          type="text"
                          value={satpamPhone4}
                          onChange={(e) => setSatpamPhone4(e.target.value)}
                          placeholder="Contoh: 081234567893"
                          className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs focus:outline-hidden focus:border-red-650 transition-colors font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Nama Satpam</label>
                        <input
                          type="text"
                          value={satpamName4}
                          onChange={(e) => setSatpamName4(e.target.value)}
                          placeholder="Contoh: Pak Rudi"
                          className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs focus:outline-hidden focus:border-red-650 transition-colors"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Pos 5 */}
                  <div className="p-3 bg-white border border-slate-200/60 rounded-lg space-y-2 col-span-1 md:col-span-2">
                    <span className="block text-[10px] font-black text-slate-700 uppercase tracking-widest">
                      Satpam / Pos 5 (Tambahan)
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Nomor WA</label>
                        <input
                          type="text"
                          value={satpamPhone5}
                          onChange={(e) => setSatpamPhone5(e.target.value)}
                          placeholder="Contoh: 081234567894"
                          className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs focus:outline-hidden focus:border-red-650 transition-colors font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Nama Satpam</label>
                        <input
                          type="text"
                          value={satpamName5}
                          onChange={(e) => setSatpamName5(e.target.value)}
                          placeholder="Contoh: Pak Hendra"
                          className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs focus:outline-hidden focus:border-red-650 transition-colors"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                
                <span className="text-[10px] text-gray-450 mt-1 block leading-normal">
                  Sistem menyimpan nomor-nomor Pos Satpam pesantren ini sebagai opsi pintasan cepat pengisian No. Wali pada formulir perizinan. Jika nomor terpilih, data wali diatur kosong atau "-" pada rincian database, log izin, maupun salinan perpesanan WhatsApp.
                </span>
              </div>

              {/* WHATSAPP MESSAGE TEMPLATES SETTINGS */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 md:p-5 space-y-4 text-left">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-emerald-100 text-emerald-800 rounded-md text-xs">💬</span>
                  <div>
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                      Pengaturan Template Pesan WhatsApp
                    </h3>
                    <p className="text-[10px] text-slate-405 font-semibold mt-0.5">Sudah mendukung pesan peringatan datang tepat waktu & blacklist otomatis rute keterlambatan 3 kali.</p>
                  </div>
                </div>

                <div className="text-[9px] bg-white border border-slate-200/65 text-slate-600 p-3 rounded-lg leading-relaxed space-y-2">
                  <span className="font-bold text-slate-800 block">Daftar Tag Placeholder Dinamis yang Tersedia:</span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 font-mono font-bold text-slate-700">
                    <div>{"{{id}}"} : ID Izin</div>
                    <div>{"{{nama}}"} : Nama Santri</div>
                    <div>{"{{kelas}}"} : Kelas</div>
                    <div>{"{{asrama}}"} : Asrama</div>
                    <div>{"{{jenis_izin}}"} : Jenis Izin</div>
                    <div>{"{{keperluan}}"} : Keperluan</div>
                    <div>{"{{mulai}}"} : Mulai Izin</div>
                    <div>{"{{selesai}}"} : Batas Izin</div>
                    <div>{"{{jam_kembali}}"} : Jam Kembali</div>
                    <div>{"{{wali}}"} : Nama Wali</div>
                    <div>{"{{kontak_wali}}"} : Kontak Wali</div>
                    <div>{"{{status}}"} : Status Izin</div>
                  </div>
                  <p className="text-[8.5px] text-slate-400 border-t border-slate-100 pt-1.5 font-sans leading-normal">Sistem akan otomatis mengganti tag di atas dengan rincian data perizinan riil ketika tombol WA ditekan.</p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {/* Wali Template */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center justify-between">
                      <span>1. Template Pesan untuk Wali Santri (Personal)</span>
                      <span className="text-[8px] text-emerald-600 uppercase bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 font-bold font-mono">Wali Santri</span>
                    </label>
                    <textarea
                      value={waTemplateWali}
                      onChange={(e) => setWaTemplateWali(e.target.value)}
                      rows={6}
                      className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:border-red-650 font-mono text-slate-850 leading-relaxed"
                      placeholder="Masukkan template pesan wali..."
                    />
                  </div>

                  {/* Satpam Template */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center justify-between">
                      <span>2. Template Pesan untuk Satpam (Laporan Pos)</span>
                      <span className="text-[8px] text-blue-600 uppercase bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 font-bold font-mono">Pos Satpam</span>
                    </label>
                    <textarea
                      value={waTemplateSatpam}
                      onChange={(e) => setWaTemplateSatpam(e.target.value)}
                      rows={6}
                      className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:border-red-650 font-mono text-slate-850 leading-relaxed"
                      placeholder="Masukkan template pesan satpam..."
                    />
                  </div>

                  {/* Group Template */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center justify-between">
                      <span>3. Template Pesan untuk Grup WhatsApp (Broadcast)</span>
                      <span className="text-[8px] text-purple-600 uppercase bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100 font-bold font-mono">Grup WA</span>
                    </label>
                    <textarea
                      value={waTemplateGroup}
                      onChange={(e) => setWaTemplateGroup(e.target.value)}
                      rows={6}
                      className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:border-red-650 font-mono text-slate-850 leading-relaxed"
                      placeholder="Masukkan template pesan grup..."
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1 border-t border-slate-50 pt-3">
                <input
                  type="checkbox"
                  id="useWhatsAppGroup"
                  checked={useWhatsAppGroup}
                  onChange={(e) => setUseWhatsAppGroup(e.target.checked)}
                  className="h-4 w-4 rounded-md border-gray-300 text-red-700 focus:ring-red-650 cursor-pointer accent-red-750"
                />
                <label htmlFor="useWhatsAppGroup" className="text-xs font-semibold text-gray-700 cursor-pointer select-none">
                  Aktifkan opsi kirim ke grup WhatsApp secara default
                </label>
              </div>
            </div>

            <div className="pt-4 flex justify-between items-center border-t border-gray-100">
              {config.syncEnabled ? (
                <button
                  type="button"
                  onClick={onSync}
                  disabled={isSyncing}
                  className="bg-red-50 hover:bg-red-100 text-red-900 border border-red-200 font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? 'Sinkronisasi berjalan...' : 'Uji Sinkron Sekarang'}
                </button>
              ) : <div />}

              <button
                type="submit"
                className="bg-red-700 hover:bg-red-800 text-white font-bold text-xs px-4 py-2 rounded-lg transition-colors cursor-pointer"
              >
                Simpan Tautan & Setelan
              </button>
            </div>
          </form>

          {config.lastSync && (
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-[10px] text-gray-500 font-mono">
              Sinkronisasi sukses terakhir: <b>{new Date(config.lastSync).toLocaleString('id-ID')}</b>
            </div>
          )}
        </div>

        {/* Ustadz Registration section card (tambahkan fitur pendaftaran ustadz baru) */}
        <div className="bg-white rounded-xl border border-red-100 p-6 md:p-7 shadow-xs space-y-4">
          <div className="border-b border-gray-100 pb-3 flex justify-between items-center">
            <div>
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <UserPlus className="w-5 h-5 text-red-800" />
                Registrasi Akun Pengurus / Ustadz Baru
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Daftarkan akun ustadz baru agar memiliki hak akses pembuatan & persetujuan izin.</p>
            </div>
          </div>

          {regSuccess && (
            <div className="p-3 bg-red-50 border border-red-100 text-red-800 rounded-lg text-xs font-semibold flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-red-600" />
              {regSuccess}
            </div>
          )}

          {regError && (
            <div className="p-3 bg-rose-50 border border-rose-100 text-rose-800 rounded-lg text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              {regError}
            </div>
          )}

          <form onSubmit={handleRegisterUstadz} className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">Nama Lengkap (Gelar)</label>
              <input
                type="text"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder="Misal: Ustadz Hanafi"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-hidden focus:border-red-650"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">Username Unik</label>
              <input
                type="text"
                value={regUsername}
                onChange={(e) => setRegUsername(e.target.value)}
                placeholder="Misal: hanafi"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-hidden focus:border-red-650 font-mono"
              />
            </div>
            <div className="relative">
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">PIN Rahasia (Angka)</label>
              <div className="flex gap-1.5">
                <input
                  type="password"
                  maxLength={10}
                  value={regPasscode}
                  onChange={(e) => setRegPasscode(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="PIN Angka..."
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-hidden focus:border-red-650 font-mono"
                />
                <button
                  type="submit"
                  className="bg-red-700 hover:bg-red-800 text-white font-bold p-2 text-xs rounded-lg shrink-0 transition-colors flex items-center justify-center cursor-pointer"
                  title="Daftar Ustadz"
                >
                  Daftar
                </button>
              </div>
            </div>
          </form>

          {/* List existing Ustadz */}
          <div className="pt-4 border-t border-gray-100">
            <span className="text-[11px] font-bold text-red-950 uppercase tracking-widest block mb-2">Ustadz Pengawas Terdaftar ({ustadzList.length})</span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ustadzList.map((ust) => (
                <div key={ust.username} className="p-2 bg-red-50/20 border border-red-50 rounded-lg flex justify-between items-center">
                  <div>
                    <span className="text-xs font-bold text-gray-900 block truncate">{ust.name}</span>
                    <span className="text-[9px] text-gray-500 font-mono block">@{ust.username}</span>
                  </div>
                  {ust.username !== 'admin' && (
                    <button
                      onClick={() => {
                        if (window.confirm(`Hapus hak akses ustadz @${ust.username} secara permanen?`)) {
                          onDeleteUstadz(ust.username);
                        }
                      }}
                      className="text-red-600 hover:bg-red-50 p-1 rounded-sm transition-colors cursor-pointer"
                      title="Hapus Hak"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Local state troubleshoot maintenance card */}
        <div className="bg-white rounded-xl border border-amber-100 p-6 md:p-7 shadow-xs space-y-4">
          <div>
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
              <span className="p-1.5 bg-amber-100 text-amber-800 rounded-lg text-xs">🧹</span>
              Pemeliharaan & Keandalan Sinkronisasi
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Gunakan pembersihan data lokal jika Anda mendapati data santri atau perizinan tidak sinkron, bertabrakan, atau berbeda dari kondisi riil di Firebase Firestore.
            </p>
          </div>

          <div className="p-3.5 bg-amber-50/50 border border-amber-100 rounded-lg text-xs text-amber-900 font-semibold leading-relaxed space-y-1.5">
            <span className="font-extrabold text-amber-950 block">Menyelesaikan Masalah Sinkronisasi:</span>
            <p>
              Dengan menekan tombol bersihkan, seluruh cache data santri, perizinan, dan konfigurasi lokal pada browser Anda akan dihapus sepenuhnya. 
            </p>
            <p className="text-[11px] text-amber-850">
              Sistem kemudian akan memuat ulang halaman secara otomatis untuk mengambil salinan data yang valid dan terbaru langsung dari Firestore Cloud database secara aman.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                if (window.confirm('Apakah Anda yakin ingin bersihkan seluruh cache data lokal browser? Aplikasi akan langsung memuat ulang halaman kembali untuk menyinkronkan data segar dari cloud.')) {
                  localStorage.removeItem('pesantren_santri');
                  localStorage.removeItem('pesantren_permissions');
                  localStorage.removeItem('pesantren_ustadz');
                  localStorage.removeItem('pesantren_sheets_config');
                  window.location.reload();
                }
              }}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs rounded-lg transition-colors shadow-3xs cursor-pointer flex items-center gap-1.5"
            >
              Bersihkan Data Lokal
            </button>
          </div>
        </div>

      </div>

      {/* Guide & Tutorial Panel */}
      <div className="lg:col-span-2 bg-gradient-to-br from-red-50 to-rose-50 border border-red-100 rounded-xl p-5 shadow-xs space-y-4">
        <h3 className="text-xs font-extrabold text-red-950 flex items-center gap-1">
          <ClipboardList className="w-4 h-4 text-red-800" />
          LANGKAH PENYIAPAN DATABASE
        </h3>

        <div className="text-[11px] text-red-950 space-y-3.5 leading-relaxed">
          <div className="space-y-1">
            <span className="font-bold block">1. Siapkan Dokumen Google Sheet Anda</span>
            <p className="text-red-900/90">
              Buat Google Sheet baru dan letakkan baris header berikut persis di baris pertama (Row 1):
            </p>
            <div className="bg-white border border-red-200 font-mono text-[9px] p-2 rounded-md font-bold overflow-x-auto whitespace-nowrap">
              id, studentId, studentName, className, roomName, guardianName, guardianPhone, leaveType, reason, startDate, endDate, status, createdAt
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="font-bold block">2. Memasang Google Apps Script</span>
              <button
                onClick={copyToClipboard}
                className="bg-red-100 hover:bg-red-200 text-red-950 px-1.5 py-0.5 rounded-md border border-red-300 font-semibold cursor-pointer transition-colors flex items-center gap-1"
                title="Salin Naskah Kode"
              >
                {copiedScript ? <Check className="w-3 h-3 text-red-700" /> : <Copy className="w-3 h-3 text-red-700" />}
                {copiedScript ? 'Tersalin' : 'Salin Kode'}
              </button>
            </div>
            <p className="text-red-900/95 leading-normal">
              Klik menu <b>Extensions</b> &gt; <b>Apps Script</b>. Tempelkan modul kode (salin menggunakan tombol di atas).
            </p>
          </div>

          <div className="space-y-1">
            <span className="font-bold block">3. Deploy sebagai Web App</span>
            <p className="text-red-900/90">
              Klik tombol <b>Deploy</b> &gt; <b>New deployment</b>. Pilih jenis <b>Web app</b>. Di bagian "Who has access", set ke <b>Anyone</b>. Kemudian salin <b>Web app URL</b> yang muncul dan tempelkan di form sebelah kiri.
            </p>
          </div>

          <div className="space-y-1">
            <span className="font-bold block">4. Bagikan spreadsheet</span>
            <p className="text-red-900/90">
              Ubah akses Google Sheet Anda dengan menekan tombol <b>Share</b> &gt; Set <b>Anyone with the link can view</b> (agar aplikasi ini dapat membaca logs/data perizinan tanpa batasan).
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
