/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Filter, 
  MessageSquare, 
  CheckCircle, 
  XCircle, 
  ArrowRightLeft,
  Calendar,
  Layers,
  Phone,
  User,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Clock,
  ShieldAlert,
  Check,
  Trash2,
  AlertCircle
} from 'lucide-react';
import { LeavePermission, SheetsConfig, isPermissionLate, isSatpamPhone, getSatpamNameByPhone, replacePlaceholders } from '../types';
import ConfirmationModal from './ConfirmationModal';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface PermissionListProps {
  permissions: LeavePermission[];
  onUpdateStatus: (id: string, newStatus: LeavePermission['status']) => void;
  onUpdateStatusBulk?: (ids: string[], newStatus: LeavePermission['status']) => void;
  onCancelPermissionBulk?: (ids: string[]) => void;
  onSendNotification: (id: string) => void;
  syncWithSheets?: () => void;
  isSyncing?: boolean;
  currentUstadz: { name: string } | null;
  sheetsConfig: SheetsConfig;
}

export default function PermissionList({ 
  permissions, 
  onUpdateStatus, 
  onUpdateStatusBulk,
  onCancelPermissionBulk,
  onSendNotification,
  syncWithSheets,
  isSyncing,
  currentUstadz,
  sheetsConfig
}: PermissionListProps) {
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  
  // WhatsApp template selector state
  const [activeWaPermission, setActiveWaPermission] = useState<LeavePermission | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<'pending' | 'disetujui' | 'kembali' | 'terlambat'>('disetujui');
  const [waTarget, setWaTarget] = useState<'personal' | 'group' | 'satpam'>('personal');
  const [customText, setCustomText] = useState('');

  // Expand reason states
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  // Editing state
  const [editingPermission, setEditingPermission] = useState<LeavePermission | null>(null);
  const [editGName, setEditGName] = useState('');
  const [editGPhone, setEditGPhone] = useState('');
  const [editType, setEditType] = useState<'Pulang' | 'Keluar' | 'Sakit' | 'Lainnya'>('Pulang');
  const [editReason, setEditReason] = useState('');
  const [editSDate, setEditSDate] = useState('');
  const [editEDate, setEditEDate] = useState('');
  const [editRTime, setEditRTime] = useState('');
  const [editSatpamPhone, setEditSatpamPhone] = useState('');
  const [editSatpamName, setEditSatpamName] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [isEditingSaving, setIsEditingSaving] = useState(false);

  // Permission selection state
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([]);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Bulk operation confirmation modal state
  const [bulkProgressConfirm, setBulkProgressConfirm] = useState<{
    isOpen: boolean;
    status: LeavePermission['status'] | 'Delete' | null;
    count: number;
  }>({
    isOpen: false,
    status: null,
    count: 0
  });

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIds = filteredPermissions.map(p => p.id);
      setSelectedPermissionIds(allIds);
    } else {
      setSelectedPermissionIds([]);
    }
  };

  const triggerBulkAction = (actionStatus: LeavePermission['status'] | 'Delete') => {
    setBulkProgressConfirm({
      isOpen: true,
      status: actionStatus,
      count: selectedPermissionIds.length
    });
  };

  const executeBulkAction = async () => {
    if (!bulkProgressConfirm.status) return;
    
    const count = selectedPermissionIds.length;
    const actionStatus = bulkProgressConfirm.status;
    
    try {
      if (actionStatus === 'Delete') {
        if (onCancelPermissionBulk) {
          await onCancelPermissionBulk(selectedPermissionIds);
        } else {
          const promises = selectedPermissionIds.map(id => deleteDoc(doc(db, 'permissions', id)));
          await Promise.all(promises);
        }
        setSuccessMsg(`Berhasil menghapus ${count} pengajuan perizinan secara massal.`);
      } else {
        if (onUpdateStatusBulk) {
          await onUpdateStatusBulk(selectedPermissionIds, actionStatus);
        } else {
          const promises = selectedPermissionIds.map(id => {
            const perm = permissions.find(p => p.id === id);
            if (!perm) return Promise.resolve();
            const updateData: Partial<LeavePermission> = { status: actionStatus };
            if (actionStatus === 'Kembali') {
              updateData.returnedAt = new Date().toISOString();
            }
            if (!perm.createdByUstadz && currentUstadz) {
              updateData.createdByUstadz = currentUstadz.name;
            }
            return updateDoc(doc(db, 'permissions', id), updateData);
          });
          await Promise.all(promises);
        }
        setSuccessMsg(`Berhasil mengubah status ${count} perizinan menjadi "${actionStatus}" secara massal.`);
      }
    } catch (err) {
      console.error("Bulk action failed:", err);
      alert("Gagal melakukan aksi massal.");
    } finally {
      setSelectedPermissionIds([]);
      setBulkProgressConfirm({ isOpen: false, status: null, count: 0 });
      setTimeout(() => setSuccessMsg(null), 4000);
    }
  };

  const handleOpenEditModal = (permission: LeavePermission) => {
    setEditingPermission(permission);
    setEditGName(permission.guardianName);
    setEditGPhone(permission.guardianPhone === '-' ? '' : permission.guardianPhone);
    setEditType(permission.leaveType);
    setEditReason(permission.reason || '');
    setEditSDate(permission.startDate);
    setEditEDate(permission.endDate);
    setEditRTime(permission.returnTime || '17:00');
    setEditSatpamPhone(permission.satpamPhone || '');
    setEditSatpamName(permission.satpamName || '');
    setEditError(null);
  };

  const handleCancelPermission = async (permission: LeavePermission) => {
    if (window.confirm(`Apakah Anda yakin ingin MEMBATALKAN (menghapus secara permanen) data perizinan untuk ananda "${permission.studentName}" (${permission.id}) dari database?`)) {
      try {
        await deleteDoc(doc(db, 'permissions', permission.id));
      } catch (err: any) {
        console.error("Error deleting permission record:", err);
        alert("Gagal membatalkan perizinan: " + (err.message || err));
      }
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPermission) return;

    if (!editGName) {
      setEditError("Nama wali santri wajib diisi!");
      return;
    }

    const satpamOptions = [
      { label: 'Pos 1 (Utama)', phone: sheetsConfig?.satpamPhone, name: sheetsConfig?.satpamName },
      { label: 'Pos 2', phone: sheetsConfig?.satpamPhone2, name: sheetsConfig?.satpamName2 },
      { label: 'Pos 3', phone: sheetsConfig?.satpamPhone3, name: sheetsConfig?.satpamName3 },
      { label: 'Pos 4', phone: sheetsConfig?.satpamPhone4, name: sheetsConfig?.satpamName4 },
      { label: 'Pos 5', phone: sheetsConfig?.satpamPhone5, name: sheetsConfig?.satpamName5 },
    ];
    
    const selectedSatpam = satpamOptions.find(opt => opt.phone === editSatpamPhone);
    const finalSatpamName = selectedSatpam?.name || editSatpamName;

    setIsEditingSaving(true);
    setEditError(null);

    try {
      const updatedFields: Partial<LeavePermission> = {
        guardianName: editGName,
        guardianPhone: editGPhone || '-',
        leaveType: editType,
        reason: editReason,
        startDate: editSDate,
        endDate: editEDate,
        returnTime: editRTime,
        satpamPhone: editSatpamPhone,
        satpamName: finalSatpamName
      };

      await updateDoc(doc(db, 'permissions', editingPermission.id), updatedFields);
      setEditingPermission(null);
    } catch (err: any) {
      console.error("Error updating permission record:", err);
      setEditError(err.message || "Gagal memperbaharui data perizinan.");
    } finally {
      setIsEditingSaving(false);
    }
  };

  // Custom Inline Confirmation Modal State
  const [confirmData, setConfirmData] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    variant?: 'danger' | 'warning' | 'primary' | 'success';
    permissionId: string;
    newStatus: LeavePermission['status'];
  }>({
    isOpen: false,
    title: '',
    message: '',
    permissionId: '',
    newStatus: 'Pending',
  });

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Status badges colors (Simple & Clean Minimalist themes)
  const getStatusBadge = (status: LeavePermission['status'], isLate?: boolean) => {
    if (isLate) {
      return 'bg-red-50 border-red-305 text-red-750 font-extrabold animate-pulse';
    }
    switch (status) {
      case 'Pending':
        return 'bg-amber-50/70 border-amber-200/60 text-amber-850';
      case 'Disetujui':
        return 'bg-emerald-50/70 border-emerald-200/65 text-emerald-900 font-bold';
      case 'Ditolak':
        return 'bg-slate-50 border-slate-200 text-slate-500 line-through';
      case 'Sedang Berjalan':
        return 'bg-rose-50 border-rose-200 text-rose-700 font-bold animate-pulse';
      case 'Kembali':
        return 'bg-indigo-50 border-indigo-200 text-indigo-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  // Trigger Confirmation Modal for any leave actions
  const handleTriggerStatusChange = (id: string, newStatus: LeavePermission['status'], studentName: string) => {
    let title = '';
    let message = '';
    let confirmLabel = 'Konfirmasi';
    let variant: 'danger' | 'warning' | 'primary' | 'success' = 'primary';
    let targetStatus = newStatus;

    if (newStatus === 'Disetujui' || newStatus === 'Sedang Berjalan') {
      const currentPerm = permissions.find(p => p.id === id);
      const isPendingApproval = currentPerm?.status === 'Pending';
      
      if (isPendingApproval || newStatus === 'Disetujui') {
        title = 'Setujui & Izinkan Keluar';
        message = `Setujui pengajuan izin keluar santri "${studentName}" dan ubah statusnya secara langsung menjadi DILUAR?`;
        confirmLabel = 'Ya, Setujui & Berangkat';
        variant = 'success';
        targetStatus = 'Sedang Berjalan';
      } else {
        title = 'Konfirmasi Keberangkatan';
        message = `Status santri "${studentName}" akan diubah menjadi SEDANG BERJALAN (meninggalkan lingkungan pesantren)?`;
        confirmLabel = 'Ya, Berangkat';
        variant = 'primary';
        targetStatus = 'Sedang Berjalan';
      }
    } else if (newStatus === 'Ditolak') {
      title = 'Tolak Perizinan';
      message = `Yakin Anda ingin menolak surat pengajuan izin untuk santri "${studentName}"?`;
      confirmLabel = 'Ya, Tolak';
      variant = 'danger';
    } else if (newStatus === 'Kembali') {
      title = 'Konfirmasi Kembali';
      message = `Verifikasi bahwasanya santri "${studentName}" telah tiba kembali di asrama dengan selamat?`;
      confirmLabel = 'Ya, Konfirmasi Kembali';
      variant = 'success';
    }

    setConfirmData({
      isOpen: true,
      title,
      message,
      confirmLabel,
      variant,
      permissionId: id,
      newStatus: targetStatus,
    });
  };

  const handleExecuteStatusUpdate = () => {
    onUpdateStatus(confirmData.permissionId, confirmData.newStatus);
    setConfirmData(prev => ({ ...prev, isOpen: false }));
  };

  // Filter permission records
  const filteredPermissions = permissions.filter((p) => {
    const sMatch = searchTerm === '' || 
      p.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.guardianName.toLowerCase().includes(searchTerm.toLowerCase());
      
    const statusMatch = statusFilter === 'all' || 
      p.status === statusFilter ||
      (statusFilter === 'Sedang Berjalan' && p.status === 'Disetujui') ||
      (statusFilter === 'Disetujui' && p.status === 'Sedang Berjalan');
    const typeMatch = typeFilter === 'all' || p.leaveType === typeFilter;
    
    return sMatch && statusMatch && typeMatch;
  });

  // Calculate and generate WhatsApp message templates dynamically
  const generateWaText = (permission: LeavePermission, template: 'pending' | 'disetujui' | 'kembali' | 'terlambat', target: 'personal' | 'group' | 'satpam' = 'personal') => {
    if (target === 'satpam' && sheetsConfig?.waTemplateSatpam) {
      return replacePlaceholders(sheetsConfig.waTemplateSatpam, permission, sheetsConfig);
    }
    if (target === 'group' && sheetsConfig?.waTemplateGroup) {
      return replacePlaceholders(sheetsConfig.waTemplateGroup, permission, sheetsConfig);
    }
    if (target === 'personal' && template === 'disetujui' && sheetsConfig?.waTemplateWali) {
      return replacePlaceholders(sheetsConfig.waTemplateWali, permission, sheetsConfig);
    }

    const statusText = template === 'pending'
      ? '⏰ SEDANG DIPROSES'
      : template === 'disetujui'
        ? '🟢 DISETUJUI'
        : template === 'kembali'
          ? '🟣 KEMBALI KE PONDOK'
          : '⛔ TERLAMBAT (BELUM KEMBALI)';

    let header = template === 'pending'
      ? '*LAPORAN PENGAJUAN IZIN KELUAR SANTRI*'
      : template === 'disetujui'
        ? '*LAPORAN PERSETUJUAN IZIN KELUAR SANTRI*'
        : template === 'kembali'
          ? '*LAPORAN KEMBALI KE ASRAMA SANTRI*'
          : '*PERINGATAN KETERLAMBATAN KEMBALI KE PONDOK*';

    if (target === 'satpam') {
      header = '*PEMBERITAHUAN IZIN SANTRI UNTUK SATPAM / POS GERBANG*';
    }

    let bodyMsg = '';
    if (template === 'terlambat') {
      bodyMsg = `Yth. Wali Santri, berdasarkan pemantauan sistem perizinan kami, santri yang bersangkutan telah melewati batas jam kepulangan kembali ke pondok pesantren yang telah ditentukan. Mohon bantuannya untuk mengantarkan kembali santri tersebut atau mengonfirmasi kendala perjalanan kepada bagian Kesantrian/Asrama.`;
    } else if (target === 'satpam') {
      bodyMsg = 'Yth. Petugas Satpam, mohon verifikasi izin keluar masuk santri di atas pada gerbang kesantrian.';
    } else if (template === 'pending') {
      bodyMsg = 'Laporan perizinan saat ini sedang diproses. Mohon tunggu persetujuan dari dewan pengurus sebelum melakukan penjemputan.';
    } else if (template === 'disetujui') {
      bodyMsg = 'Santri diperbolehkan meninggalkan area pesantren. Silakan lakukan penjemputan dengan melaporkan rincian surat ini ke bagian Pos Keamanan.';
    } else if (template === 'kembali') {
      bodyMsg = 'Alhamdulillah, santri telah tiba kembali di asrama dengan selamat. Terima kasih atas bantuan bimbingan pengawasan dari pihak keluarga/wali.';
    }

    return `${header}
 
Assalamu'alaikum Wr. Wb.
Berikut disampaikan rincian data perizinan santri Pondok Pesantren:
 
• *Nama Santri*: ${permission.studentName}
• *Kelas*: ${permission.className}
• *Asrama*: ${permission.roomName || 'Asrama'}
• *Jenis Izin*: ${permission.leaveType}
• *Keperluan*: "${permission.reason}"
• *Mulai Izin*: ${permission.startDate}
• *Batas Kembali*: ${permission.endDate}${permission.returnTime ? ` pukul ${permission.returnTime} WIB` : ''}
• *Penangung Jawab/Wali*: ${(() => {
  const satpamInfo = getSatpamNameByPhone(permission.guardianPhone, sheetsConfig);
  if (satpamInfo) {
    return satpamInfo.name ? `${satpamInfo.name} (${satpamInfo.label})` : satpamInfo.label;
  }
  return permission.guardianName;
})()}
• *Kontak Wali*: ${permission.guardianPhone !== '-' ? permission.guardianPhone : 'Tidak Dicantumkan'}
• *Status*: ${statusText}
 
${bodyMsg}
 
Wassalamu'alaikum Wr. Wb.
_Kantor Pengasuhan Pondok Pesantren_`;
  };

  const handleOpenWaModal = (permission: LeavePermission) => {
    setActiveWaPermission(permission);
    // Auto-select template based on current status & lateness
    const isLate = isPermissionLate(permission);
    let defaultTemplate: 'pending' | 'disetujui' | 'kembali' | 'terlambat' = 'disetujui';
    if (permission.status === 'Pending') defaultTemplate = 'pending';
    if (permission.status === 'Kembali') defaultTemplate = 'kembali';
    if (isLate) defaultTemplate = 'terlambat';
    
    // Auto-detect target based on config & phone availability
    let defaultTarget: 'personal' | 'group' = 'personal';
    if (permission.guardianPhone === '-' && sheetsConfig?.whatsappGroupLink) {
      defaultTarget = 'group';
    } else if (sheetsConfig?.useWhatsAppGroup && sheetsConfig?.whatsappGroupLink) {
      defaultTarget = 'group';
    }

    setWaTarget(defaultTarget);
    setSelectedTemplate(defaultTemplate);
    setCustomText(generateWaText(permission, defaultTemplate, defaultTarget));
  };

  const handleChangeTemplate = (template: 'pending' | 'disetujui' | 'kembali' | 'terlambat') => {
    if (!activeWaPermission) return;
    setSelectedTemplate(template);
    setCustomText(generateWaText(activeWaPermission, template, waTarget));
  };

  const handleChangeTarget = (newTarget: 'personal' | 'group' | 'satpam') => {
    if (!activeWaPermission) return;
    setWaTarget(newTarget);
    setCustomText(generateWaText(activeWaPermission, selectedTemplate, newTarget));
  };

  const handleSendWhatsAppWeb = () => {
    if (!activeWaPermission) return;
    
    // Mark as notified in our backend
    onSendNotification(activeWaPermission.id);
    
    const encodedText = encodeURIComponent(customText);

    if (waTarget === 'group' && sheetsConfig?.whatsappGroupLink) {
      // Copy to clipboard
      navigator.clipboard.writeText(customText).then(() => {
        // Open Group Link
        window.open(sheetsConfig.whatsappGroupLink, '_blank', 'noopener,noreferrer');
      }).catch((err) => {
        // Fallback open
        window.open(sheetsConfig.whatsappGroupLink, '_blank', 'noopener,noreferrer');
      });
    } else if (waTarget === 'satpam' && sheetsConfig?.satpamPhone) {
      const cleanPhone = sheetsConfig.satpamPhone.replace(/[^0-9]/g, '');
      const waUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    } else {
      // Dispatch/Open WhatsApp Web Link
      const cleanPhone = activeWaPermission.guardianPhone;
      const targetPhone = cleanPhone === '-' ? '' : cleanPhone;
      const waUrl = `https://api.whatsapp.com/send?phone=${targetPhone}&text=${encodedText}`;
      
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    }
    
    setActiveWaPermission(null);
  };

  return (
    <div className="space-y-5">
      
      {/* Search and Filters Banner */}
      <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-2xs flex flex-col md:flex-row gap-3 justify-between items-stretch">
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari surat izin berdasarkan santri, ID, atau wali..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200/80 rounded-lg text-xs focus:outline-hidden focus:border-slate-800 focus:bg-white transition-all text-slate-800"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200/80 rounded-lg px-2 py-1.5 text-xs text-slate-600">
            <Filter className="w-3.5 h-3.5 text-slate-400 font-bold" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent border-none focus:outline-hidden text-xs font-semibold py-0.5 cursor-pointer text-slate-800"
            >
              <option value="all">Semua Status</option>
              <option value="Pending">⏰ Pending Pengurus</option>
              <option value="Disetujui">🟢 Disetujui</option>
              <option value="Sedang Berjalan">🔴 Sedang Diluar</option>
              <option value="Kembali">🟣 Sudah Kembali</option>
              <option value="Ditolak">❌ Ditolak</option>
            </select>
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200/80 rounded-lg px-2 py-1.5 text-xs text-slate-600">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-transparent border-none focus:outline-hidden text-xs font-semibold py-0.5 cursor-pointer text-slate-800"
            >
              <option value="all">Semua Jenis Izin</option>
              <option value="Pulang">Pulang Rumah</option>
              <option value="Keluar">Keluar Lingkungan</option>
              <option value="Sakit">Sakit / Medis</option>
              <option value="Lainnya">Lainnya</option>
            </select>
          </div>

          {/* Sync Trigger shortcut if available */}
          {syncWithSheets && (
            <button
              onClick={syncWithSheets}
              disabled={isSyncing}
              className="text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 rounded-lg px-3 py-1.5 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-2xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              {isSyncing ? 'Mengkoneksikan...' : 'Sync Sheet'}
            </button>
          )}
        </div>
      </div>

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-100 text-emerald-900 rounded-xl text-xs font-bold flex items-center gap-2 shadow-2xs">
          <CheckCircle className="w-4 h-4 text-emerald-650 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {filteredPermissions.length > 0 && (
        <div className="flex flex-col md:flex-row md:items-center justify-between p-3.5 bg-slate-50 border border-slate-200/60 rounded-xl text-xs text-slate-650 gap-3">
          <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800 select-none">
            <input
              type="checkbox"
              checked={filteredPermissions.length > 0 && selectedPermissionIds.length === filteredPermissions.length}
              onChange={handleSelectAll}
              className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer h-4 w-4"
            />
            <span>Pilih Semua Perizinan Sesuai Filter ({filteredPermissions.length})</span>
          </label>
          {selectedPermissionIds.length > 0 ? (
            <span className="text-[11px] font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-md">
              Terpilih {selectedPermissionIds.length} dari {filteredPermissions.length} Data
            </span>
          ) : (
            <span className="text-[10px] text-slate-400 font-semibold">
              Gunakan kotak centang di samping kiri kartu izin untuk memilih secara manual.
            </span>
          )}
        </div>
      )}

      {selectedPermissionIds.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between p-4 bg-indigo-50 border border-indigo-150 rounded-xl text-slate-800 gap-3.5 shadow-xs"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-indigo-650 shrink-0" />
            <p className="text-xs font-bold text-indigo-950">
              Aksi Massal Terpilih (<span className="font-extrabold text-indigo-800">{selectedPermissionIds.length}</span> perizinan):
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <button
              onClick={() => triggerBulkAction('Sedang Berjalan')}
              className="px-3 py-2 text-xs text-emerald-805 bg-white hover:bg-emerald-50 hover:border-emerald-300 border border-emerald-200 font-bold rounded-lg cursor-pointer transition-all flex items-center gap-1 shadow-3xs"
            >
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
              Setujui Massal
            </button>
            <button
              onClick={() => triggerBulkAction('Kembali')}
              className="px-3 py-2 text-xs text-indigo-800 bg-white hover:bg-indigo-50 hover:border-indigo-300 border border-indigo-200 font-bold rounded-lg cursor-pointer transition-all flex items-center gap-1 shadow-3xs"
            >
              <Check className="w-3.5 h-3.5 text-indigo-600" />
              Selesaikan Massal (Kembali)
            </button>
            <button
              onClick={() => triggerBulkAction('Ditolak')}
              className="px-3 py-2 text-xs text-slate-705 bg-white hover:bg-slate-100 border border-slate-205 font-bold rounded-lg cursor-pointer transition-all flex items-center gap-1 shadow-3xs"
            >
              <XCircle className="w-3.5 h-3.5 text-slate-500" />
              Tolak Massal
            </button>
            {currentUstadz && (
              <button
                onClick={() => triggerBulkAction('Delete')}
                className="px-3 py-2 text-xs text-rose-700 bg-rose-50 hover:bg-rose-105 border border-rose-200 font-bold rounded-lg cursor-pointer transition-all flex items-center gap-1 shadow-3xs"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                Batalkan Massal
              </button>
            )}
            <button
              onClick={() => setSelectedPermissionIds([])}
              className="px-3 py-2 text-xs text-slate-500 hover:text-slate-800 font-bold transition-all cursor-pointer"
            >
              Batalkan Pilihan
            </button>
          </div>
        </motion.div>
      )}

      {/* Main Table/List Area */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-2xs">
        {filteredPermissions.length === 0 ? (
          <div className="py-20 text-center text-slate-400 space-y-3">
            <XCircle className="w-10 h-10 mx-auto text-slate-300" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-800">Tidak ada pengajuan perizinan ditemukan</p>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">Atur ulang saringan atau cari kata kunci lain.</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredPermissions.map((permission) => {
              const isExpanded = !!expandedIds[permission.id];
              const isLate = isPermissionLate(permission);
              return (
                <div key={permission.id} className="p-4 md:p-5 hover:bg-slate-50/40 transition-all">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Selection Checkbox */}
                    <div className="flex items-center self-start md:self-auto py-1 shrink-0">
                      <input
                        type="checkbox"
                        checked={selectedPermissionIds.includes(permission.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedPermissionIds(prev => [...prev, permission.id]);
                          } else {
                            setSelectedPermissionIds(prev => prev.filter(id => id !== permission.id));
                          }
                        }}
                        className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer h-4 w-4"
                      />
                    </div>

                    {/* Student Info and ID */}
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-mono font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-md">
                          {permission.id}
                        </span>
                        <h3 className="font-bold text-sm text-slate-900 truncate">
                          {permission.studentName}
                        </h3>
                        <span className="text-[10px] text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md font-semibold">
                          {permission.className}
                        </span>
                        {permission.roomName && (
                          <span className="text-[10px] text-slate-400 font-medium">
                            ({permission.roomName})
                          </span>
                        )}
                      </div>
 
                      {/* Schedule dates details */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                        <span className="flex items-center gap-1 font-medium">
                          <Calendar className="w-3.5 h-3.5 text-slate-404" />
                          Mulai: <b className="text-slate-800 font-semibold">{permission.startDate}</b> s/d <b className="text-slate-800 font-semibold">{permission.endDate}</b>
                        </span>
                        {permission.returnTime && (
                          <span className="flex items-center gap-1 font-semibold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded text-[10px]">
                            <Clock className="w-3 h-3 text-rose-500" />
                            Kembali Akhir: {permission.returnTime}
                          </span>
                        )}
                        <span className="font-medium">
                          Tipe: <b className="text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-bold">{permission.leaveType}</b>
                        </span>
                      </div>
 
                      {/* Guardian and notification state */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-slate-404" />
                          Wali: <span className="font-semibold text-slate-700">
                            {(() => {
                              const satpamInfo = getSatpamNameByPhone(permission.guardianPhone, sheetsConfig);
                              if (satpamInfo) {
                                return satpamInfo.name ? `${satpamInfo.name} (${satpamInfo.label})` : satpamInfo.label;
                              }
                              return permission.guardianName;
                            })()}
                          </span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-slate-404" />
                          WA: <span className="font-mono text-slate-700 font-semibold">
                            {permission.guardianPhone}
                          </span>
                        </span>
                        {permission.notifiedAt && (
                          <span className="text-[10px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md font-bold flex items-center gap-1 border border-emerald-100">
                            <CheckCircle className="w-3 h-3 text-emerald-600" />
                            WA Terkirim
                          </span>
                        )}
                      </div>
                    </div>
 
                    {/* Status Badge & Dynamic Quick Action controls */}
                    <div className="flex items-center gap-3 self-start md:self-auto shrink-0 border-t md:border-t-0 border-slate-50 pt-3 md:pt-0 w-full md:w-auto justify-between md:justify-end">
                      <span className={`text-[11px] font-extrabold px-2.5 py-1 rounded-full border ${getStatusBadge(permission.status, isLate)}`}>
                        {isLate ? '⛔ TERLAMBAT (DILUAR)' : ((permission.status === 'Sedang Berjalan' || permission.status === 'Disetujui') ? 'DILUAR' : permission.status.toUpperCase())}
                      </span>

                      {/* Action buttons (only allowed as quick feedback, protected states are validated inside App.tsx controls) */}
                      <div className="flex gap-1.5">
                        {permission.status === 'Pending' && (
                          <>
                            <button
                              onClick={() => handleTriggerStatusChange(permission.id, 'Disetujui', permission.studentName)}
                              className="px-2.5 py-1.5 bg-emerald-55 hover:bg-emerald-100 text-emerald-800 rounded-lg border border-emerald-200 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-3xs"
                              title="Setujui Izin"
                            >
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-650" />
                              <span className="hidden sm:inline">Setujui</span>
                            </button>
                            <button
                              onClick={() => handleTriggerStatusChange(permission.id, 'Ditolak', permission.studentName)}
                              className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                              title="Tolak Izin"
                            >
                              <XCircle className="w-3.5 h-3.5 text-slate-500" />
                              <span className="hidden sm:inline">Tolak</span>
                            </button>
                          </>
                        )}

                        {(permission.status === 'Sedang Berjalan' || permission.status === 'Disetujui') && (
                          <button
                            onClick={() => handleTriggerStatusChange(permission.id, 'Kembali', permission.studentName)}
                            className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 rounded-lg border border-indigo-200 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                            title="Konfirmasi Kembali ke Pondok"
                          >
                            <CheckCircle className="w-3.5 h-3.5 text-indigo-655" />
                            <span>Kembali</span>
                          </button>
                        )}

                        {/* WhatsApp automated notify handler */}
                        {permission.status !== 'Ditolak' && (
                          <button
                            onClick={() => handleOpenWaModal(permission)}
                            className="p-1.5 bg-green-50/80 hover:bg-green-100 text-green-800 rounded-lg border border-green-200 transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-semibold animate-transition"
                            title="Kirim Pesan WhatsApp"
                          >
                            <MessageSquare className="w-4 h-4 text-green-600" />
                            <span className="hidden sm:inline">Kirim WA</span>
                          </button>
                        )}

                        {/* Edit and Cancel Options for Authenticated Ustadz */}
                        {currentUstadz && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(permission)}
                              className="p-1.5 bg-indigo-55/70 hover:bg-indigo-100 text-indigo-805 rounded-lg border border-indigo-200 transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                              title="Edit Detail Perizinan"
                            >
                              <span>✏️</span>
                              <span className="hidden sm:inline">Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCancelPermission(permission)}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg border border-rose-200 transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                              title="Batalkan perizinan"
                            >
                              <span>🗑️</span>
                              <span className="hidden sm:inline">Batalkan</span>
                            </button>
                          </>
                        )}

                        {/* Expander to see details */}
                        <button
                          onClick={() => toggleExpand(permission.id)}
                          className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded detail box */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden mt-3"
                      >
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-2.5 leading-relaxed text-slate-700">
                          <div>
                            <span className="font-extrabold text-[9px] uppercase tracking-wider text-slate-400 block">Alasan Detail Keperluan</span>
                            <p className="mt-1 text-slate-800 font-medium">{permission.reason || '-'}</p>
                          </div>
                          <div className="pt-2 border-t border-slate-200/60 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-[10px] text-slate-400 font-semibold">
                            <div>Waktu Pengajuan: <b>{new Date(permission.createdAt).toLocaleString('id-ID')}</b></div>
                            {permission.createdByUstadz && (
                              <div>Pemberi Izin: <b className="text-red-700 font-extrabold">{permission.createdByUstadz}</b></div>
                            )}
                            {permission.returnedAt && (
                              <div>Waktu Kembali: <b>{new Date(permission.returnedAt).toLocaleString('id-ID')}</b></div>
                            )}
                            {permission.notifiedAt && (
                              <div>Notifikasi Terakhir WA: <b>{new Date(permission.notifiedAt).toLocaleString('id-ID')}</b></div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* REUSABLE CUSTOM CONFIRMATION DIALOG */}
      <ConfirmationModal
        isOpen={confirmData.isOpen}
        title={confirmData.title}
        message={confirmData.message}
        confirmLabel={confirmData.confirmLabel}
        variant={confirmData.variant}
        onConfirm={handleExecuteStatusUpdate}
        onCancel={() => setConfirmData(prev => ({ ...prev, isOpen: false }))}
      />

      {/* BULK PERMISSION ACTION CONFIRMATION MODAL */}
      <ConfirmationModal
        isOpen={bulkProgressConfirm.isOpen}
        title={`Konfirmasi Aksi Massal: ${bulkProgressConfirm.status === 'Delete' ? 'Hapus/Batalkan' : bulkProgressConfirm.status}`}
        message={`Apakah Anda yakin ingin memproses ${bulkProgressConfirm.count} data perizinan terpilih secara massal dari basis data sistem?`}
        confirmLabel="Ya, Eksekusi Massal"
        variant={bulkProgressConfirm.status === 'Delete' || bulkProgressConfirm.status === 'Ditolak' ? 'danger' : 'success'}
        onConfirm={executeBulkAction}
        onCancel={() => setBulkProgressConfirm({ isOpen: false, status: null, count: 0 })}
      />

      {/* EDIT PERMISSION EDIT MODAL */}
      <AnimatePresence>
        {editingPermission && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-lg w-full overflow-hidden my-8"
            >
              <div className="p-5 border-b border-slate-150 flex justify-between items-center bg-slate-50">
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">Ubah Detail Perizinan Santri</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">ID Izin: {editingPermission.id} | Santri: {editingPermission.studentName}</p>
                </div>
                <button
                  onClick={() => setEditingPermission(null)}
                  className="text-slate-500 hover:text-slate-800 text-xs bg-slate-200/50 hover:bg-slate-200 px-2 py-1 rounded-md cursor-pointer transition-colors font-semibold"
                >
                  Tutup
                </button>
              </div>

              <form onSubmit={handleSaveEdit}>
                <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                  {editError && (
                    <div className="p-3 bg-rose-50 border border-rose-100 text-rose-800 rounded-lg text-xs font-bold leading-normal">
                      {editError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Nama Wali Santri</label>
                      <input
                        type="text"
                        value={editGName}
                        onChange={(e) => setEditGName(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-slate-800"
                        placeholder="Ketik nama wali..."
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">No. WhatsApp Wali</label>
                      <input
                        type="text"
                        value={editGPhone}
                        onChange={(e) => setEditGPhone(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono focus:outline-hidden focus:border-slate-800"
                        placeholder="Kosongkan jika tidak ada"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Jenis Perizinan</label>
                      <select
                        value={editType}
                        onChange={(e) => setEditType(e.target.value as any)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-hidden focus:border-slate-800 cursor-pointer"
                      >
                        <option value="Pulang">Pulang Rumah</option>
                        <option value="Keluar">Keluar Lingkungan</option>
                        <option value="Sakit">Sakit / Medis</option>
                        <option value="Lainnya">Lainnya</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Jam Kembali Akhir</label>
                      <input
                        type="text"
                        value={editRTime}
                        onChange={(e) => setEditRTime(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-slate-800"
                        placeholder="Contoh: 17:00"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Tanggal Mulai Izin</label>
                      <input
                        type="date"
                        value={editSDate}
                        onChange={(e) => setEditSDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Tanggal Selesai Izin</label>
                      <input
                        type="date"
                        value={editEDate}
                        onChange={(e) => setEditEDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-slate-800"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Alasan Detail Keperluan</label>
                    <textarea
                      rows={3}
                      value={editReason}
                      onChange={(e) => setEditReason(e.target.value)}
                      className="w-full p-3 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-slate-800 resize-none"
                      placeholder="Masukkan alasan detail..."
                    ></textarea>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 space-y-2 text-left">
                    <span className="text-[11px] font-extrabold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider block">
                      🛡️ Pilih Pos Satpam Penanggung Jawab
                    </span>
                    {(() => {
                      const satpamOptions = [
                        { label: 'Pos 1 (Utama)', phone: sheetsConfig?.satpamPhone, name: sheetsConfig?.satpamName },
                        { label: 'Pos 2', phone: sheetsConfig?.satpamPhone2, name: sheetsConfig?.satpamName2 },
                        { label: 'Pos 3', phone: sheetsConfig?.satpamPhone3, name: sheetsConfig?.satpamName3 },
                        { label: 'Pos 4', phone: sheetsConfig?.satpamPhone4, name: sheetsConfig?.satpamName4 },
                        { label: 'Pos 5', phone: sheetsConfig?.satpamPhone5, name: sheetsConfig?.satpamName5 },
                      ].filter(opt => !!opt.phone);

                      if (satpamOptions.length === 0) {
                        return <span className="text-[10px] text-slate-400 font-semibold block">Pos satpam tidak tersedia.</span>;
                      }

                      return (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {satpamOptions.map((opt, idx) => {
                            const isSelected = editSatpamPhone === opt.phone;
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                  setEditSatpamPhone(opt.phone || '');
                                  setEditSatpamName(opt.name || '');
                                }}
                                className={`p-2.5 rounded-lg border text-left text-[11px] transition-all cursor-pointer flex flex-col gap-0.5 ${
                                  isSelected
                                    ? 'bg-red-50 border-red-500 text-red-900 shadow-3xs'
                                    : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
                                }`}
                              >
                                <span className="font-extrabold text-[9px] uppercase tracking-wider block">{opt.label}</span>
                                <span className="font-bold text-slate-800 line-clamp-1 block">{opt.name || 'Petugas'}</span>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-150 flex justify-end gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setEditingPermission(null)}
                    className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-100 font-bold text-slate-655 transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isEditingSaving}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold shadow-xs transition-all cursor-pointer disabled:opacity-40"
                  >
                    {isEditingSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* WHATSAPP MODAL POPUP DIALOG */}
      <AnimatePresence>
        {activeWaPermission && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-lg w-full overflow-hidden"
            >
              <div className="p-5 border-b border-slate-150 flex justify-between items-center bg-slate-50">
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">Notifikasi Otomatis WhatsApp</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">Kirim pesan terformat rapi kepada Wali Santri</p>
                </div>
                <button
                  onClick={() => setActiveWaPermission(null)}
                  className="text-slate-500 hover:text-slate-800 text-xs bg-slate-200/50 hover:bg-slate-200 px-2 py-1 rounded-md cursor-pointer transition-colors font-semibold"
                >
                  Tutup
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* Switch template tab selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Pilih Template Pesan</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { key: 'pending', label: '⏰ Diproses' },
                      { key: 'disetujui', label: '🟢 Disetujui' },
                      { key: 'kembali', label: '🟣 Kembali' },
                      { key: 'terlambat', label: '⛔ Terlambat' }
                    ].map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => handleChangeTemplate(tab.key as any)}
                        className={`py-1.5 px-2 rounded-lg border text-[11px] font-bold transition-all text-center cursor-pointer truncate ${
                          selectedTemplate === tab.key
                            ? 'bg-slate-900 border-slate-900 text-white shadow-3xs'
                            : 'bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-550'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Edit template container */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Isi Teks Notifikasi (Boleh Diedit)</label>
                  <textarea
                    rows={7}
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg p-3 leading-relaxed focus:outline-hidden focus:border-slate-800 transition-colors resize-none"
                  ></textarea>
                </div>

                {/* Target Destination Switcher */}
                {(sheetsConfig?.whatsappGroupLink || sheetsConfig?.satpamPhone) && (
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Tujuan Notifikasi (WhatsApp)</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => handleChangeTarget('personal')}
                        disabled={activeWaPermission.guardianPhone === '-'}
                        className={`py-2 px-3 rounded-xl border text-[11px] font-bold transition-all text-center flex items-center justify-center gap-1.5 ${
                          activeWaPermission.guardianPhone === '-' ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                        } ${
                          waTarget === 'personal'
                            ? 'bg-slate-900 border-slate-900 text-white shadow-3xs'
                            : 'bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-550'
                        }`}
                      >
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        HP Wali
                      </button>

                      {sheetsConfig?.whatsappGroupLink && (
                        <button
                          type="button"
                          onClick={() => handleChangeTarget('group')}
                          className={`py-2 px-3 rounded-xl border text-[11px] font-bold transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer ${
                            waTarget === 'group'
                              ? 'bg-slate-900 border-slate-900 text-white shadow-3xs'
                              : 'bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-505 shadow-3xs'
                          }`}
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                          Grup WA
                        </button>
                      )}

                      {sheetsConfig?.satpamPhone && (
                        <button
                          type="button"
                          onClick={() => handleChangeTarget('satpam')}
                          className={`py-2 px-3 rounded-xl border text-[11px] font-bold transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer ${
                            waTarget === 'satpam'
                              ? 'bg-slate-900 border-slate-900 text-white shadow-3xs'
                              : 'bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-550'
                          }`}
                        >
                          <ShieldAlert className="w-3.5 h-3.5 text-slate-400" />
                          Pos Satpam
                        </button>
                      )}
                    </div>
                    {activeWaPermission.guardianPhone === '-' && waTarget === 'personal' && (
                      <p className="text-[10px] text-rose-600 mt-1.5 font-medium font-bold">
                        * Nomor HP Wali kosong. Silakan pilih Grup WhatsApp atau Pos Satpam.
                      </p>
                    )}
                  </div>
                )}

                {/* Receiver summary */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-slate-200 text-slate-700 rounded-md">
                      <Phone className="w-3.5 h-3.5" />
                    </span>
                    {waTarget === 'group' ? (
                      <div>
                        <span className="font-bold text-slate-900 block">Grup WhatsApp Pesantren</span>
                        <span className="text-[10px] text-slate-500 font-semibold block mt-0.5 truncate max-w-[240px]">Tautan: {sheetsConfig?.whatsappGroupLink}</span>
                      </div>
                    ) : waTarget === 'satpam' ? (
                      <div>
                        <span className="font-bold text-slate-900 block">Pos Satpam / Gerbang</span>
                        <span className="text-[10px] text-slate-500 font-semibold block mt-0.5">Tujuan: {sheetsConfig?.satpamPhone}</span>
                      </div>
                    ) : (
                      <div>
                        <span className="font-bold text-slate-900 block">{isSatpamPhone(activeWaPermission.guardianPhone, sheetsConfig) ? '-' : activeWaPermission.guardianName} (Wali)</span>
                        <span className="text-[10px] text-slate-500 font-semibold block mt-0.5">Tujuan: {isSatpamPhone(activeWaPermission.guardianPhone, sheetsConfig) ? '-' : activeWaPermission.guardianPhone}</span>
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded-md">
                    {waTarget === 'group' ? 'Salin & Buka Grup' : 'Direct Link'}
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="p-4 bg-slate-50/70 border-t border-slate-150 flex justify-end gap-2 text-xs">
                <button
                  onClick={() => setActiveWaPermission(null)}
                  className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-100 font-bold text-slate-655 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  onClick={handleSendWhatsAppWeb}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer hover:shadow-md"
                >
                  Kirim via WhatsApp
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
