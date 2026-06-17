/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  UserPlus, 
  FileText, 
  Trash2, 
  Search, 
  Check, 
  AlertCircle, 
  Sparkles,
  ClipboardList,
  UserCheck,
  UploadCloud,
  FileSpreadsheet,
  X,
  Unlock,
  ShieldAlert,
  Home
} from 'lucide-react';
import { Santri, LeavePermission, isPermissionLate, getLatenessDuration, wasPermissionLate } from '../types';
import ConfirmationModal from './ConfirmationModal';

interface StudentManagementProps {
  santriList: Santri[];
  permissions?: LeavePermission[];
  onAddSantriBulk: (newStudents: Omit<Santri, 'id'>[]) => Promise<void> | void;
  onAddSantriSingle: (santri: Omit<Santri, 'id'>) => void;
  onDeleteSantri: (id: string) => void;
  onDeleteSantriBulk?: (ids: string[]) => Promise<void> | void;
  currentUstadz?: { username: string; name: string } | null;
  onUpdateSantri?: (id: string, updates: Partial<Santri>) => Promise<void> | void;
  onUpdateStatus?: (id: string, newStatus: LeavePermission['status']) => Promise<void> | void;
}

export default function StudentManagement({ 
  santriList, 
  permissions = [],
  onAddSantriBulk, 
  onAddSantriSingle,
  onDeleteSantri,
  onDeleteSantriBulk,
  currentUstadz,
  onUpdateSantri,
  onUpdateStatus
}: StudentManagementProps) {
  const [activeSubTab, setActiveSubTab] = useState<'list' | 'manual' | 'bulk'>('list');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Single manual registrations
  const [name, setName] = useState('');
  const [className, setClassName] = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Bulk registrations
  const [bulkText, setBulkText] = useState('');
  const [bulkPreview, setBulkPreview] = useState<Omit<Santri, 'id'>[]>([]);
  const [bulkFeedback, setBulkFeedback] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Search and class filter
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('all');

  // Selected student IDs for bulk delete
  const [selectedSantriIds, setSelectedSantriIds] = useState<string[]>([]);

  // Extract unique classes dynamically from santriList
  const uniqueClasses = Array.from(new Set(santriList.map(s => s.className).filter(Boolean))).sort();

  // Custom modal delete state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    studentId: string;
    studentName: string;
  }>({
    isOpen: false,
    studentId: '',
    studentName: '',
  });

  // Bulk delete modal state
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState({
    isOpen: false,
    count: 0
  });

  const handleAddSingle = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    if (!name.trim() || !className.trim()) {
      setErrorMsg('Nama lengkap dan kelas wajib diisi.');
      return;
    }

    onAddSantriSingle({
      name: name.trim(),
      className: className.trim(),
      roomName: 'Asrama' // default room name value
    });

    setSuccessMsg(`Santri "${name.trim()}" (Kelas ${className.trim()}) berhasil didaftarkan.`);
    setName('');
    setClassName('');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const parseBulkTextAndPreview = (text: string) => {
    if (!text.trim()) {
      setBulkPreview([]);
      return;
    }

    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const parsed: Omit<Santri, 'id'>[] = [];

    lines.forEach(line => {
      // Parse strictly as Format: Nama, kelas
      const parts = line.split(',').map(p => p.trim());
      const studName = parts[0] || '';
      const studClass = parts[1] || 'Umum';

      if (studName.toLowerCase() === 'name' || studName.toLowerCase() === 'nama') {
        // Skip header lines
        return;
      }

      if (studName) {
        parsed.push({
          name: studName,
          className: studClass,
          roomName: 'Asrama' // Automatically assign default room
        });
      }
    });

    setBulkPreview(parsed);
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setBulkText(text);
    parseBulkTextAndPreview(text);
  };

  // Modern File Upload and drag-and-drop parsing handlers
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setBulkText(text);
        parseBulkTextAndPreview(text);
      }
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (file.type === "text/plain" || file.name.endsWith(".csv") || file.name.endsWith(".txt")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) {
          setBulkText(text);
          parseBulkTextAndPreview(text);
        }
      };
      reader.readAsText(file);
    } else {
      setBulkFeedback("Ekstensi file tidak didukung. Harap upload file .txt atau .csv");
    }
  };

  const [isSavingBulk, setIsSavingBulk] = useState(false);

  const handleApplyBulk = async () => {
    if (bulkPreview.length === 0) {
      setBulkFeedback('Belum ada data valid untuk disimpan.');
      return;
    }

    setIsSavingBulk(true);
    setBulkFeedback(null);
    try {
      await onAddSantriBulk(bulkPreview);
      setBulkFeedback(`Sukses mengimpor ${bulkPreview.length} data santri baru secara massal!`);
      setBulkText('');
      setBulkPreview([]);
    } catch (err: any) {
      setBulkFeedback(`Gagal mengimpor data: ${err.message || err}`);
    } finally {
      setIsSavingBulk(false);
      setTimeout(() => setBulkFeedback(null), 6000);
    }
  };

  const triggerDeleteConfirm = (id: string, name: string) => {
    setDeleteConfirm({
      isOpen: true,
      studentId: id,
      studentName: name,
    });
  };

  const executeDelete = () => {
    onDeleteSantri(deleteConfirm.studentId);
    setSelectedSantriIds(prev => prev.filter(id => id !== deleteConfirm.studentId));
    setDeleteConfirm(prev => ({ ...prev, isOpen: false }));
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIds = filteredList.map(s => s.id);
      setSelectedSantriIds(allIds);
    } else {
      setSelectedSantriIds([]);
    }
  };

  const triggerBulkDeleteConfirm = () => {
    setBulkDeleteConfirm({
      isOpen: true,
      count: selectedSantriIds.length
    });
  };

  const executeBulkDelete = async () => {
    const deleteCount = selectedSantriIds.length;
    if (onDeleteSantriBulk) {
      await onDeleteSantriBulk(selectedSantriIds);
    } else {
      const deletePromises = selectedSantriIds.map(id => onDeleteSantri(id));
      await Promise.all(deletePromises);
    }
    setSelectedSantriIds([]);
    setBulkDeleteConfirm({ isOpen: false, count: 0 });
    setSuccessMsg(`Berhasil menghapus ${deleteCount} data santri secara massal.`);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const handleSendBlacklistWhatsApp = (st: Santri) => {
    const studentPerms = permissions.filter(p => p.studentId === st.id);
    const latestPermWithPhone = [...studentPerms]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .find(p => p.guardianPhone && p.guardianPhone !== '-');
    const parentPhone = latestPermWithPhone?.guardianPhone || '';
    const parentName = latestPermWithPhone?.guardianName || 'Wali Santri';
    
    // Find late permissions where they were actually late or late returned
    const latePermissions = studentPerms.filter(p => {
      return isPermissionLate(p) || (p.status === 'Kembali' && p.returnedAt && p.returnTime && (new Date(p.returnedAt) > new Date(p.endDate + 'T' + p.returnTime)));
    });

    const formattedPhone = parentPhone ? parentPhone.replace(/[^0-9]/g, '') : '';
    
    const textMsg = `*PEMBERITAHUAN BLACKLIST PERIZINAN SANTRI*

Assalamu'alaikum Wr. Wb.
Yth. Bapak/Ibu ${parentName}, wali dari ananda:

• *Nama Santri*: ${st.name}
• *Kelas / Asrama*: ${st.className} / ${st.roomName || 'Asrama'}
• *Status Sistem*: 🛑 DIBLACKLIST (Ditangguhkan)
• *Alasan*: ${st.blacklistReason || 'Keterlambatan kembali ke pondok melebihi batas 3 kali.'}

*RIWAYAT KETERLAMBATAN & PERIZINAN:*
Total Izin Diambil: ${studentPerms.length} kali
Total Keterlambatan: ${latePermissions.length} kali
${latePermissions.map((p, idx) => `  ${idx + 1}. Izin ${p.leaveType} (${p.startDate} s/d ${p.endDate}): Terlambat kembali`).join('\n')}

*PROSEDUR PEMBUKAAN FITUR PERIZINAN:*
Berdasarkan peraturan ketertiban kesantrian, untuk mengaktifkan kembali (unblacklist) kartu izin santri, harap perizinan diselesaikan dengan cara:
1. Wali santri wajib datang langsung menghadap Kantor Pengasuhan/Kesantrian.
2. Membawa kembali surat/kartu izin fisik asli.
3. Menandatangani surat komitmen ketepatan waktu kembali santri.

Mohon dukungannya agar santri dapat melatih kedisiplinan dan menjaga amanah perizinan pondok. Terima kasih jazaakumullah khairan.

Wassalamu'alaikum Wr. Wb.
_Kantor Pengasuhan Pondok Pesantren_`;

    const encodedText = encodeURIComponent(textMsg);
    
    if (formattedPhone && formattedPhone.length > 5) {
      window.open(`https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodedText}`, '_blank');
    } else {
      const userPhone = prompt(`Nomor WhatsApp wali tidak ditemukan secara otomatis di riwayat izin. Silakan masukkan nomor WhatsApp wali secara manual (contoh: 081234567890):`);
      if (userPhone) {
        let cleaned = userPhone.replace(/[^0-9]/g, '');
        if (cleaned.startsWith('0')) {
          cleaned = '62' + cleaned.slice(1);
        }
        window.open(`https://api.whatsapp.com/send?phone=${cleaned}&text=${encodedText}`, '_blank');
      }
    }
  };

  const handleSendUnblacklistWhatsApp = (st: Santri) => {
    const studentPerms = permissions ? permissions.filter(p => p.studentId === st.id) : [];
    const latestPermWithPhone = [...studentPerms]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .find(p => p.guardianPhone && p.guardianPhone !== '-');
    const parentPhone = latestPermWithPhone?.guardianPhone || '';
    const parentName = latestPermWithPhone?.guardianName || 'Wali Santri';
    
    // Find late permissions where they were actually late or late returned
    const latePermissions = studentPerms.filter(p => {
      return isPermissionLate(p) || (p.status === 'Kembali' && p.returnedAt && p.returnTime && (wasPermissionLate(p)));
    });

    const formattedPhone = parentPhone ? parentPhone.replace(/[^0-9]/g, '') : '';
    
    // Format each late permission with its delay duration
    const lateDetails = latePermissions.map((p, idx) => {
      const duration = getLatenessDuration(p);
      return `  ${idx + 1}. Izin ${p.leaveType} (${p.startDate} s/d ${p.endDate}): Terlambat ${duration}`;
    }).join('\n');

    const textMsg = `*PEMBERITAHUAN AKTIVASI KEMBALI (UNBLACKLIST) PERIZINAN SANTRI*

Assalamu'alaikum Wr. Wb.
Yth. Bapak/Ibu ${parentName}, wali dari ananda:

• *Nama Santri*: ${st.name}
• *Kelas / Asrama*: ${st.className} / ${st.roomName || 'Asrama'}
• *Status Sistem*: 🟢 AKTIF KEMBALI (Sanksi Blacklist Dicabut)

Alhamdulillah, fitur perizinan luar pondok untuk ananda telah diaktifkan kembali oleh bagian Kesantrian/Pengasuhan setelah dilakukan evaluasi, bimbingan, dan verifikasi penyelesaian keterlambatan.

*RIWAYAT KETERLAMBATAN SEBELUMNYA:*
Total Keterlambatan: ${latePermissions.length} kali
${lateDetails || '  -'}

Kami sangat mengharapkan kerja sama Bapak/Ibu wali santri sekalian untuk menjaga ketepatan waktu kepulangan ananda pada izin-izin berikutnya demi kebaikan bimbingan disiplin santri. Terima kasih.

Wassalamu'alaikum Wr. Wb.
_Kantor Pengasuhan Pondok Pesantren_`;

    const encodedText = encodeURIComponent(textMsg);
    
    if (formattedPhone && formattedPhone.length > 5) {
      window.open(`https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodedText}`, '_blank');
    } else {
      const userPhone = prompt(`Nomor WhatsApp wali tidak ditemukan secara otomatis di riwayat izin. Silakan masukkan nomor WhatsApp wali secara manual (contoh: 081234567890):`);
      if (userPhone) {
        let cleaned = userPhone.replace(/[^0-9]/g, '');
        if (cleaned.startsWith('0')) {
          cleaned = '62' + cleaned.slice(1);
        }
        window.open(`https://api.whatsapp.com/send?phone=${cleaned}&text=${encodedText}`, '_blank');
      }
    }
  };

  const filteredList = santriList.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          s.className.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          s.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClass = selectedClassFilter === 'all' || s.className === selectedClassFilter;
    return matchesSearch && matchesClass;
  });

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-2xs overflow-hidden">
      
      {/* Header Tab Switcher (Modernized to Minimalist Slate look) */}
      <div className="bg-white px-5 py-5 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <Users className="w-4.5 h-4.5 text-slate-700" />
            Manajemen Basis Data Santri
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Tambah data secara manual, massal (bulk), maupun kelola daftar santri.</p>
        </div>

        <div className="flex gap-1 bg-slate-50 p-1 rounded-xl shrink-0">
          {[
            { id: 'list', label: 'Daftar Santri', icon: ClipboardList },
            { id: 'manual', label: 'Tambah Manual', icon: UserPlus },
            { id: 'bulk', label: 'Impor Massal (Bulk)', icon: FileText }
          ].map((subTab) => {
            const Icon = subTab.icon;
            const isSubActive = activeSubTab === subTab.id;
            return (
              <button
                key={subTab.id}
                onClick={() => {
                  setActiveSubTab(subTab.id as any);
                  setSuccessMsg(null);
                  setErrorMsg(null);
                  setBulkFeedback(null);
                }}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  isSubActive 
                    ? 'bg-slate-900 text-white shadow-3xs'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {subTab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-5">
        
        {/* LIST VIEW */}
        {activeSubTab === 'list' && (
          <div className="space-y-4">
            {successMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-900 rounded-lg text-xs font-semibold flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                {successMsg}
              </div>
            )}

            {/* Search and Filters Bar */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Search className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Cari nama santri, kelas, atau ID..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200/85 rounded-lg text-xs focus:outline-hidden focus:border-slate-850 focus:bg-white transition-all text-slate-800 font-medium"
                />
              </div>

              {/* Dynamic Class Filter Dropdown */}
              <div className="w-full sm:w-56 shrink-0">
                <select
                  value={selectedClassFilter}
                  onChange={(e) => setSelectedClassFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-205 rounded-lg text-xs focus:outline-hidden focus:border-slate-850 focus:bg-white transition-all text-slate-700 font-bold cursor-pointer h-full"
                >
                  <option value="all">📁 Semua Kelas ({santriList.length})</option>
                  {uniqueClasses.map((cl, idx) => {
                    const count = santriList.filter(s => s.className === cl).length;
                    return (
                      <option key={idx} value={cl}>
                        🏫 Kelas {cl} ({count})
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {/* Bulk Actions Sliding Banner */}
            {selectedSantriIds.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 bg-rose-50 border border-rose-150 rounded-xl text-slate-855 gap-3"
              >
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <p className="text-xs font-bold text-rose-950">
                    Terpilih <span className="bg-rose-100 px-2 py-0.5 rounded-md font-extrabold text-rose-800">{selectedSantriIds.length}</span> data santri untuk Hapus Massal.
                  </p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto justify-end">
                  <button
                    onClick={() => setSelectedSantriIds([])}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 font-bold bg-white border border-slate-200 rounded-lg transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    onClick={triggerBulkDeleteConfirm}
                    className="px-3.5 py-1.5 text-xs text-white bg-rose-600 hover:bg-rose-700 font-extrabold rounded-lg flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Hapus Massal ({selectedSantriIds.length})
                  </button>
                </div>
              </motion.div>
            )}

            {/* List Table */}
            <div className="border border-slate-100 rounded-lg overflow-hidden shadow-3xs">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-800 text-[10px] uppercase tracking-wider font-extrabold border-b border-slate-150">
                  <tr>
                    <th className="px-4 py-3 text-center w-10">
                      <input
                        type="checkbox"
                        checked={filteredList.length > 0 && selectedSantriIds.length === filteredList.length}
                        onChange={handleSelectAll}
                        className="rounded border-slate-350 text-slate-900 focus:ring-slate-900 cursor-pointer"
                        title="Pilih semua santri di halaman ini"
                      />
                    </th>
                    <th className="px-4 py-3">ID Santri</th>
                    <th className="px-4 py-3">Nama Lengkap</th>
                    <th className="px-4 py-3">Kelas / Tingkat</th>
                    <th className="px-4 py-3">Status Posisi</th>
                    <th className="px-4 py-3 text-right">Opsi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-slate-400">
                        Tidak ada records data santri ditemukan.
                      </td>
                    </tr>
                  ) : (
                    filteredList.map((st) => {
                      const activePerm = permissions?.find(p => p.studentId === st.id && p.status === 'Sedang Berjalan');
                      const isSelected = selectedSantriIds.includes(st.id);
                      
                      let positionLabel = '🏠 Di Dalam';
                      let positionClass = 'bg-emerald-50 text-emerald-700 border border-emerald-150 font-bold';
                      
                      if (st.isBlacklisted) {
                        positionLabel = '🛑 Blacklisted';
                        positionClass = 'bg-rose-50 text-rose-700 border border-rose-150 font-bold';
                      } else if (activePerm) {
                        const isLate = isPermissionLate(activePerm);
                        if (isLate) {
                          positionLabel = '⚠️ Terlambat';
                          positionClass = 'bg-rose-100 text-rose-850 border border-rose-250 font-extrabold animate-pulse';
                        } else {
                          positionLabel = '🚗 Sedang Diluar';
                          positionClass = 'bg-amber-50 text-amber-700 border border-amber-150 font-bold';
                        }
                      }

                      return (
                        <tr 
                          key={st.id} 
                          className={`hover:bg-slate-50/50 transition-colors ${st.isBlacklisted ? 'bg-rose-50/10' : ''} ${isSelected ? 'bg-slate-50' : ''}`}
                        >
                          <td className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedSantriIds(prev => [...prev, st.id]);
                                } else {
                                  setSelectedSantriIds(prev => prev.filter(id => id !== st.id));
                                }
                              }}
                              className="rounded border-slate-350 text-slate-900 focus:ring-slate-900 cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-slate-500">{st.id}</td>
                          <td className="px-4 py-3">
                            <span className={`font-semibold block ${st.isBlacklisted ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{st.name}</span>
                            {st.isBlacklisted && (
                              <span className="inline-flex items-center gap-1 text-[10px] bg-rose-50 text-rose-700 border border-rose-150 px-2 py-0.5 rounded-md font-bold mt-1">
                                <ShieldAlert className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                <span>Blacklisted: {st.blacklistReason || 'Keterlambatan'}</span>
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-700">{st.className}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 text-[10px] px-2.5 py-0.5 rounded-full ${positionClass}`}>
                              {positionLabel}
                            </span>
                            {activePerm && (
                              <span className="block text-[9px] text-slate-400 font-semibold mt-1">
                                Batas: {activePerm.endDate} {activePerm.returnTime || ''}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex gap-1.5 justify-end items-center">
                              {activePerm && onUpdateStatus && (
                                <button
                                  onClick={() => {
                                    if (window.confirm(`Konfirmasi absen masuk untuk ${st.name}? Status izin aktif (${activePerm.id}) akan diselesaikan.`)) {
                                      onUpdateStatus(activePerm.id, 'Kembali');
                                    }
                                  }}
                                  className="px-2 py-1 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-101/85 font-extrabold text-[10px] flex items-center gap-1 transition-all shadow-3xs cursor-pointer"
                                  title="Absen Masuk (Selesaikan Izin)"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  Absen Masuk
                                </button>
                              )}
                              {st.isBlacklisted && (
                                <>
                                  <button
                                    onClick={() => handleSendBlacklistWhatsApp(st)}
                                    className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg border border-transparent text-[10px] font-extrabold flex items-center gap-1 transition-all shadow-3xs cursor-pointer"
                                    title="Kirim pesan peringatan / riwayat blacklist ke WhatsApp Wali Santri"
                                  >
                                    <span className="text-[11px] font-mono">💬</span>
                                    <span>Hubungi Wali</span>
                                  </button>
                                  <button
                                    onClick={() => handleSendUnblacklistWhatsApp(st)}
                                    className="px-2 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-lg border border-transparent text-[10px] font-extrabold flex items-center gap-1 transition-all shadow-3xs cursor-pointer"
                                    title="Kirim template pesan WA Buka Blacklist ke Wali Santri (disertai durasi keterlambatan)"
                                  >
                                    <span className="text-[11px] font-mono">🔓</span>
                                    <span>WA Buka Blacklist</span>
                                  </button>
                                  <button
                                    disabled={currentUstadz?.username !== 'admin'}
                                    onClick={() => {
                                      if (onUpdateSantri) {
                                        onUpdateSantri(st.id, {
                                          isBlacklisted: false,
                                          unblacklistedAt: new Date().toISOString()
                                        });
                                      }
                                    }}
                                    className={`px-2 py-1 rounded-lg border text-[10px] font-extrabold flex items-center gap-1 cursor-pointer transition-all ${
                                      currentUstadz?.username === 'admin'
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 shadow-3xs'
                                        : 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                                    }`}
                                    title={currentUstadz?.username === 'admin' ? 'Buka Blacklist Santri' : 'Buka Blacklist (Khusus Akun Admin)'}
                                  >
                                    <Unlock className="w-3 h-3 text-emerald-600" />
                                    {currentUstadz?.username === 'admin' ? 'Buka Blacklist' : 'Unlock (Admin Only)'}
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => triggerDeleteConfirm(st.id, st.name)}
                                className="p-1.5 text-rose-605 hover:bg-rose-50 hover:text-rose-800 rounded-lg transition-all cursor-pointer inline-flex items-center border border-transparent"
                                title="Hapus Data"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <p className="text-[10px] text-slate-400 font-semibold">
              Total basis data: <b>{filteredList.length} santri</b>.
            </p>
          </div>
        )}

        {/* MANUAL FORM VIEW */}
        {activeSubTab === 'manual' && (
          <div className="max-w-md mx-auto py-3 space-y-4">
            {successMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-900 rounded-lg text-xs font-semibold flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                {successMsg}
              </div>
            )}
            
            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-100 text-rose-800 rounded-lg text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleAddSingle} className="space-y-4 border border-slate-100 p-5 rounded-xl bg-slate-50/20">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Form Daftarkan Santri Baru</h3>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Nama Lengkap Santri</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Misal: Mochammad Bagas Saputra"
                    className="w-full px-3 py-2 bg-white border border-slate-200/80 rounded-lg text-xs focus:outline-hidden focus:border-slate-800 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Kelas (Format: Nama,kelas)</label>
                  <input
                    type="text"
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    placeholder="Contoh: 10-A atau IX-MTs"
                    className="w-full px-3 py-2 bg-white border border-slate-200/80 rounded-lg text-xs focus:outline-hidden focus:border-slate-800 transition-colors"
                  />
                </div>
              </div>

              <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                * Santri yang didaftarkan di sini akan langsung masuk di database autocomplete formulir pengajuan izin pulang.
              </p>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition-all cursor-pointer shadow-3xs"
                >
                  Daftarkan Santri
                </button>
              </div>
            </form>
          </div>
        )}

        {/* BULK MASSAL IMPORT VIEW (Simplified & Extremely Modern) */}
        {activeSubTab === 'bulk' && (
          <div className="space-y-4">
            {bulkFeedback && (
              <div className="p-3 bg-red-50 border border-red-150 text-red-900 rounded-lg text-xs font-semibold flex items-center gap-2">
                <Check className="w-4 h-4 text-red-600 shrink-0" />
                {bulkFeedback}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
              
              {/* Text Input & Drag/Drop Area */}
              <div className="lg:col-span-3 space-y-4">
                <div className="space-y-2">
                  <span className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                    Input Data Massal (Format: Nama,kelas)
                  </span>
                  <p className="text-[11px] text-slate-500 leading-normal font-medium">
                    Tulis atau paste daftar santri dengan format <code className="bg-slate-100 text-slate-700 px-1 py-0.5 rounded font-mono">Nama,kelas</code> perbaris. Anda juga bisa drag & drop file <code className="font-mono">.csv</code> atau <code className="font-mono">.txt</code> ke kotak di bawah.
                  </p>
                </div>

                {/* Drag and Drop Zone */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-5 text-center transition-all ${
                    isDragging 
                      ? 'border-slate-900 bg-slate-100/50' 
                      : 'border-slate-200 hover:border-slate-400 bg-slate-50/20'
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".csv,.txt"
                    className="hidden"
                  />
                  <UploadCloud className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-700">Drag & Drop file .txt/.csv di sini</p>
                  <p className="text-[10px] text-slate-400 mt-1">atau</p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-2 text-[11px] font-bold text-slate-900 px-2.5 py-1.5 border border-slate-300 rounded-md bg-white hover:bg-slate-50 transition-all cursor-pointer shadow-3xs"
                  >
                    Pilih File Komputer
                  </button>
                </div>

                {/* Text Area */}
                <div>
                  <textarea
                    rows={6}
                    value={bulkText}
                    onChange={handleTextareaChange}
                    placeholder="Contoh format:&#10;Ahmad Fauzi, 10-A&#10;Muhammad Ali, 11-B&#10;Zahra Amira, 12-B"
                    className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg p-3 leading-relaxed focus:outline-hidden focus:border-slate-800 transition-colors resize-none"
                  ></textarea>
                </div>

                <div className="flex gap-2 justify-end">
                  {bulkPreview.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setBulkText('');
                        setBulkPreview([]);
                      }}
                      className="px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-100 text-slate-500 font-bold text-xs transition-colors cursor-pointer"
                    >
                      Reset
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleApplyBulk}
                    disabled={bulkPreview.length === 0 || isSavingBulk}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition-all disabled:opacity-40 cursor-pointer flex items-center gap-1.5 shadow-2xs text-[11px]"
                  >
                    <UserCheck className="w-4 h-4 text-white" />
                    {isSavingBulk ? 'Sedang Menyimpan...' : `Simpan Massal (${bulkPreview.length} Santri)`}
                  </button>
                </div>
              </div>

              {/* Real-time Preview */}
              <div className="lg:col-span-2 bg-slate-50 border border-slate-150 rounded-xl p-4.5 space-y-3.5 flex flex-col h-[340px]">
                <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 font-bold">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  Pratinjau Hasil Parser ({bulkPreview.length})
                </h4>
                
                <div className="flex-1 overflow-y-auto border border-slate-100 bg-white rounded-lg p-3 text-[11px] divide-y divide-slate-100 shadow-3xs">
                  {bulkPreview.length === 0 ? (
                    <div className="h-full flex items-center justify-center p-4 text-center text-slate-400 font-medium">
                      Silakan ketik list santri di kiri atau unggah file untuk melihat pratinjau hasil deteksi otomatis di sini.
                    </div>
                  ) : (
                    bulkPreview.map((item, idx) => (
                      <div key={idx} className="py-2 flex justify-between items-center">
                        <div className="truncate pr-2">
                          <span className="font-bold text-slate-900 block truncate">{item.name}</span>
                          <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">Asrama Default</span>
                        </div>
                        <span className="bg-slate-100 border border-slate-150 text-slate-705 px-2 py-0.5 rounded-md font-bold text-[9px] shrink-0">
                          Kelas {item.className}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

      </div>

      {/* CUSTOM REUSABLE DELETE CONFIRMATION MODAL */}
      <ConfirmationModal
        isOpen={deleteConfirm.isOpen}
        title="Urus Hapus Data"
        message={`Apakah Anda yakin ingin menghapus data santri "${deleteConfirm.studentName}" secara permanen dari basis data sistem lokal?`}
        confirmLabel="Ya, Hapus Permanen"
        variant="danger"
        onConfirm={executeDelete}
        onCancel={() => setDeleteConfirm(prev => ({ ...prev, isOpen: false }))}
      />

      {/* CUSTOM REUSABLE BULK DELETE CONFIRMATION MODAL */}
      <ConfirmationModal
        isOpen={bulkDeleteConfirm.isOpen}
        title="Konfirmasi Hapus Massal"
        message={`Apakah Anda yakin ingin menghapus ${bulkDeleteConfirm.count} data santri terpilih secara permanen dan massal dari basis data sistem?`}
        confirmLabel="Ya, Hapus Semua Terpilih"
        variant="danger"
        onConfirm={executeBulkDelete}
        onCancel={() => setBulkDeleteConfirm({ isOpen: false, count: 0 })}
      />
      
    </div>
  );
}
