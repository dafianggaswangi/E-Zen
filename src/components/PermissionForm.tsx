/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Search, 
  User, 
  Phone, 
  BookOpen, 
  Home, 
  Calendar, 
  FileText,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  ChevronDown,
  Clock
} from 'lucide-react';
import { Santri, LeavePermission, SheetsConfig, isSatpamPhone } from '../types';

interface PermissionFormProps {
  santriList: Santri[];
  permissions?: LeavePermission[];
  onSubmit: (permissionData: Omit<LeavePermission, 'id' | 'createdAt' | 'status'>) => void;
  onSubmitBulk?: (permissionsData: Omit<LeavePermission, 'id' | 'createdAt' | 'status'>[]) => Promise<void> | void;
  onAddSantri: (santri: Omit<Santri, 'id'>) => Santri;
  currentUstadz: { name: string } | null;
  sheetsConfig?: SheetsConfig;
}

export default function PermissionForm({ santriList, permissions = [], onSubmit, onSubmitBulk, onAddSantri, currentUstadz, sheetsConfig }: PermissionFormProps) {
  // Helper to check if student is currently outside (Sedang Berjalan/Disetujui)
  const isStudentOutside = (studentId?: string, name?: string) => {
    return permissions.some(p => 
      (p.status === 'Sedang Berjalan' || p.status === 'Disetujui') && 
      ((studentId && p.studentId === studentId) || (!studentId && name && p.studentName.toLowerCase().trim() === name.toLowerCase().trim()))
    );
  };
  // Form mode switcher
  const [formMode, setFormMode] = useState<'single' | 'bulk'>('single');
  const [bulkSearchQuery, setBulkSearchQuery] = useState('');
  const [selectedSantriIds, setSelectedSantriIds] = useState<string[]>([]);
  const [isSubmittingBulk, setIsSubmittingBulk] = useState(false);

  // Search student states
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedSantri, setSelectedSantri] = useState<Santri | null>(null);

  // Form states
  const [manualMode, setManualMode] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualClass, setManualClass] = useState('');
  
  const [guardianName, setGuardianName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [selectedSatpamPhone, setSelectedSatpamPhone] = useState('');
  
  // Guardian Search States & Data Extraction
  const [showGuardianSearch, setShowGuardianSearch] = useState(false);
  const [guardianSearchQuery, setGuardianSearchQuery] = useState('');

  const uniqueGuardians = React.useMemo(() => {
    const result: { name: string; phone: string; studentNames: string[] }[] = [];
    const seenPhones = new Set<string>();

    permissions.forEach(p => {
      if (!p.guardianPhone || p.guardianPhone === '-') return;
      // Skip helper/satpam phones if they happen to be in the database
      if (isSatpamPhone(p.guardianPhone, sheetsConfig)) return;

      const cleanPhone = p.guardianPhone.replace(/[^0-9]/g, '');
      if (!cleanPhone) return;

      if (!seenPhones.has(cleanPhone)) {
        seenPhones.add(cleanPhone);
        result.push({
          name: p.guardianName || 'Wali Santri',
          phone: p.guardianPhone,
          studentNames: p.studentName ? [p.studentName] : []
        });
      } else {
        const existing = result.find(r => r.phone.replace(/[^0-9]/g, '') === cleanPhone);
        if (existing) {
          if (p.guardianName && (!existing.name || existing.name === 'Wali Santri')) {
            existing.name = p.guardianName;
          }
          if (p.studentName && !existing.studentNames.includes(p.studentName)) {
            existing.studentNames.push(p.studentName);
          }
        }
      }
    });

    return result;
  }, [permissions, sheetsConfig]);

  const filteredGuardians = React.useMemo(() => {
    if (!guardianSearchQuery.trim()) return uniqueGuardians;
    const query = guardianSearchQuery.toLowerCase();
    return uniqueGuardians.filter(g => 
      g.name.toLowerCase().includes(query) ||
      g.phone.includes(query) ||
      g.studentNames.some(s => s.toLowerCase().includes(query))
    );
  }, [uniqueGuardians, guardianSearchQuery]);

  const handlePickDeviceContact = async () => {
    if (!('contacts' in navigator && 'ContactsManager' in window)) {
      alert('Browser atau Handphone Anda tidak mendukung Contact Picker API langsung. Silakan gunakan Google Chrome HP / Safari HTTPS, atau ketik kontak manual.');
      return;
    }
    try {
      const props = ['name', 'tel'];
      const opts = { multiple: false };
      // @ts-ignore
      const contacts = await navigator.contacts.select(props, opts);
      if (contacts && contacts.length > 0) {
        const contact = contacts[0];
        const name = contact.name && contact.name[0] ? contact.name[0] : '';
        let phone = contact.tel && contact.tel[0] ? contact.tel[0] : '';
        
        // Clean phone number format
        if (phone) {
          phone = phone.replace(/[^\d+]/g, ''); // keep only digits and plus sign
        }

        if (name) setGuardianName(name);
        if (phone) setGuardianPhone(phone);
      }
    } catch (err: any) {
      console.error('Pick contact error:', err);
      if (err.name !== 'AbortError') {
        alert('Gagal mengambil kontak handphone: ' + err.message);
      }
    }
  };

  const [leaveType, setLeaveType] = useState<'Pulang' | 'Keluar' | 'Sakit' | 'Lainnya'>('Pulang');
  const [reason, setReason] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [returnTime, setReturnTime] = useState('17:00');
  
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Set default dates and initialize satpam from config
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setStartDate(today);
    setEndDate(today);
  }, []);

  useEffect(() => {
    if (sheetsConfig) {
      const activeSatpam = sheetsConfig.satpamPhone || sheetsConfig.satpamPhone2 || sheetsConfig.satpamPhone3 || sheetsConfig.satpamPhone4 || sheetsConfig.satpamPhone5 || '';
      if (!selectedSatpamPhone) {
        setSelectedSatpamPhone(activeSatpam);
      }
    }
  }, [sheetsConfig]);

  // Filter student list
  const filteredSantri = santriList.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.className.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectSantri = (santri: Santri) => {
    setSelectedSantri(santri);
    setSearchQuery(santri.name);
    setShowDropdown(false);
    setManualMode(false);
    
    // Auto-fill mock guard data for realistic UX flow
    if (santri.name.includes('Ahmad')) {
      setGuardianName('Bapak Suryadi');
      setGuardianPhone('6281234567890');
    } else if (santri.name.includes('Zahra')) {
      setGuardianName('Ibu Ningsih');
      setGuardianPhone('6285298765432');
    } else if (santri.name.includes('Muhammad') || santri.name.includes('Rizky')) {
      setGuardianName('Bapak Hendra');
      setGuardianPhone('6281311223344');
    } else {
      setGuardianName('');
      setGuardianPhone('');
    }
  };

  const handleManualSwitch = () => {
    setManualMode(true);
    setSelectedSantri(null);
    setShowDropdown(false);
    setGuardianName('');
    setGuardianPhone('');
  };

  // Modern clean phone reformatter for WhatsApp Web Links
  const formatPhoneNumber = (phone: string): string => {
    let clean = phone.replace(/[^0-9]/g, '');
    if (clean.startsWith('0')) {
      clean = '62' + clean.slice(1);
    } else if (clean.startsWith('8')) {
      clean = '62' + clean;
    }
    return clean;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    // Validate student is specified
    let studentId = '';
    let studentName = '';
    let className = '';
    let roomName = 'Asrama';

    if (manualMode) {
      if (!manualName || !manualClass) {
        setErrorMsg('Silakan lengkapi data santri (Nama dan Kelas).');
        return;
      }
      
      const matchedSantri = santriList.find(s => s.name.trim().toLowerCase() === manualName.trim().toLowerCase());
      if (matchedSantri && matchedSantri.isBlacklisted) {
        setErrorMsg(`Tidak dapat menerbitkan izin. Santri manual "${matchedSantri.name}" saat ini diblacklist karena: ${matchedSantri.blacklistReason || 'Keterlambatan berulang'}. Hanya administrator yang bisa memulihkan.`);
        return;
      }

      // Register with Nama,kelas
      const newS = onAddSantri({
        name: manualName,
        className: manualClass,
        roomName: 'Asrama'
      });
      studentId = newS.id;
      studentName = newS.name;
      className = newS.className;
    } else {
      if (!selectedSantri) {
        setErrorMsg('Silakan pilih salah satu data santri aktif dari kolom pencarian.');
        return;
      }
      if (selectedSantri.isBlacklisted) {
        setErrorMsg(`Tidak dapat menerbitkan izin. Santri "${selectedSantri.name}" saat ini diblacklist karena: ${selectedSantri.blacklistReason || 'Keterlambatan berulang'}.`);
        return;
      }
      studentId = selectedSantri.id;
      studentName = selectedSantri.name;
      className = selectedSantri.className;
      roomName = selectedSantri.roomName || 'Asrama';
    }

    // Validate inputs
    if (!reason.trim()) {
      setErrorMsg('Alasan perizinan wajib dijabarkan.');
      return;
    }
    if (!startDate || !endDate) {
      setErrorMsg('Tanggal mulai & selesai izin wajib ditentukan.');
      return;
    }
    if (!returnTime) {
      setErrorMsg('Jam Kembali wajib ditentukan.');
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) {
      setErrorMsg('Tanggal selesai tidak bisa mendahului tanggal mulai.');
      return;
    }

    if (!selectedSatpamPhone) {
      setErrorMsg('Pemilihan Pos Satpam yang bertugas wajib dipilih.');
      return;
    }

    const satpamOptions = [
      { label: 'Pos 1 (Utama)', phone: sheetsConfig?.satpamPhone, name: sheetsConfig?.satpamName },
      { label: 'Pos 2', phone: sheetsConfig?.satpamPhone2, name: sheetsConfig?.satpamName2 },
      { label: 'Pos 3', phone: sheetsConfig?.satpamPhone3, name: sheetsConfig?.satpamName3 },
      { label: 'Pos 4', phone: sheetsConfig?.satpamPhone4, name: sheetsConfig?.satpamName4 },
      { label: 'Pos 5', phone: sheetsConfig?.satpamPhone5, name: sheetsConfig?.satpamName5 },
    ];
    const selectedSatpamOpt = satpamOptions.find(opt => opt.phone === selectedSatpamPhone);
    const resolvedSatpamName = selectedSatpamOpt ? (selectedSatpamOpt.name || selectedSatpamOpt.label) : 'Satpam';

    let finalGuardianName = guardianName.trim() || 'Wali Santri';
    
    let formattedPhone = '-';
    if (guardianPhone.trim()) {
      formattedPhone = formatPhoneNumber(guardianPhone);
      if (formattedPhone.length < 10) {
        setErrorMsg('Nomor WhatsApp wali tidak valid. Gunakan format standar seperti 0812xxxxxx.');
        return;
      }
    }

    if (isSatpamPhone(formattedPhone, sheetsConfig)) {
      finalGuardianName = '-';
    }

    // Call submit callback
    onSubmit({
      studentId,
      studentName,
      className,
      roomName,
      guardianName: finalGuardianName,
      guardianPhone: formattedPhone,
      leaveType,
      reason: reason.trim(),
      startDate,
      endDate,
      returnTime,
      satpamPhone: selectedSatpamPhone,
      satpamName: resolvedSatpamName
    });

    setSuccessMsg(`Pemberian izin santri atas nama "${studentName}" berhasil disimpan dengan status DIZINKAN!`);
    setTimeout(() => {
      setSuccessMsg(null);
    }, 8000);
    
    // Clear forms
    setSearchQuery('');
    setSelectedSantri(null);
    setManualName('');
    setManualClass('');
    setGuardianName('');
    setGuardianPhone('');
    setReturnTime('17:00');
    setReason('');
    setManualMode(false);
  };

  const handleSubmitBulk = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (selectedSantriIds.length === 0) {
      setErrorMsg('Silakan pilih minimal satu santri aktif.');
      return;
    }

    if (!reason.trim()) {
      setErrorMsg('Alasan perizinan wajib dijabarkan.');
      return;
    }

    if (!startDate || !endDate) {
      setErrorMsg('Tanggal mulai & selesai izin wajib ditentukan.');
      return;
    }

    if (!returnTime) {
      setErrorMsg('Jam Kembali wajib ditentukan.');
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) {
      setErrorMsg('Tanggal selesai tidak bisa mendahului tanggal mulai.');
      return;
    }

    if (!selectedSatpamPhone) {
      setErrorMsg('Pemilihan Pos Satpam yang bertugas wajib dipilih.');
      return;
    }

    const satpamOptions = [
      { label: 'Pos 1 (Utama)', phone: sheetsConfig?.satpamPhone, name: sheetsConfig?.satpamName },
      { label: 'Pos 2', phone: sheetsConfig?.satpamPhone2, name: sheetsConfig?.satpamName2 },
      { label: 'Pos 3', phone: sheetsConfig?.satpamPhone3, name: sheetsConfig?.satpamName3 },
      { label: 'Pos 4', phone: sheetsConfig?.satpamPhone4, name: sheetsConfig?.satpamName4 },
      { label: 'Pos 5', phone: sheetsConfig?.satpamPhone5, name: sheetsConfig?.satpamName5 },
    ];
    const selectedSatpamOpt = satpamOptions.find(opt => opt.phone === selectedSatpamPhone);
    const resolvedSatpamName = selectedSatpamOpt ? (selectedSatpamOpt.name || selectedSatpamOpt.label) : 'Satpam';

    let finalGuardianName = guardianName.trim() || 'Wali Santri / Ustadz';
    
    let formattedPhone = '-';
    if (guardianPhone.trim()) {
      formattedPhone = formatPhoneNumber(guardianPhone);
      if (formattedPhone.length < 10) {
        setErrorMsg('Nomor WhatsApp wali tidak valid. Gunakan format standar seperti 0812xxxxxx.');
        return;
      }
    }

    if (isSatpamPhone(formattedPhone, sheetsConfig)) {
      finalGuardianName = '-';
    }

    setIsSubmittingBulk(true);
    try {
      const bulkPermsData = selectedSantriIds.map((id) => {
        const s = santriList.find((item) => item.id === id)!;
        return {
          studentId: s.id,
          studentName: s.name,
          className: s.className,
          roomName: s.roomName || 'Asrama',
          guardianName: finalGuardianName,
          guardianPhone: formattedPhone,
          leaveType,
          reason: reason.trim(),
          startDate,
          endDate,
          returnTime,
          satpamPhone: selectedSatpamPhone,
          satpamName: resolvedSatpamName
        };
      });

      if (onSubmitBulk) {
        await onSubmitBulk(bulkPermsData);
      } else {
        for (const data of bulkPermsData) {
          onSubmit(data);
        }
      }

      setSuccessMsg(`Pemberian izin massal sebanyak ${selectedSantriIds.length} santri berhasil disimpan dengan status DIZINKAN!`);
      setTimeout(() => {
        setSuccessMsg(null);
      }, 8000);
      
      // Clear forms
      setSelectedSantriIds([]);
      setGuardianName('');
      setGuardianPhone('');
      setReturnTime('17:00');
      setReason('');
      setBulkSearchQuery('');
    } catch (err: any) {
      setErrorMsg(`Gagal mengajukan perizinan massal: ${err.message || err}`);
    } finally {
      setIsSubmittingBulk(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto bg-white rounded-xl border border-slate-100 p-5 md:p-6 shadow-2xs">
      <div className="border-b border-slate-100 pb-4 mb-5 flex justify-between items-center">
        <div>
          <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">Formulir Pemberian Perizinan Santri</h2>
          <p className="text-xs text-slate-500 mt-0.5">Formulir pemberian izin keluar pondok secara langsung dengan status DIZINKAN.</p>
        </div>
        {currentUstadz && (
          <span className="text-[10px] font-bold bg-slate-100 border border-slate-205 text-slate-800 px-2 py-0.5 rounded-sm shrink-0">
            ✍️ {currentUstadz.name}
          </span>
        )}
      </div>

      {/* SUB-TAB SWITCHER FOR MODE SELECT (Single vs Bulk) */}
      <div className="flex gap-1 bg-slate-50 p-1 rounded-xl mb-5 border border-slate-100 shadow-3xs">
        <button
          type="button"
          onClick={() => {
            setFormMode('single');
            setSuccessMsg(null);
            setErrorMsg(null);
          }}
          className={`flex-grow flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
            formMode === 'single'
              ? 'bg-white text-slate-900 shadow-3xs border border-slate-200/50 font-black'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
          }`}
        >
          <User className="w-3.5 h-3.5 text-slate-700" />
          Izin Tunggal (Satu Santri)
        </button>
        <button
          type="button"
          onClick={() => {
            setFormMode('bulk');
            setSuccessMsg(null);
            setErrorMsg(null);
          }}
          className={`flex-grow flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
            formMode === 'bulk'
              ? 'bg-white text-slate-900 shadow-3xs border border-slate-200/50 font-black'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
          }`}
        >
          <Plus className="w-3.5 h-3.5 text-red-600" />
          Izin Massal ({selectedSantriIds.length} Santri)
        </button>
      </div>

      <AnimatePresence mode="wait">
        {successMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -40, scale: 0.9, x: "-50%" }}
            animate={{ opacity: 1, y: 0, scale: 1, x: "-50%" }}
            exit={{ opacity: 0, y: -20, scale: 0.95, x: "-50%" }}
            className="fixed top-8 left-1/2 z-250 max-w-md w-[calc(100%-2rem)] bg-emerald-650 text-white p-4.5 rounded-2xl shadow-2xl border border-emerald-500/20 flex items-start gap-3.5 backdrop-blur-md"
            style={{ backgroundColor: '#059669' }}
          >
            <div className="p-2 bg-white/15 text-white rounded-xl border border-white/10 shrink-0">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 space-y-1 pr-6 text-left">
              <h4 className="font-extrabold text-xs text-white uppercase tracking-wider">BERHASIL DITERBITKAN 🎉</h4>
              <p className="text-xs text-emerald-50 font-semibold leading-relaxed">{successMsg}</p>
              <p className="text-[10px] text-emerald-100/90 font-medium leading-relaxed mt-0.5">
                Silakan buka log perizinan untuk mengirimkan notifikasi ke wali santri/satpam jika diperlukan.
              </p>
            </div>
            <button
              onClick={() => setSuccessMsg(null)}
              className="absolute top-3 right-3 text-white/70 hover:text-white hover:bg-white/10 w-6 h-6 rounded-lg transition-all font-bold text-xs flex items-center justify-center cursor-pointer"
              title="Tutup"
            >
              ✕
            </button>
          </motion.div>
        )}

        {errorMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-5 p-4 bg-rose-50 border border-rose-100 text-rose-805 rounded-lg flex items-start gap-2.5 text-xs font-semibold"
          >
            <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
            <p className="leading-relaxed">{errorMsg}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {formMode === 'single' ? (
        /* SINGLE MODE PERMISSION FORM */
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* SECTION 1: IDENTITAS SANTRI */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider font-bold">Langkah 1: Identitas Santri</h3>
              <button
                type="button"
                onClick={() => manualMode ? setManualMode(false) : handleManualSwitch()}
                className="text-[11px] font-bold text-slate-800 hover:underline transition-all cursor-pointer"
              >
                {manualMode ? 'Cari di database santri' : 'Ketik manual (Nama,kelas)'}
              </button>
            </div>

            {!manualMode ? (
              /* Autocomplete search field */
              <div className="relative">
                <label className="block text-xs font-bold text-slate-600 mb-1">Cari Nama Santri</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowDropdown(true);
                    }}
                    onFocus={() => setShowDropdown(true)}
                    placeholder="Ketik nama santri atau kelas..."
                    className="w-full pl-9 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-slate-800 focus:bg-white transition-all text-slate-800"
                  />
                  <button
                    type="button"
                    onClick={() => setShowDropdown(!showDropdown)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>

                {/* Suggestions dropdown list */}
                {showDropdown && (
                  <div className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-52 overflow-y-auto divide-y divide-slate-50">
                    {filteredSantri.length > 0 ? (
                      filteredSantri.map((santri) => {
                        const isOutside = isStudentOutside(santri.id, santri.name);
                        return (
                          <button
                            key={santri.id}
                            type="button"
                            onClick={() => {
                              if (santri.isBlacklisted) {
                                setErrorMsg(`Santri "${santri.name}" saat ini diblacklist karena: ${santri.blacklistReason || 'Keterlambatan berulang'}. Hanya administrator yang bisa memulihkan.`);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                return;
                              }
                              if (isOutside) {
                                setErrorMsg(`Santri "${santri.name}" sedang berada di luar pondok. Tidak dapat memberikan perizinan baru sebelum santri tersebut kembali.`);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                return;
                              }
                              handleSelectSantri(santri);
                            }}
                            className={`w-full text-left px-4 py-2 hover:bg-slate-50 text-xs transition-colors flex justify-between items-center cursor-pointer ${
                              santri.isBlacklisted ? 'bg-rose-50/40 hover:bg-rose-100/30' : isOutside ? 'bg-amber-50/50 hover:bg-amber-100/30 opacity-75' : ''
                            }`}
                          >
                            <div>
                              <span className={`font-extrabold block ${santri.isBlacklisted ? 'text-rose-900 line-through' : isOutside ? 'text-amber-900' : 'text-slate-900'}`}>{santri.name}</span>
                              <span className="text-[9px] text-slate-400 font-bold block mt-0.5">ID: {santri.id}</span>
                              {santri.isBlacklisted && (
                                <span className="inline-block text-[9px] bg-rose-100 border border-rose-200 text-rose-700 px-1.5 py-0.2 rounded-md font-bold mt-1">
                                  ⚠️ Blacklisted: {santri.blacklistReason}
                                </span>
                              )}
                              {isOutside && (
                                <span className="inline-block text-[9px] bg-amber-100 border border-amber-200 text-amber-805 px-1.5 py-0.2 rounded-md font-bold mt-1">
                                  🔴 SEDANG DI LUAR PONDOK
                                </span>
                              )}
                            </div>
                            <div className="text-right text-[10px]">
                              <span className="bg-slate-100 border border-slate-150 text-slate-700 px-2 py-0.5 rounded-md block font-extrabold">Kelas {santri.className}</span>
                            </div>
                          </button>
                        );
                      })
                    ) : (
                      <div className="p-3 text-center text-[10px] text-slate-400 space-y-1">
                        <p>Nama santri tidak ditemukan.</p>
                        <button
                          type="button"
                          onClick={handleManualSwitch}
                          className="text-slate-900 font-bold hover:underline cursor-pointer"
                        >
                          Input Manual Sekarang
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* Manual input fields in format: Nama, kelas */
              <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-150 space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-650 mb-1">Nama Lengkap Santri</label>
                  <input
                    type="text"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    placeholder="Ketik nama lengkap..."
                    className="w-full px-3 py-2 bg-white border border-slate-205 rounded-lg text-xs focus:outline-hidden focus:border-slate-800 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-650 mb-1">Kelas (Hasil parse: Nama,kelas)</label>
                  <input
                    type="text"
                    value={manualClass}
                    onChange={(e) => setManualClass(e.target.value)}
                    placeholder="Contoh: 10-A atau IX-MTS"
                    className="w-full px-3 py-2 bg-white border border-slate-205 rounded-lg text-xs focus:outline-hidden focus:border-slate-800 transition-colors"
                  />
                </div>
              </div>
            )}
          </div>

          {/* SECTION 2: IDENTITAS WALI */}
          <div className="space-y-3 pt-2.5 border-t border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider font-bold">Langkah 2: Penanggung Jawab / Wali</h3>
              <div className="flex flex-wrap items-center gap-1.5">
                {uniqueGuardians.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowGuardianSearch(true)}
                    className="px-2.5 py-1 text-[10.5px] bg-red-50 hover:bg-red-100 border border-red-200/60 text-red-700 font-extrabold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Search className="w-3 h-3 text-red-650" />
                    Cari Kontak ({uniqueGuardians.length})
                  </button>
                )}
                <button
                  type="button"
                  onClick={handlePickDeviceContact}
                  className="px-2.5 py-1 text-[10.5px] bg-slate-100 hover:bg-slate-200 border border-slate-250 text-slate-705 font-extrabold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                  title="Ambil otomatis nomor dari Kontak Telepon HP Anda"
                >
                  <span className="text-xs">📱</span> Pilih Kontak HP
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-655 mb-1 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-405" />
                  Nama Wali Santri
                </label>
                <input
                  type="text"
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                  placeholder="Contoh: Ayah Suryadi atau Ibu Fatmawati"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-slate-800 focus:bg-white transition-all text-slate-850"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-655 mb-1 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-slate-405" />
                  No. WhatsApp Wali (Opsional)
                </label>
                <input
                  type="text"
                  value={guardianPhone}
                  onChange={(e) => setGuardianPhone(e.target.value)}
                  placeholder="Contoh: 081234567890"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-slate-800 focus:bg-white transition-all text-slate-850 font-mono"
                />
                <span className="text-[9px] text-slate-400 mt-1 block font-medium">Kosongkan jika wali tidak memiliki WhatsApp atau menggunakan wali asrama.</span>
              </div>
              
              <div className="md:col-span-2 space-y-2 mt-2 bg-slate-50 border border-slate-200/60 p-4 rounded-xl text-left">
                <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                  🛡️ Pilih Pos Satpam yang Bertugas (Wajib) <span className="text-rose-500">*</span>
                </span>
                <p className="text-[10px] text-slate-400 font-semibold mb-2">Petugas keamanan pos ini bertanggung jawab memverifikasi keluar masuk gerbang santri.</p>
                {(() => {
                  const satpamOptions = [
                    { label: 'Pos 1 (Utama)', phone: sheetsConfig?.satpamPhone, name: sheetsConfig?.satpamName },
                    { label: 'Pos 2', phone: sheetsConfig?.satpamPhone2, name: sheetsConfig?.satpamName2 },
                    { label: 'Pos 3', phone: sheetsConfig?.satpamPhone3, name: sheetsConfig?.satpamName3 },
                    { label: 'Pos 4', phone: sheetsConfig?.satpamPhone4, name: sheetsConfig?.satpamName4 },
                    { label: 'Pos 5', phone: sheetsConfig?.satpamPhone5, name: sheetsConfig?.satpamName5 },
                  ].filter(opt => !!opt.phone);

                  if (satpamOptions.length === 0) {
                    return (
                      <div className="p-3 bg-amber-50 border border-amber-250 text-amber-700 rounded-lg text-[10px] font-black">
                        Peringatan: Belum ada nomor WhatsApp Satpam yang dikonfigurasikan di menu Database. Harap hubungi Admin Utama.
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 w-full">
                      {satpamOptions.map((opt, idx) => {
                        const displayName = opt.name ? `${opt.name} (${opt.label.replace(' (Utama)', '')})` : opt.label;
                        const isSelected = selectedSatpamPhone === opt.phone;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setSelectedSatpamPhone(opt.phone || '')}
                            className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1 ${
                              isSelected
                                ? 'bg-red-50 border-red-550 text-red-900 shadow-3xs ring-2 ring-red-500/10'
                                : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
                            }`}
                          >
                            <span className="text-[10px] font-black uppercase tracking-wider block">{opt.label}</span>
                            <span className="text-xs font-black text-slate-800 line-clamp-1 block">{opt.name || 'Petugas'}</span>
                            <span className="text-[10px] font-mono text-slate-500 block">{opt.phone}</span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* SECTION 3: DETAIL PERIZINAN */}
          <div className="space-y-3 pt-2.5 border-t border-slate-100">
            <h3 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider font-bold">Langkah 3: Alasan & Jadwal Izin</h3>
            
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-2">Jenis Perizinan</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  { key: 'Pulang', label: 'Pulang Rumah', desc: 'Selesai masa sekolah' },
                  { key: 'Keluar', label: 'Keluar Lingkungan', desc: 'Keperluan singkat' },
                  { key: 'Sakit', label: 'Izin Sakit', desc: 'Urusan medis / klinik' },
                  { key: 'Lainnya', label: 'Hal Mendesak', desc: 'Urusan darurat sanak' }
                ].map((type) => (
                  <button
                    key={type.key}
                    type="button"
                    onClick={() => setLeaveType(type.key as any)}
                    className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between h-20 ${
                      leaveType === type.key
                        ? 'bg-slate-900 border-slate-900 text-white shadow-3xs'
                        : 'bg-white border-slate-200 hover:border-slate-350 text-slate-600'
                    }`}
                  >
                    <span className="text-xs font-semibold block">{type.label}</span>
                    <span className={`text-[9px] mt-0.5 leading-tight block ${leaveType === type.key ? 'text-slate-250 font-medium' : 'text-slate-400 font-semibold'}`}>{type.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-655 mb-1 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-slate-405" />
                Alasan Keperluan Izin
              </label>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Berikan alasan detail kepergian santri... (misal: Berobat gigi ke Klinik Permata Mulia)"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-slate-800 focus:bg-white transition-all text-slate-850 resize-none leading-relaxed"
              ></textarea>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-655 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-405" />
                  Tanggal Keberangkatan
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-slate-850 font-mono text-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-655 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-405" />
                  Tanggal Selesai/Kembali
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-slate-850 font-mono text-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-655 mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-405" />
                  Jam Harus Kembali
                </label>
                <input
                  type="time"
                  value={returnTime}
                  onChange={(e) => setReturnTime(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-slate-850 font-mono text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* SUBMIT BUTTON */}
          <div className="pt-3 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-5 py-2.5 rounded-lg shadow-3xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-emerald-450" />
              Berikan Perizinan Santri
            </button>
          </div>
        </form>
      ) : (
        /* BULK GROUP MODE PERMISSION FORM */
        <form onSubmit={handleSubmitBulk} className="space-y-4">
          {/* SECTION 1: PILIH Kelompok SANTRI */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider font-bold">Langkah 1: Pilih Kelompok Santri</h3>
              <span className="text-[11px] font-extrabold text-red-700 bg-red-50 border border-red-100 px-2 py-0.5 rounded-md">
                Terpilih: {selectedSantriIds.length} Santri
              </span>
            </div>

            <div className="relative">
              <label className="block text-xs font-bold text-slate-600 mb-1">Cari & Checkmark Daftar Santri</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Search className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={bulkSearchQuery}
                  onChange={(e) => setBulkSearchQuery(e.target.value)}
                  placeholder="Ketik nama santri atau kelas untuk difilter..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-slate-800 focus:bg-white transition-all text-slate-800"
                />
              </div>
            </div>

            {/* Scrollable checklists */}
            <div className="border border-slate-150 rounded-lg max-h-48 overflow-y-auto divide-y divide-slate-100 bg-slate-50/50">
              {santriList
                .filter(s => 
                  !s.isBlacklisted && 
                  (s.name.toLowerCase().includes(bulkSearchQuery.toLowerCase()) || 
                  s.className.toLowerCase().includes(bulkSearchQuery.toLowerCase()))
                )
                .map((santri) => {
                  const isChecked = selectedSantriIds.includes(santri.id);
                  const isOutside = isStudentOutside(santri.id, santri.name);
                  return (
                    <button
                      key={santri.id}
                      type="button"
                      onClick={() => {
                        if (isOutside) {
                          setErrorMsg(`Santri "${santri.name}" sedang berada di luar pondok dan belum kembali. Silakan lakukan konfirmasi kepulangan terlebih dahulu di daftar izin.`);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                          return;
                        }
                        if (isChecked) {
                          setSelectedSantriIds(prev => prev.filter(id => id !== santri.id));
                        } else {
                          setSelectedSantriIds(prev => [...prev, santri.id]);
                        }
                      }}
                      className={`w-full text-left px-4 py-2 hover:bg-slate-100 text-xs flex justify-between items-center transition-colors cursor-pointer ${
                        isChecked ? 'bg-red-50/50 hover:bg-red-50' : isOutside ? 'opacity-60 bg-amber-50/20 hover:bg-amber-50/30' : 'bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-4.5 h-4.5 rounded border flex items-center justify-center transition-all ${
                          isOutside ? 'bg-amber-105 border-amber-300' : isChecked ? 'bg-red-600 border-red-600 text-white' : 'bg-white border-slate-300'
                        }`}>
                          {isOutside ? <span className="text-[9px] leading-none mb-0.5">⚠️</span> : isChecked && <Plus className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                        <div>
                          <span className={`font-extrabold block ${isOutside ? 'text-amber-900' : 'text-slate-900'}`}>
                            {santri.name}
                            {isOutside && (
                              <span className="inline-block text-[8px] bg-amber-105 border border-amber-250 text-amber-805 px-1 py-0.2 rounded-md font-extrabold ml-1.5 align-middle">
                                🔴 DI LUAR
                              </span>
                            )}
                          </span>
                          <span className="text-[9px] text-slate-400 font-bold block mt-0.5">ID: {santri.id}</span>
                        </div>
                      </div>
                      <span className="bg-slate-100 border border-slate-150 text-slate-700 px-2 py-0.5 rounded-md font-extrabold text-[10px]">
                        Kelas {santri.className}
                      </span>
                    </button>
                  );
                })}
              {santriList.filter(s => !s.isBlacklisted).length === 0 && (
                <div className="p-4 text-center text-slate-400 text-xs">
                  Tidak ada santri aktif yang terdaftar di sistem.
                </div>
              )}
            </div>

            {/* Selected items tags */}
            {selectedSantriIds.length > 0 && (
              <div className="p-3 bg-red-50/10 border border-red-100/50 rounded-xl space-y-2">
                <span className="block text-[9px] font-extrabold text-red-500 uppercase tracking-wider">
                  Daftar Pilihan Santri:
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {selectedSantriIds.map((id) => {
                    const santri = santriList.find(s => s.id === id);
                    if (!santri) return null;
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 text-[10px] bg-slate-900 text-white pl-2 pr-1.5 py-0.5 rounded-md font-bold"
                      >
                        <span>{santri.name} ({santri.className})</span>
                        <button
                          type="button"
                          onClick={() => setSelectedSantriIds(prev => prev.filter(x => x !== id))}
                          className="hover:text-rose-400 font-extrabold text-xs ml-1 px-1 flex items-center justify-center cursor-pointer select-none"
                        >
                          &times;
                        </button>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* SECTION 2: IDENTITAS WALI (Common for group) */}
          <div className="space-y-3 pt-2.5 border-t border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider font-bold">Langkah 2: Penanggung Jawab / Pengasuhan</h3>
              <div className="flex flex-wrap items-center gap-1.5">
                {uniqueGuardians.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowGuardianSearch(true)}
                    className="px-2.5 py-1 text-[10.5px] bg-red-50 hover:bg-red-100 border border-red-200/60 text-red-700 font-extrabold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Search className="w-3 h-3 text-red-650" />
                    Cari Kontak ({uniqueGuardians.length})
                  </button>
                )}
                <button
                  type="button"
                  onClick={handlePickDeviceContact}
                  className="px-2.5 py-1 text-[10.5px] bg-slate-100 hover:bg-slate-200 border border-slate-250 text-slate-705 font-extrabold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                  title="Ambil otomatis nomor dari Kontak Telepon HP Anda"
                >
                  <span className="text-xs">📱</span> Pilih Kontak HP
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-655 mb-1 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-405" />
                  Nama Wali / Penanggung Jawab
                </label>
                <input
                  type="text"
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                  placeholder="Contoh: Kesantrian Abu Bakar atau Wali Kelas"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-slate-800 focus:bg-white transition-all text-slate-850"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-655 mb-1 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-slate-405" />
                  No. WhatsApp Penanggung Jawab (Opsional)
                </label>
                <input
                  type="text"
                  value={guardianPhone}
                  onChange={(e) => setGuardianPhone(e.target.value)}
                  placeholder="Contoh: 081234567890"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-slate-800 focus:bg-white transition-all text-slate-850 font-mono"
                />
              </div>
              
              <div className="md:col-span-2 space-y-2 mt-2 bg-slate-50 border border-slate-200/60 p-4 rounded-xl text-left">
                <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                  🛡️ Pilih Pos Satpam yang Bertugas (Wajib) <span className="text-rose-500">*</span>
                </span>
                <p className="text-[10px] text-slate-400 font-semibold mb-2">Petugas keamanan pos ini bertanggung jawab memverifikasi keluar masuk gerbang santri massal.</p>
                {(() => {
                  const satpamOptions = [
                    { label: 'Pos 1 (Utama)', phone: sheetsConfig?.satpamPhone, name: sheetsConfig?.satpamName },
                    { label: 'Pos 2', phone: sheetsConfig?.satpamPhone2, name: sheetsConfig?.satpamName2 },
                    { label: 'Pos 3', phone: sheetsConfig?.satpamPhone3, name: sheetsConfig?.satpamName3 },
                    { label: 'Pos 4', phone: sheetsConfig?.satpamPhone4, name: sheetsConfig?.satpamName4 },
                    { label: 'Pos 5', phone: sheetsConfig?.satpamPhone5, name: sheetsConfig?.satpamName5 },
                  ].filter(opt => !!opt.phone);

                  if (satpamOptions.length === 0) {
                    return (
                      <div className="p-3 bg-amber-50 border border-amber-250 text-amber-700 rounded-lg text-[10px] font-black">
                        Peringatan: Belum ada nomor WhatsApp Satpam yang dikonfigurasikan di menu Database. Harap hubungi Admin Utama.
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 w-full">
                      {satpamOptions.map((opt, idx) => {
                        const displayName = opt.name ? `${opt.name} (${opt.label.replace(' (Utama)', '')})` : opt.label;
                        const isSelected = selectedSatpamPhone === opt.phone;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setSelectedSatpamPhone(opt.phone || '')}
                            className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1 ${
                              isSelected
                                ? 'bg-red-50 border-red-550 text-red-900 shadow-3xs ring-2 ring-red-500/10'
                                : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
                            }`}
                          >
                            <span className="text-[10px] font-black uppercase tracking-wider block">{opt.label}</span>
                            <span className="text-xs font-black text-slate-800 line-clamp-1 block">{opt.name || 'Petugas'}</span>
                            <span className="text-[10px] font-mono text-slate-500 block">{opt.phone}</span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* SECTION 3: PARAMETER PERIZINAN */}
          <div className="space-y-3 pt-2.5 border-t border-slate-100">
            <h3 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider font-bold">Langkah 3: Aturan Perizinan Massal</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-655 mb-1 flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5 text-slate-405" />
                  Pilih Jenis Perizinan
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    { key: 'Pulang', label: 'Izin Pulang', desc: 'Kembali kerumah keluarga' },
                    { key: 'Keluar', label: 'Izin Keluar', desc: 'Keluar komplek sementara' },
                    { key: 'Sakit', label: 'Izin Sakit', desc: 'Pulang/Rujukan medis luar' },
                    { key: 'Lainnya', label: 'Lain-lain', desc: 'Keperluan mendesak lain' }
                  ].map((type) => (
                    <button
                      key={type.key}
                      type="button"
                      onClick={() => setLeaveType(type.key as any)}
                      className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between h-20 ${
                        leaveType === type.key
                          ? 'bg-red-800 border-red-800 text-white shadow-3xs'
                          : 'bg-white border-slate-200 hover:border-slate-350 text-slate-600'
                      }`}
                    >
                      <span className="text-xs font-semibold block">{type.label}</span>
                      <span className={`text-[9px] mt-0.5 leading-tight block ${leaveType === type.key ? 'text-red-200' : 'text-slate-400 font-semibold'}`}>{type.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-655 mb-1 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-slate-405" />
                  Alasan Keperluan Perizinan Kelompok
                </label>
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Berikan alasan detail kepergian kelompok... (misal: Rihlah kesantrian / Ziarah bersama)"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-slate-800 focus:bg-white transition-all text-slate-850 resize-none leading-relaxed"
                ></textarea>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-655 mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-405" />
                    Tanggal Keberangkatan
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-slate-850 font-mono text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-655 mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-405" />
                    Tanggal Selesai/Kembali
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-slate-850 font-mono text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-655 mb-1 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-405" />
                    Jam Harus Kembali
                  </label>
                  <input
                    type="time"
                    value={returnTime}
                    onChange={(e) => setReturnTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-slate-850 font-mono text-slate-800"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SUBMIT BUTTON */}
          <div className="pt-3 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={selectedSantriIds.length === 0 || isSubmittingBulk}
              className={`bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-5 py-2.5 rounded-lg shadow-3xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <Plus className="w-4 h-4 text-white shrink-0" />
              {isSubmittingBulk ? 'Sedang Memproses...' : `Berikan Perizinan Massal (${selectedSantriIds.length} Santri)`}
            </button>
          </div>
        </form>
      )}

      {/* Searchable Guardian Modal Overlay */}
      <AnimatePresence>
        {showGuardianSearch && (
          <div className="fixed inset-0 z-250 flex items-center justify-center p-4">
            {/* Background Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowGuardianSearch(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
            />
            {/* Modal Container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-md w-full overflow-hidden relative z-10 flex flex-col max-h-[85vh] text-left"
            >
              {/* Header */}
              <div className="p-4 bg-slate-50 border-b border-slate-150 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Cari Kontak Wali Tersimpan</h3>
                  <p className="text-[10px] text-slate-505 font-medium mt-0.5">Memuat data dari seluruh riwayat izin perizinan di sistem</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGuardianSearch(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors font-bold text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Search input bar */}
              <div className="p-3 bg-slate-50 border-b border-slate-150">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={guardianSearchQuery}
                    onChange={(e) => setGuardianSearchQuery(e.target.value)}
                    placeholder="Masukkan nama wali, No. WA, atau nama santri..."
                    className="w-full pl-9 pr-8 py-2 bg-white border border-slate-205 rounded-xl text-xs focus:outline-hidden focus:border-slate-800 transition-all font-semibold text-slate-800"
                    autoFocus
                  />
                  {guardianSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setGuardianSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Contacts list scrollable container */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-white">
                {filteredGuardians.length === 0 ? (
                  <div className="py-12 text-center space-y-2">
                    <span className="text-3xl block">🔍</span>
                    <p className="text-xs text-slate-400 font-extrabold">Data tidak ditemukan</p>
                    <p className="text-[10px] text-slate-400 font-medium max-w-xs mx-auto px-4">
                      Pastikan ejaan benar atau gunakan kata kunci pencarian yang lain.
                    </p>
                  </div>
                ) : (
                  filteredGuardians.map((g, idx) => (
                    <button
                      type="button"
                      key={idx}
                      onClick={() => {
                        setGuardianName(g.name);
                        setGuardianPhone(g.phone);
                        setShowGuardianSearch(false);
                        setGuardianSearchQuery('');
                      }}
                      className="w-full text-left p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all flex items-start gap-3 cursor-pointer group"
                    >
                      <div className="p-2 bg-slate-100 group-hover:bg-red-50 text-slate-500 group-hover:text-red-600 rounded-xl transition-all shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-900 group-hover:text-red-700 block truncate transition-colors">
                            {g.name}
                          </span>
                          <span className="text-[10px] font-mono font-bold text-slate-500 group-hover:text-red-600 transition-colors whitespace-nowrap">
                            {g.phone}
                          </span>
                        </div>
                        {g.studentNames.length > 0 && (
                          <p className="text-[10px] text-slate-500 font-semibold mt-0.5 truncate leading-tight">
                            Santri: <span className="text-slate-800 font-bold">{g.studentNames.join(', ')}</span>
                          </p>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>

              {/* Footer stats badge */}
              <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
                <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-widest block">
                  Total {uniqueGuardians.length} Kontak Wali Terdeteksi
                </span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
