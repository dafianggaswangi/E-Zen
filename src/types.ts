/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Ustadz {
  username: string;
  name: string;
  passcode: string; // Password / PIN to authenticate
  isVerified?: boolean; // New verification field for gatekeeping usage
}

export interface Santri {
  id: string;
  name: string;
  className: string;
  roomName: string;
  isBlacklisted?: boolean;
  blacklistReason?: string;
  unblacklistedAt?: string;
}

export interface LeavePermission {
  id: string;
  studentId: string;
  studentName: string;
  className: string;
  roomName: string;
  guardianName: string;
  guardianPhone: string;
  leaveType: 'Pulang' | 'Keluar' | 'Sakit' | 'Lainnya';
  reason: string;
  startDate: string;
  endDate: string;
  returnTime?: string; // Jam Kembali
  status: 'Pending' | 'Disetujui' | 'Ditolak' | 'Sedang Berjalan' | 'Kembali';
  createdAt: string;
  returnedAt?: string;
  notifiedAt?: string;
  createdByUstadz?: string; // Ustadz yang memberi izin
  satpamPhone?: string; // Nomor WhatsApp Satpam Pos Gerbang yang Bertugas
  satpamName?: string;  // Nama Satpam Pos Gerbang yang Bertugas
}

export interface SheetsConfig {
  sheetUrl: string;
  sheetId: string;
  apiKey: string;
  appsScriptUrl: string; // Alternative and much more powerful direct syncing method
  syncEnabled: boolean;
  lastSync?: string;
  whatsappGroupLink?: string; // Tautan Grup WhatsApp
  useWhatsAppGroup?: boolean; // Setelan default pengiriman ke grup WA
  satpamPhone?: string; // Nomor WhatsApp Satpam Pos Gerbang
  satpamName?: string;  // Nama Satpam / Petugas Pos Gerbang 1
  satpamPhone2?: string;
  satpamName2?: string; // Nama Satpam / Petugas Pos Gerbang 2
  satpamPhone3?: string;
  satpamName3?: string; // Nama Satpam / Petugas Pos Gerbang 3
  satpamPhone4?: string;
  satpamName4?: string; // Nama Satpam / Petugas Pos Gerbang 4
  satpamPhone5?: string;
  satpamName5?: string; // Nama Satpam / Petugas Pos Gerbang 5
  waTemplateWali?: string; // Custom template untuk Wali Santri
  waTemplateSatpam?: string; // Custom template untuk Satpam Pos Gerbang
  waTemplateGroup?: string; // Custom template untuk Grup WhatsApp
}

export function replacePlaceholders(
  template: string,
  permission: LeavePermission,
  config?: SheetsConfig
): string {
  if (!template) return '';
  
  const formattedSatpam = getSatpamNameByPhone(permission.guardianPhone, config);
  const guardianDisplay = formattedSatpam 
    ? (formattedSatpam.name ? `${formattedSatpam.name} (${formattedSatpam.label})` : formattedSatpam.label)
    : permission.guardianName;

  const placeholders: { [key: string]: string } = {
    '{{id}}': permission.id,
    '{{nama}}': permission.studentName,
    '{{kelas}}': permission.className,
    '{{asrama}}': permission.roomName || 'Asrama',
    '{{jenis_izin}}': permission.leaveType,
    '{{keperluan}}': permission.reason,
    '{{mulai}}': permission.startDate,
    '{{selesai}}': permission.endDate,
    '{{jam_kembali}}': permission.returnTime || '17:00',
    '{{wali}}': guardianDisplay,
    '{{kontak_wali}}': permission.guardianPhone !== '-' ? permission.guardianPhone : 'Tidak Dicantumkan',
    '{{status}}': permission.status,
  };

  let result = template;
  Object.entries(placeholders).forEach(([key, val]) => {
    const escapedKey = key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    result = result.replace(new RegExp(escapedKey, 'g'), val);
  });
  
  return result;
}

export function isSatpamPhone(phone: string, config?: {
  satpamPhone?: string;
  satpamPhone2?: string;
  satpamPhone3?: string;
  satpamPhone4?: string;
  satpamPhone5?: string;
}): boolean {
  if (!phone || phone === '-' || !config) return false;
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  if (!cleanPhone) return false;

  const satpams = [
    config.satpamPhone,
    config.satpamPhone2,
    config.satpamPhone3,
    config.satpamPhone4,
    config.satpamPhone5
  ].map(p => p ? p.replace(/[^0-9]/g, '') : '').filter(Boolean);

  return satpams.includes(cleanPhone);
}

export function getSatpamNameByPhone(phone: string, config?: SheetsConfig): { name: string; label: string } | null {
  if (!phone || phone === '-' || !config) return null;
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  if (!cleanPhone) return null;

  const satpams = [
    { label: 'Pos 1', phone: config.satpamPhone, name: config.satpamName },
    { label: 'Pos 2', phone: config.satpamPhone2, name: config.satpamName2 },
    { label: 'Pos 3', phone: config.satpamPhone3, name: config.satpamName3 },
    { label: 'Pos 4', phone: config.satpamPhone4, name: config.satpamName4 },
    { label: 'Pos 5', phone: config.satpamPhone5, name: config.satpamName5 },
  ];

  for (const s of satpams) {
    if (s.phone && s.phone.replace(/[^0-9]/g, '') === cleanPhone) {
      return {
        name: s.name || '',
        label: s.label
      };
    }
  }

  return null;
}

export function isPermissionLate(permission: { status: string; endDate: string; returnTime?: string }): boolean {
  if (permission.status !== 'Sedang Berjalan') return false;
  if (!permission.endDate) return false;
  
  const timeStr = permission.returnTime || '23:59';
  const parts = permission.endDate.split('-');
  const timeParts = timeStr.split(':');
  
  if (parts.length !== 3 || timeParts.length < 2) return false;
  
  const endDateTime = new Date(
    parseInt(parts[0]),
    parseInt(parts[1]) - 1, // month is 0-indexed
    parseInt(parts[2]),
    parseInt(timeParts[0]),
    parseInt(timeParts[1]),
    0
  );
  
  const now = new Date();
  return now > endDateTime;
}

export function wasPermissionLate(permission: { endDate: string; returnTime?: string; returnedAt?: string }): boolean {
  if (!permission.endDate || !permission.returnedAt) return false;
  
  const timeStr = permission.returnTime || '23:59';
  const parts = permission.endDate.split('-');
  const timeParts = timeStr.split(':');
  
  if (parts.length !== 3 || timeParts.length < 2) return false;
  
  const endDateTime = new Date(
    parseInt(parts[0]),
    parseInt(parts[1]) - 1, // month is 0-indexed
    parseInt(parts[2]),
    parseInt(timeParts[0]),
    parseInt(timeParts[1]),
    0
  );
  
  const returnedDateTime = new Date(permission.returnedAt);
  return returnedDateTime > endDateTime;
}

export function getLateOccurrencesByMonth(
  permissions: LeavePermission[],
  student: Santri
): { [monthKey: string]: LeavePermission[] } {
  const result: { [monthKey: string]: LeavePermission[] } = {};
  
  permissions.forEach(perm => {
    if (perm.studentId !== student.id) return;
    
    let isLate = false;
    let lateTime: string | null = null;
    
    if (perm.status === 'Sedang Berjalan') {
      isLate = isPermissionLate(perm);
      if (isLate) {
        // Approximate late time as the scheduled end date/time
        const timeStr = perm.returnTime || '23:59';
        const parts = perm.endDate.split('-');
        const timeParts = timeStr.split(':');
        if (parts.length === 3 && timeParts.length >= 2) {
          lateTime = new Date(
            parseInt(parts[0]),
            parseInt(parts[1]) - 1,
            parseInt(parts[2]),
            parseInt(timeParts[0]),
            parseInt(timeParts[1])
          ).toISOString();
        }
      }
    } else if (perm.status === 'Kembali') {
      isLate = wasPermissionLate(perm);
      if (isLate && perm.returnedAt) {
        lateTime = perm.returnedAt;
      }
    }
    
    if (isLate && perm.endDate) {
      // If student has an unblacklistedAt date, discard permissions that became late before that date
      if (student.unblacklistedAt && lateTime) {
        if (new Date(lateTime) <= new Date(student.unblacklistedAt)) {
          return; // Skip this one because it was before they were unblacklisted
        }
      }
      
      const parts = perm.endDate.split('-');
      if (parts.length === 3) {
        const monthKey = `${parts[0]}-${parts[1]}`; // e.g. "2026-05"
        if (!result[monthKey]) {
          result[monthKey] = [];
        }
        result[monthKey].push(perm);
      }
    }
  });
  
  return result;
}

export function getLatenessDuration(permission: { endDate: string; returnTime?: string; returnedAt?: string; status: string }): string {
  if (!permission.endDate) return '-';
  
  const timeStr = permission.returnTime || '23:59';
  const parts = permission.endDate.split('-');
  const timeParts = timeStr.split(':');
  
  if (parts.length !== 3 || timeParts.length < 2) return '-';
  
  const endDateTime = new Date(
    parseInt(parts[0]),
    parseInt(parts[1]) - 1, // month is 0-indexed
    parseInt(parts[2]),
    parseInt(timeParts[0]),
    parseInt(timeParts[1]),
    0
  );
  
  // If they have returned, compare with returned time; otherwise, compare with current time.
  const compareTime = permission.returnedAt ? new Date(permission.returnedAt) : new Date();
  const diffMs = compareTime.getTime() - endDateTime.getTime();
  if (diffMs <= 0) return '0 menit';
  
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const days = Math.floor(diffMinutes / (24 * 60));
  const hours = Math.floor((diffMinutes % (24 * 60)) / 60);
  const minutes = diffMinutes % 60;
  
  let resultStr = '';
  if (days > 0) resultStr += `${days} hari `;
  if (hours > 0) resultStr += `${hours} jam `;
  if (minutes > 0 || resultStr === '') resultStr += `${minutes} menit`;
  
  return resultStr.trim();
}

