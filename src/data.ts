/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Santri, LeavePermission, Ustadz } from './types';

export const INITIAL_USTADZ: Ustadz[] = [
  { username: 'admin', name: 'Ustadz Abdullah', passcode: '246810' },
  { username: 'fauzi', name: 'Ustadz Fauzi Ahmad', passcode: '246810' }
];

export const INITIAL_SANTRI: Santri[] = [
  { id: 'S001', name: 'Ahmad Faiz Rabbani', className: '10-A (Ula)', roomName: 'Kamar Al-Ghazali' },
  { id: 'S002', name: 'Zahra Muthmainnah', className: '11-B (Wustha)', roomName: 'Kamar Fatimah Az-Zahra' },
  { id: 'S003', name: 'Muhammad Rizky', className: '12-A (Ulya)', roomName: 'Kamar Ibnu Sina' },
  { id: 'S004', name: 'Fatimah Az-Zahra', className: '10-C (Ula)', roomName: 'Kamar Siti Khadijah' },
  { id: 'S005', name: 'M. Ali Shiddiq', className: '11-A (Wustha)', roomName: 'Kamar Al-Farabi' },
  { id: 'S006', name: 'Annisa Nur Cahaya', className: '12-B (Ulya)', roomName: 'Kamar Aisyah' },
  { id: 'S007', name: 'Luqman Hakim', className: '10-B (Ula)', roomName: 'Kamar Syathibi' },
  { id: 'S008', name: 'Khadijah Al-Kubro', className: '11-C (Wustha)', roomName: 'Kamar Siti Aminah' }
];

export const INITIAL_LEAVE_PERMISSIONS: LeavePermission[] = [
  {
    id: 'IZN-2026-001',
    studentId: 'S001',
    studentName: 'Ahmad Faiz Rabbani',
    className: '10-A (Ula)',
    roomName: 'Kamar Al-Ghazali',
    guardianName: 'H. Suryadi',
    guardianPhone: '6281234567890',
    leaveType: 'Pulang',
    reason: 'Acara pernikahan kakak kandung di kampung halaman',
    startDate: '2026-06-01',
    endDate: '2026-06-05',
    status: 'Disetujui',
    createdAt: '2026-05-30T02:30:00Z'
  },
  {
    id: 'IZN-2026-002',
    studentId: 'S002',
    studentName: 'Zahra Muthmainnah',
    className: '11-B (Wustha)',
    roomName: 'Kamar Fatimah Az-Zahra',
    guardianName: 'Ibu Ningsih',
    guardianPhone: '6285298765432',
    leaveType: 'Sakit',
    reason: 'Demam tinggi selama 2 hari, perlu istirahat total di rumah',
    startDate: '2026-05-29',
    endDate: '2026-06-02',
    status: 'Sedang Berjalan',
    createdAt: '2026-05-29T08:15:00Z'
  },
  {
    id: 'IZN-2026-003',
    studentId: 'S003',
    studentName: 'Muhammad Rizky',
    className: '12-A (Ulya)',
    roomName: 'Kamar Ibnu Sina',
    guardianName: 'Bpk. Hendra',
    guardianPhone: '6281311223344',
    leaveType: 'Keluar',
    reason: 'Membeli perlengkapan kitab dan obat pribadi di apotek terdekat',
    startDate: '2026-05-31',
    endDate: '2026-05-31',
    status: 'Kembali',
    createdAt: '2026-05-31T01:00:00Z',
    returnedAt: '2026-05-31T04:30:00Z'
  },
  {
    id: 'IZN-2026-004',
    studentId: 'S004',
    studentName: 'Fatimah Az-Zahra',
    className: '10-C (Ula)',
    roomName: 'Kamar Siti Khadijah',
    guardianName: 'Ibu Fatmawati',
    guardianPhone: '6281299887766',
    leaveType: 'Pulang',
    reason: 'Ada urusan keluarga darurat (pemakaman kerabat)',
    startDate: '2026-06-02',
    endDate: '2026-06-04',
    status: 'Pending',
    createdAt: '2026-05-31T05:00:00Z'
  }
];
