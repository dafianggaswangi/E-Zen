/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { 
  Users, 
  Clock, 
  CheckCircle, 
  ArrowRightLeft,
  FileSpreadsheet,
  TrendingUp,
  MessageSquare,
  Sparkles,
  AlertTriangle
} from 'lucide-react';
import { LeavePermission, Santri, isPermissionLate, SheetsConfig, isSatpamPhone, getSatpamNameByPhone } from '../types';

interface DashboardProps {
  permissions: LeavePermission[];
  santriList: Santri[];
  onNavigate: (tab: string) => void;
  sheetsConfig?: SheetsConfig;
}

export default function Dashboard({ permissions, santriList, onNavigate, sheetsConfig }: DashboardProps) {
  // Statistics calculations
  const totalSantri = santriList.length;
  const pendingRequests = permissions.filter(p => p.status === 'Pending').length;
  const activeLeave = permissions.filter(p => p.status === 'Sedang Berjalan').length;
  const approvedLeave = permissions.filter(p => p.status === 'Disetujui').length;
  const returnedCount = permissions.filter(p => p.status === 'Kembali').length;
  const insideCount = Math.max(0, totalSantri - activeLeave);

  // Lateness check
  const latePermissions = permissions.filter(p => p.status === 'Sedang Berjalan' && isPermissionLate(p));
  const lateCount = latePermissions.length;

  // Distribution by type
  const typeCounts = permissions.reduce((acc, curr) => {
    acc[curr.leaveType] = (acc[curr.leaveType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const leaveTypesInfo = [
    { key: 'Pulang', label: 'Pulang Ke Rumah', color: 'bg-slate-100 text-slate-800 border-slate-200' },
    { key: 'Keluar', label: 'Keluar Lingkungan', color: 'bg-slate-105 text-slate-800 border-slate-200' },
    { key: 'Sakit', label: 'Izin Medis/Sakit', color: 'bg-slate-100 text-slate-800 border-slate-200' },
    { key: 'Lainnya', label: 'Urusan Lainnya', color: 'bg-slate-100 text-slate-800 border-slate-205' }
  ];

  // Pick the 3 most recent leave transactions that are active
  const ongoingPermissions = permissions
    .filter(p => p.status === 'Sedang Berjalan' || p.status === 'Disetujui')
    .slice(0, 3);

  return (
    <div className="space-y-5">
      {/* Top Banner (Simple & Modern) */}
      <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xs relative overflow-hidden">
        {/* Subtle geometric overlay */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-slate-800 opacity-30 rounded-full translate-x-24 -translate-y-24 blur-2xl"></div>
        <div className="absolute bottom-0 right-1/4 w-40 h-40 bg-zinc-700 opacity-20 rounded-full translate-y-16 blur-xl"></div>
        
        <div className="max-w-xl relative z-10 space-y-2.5">
          <span className="bg-white/10 backdrop-blur-md text-white text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider">
            Sistem Informasi Pesantren
          </span>
          <h1 className="text-xl md:text-2xl font-black tracking-tight">
            Sistem Perizinan & Notifikasi Santri
          </h1>
          <p className="text-slate-300 text-xs leading-relaxed font-medium">
            Kelola data perizinan keluar-masuk santri dengan mudah, aman, terintegrasi otomatis dengan Google Sheets, dan terhubung langsung ke WhatsApp Wali Santri.
          </p>
          <div className="flex gap-2.5 pt-1.5">
            <button 
              onClick={() => onNavigate('form-izin')}
              className="bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs px-4 py-2 rounded-lg transition-all cursor-pointer shadow-3xs"
            >
              Buat Izin Baru
            </button>
            <button 
              onClick={() => onNavigate('integrasi-sheets')}
              className="bg-white/10 hover:bg-white/15 text-white font-bold text-xs px-4 py-2 rounded-lg border border-white/10 backdrop-blur-sm transition-all cursor-pointer flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Sambungkan Sheet
            </button>
          </div>
        </div>
      </div>

      {/* Warning Alert Banner for Late Students */}
      {lateCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-rose-50 border border-rose-150 rounded-2xl p-4 flex items-start gap-3 shadow-3xs"
        >
          <div className="p-2 bg-rose-100 text-rose-700 rounded-xl border border-rose-200">
            <AlertTriangle className="w-5 h-5 text-rose-600 animate-bounce" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] uppercase font-black text-rose-600 tracking-wider">Laporan Keterlambatan</span>
            <h3 className="text-xs font-extrabold text-rose-800 mt-0.5">
              Terdapat {lateCount} Santri Terlambat Kembali ke Pondok!
            </h3>
            <p className="text-[11px] text-rose-650 mt-1 leading-normal font-semibold">
              Santri berikut berstatus 'Sedang Diluar' namun telah melampaui batas tanggal pengembalian. Harap hubungi wali santri untuk konfirmasi:
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {latePermissions.map(p => (
                <span 
                  key={p.id} 
                  className="bg-white/95 border border-rose-200 px-2.5 py-1.5 rounded-lg text-[10px] text-rose-900 font-extrabold flex items-center gap-1 hover:bg-white transition-colors cursor-pointer"
                  onClick={() => onNavigate('daftar-izin')}
                >
                  🛡️ {p.studentName} ({p.className}) - <span className="font-mono text-rose-750">{p.endDate} {p.returnTime ? `(${p.returnTime})` : ''}</span>
                </span>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Grid Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
        {[
          {
            title: 'Total Santri',
            value: totalSantri,
            desc: 'Jumlah santri terdaftar',
            icon: Users,
            color: 'text-red-900 bg-red-50/70 border-red-200/60',
            badge: `${totalSantri} santri`
          },
          {
            title: 'Sedang Diluar',
            value: activeLeave,
            desc: lateCount > 0 ? `${lateCount} santri TERLAMBAT!` : 'Santri diluar pesantren',
            icon: ArrowRightLeft,
            color: lateCount > 0 ? 'text-rose-700 bg-rose-101 border-rose-300 animate-pulse' : 'text-rose-900 bg-rose-50/70 border-rose-200/60',
            badge: lateCount > 0 ? `⚠️ ${lateCount} Terlambat` : `${activeLeave} santri`
          },
          {
            title: 'Sedang Di Dalam',
            value: insideCount,
            desc: 'Berada di dalam asrama',
            icon: CheckCircle,
            color: 'text-emerald-900 bg-emerald-50/70 border-emerald-200/60',
            badge: `${insideCount} santri`
          },
          {
            title: 'Sudah Kembali',
            value: returnedCount,
            desc: 'Kembali ke asrama',
            icon: Users,
            color: 'text-slate-800 bg-slate-50 border-slate-205',
            badge: `Mencapai ${returnedCount}`
          }
        ].map((item, idx) => {
          const isLateStat = item.title === 'Sedang Diluar' && lateCount > 0;
          return (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: idx * 0.04 }}
              className={`p-4 rounded-xl border bg-white shadow-2xs flex flex-col justify-between h-28 relative overflow-hidden ${
                isLateStat ? 'border-rose-300 ring-2 ring-rose-50' : 'border-slate-100'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">{item.title}</span>
                  <span className={`text-2xl font-black block mt-1 tracking-tight ${isLateStat ? 'text-rose-700' : 'text-slate-900'}`}>{item.value}</span>
                </div>
                <div className={`p-1.5 rounded-lg border ${item.color}`}>
                  <item.icon className="w-4 h-4" />
                </div>
              </div>
              <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1 border-t border-slate-50 pt-1.5 font-semibold">
                <span className={`truncate ${isLateStat ? 'text-rose-600 font-extrabold' : ''}`}>{item.desc}</span>
                <span className={`font-extrabold px-1.5 rounded-sm ${isLateStat ? 'bg-rose-100 text-rose-700 animate-pulse' : 'text-slate-600 bg-slate-50'}`}>{item.badge}</span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Main Content Split Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Left/Middle: Quick Active List */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 p-5 shadow-2xs space-y-3.5">
          <div className="flex justify-between items-center pb-2.5 border-b border-slate-100">
            <div>
              <h2 className="text-xs font-extrabold text-slate-900 uppercase tracking-tight flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-900 block animate-pulse"></span>
                Daftar Izin Aktif Saat Ini
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">Santri yang saat ini sedang diproses atau di luar gerbang</p>
            </div>
            <button 
              onClick={() => onNavigate('daftar-izin')}
              className="text-xs font-bold text-slate-900 hover:underline transition-all flex items-center gap-1 cursor-pointer"
            >
              Lihat Semua
              <span className="text-[10px]">→</span>
            </button>
          </div>

          {ongoingPermissions.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <CheckCircle className="w-8 h-8 mx-auto text-slate-205" />
              <p className="text-xs font-bold text-slate-705">Tidak ada perizinan aktif saat ini</p>
              <p className="text-[10px] text-slate-400">Semua santri berada di dalam lingkungan asrama.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {ongoingPermissions.map((permission) => {
                const isLate = permission.status === 'Sedang Berjalan' && isPermissionLate(permission);
                return (
                  <div 
                    key={permission.id} 
                    className={`py-3 flex items-center justify-between group first:pt-0 last:pb-0 ${
                      isLate ? 'bg-rose-50/30 px-2.5 rounded-xl border border-rose-100/50 my-1' : ''
                    }`}
                  >
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center gap-1.5">
                        <span className={`font-bold text-xs truncate ${isLate ? 'text-rose-900' : 'text-slate-900'}`}>
                          {permission.studentName}
                        </span>
                        <span className="text-[9px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded-md font-bold">
                          {permission.className}
                        </span>
                        {isLate && (
                          <span className="text-[8px] bg-rose-100 text-rose-700 font-extrabold px-1.5 py-0.2 rounded-md border border-rose-200 animate-pulse">
                            TERLAMBAT kembali
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-1 font-semibold">
                        <span className="flex items-center gap-1">
                          <Clock className={`w-3 h-3 ${isLate ? 'text-rose-500' : 'text-slate-400'}`} />
                          Batas: <b className={`font-mono ${isLate ? 'text-rose-700' : 'text-slate-600'}`}>{permission.endDate} {permission.returnTime ? `(${permission.returnTime})` : ''}</b>
                        </span>
                        <span className="truncate">Wali: <b className="text-slate-600">{(() => {
                          const satpamInfo = getSatpamNameByPhone(permission.guardianPhone, sheetsConfig);
                          if (satpamInfo) {
                            return satpamInfo.name ? `${satpamInfo.name} (${satpamInfo.label})` : satpamInfo.label;
                          }
                          return permission.guardianName;
                        })()}</b></span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border ${
                        isLate 
                          ? 'bg-rose-600 border-rose-700 text-white animate-pulse shadow-sm shadow-rose-300'
                          : permission.status === 'Sedang Berjalan'
                            ? 'bg-rose-50 border-rose-200 text-rose-700'
                            : 'bg-amber-50 border-amber-200 text-amber-700'
                      }`}>
                        {isLate ? '⛔ Terlambat' : permission.status === 'Sedang Berjalan' ? 'Diluar' : 'Izin Aktif'}
                      </span>
                      <button
                        onClick={() => onNavigate('daftar-izin')}
                        className={`text-xs p-1.5 rounded-md transition-all cursor-pointer border ${
                          isLate 
                            ? 'bg-rose-105 hover:bg-rose-200 text-rose-700 border-rose-300' 
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                        title="Selesaikan / Notifikasi WA"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Distribution and Sheets info */}
        <div className="space-y-5">
          {/* Distribution card */}
          <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-2xs space-y-4">
            <div>
              <h2 className="text-xs font-extrabold text-slate-900 uppercase tracking-tight flex items-center gap-1.5 font-bold">
                <TrendingUp className="w-4 h-4 text-slate-700" />
                Kategori Jenis Izin
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5 font-medium">Statistik perizinan aktif per asrama</p>
            </div>

            <div className="space-y-3">
              {leaveTypesInfo.map((type) => {
                const count = typeCounts[type.key] || 0;
                const total = permissions.length || 1;
                const percentage = Math.round((count / total) * 100);

                return (
                  <div key={type.key} className="space-y-1">
                    <div className="flex justify-between items-center text-[10px] font-bold">
                      <span className="text-slate-505">{type.label}</span>
                      <span className="text-slate-900">{count} izin ({percentage}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-slate-900"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Helper card */}
          <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 md:p-5 space-y-2.5 text-slate-600 shadow-3xs">
            <h3 className="text-[10px] font-extrabold text-slate-800 tracking-wider uppercase font-bold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-slate-700" />
              Alur Notifikasi WA Wali
            </h3>
            <ol className="text-[11px] text-slate-500 space-y-1.5 list-decimal list-inside leading-normal font-semibold">
              <li>Input perizinan di menu <b>Form Pengajuan</b>.</li>
              <li>Tersimpan otomatis secara lokal dan tersambung Google Sheets.</li>
              <li>Gunakan tombol <b>Kirim WA</b> di menu log untuk melakukan redirect pesan notifikasi ke wali santri.</li>
            </ol>
          </div>
        </div>

      </div>
    </div>
  );
}
