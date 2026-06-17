/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldAlert, 
  Search, 
  CheckCircle, 
  Clock, 
  Calendar,
  HelpCircle,
  MapPin,
  ClipboardCheck,
  Phone,
  User,
  ExternalLink,
  MessageSquare,
  Mic,
  MicOff
} from 'lucide-react';
import { LeavePermission, SheetsConfig, isSatpamPhone, getSatpamNameByPhone, replacePlaceholders } from '../types';
import ConfirmationModal from './ConfirmationModal';

interface SatpamPortalProps {
  permissions: LeavePermission[];
  onUpdateStatus: (id: string, newStatus: LeavePermission['status']) => void;
  satpamPhone?: string;
  sheetsConfig?: SheetsConfig;
}

export default function SatpamPortal({ permissions, onUpdateStatus, satpamPhone, sheetsConfig }: SatpamPortalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  
  // Speech Recognition States
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  
  const speechSupported = typeof window !== 'undefined' && 
    (!!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition);

  // Clean-up speech on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // ignore
        }
      }
    };
  }, []);

  const handleToggleListening = () => {
    if (!speechSupported) {
      alert('Perekam pencarian suara tidak didukung di perangkat/browser ini.');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // ignore
        }
      }
      setIsListening(false);
    } else {
      try {
        const recognition = new SpeechRecognition();
        recognition.lang = 'id-ID';
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onstart = () => {
          setIsListening(true);
        };

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error', event);
          setIsListening(false);
          if (event.error === 'not-allowed') {
            alert('Akses mikrofon ditolak. Mohon aktifkan izin mikrofon untuk browser ini agar dapat mencari dengan suara.');
          } else if (event.error === 'no-speech') {
            alert('Tidak ada suara terdeteksi. Silakan coba lagi.');
          }
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          if (transcript) {
            // Remove ending dots or punctuation marks for better search matches
            const cleanedQuery = transcript.replace(/[\.\,\?\!]$/, '').trim();
            setSearchQuery(cleanedQuery);
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
      } catch (err) {
        console.error('Failed to initialize speech recognition:', err);
        setIsListening(false);
      }
    }
  };
  
  // Custom Inline Confirmation Modal State
  const [confirmData, setConfirmData] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    permission: LeavePermission | null;
  }>({
    isOpen: false,
    title: '',
    message: '',
    permission: null
  });

  // Filter ONLY students currently outside ('Sedang Berjalan' or 'Disetujui')
  const outStudents = permissions.filter(p => p.status === 'Sedang Berjalan' || p.status === 'Disetujui');

  // Apply search query on those out students
  const filteredAndMatched = outStudents.filter(p => 
    p.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.className.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleVerifyIn = (perm: LeavePermission) => {
    setConfirmData({
      isOpen: true,
      title: 'Verifikasi Kepulangan / Masuk Asrama',
      message: `Apakah Anda memverifikasi santri "${perm.studentName}" telah tiba kembali ke asrama pesantren sekarang?`,
      permission: perm
    });
  };

  const handleExecuteVerification = () => {
    const { permission } = confirmData;
    if (!permission) return;

    onUpdateStatus(permission.id, 'Kembali');
    setConfirmData(prev => ({ ...prev, isOpen: false }));
  };

  // Dispatch/Open WhatsApp Web Link for Satpam
  const handleSendToSatpamWhatsApp = (perm: LeavePermission) => {
    const targetPhone = satpamPhone ? satpamPhone.replace(/[^0-9]/g, '') : '';
    
    let textMsg = '';
    if (sheetsConfig?.waTemplateSatpam) {
      textMsg = replacePlaceholders(sheetsConfig.waTemplateSatpam, perm, sheetsConfig);
    } else {
      textMsg = `*LAPORAN PERIZINAN SANTRI (POS SATPAM)*

Yth. Petugas Keamanan / Satpam,
Berikut dilaporkan data santri yang sedang diizinkan keluar asrama:

• *Nama*: ${perm.studentName}
• *Kelas*: ${perm.className}
• *ID Perizinan*: ${perm.id}
• *Jenis Izin*: ${perm.leaveType}
• *Keperluan*: "${perm.reason}"
• *Mulai Izin*: ${perm.startDate}
• *Batas Kembali*: ${perm.endDate}${perm.returnTime ? ` pukul ${perm.returnTime}` : ''} WIB
• *Wali Santri*: ${(() => {
  const satpamInfo = getSatpamNameByPhone(perm.guardianPhone, sheetsConfig);
  if (satpamInfo) {
    return satpamInfo.name ? `${satpamInfo.name} (${satpamInfo.label})` : satpamInfo.label;
  }
  return perm.guardianName;
})()}
• *Kontak Wali*: ${perm.guardianPhone !== '-' ? perm.guardianPhone : 'Tidak Dicantumkan'}
• *Pemberi Izin*: ${perm.createdByUstadz || 'Staf Kesantrian'}
• *Status*: SEDANG DI LUAR PONDOK

Mohon verifikasi kepulangan santri ketika kembali ke asrama melalui aplikasi E-Zen.`;
    }

    const encodedText = encodeURIComponent(textMsg);
    const waUrl = `https://api.whatsapp.com/send?phone=${targetPhone}&text=${encodedText}`;
    
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-6">
      
      {/* Red & White Hero Top Banner */}
      <div className="bg-red-600 rounded-2xl p-5 md:p-6 text-white shadow-md border-b-4 border-red-700 relative overflow-hidden text-left">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-48 h-48 rounded-full bg-white/5 pointer-events-none"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-white/10 rounded-xl backdrop-blur-xs">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                VERIFIKASI KEAMANAN SATPAM
              </h2>
              <p className="text-xs text-red-100 font-medium mt-0.5">Pos Gerbang Validasi Kepulangan Santri (Edisi Merah Putih)</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black tracking-widest uppercase px-3 py-1 bg-white text-red-600 rounded-full shadow-2xs border border-red-100">
              🔴 SATPAM INDONESIA
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        
        {/* Simple & Clear Controller Box */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 md:p-6 shadow-xs space-y-4 text-left">
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
                <Clock className="w-4.5 h-4.5 text-red-600" />
                Daftar Santri yang Sedang Di Luar ({filteredAndMatched.length})
              </h3>
              <p className="text-xs text-slate-500">Hanya menampilkan santri dengan status keberangkatan "Sedang Berjalan".</p>
            </div>
            {(() => {
              const activePhones = [
                { name: sheetsConfig?.satpamName ? `${sheetsConfig.satpamName} (Pos 1)` : 'Pos 1', val: sheetsConfig?.satpamPhone },
                { name: sheetsConfig?.satpamName2 ? `${sheetsConfig.satpamName2} (Pos 2)` : 'Pos 2', val: sheetsConfig?.satpamPhone2 },
                { name: sheetsConfig?.satpamName3 ? `${sheetsConfig.satpamName3} (Pos 3)` : 'Pos 3', val: sheetsConfig?.satpamPhone3 },
                { name: sheetsConfig?.satpamName4 ? `${sheetsConfig.satpamName4} (Pos 4)` : 'Pos 4', val: sheetsConfig?.satpamPhone4 },
                { name: sheetsConfig?.satpamName5 ? `${sheetsConfig.satpamName5} (Pos 5)` : 'Pos 5', val: sheetsConfig?.satpamPhone5 },
              ].filter(p => !!p.val);

              if (activePhones.length === 0) {
                return satpamPhone ? (
                  <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-100 px-2.5 py-1 rounded-lg">
                    Telepon Pos: {satpamPhone}
                  </span>
                ) : null;
              }

              return (
                <div className="flex flex-wrap gap-1.5 items-center justify-end">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Telepon Pos Aktif:</span>
                  {activePhones.map((p, i) => (
                    <span key={i} className="text-[10px] font-bold text-red-650 bg-red-50 border border-red-100 px-2 py-0.5 rounded-md" title={`Nomor ${p.name}`}>
                      {p.name}: {p.val}
                    </span>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Clean Red-outline Search Input with Speech Search Integration */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4 text-red-500" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isListening ? "🎙️ Sedang mendengarkan... ucapkan Nama Santri sekarang!" : "Cari santri diluar pondok berdasarkan Nama, Kelas, atau ID Izin..."}
              className={`w-full pl-10 pr-24 py-2.5 bg-slate-50 border rounded-xl text-xs focus:outline-hidden focus:bg-white transition-all text-slate-800 placeholder-slate-400 font-medium ${
                isListening ? 'border-red-600 ring-4 ring-red-100 animate-pulse font-black text-red-700 bg-red-50/20' : 'border-slate-200 focus:border-red-650'
              }`}
            />
            {/* Action controls inside the input on the right */}
            <div className="absolute inset-y-0 right-0 flex items-center pr-2.5 gap-1.5">
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="px-2 py-1 text-[9px] font-black text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer transition-all"
                >
                  HAPUS
                </button>
              )}
              {speechSupported ? (
                <button
                  type="button"
                  onClick={handleToggleListening}
                  className={`p-1.5 rounded-lg flex items-center justify-center transition-all cursor-pointer border ${
                    isListening 
                      ? 'bg-red-600 text-white border-red-700 shadow-2xs' 
                      : 'bg-red-50 text-red-600 border-red-200/50 hover:bg-red-100/70'
                  }`}
                  title={isListening ? 'Matikan Mikrofon' : 'Cari nama santri dengan Suara Anda (Mikrofon)'}
                >
                  {isListening ? (
                    <MicOff className="w-3.5 h-3.5" />
                  ) : (
                    <Mic className="w-3.5 h-3.5 pointer-events-none" />
                  )}
                </button>
              ) : (
                <span className="text-[8px] text-slate-350 font-extrabold uppercase mr-1" title="Mikrofon tidak terdeteksi / tidak diizinkan">
                  MUTE
                </span>
              )}
            </div>
          </div>

          {/* Simple clear list of Out Students */}
          <div className="space-y-4">
            {filteredAndMatched.length === 0 ? (
              <div className="p-16 text-center border-2 border-dashed border-slate-150 rounded-2xl space-y-3 bg-slate-50/50">
                <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto text-red-600">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-extrabold text-slate-800">Semua Santri Berada Di Dalam Pondok</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed font-semibold">
                    Tidak ada santri yang sedang berada di luar area asrama pesantren berdasarkan pencarian saat ini.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredAndMatched.map((permission) => (
                  <motion.div
                    layout
                    key={permission.id}
                    className="bg-white border-2 border-slate-200 rounded-2xl shadow-3xs hover:border-red-500 transition-all overflow-hidden flex flex-col justify-between"
                  >
                    {/* Active strip */}
                    <div className="bg-red-50/80 border-b border-red-100/50 px-4 py-2.5 flex justify-between items-center text-xs font-bold text-red-850">
                      <span className="font-mono text-[10px] bg-red-600 text-white px-2 py-0.5 rounded-md shadow-3xs">{permission.id}</span>
                      <span className="flex items-center gap-1.5 text-[10px] uppercase font-black tracking-widest bg-white border border-red-200 px-2.5 py-0.5 rounded-full text-red-650 animate-pulse">
                        <span className="w-1.5 h-1.5 bg-red-600 rounded-full"></span>
                        Sedang Di luar
                      </span>
                    </div>

                    {/* Content inside card */}
                    <div className="p-4 space-y-3 flex-grow text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 font-extrabold uppercase">Nama Santri</span>
                        <h4 className="text-sm font-black text-slate-900 mt-0.5">{permission.studentName}</h4>
                        <p className="text-xs text-slate-500 font-bold block mt-0.5">Kelas {permission.className} — Asrama: {permission.roomName || 'Utama'}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-3 py-2 border-y border-slate-100">
                        <div>
                          <span className="text-[10px] text-slate-400 font-semibold uppercase block">Jenis Perizinan</span>
                          <span className="inline-block bg-red-50 text-red-700 font-extrabold border border-red-100 rounded-md px-2 py-0.5 text-[10px] mt-1">{permission.leaveType}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-semibold uppercase block">Batas Waktu Kembali</span>
                          <span className="font-mono text-slate-800 font-bold block mt-1">{permission.endDate} — {permission.returnTime || '17:00'}</span>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-[10px] text-slate-400 font-semibold uppercase block">Tujuan & Alasan Izin:</span>
                        <p className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl italic leading-relaxed text-slate-600 text-[11px] font-medium shadow-3xs">
                          "{permission.reason || 'Saksi keperluan perizinan asrama.'}"
                        </p>
                      </div>

                      <div className="space-y-1 text-[11px] pt-1">
                        <span className="text-slate-400 font-semibold block">Wali / Penjemput:</span>
                        <p className="font-extrabold text-slate-700">
                          {(() => {
                            const satpamInfo = getSatpamNameByPhone(permission.guardianPhone, sheetsConfig);
                            if (satpamInfo) {
                              return satpamInfo.name ? `${satpamInfo.name} (${satpamInfo.label})` : satpamInfo.label;
                            }
                            return permission.guardianPhone !== '-' ? `${permission.guardianName} (${permission.guardianPhone})` : permission.guardianName;
                          })()}
                        </p>
                      </div>

                      {permission.createdByUstadz && (
                        <div className="space-y-1 text-[11px] pt-1">
                          <span className="text-slate-400 font-semibold block">Ustadz Pemberi Izin:</span>
                          <p className="font-extrabold text-red-750">{permission.createdByUstadz}</p>
                        </div>
                      )}
                    </div>

                    {/* Integrated Action Buttons */}
                    <div className="p-3 bg-slate-50 border-t border-slate-105 flex flex-col sm:flex-row gap-2">
                      
                      {satpamPhone && (
                        <button
                          type="button"
                          onClick={() => handleSendToSatpamWhatsApp(permission)}
                          className="w-full sm:w-auto px-3 py-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-[10.5px] font-black text-slate-700 transition-all flex items-center justify-center gap-1 cursor-pointer"
                          title="Kirim SMS/WA Info ke Satpam"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-red-650" />
                          Kirim WA Satpam
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleVerifyIn(permission)}
                        className="flex-grow py-2 px-4 bg-red-600 hover:bg-red-700 text-white text-[11.5px] font-extrabold rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer hover:shadow-2xs"
                      >
                        <CheckCircle className="w-4 h-4 text-white shrink-0" />
                        VERIFIKASI MASUK (KEMBALI)
                      </button>
                    </div>

                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Info panel */}
        <div className="bg-white rounded-2xl border border-slate-150 p-4 leading-relaxed text-xs text-slate-550 shadow-3xs space-y-2 text-left animate-fadeIn">
          <h4 className="font-extrabold text-slate-800 flex items-center gap-1.5 text-xs text-red-600">
            <MapPin className="w-4 h-4" />
            Wewenang Verifikasi Pos Satpam
          </h4>
          <p className="text-[11px] text-slate-400 font-semibold leading-normal">
            Demi menjaga ketertiban, Satpam bertugas memverifikasi kembalinya santri (menekan tombol <b>Verifikasi Masuk</b>) agar status santri kembali aktif di perizinan pondok. Data santri baru yang diizinkan ustadz akan tampil secara otomatis setelah ustadz menyetujui dan memproses keberangkatan mereka.
          </p>
        </div>

      </div>

      {/* REUSABLE CUSTOM CONFIRMATION DIALOG */}
      <ConfirmationModal
        isOpen={confirmData.isOpen}
        title={confirmData.title}
        message={confirmData.message}
        confirmLabel="Konfirmasi Masuk"
        variant="success"
        onConfirm={handleExecuteVerification}
        onCancel={() => setConfirmData(prev => ({ ...prev, isOpen: false }))}
      />

    </div>
  );
}
