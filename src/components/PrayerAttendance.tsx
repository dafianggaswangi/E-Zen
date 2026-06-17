/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle, 
  Circle, 
  Search, 
  Clock, 
  Calendar, 
  Users, 
  BookOpen, 
  Activity, 
  Check, 
  UserX, 
  UserCheck, 
  Smile, 
  Frown, 
  AlertCircle,
  TrendingUp,
  Award
} from 'lucide-react';
import { Santri, LeavePermission } from '../types';
import { collection, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): string {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return error instanceof Error ? error.message : String(error);
}

interface PrayerAttendanceProps {
  santriList: Santri[];
  permissions: LeavePermission[];
  firebaseReady?: boolean;
}

type AttendanceStatus = 'Hadir' | 'Masbuk' | 'Sakit' | 'Izin' | 'Alfa';

interface AttendanceRecord {
  studentId: string;
  studentName: string;
  className: string;
  roomName: string;
  status: AttendanceStatus;
  markedAt: string;
}

export default function PrayerAttendance({ santriList, permissions, firebaseReady = true }: PrayerAttendanceProps) {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  
  const [selectedPrayer, setSelectedPrayer] = useState<'Shubuh' | 'Dzuhur' | 'Ashar' | 'Maghrib' | 'Isya'>(() => {
    const hour = new Date().getHours();
    if (hour >= 4 && hour < 11) return 'Shubuh';
    if (hour >= 11 && hour < 15) return 'Dzuhur';
    if (hour >= 15 && hour < 17) return 'Ashar';
    if (hour >= 17 && hour < 19) return 'Maghrib';
    return 'Isya';
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('all');
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceStatus>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filter students who are currently inside the boarding school
  // Exclude students who have active permissions ("Sedang Berjalan") and those blacklisted
  const activeLeavingStudentIds = new Set(
    permissions
      .filter(p => p.status === 'Sedang Berjalan')
      .map(p => p.studentId)
  );

  const studentsInside = santriList.filter(
    s => !activeLeavingStudentIds.has(s.id) && !s.isBlacklisted
  );

  const uniqueClasses = Array.from(new Set(studentsInside.map(s => s.className).filter(Boolean))).sort();

  // Load attendance records from Firestore based on date + prayer time
  useEffect(() => {
    if (!firebaseReady) {
      setIsLoading(true);
      return;
    }

    setIsLoading(true);
    setError(null);
    const docId = `${selectedDate}_${selectedPrayer}`;
    const docRef = doc(db, 'prayerAttendance', docId);

    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const records = data.records as Record<string, AttendanceStatus> || {};
        setAttendanceMap(records);
      } else {
        // Initialize with empty attendance
        setAttendanceMap({});
      }
      setIsLoading(false);
    }, (err) => {
      console.error("Error fetching prayer attendance:", err);
      setIsLoading(false);
      const errMsg = handleFirestoreError(err, OperationType.GET, `prayerAttendance/${docId}`);
      setError(errMsg);
    });

    return () => unsubscribe();
  }, [selectedDate, selectedPrayer, firebaseReady]);

  // Handle marking status for a single student
  const handleMarkStatus = async (studentId: string, status: AttendanceStatus) => {
    const student = santriList.find(s => s.id === studentId);
    if (!student) return;

    const newMap = { ...attendanceMap, [studentId]: status };
    setAttendanceMap(newMap);

    const docId = `${selectedDate}_${selectedPrayer}`;
    try {
      await setDoc(doc(db, 'prayerAttendance', docId), {
        date: selectedDate,
        prayer: selectedPrayer,
        updatedAt: new Date().toISOString(),
        records: newMap
      });
    } catch (err) {
      console.error("Error writing prayer attendance:", err);
      const errMsg = handleFirestoreError(err, OperationType.WRITE, `prayerAttendance/${docId}`);
      setError(errMsg);
    }
  };

  // Quick action: Mark all unassigned/all filtered students as 'Hadir'
  const handleMarkAllFilteredAsHadir = async () => {
    const docId = `${selectedDate}_${selectedPrayer}`;
    const newMap = { ...attendanceMap };

    filteredStudents.forEach(st => {
      newMap[st.id] = 'Hadir';
    });

    setAttendanceMap(newMap);
    setSaveStatus("Mengetik semua santri sebagai HADIR...");

    try {
      await setDoc(doc(db, 'prayerAttendance', docId), {
        date: selectedDate,
        prayer: selectedPrayer,
        updatedAt: new Date().toISOString(),
        records: newMap
      });
      setSaveStatus("Berhasil menandai semua santri Hadir!");
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      console.error("Error writing bulk attendance:", err);
      setSaveStatus("Gagal menyimpan bulk absensi.");
      setTimeout(() => setSaveStatus(null), 3000);
      const errMsg = handleFirestoreError(err, OperationType.WRITE, `prayerAttendance/${docId}`);
      setError(errMsg);
    }
  };

  const filteredStudents = studentsInside.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          s.className.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          s.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClass = selectedClassFilter === 'all' || s.className === selectedClassFilter;
    return matchesSearch && matchesClass;
  });

  // Calculate dynamic stats based on filtered student list
  const totalStudents = studentsInside.length;
  const countHadir = studentsInside.filter(s => attendanceMap[s.id] === 'Hadir').length;
  const countMasbuk = studentsInside.filter(s => attendanceMap[s.id] === 'Masbuk').length;
  const countSakit = studentsInside.filter(s => attendanceMap[s.id] === 'Sakit').length;
  const countIzin = studentsInside.filter(s => attendanceMap[s.id] === 'Izin').length;
  const countAlfa = studentsInside.filter(s => attendanceMap[s.id] === 'Alfa').length;
  const countNotMarked = totalStudents - (countHadir + countMasbuk + countSakit + countIzin + countAlfa);

  const attendancePercentage = totalStudents > 0 
    ? Math.round(((countHadir + countMasbuk) / totalStudents) * 100) 
    : 0;

  return (
    <div className="space-y-6">
      
      {error && (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl text-xs font-bold flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="block font-black uppercase text-[10px] tracking-wider text-amber-700">Peringatan Akses Server</span>
            <span className="block leading-relaxed">{error}</span>
          </div>
        </div>
      )}
      
      {/* 1. TOP OVERVIEW DASHBOARD */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        {/* Dynamic percentage card */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 flex items-center gap-4 shadow-3xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-50 rounded-full blur-2xl -mr-8 -mt-8 opacity-40"></div>
          <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center text-red-600 shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <span className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">Kehadiran Berjamaah</span>
            <span className="block text-2xl font-black text-slate-900 tracking-tight mt-0.5">{attendancePercentage}%</span>
            <span className="block text-[9px] text-slate-500 font-extrabold mt-0.5">{countHadir + countMasbuk} / {totalStudents} Santri di Dalam</span>
          </div>
        </div>

        {/* Total students inside card */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 flex items-center gap-4 shadow-3xs">
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-650 shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">Santri di Dalam Pondok</span>
            <span className="block text-2xl font-black text-slate-900 tracking-tight mt-0.5">{totalStudents} Anak</span>
            <span className="block text-[9px] text-emerald-600 font-extrabold mt-0.5">Wajib Shalat Berjamaah</span>
          </div>
        </div>

        {/* Hadir / Masbuk Card */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 flex items-center gap-4 shadow-3xs">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <span className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">Hadir / Masbuk</span>
            <span className="block text-xl font-black text-emerald-700 tracking-tight mt-0.5">{countHadir} / {countMasbuk} Santri</span>
            <span className="block text-[9px] text-slate-500 font-semibold mt-0.5">Sudah melapor di saff mushalla</span>
          </div>
        </div>

        {/* Absent Card */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 flex items-center gap-4 shadow-3xs">
          <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
            <UserX className="w-6 h-6" />
          </div>
          <div>
            <span className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">Sakit / Uzur / Ghoib</span>
            <span className="block text-xl font-black text-amber-700 tracking-tight mt-0.5">{countSakit + countIzin} / {countAlfa} Santri</span>
            <span className="block text-[9px] text-rose-500 font-extrabold mt-0.5">{countNotMarked} Santri belum absen</span>
          </div>
        </div>
      </div>

      {/* 2. PARAMETERS CONFIGURATION */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-2xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        
        {/* Date Selector & Prayer Times */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-slate-50 px-3.5 py-1.5 rounded-xl border border-slate-200/60 text-xs font-bold w-full sm:w-auto">
            <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent border-none p-0 focus:ring-0 text-slate-700 w-full"
            />
          </div>

          {/* Shalat times buttons */}
          <div className="bg-slate-100 p-1 rounded-xl flex gap-1 w-full sm:w-auto overflow-x-auto">
            {(['Shubuh', 'Dzuhur', 'Ashar', 'Maghrib', 'Isya'] as const).map((pr) => {
              const isActive = selectedPrayer === pr;
              return (
                <button
                  key={pr}
                  type="button"
                  onClick={() => setSelectedPrayer(pr)}
                  className={`px-3 py-1.5 rounded-lg text-center transition-all text-xs font-black cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-red-800 text-white shadow-3xs'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  {pr}
                </button>
              );
            })}
          </div>
        </div>

        {/* Stats Summary message */}
        <div className="text-[11px] font-semibold text-slate-400 leading-normal text-left sm:text-right w-full md:w-auto">
          * Data absensi disinkronkan secara otomatis di server database cloud.
        </div>
      </div>

      {/* 3. SHALAT LIST TABLE WITH SELECTIONS */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-2xs overflow-hidden">
        
        {/* Sub-Header: Search & Bulk Action Buttons */}
        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50/20">
          
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto flex-1 max-w-2xl">
            {/* Search inputs */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari nama santri di dalam pondok..."
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:border-red-650"
              />
            </div>

            {/* Class filter inside prayer */}
            <div className="w-full sm:w-48 shrink-0">
              <select
                value={selectedClassFilter}
                onChange={(e) => setSelectedClassFilter(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-205 rounded-xl text-xs focus:outline-hidden focus:border-red-650 text-slate-700 font-bold cursor-pointer"
              >
                <option value="all">📂 Semua Kelas ({totalStudents})</option>
                {uniqueClasses.map((cl, idx) => {
                  const count = studentsInside.filter(s => s.className === cl).length;
                  return (
                    <option key={idx} value={cl}>
                      🏫 Kelas {cl} ({count})
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          <div className="flex gap-2 items-center w-full md:w-auto shrink-0">
            {saveStatus && (
              <span className="text-[10px] text-emerald-700 font-bold animate-pulse">
                {saveStatus}
              </span>
            )}
            <button
              onClick={handleMarkAllFilteredAsHadir}
              disabled={filteredStudents.length === 0}
              className="w-full sm:w-auto px-4 py-2 bg-red-600 hover:bg-red-750 text-white font-extrabold text-xs rounded-xl transition-all shadow-3xs cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-40"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              Tandai Semua Hadir ({filteredStudents.length} Santri)
            </button>
          </div>
        </div>

        {/* Search feedback result list */}
        {isLoading ? (
          <div className="py-20 text-center text-slate-400">
            <div className="animate-spin h-5 w-5 border-2 border-red-600 border-t-transparent rounded-full mx-auto mb-2"></div>
            <span className="text-xs font-semibold">Mengunduh data kehadiran dari Firestore...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-705 text-[10px] uppercase tracking-wider font-extrabold border-b border-slate-150 select-none">
                <tr>
                  <th className="px-5 py-3.5">Santri ID</th>
                  <th className="px-5 py-3.5">Nama Lengkap</th>
                  <th className="px-5 py-3.5">Kelas</th>
                  <th className="px-5 py-3.5 text-center">Status Kehadiran Shalat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-12 text-slate-400 font-semibold">
                      Tidak ada santri di dalam pesantren yang ditemukan untuk kriteria ini.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((st) => {
                    const currentStatus = attendanceMap[st.id] || null;
                    return (
                      <tr key={st.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3.5 font-mono font-bold text-slate-400">{st.id}</td>
                        <td className="px-5 py-3.5">
                          <span className="font-extrabold text-slate-800 text-sm block">{st.name}</span>
                          <span className="text-[10px] text-slate-450 mt-0.5 block font-bold">🏠 {st.roomName || 'Asrama Pondok'}</span>
                        </td>
                        <td className="px-5 py-3.5 font-bold text-slate-505">{st.className}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex justify-center items-center gap-1 sm:gap-1.5">
                            {[
                              { id: 'Hadir', label: 'Hadir', activeClass: 'bg-emerald-600 text-white font-extrabold', inactiveClass: 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100/50 font-bold border-emerald-100' },
                              { id: 'Masbuk', label: 'Masbuk', activeClass: 'bg-amber-505 text-white bg-amber-600 font-extrabold', inactiveClass: 'bg-amber-50 text-amber-600 hover:bg-amber-100/50 font-bold border-amber-100' },
                              { id: 'Sakit', label: 'Sakit', activeClass: 'bg-sky-600 text-white font-extrabold', inactiveClass: 'bg-sky-50 text-sky-600 hover:bg-sky-101/50 font-bold border-sky-100' },
                              { id: 'Izin', label: 'Izin', activeClass: 'bg-purple-600 text-white font-extrabold', inactiveClass: 'bg-purple-50 text-purple-600 hover:bg-purple-101/50 font-bold border-purple-100' },
                              { id: 'Alfa', label: 'Alfa', activeClass: 'bg-rose-600 text-white font-extrabold', inactiveClass: 'bg-rose-50 text-rose-600 hover:bg-rose-101/50 font-bold border-rose-100' },
                            ].map((opt) => {
                              const isSelected = currentStatus === opt.id;
                              return (
                                <button
                                  key={opt.id}
                                  type="button"
                                  onClick={() => handleMarkStatus(st.id, opt.id as AttendanceStatus)}
                                  className={`px-2 py-1 md:px-3 text-[10px] rounded-lg border transition-all duration-150 cursor-pointer ${
                                    isSelected 
                                      ? opt.activeClass + ' scale-102 shadow-3xs' 
                                      : opt.inactiveClass + ' border-transparent'
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-[10.5px] font-bold text-slate-400">
          <span>Menampilkan {filteredStudents.length} santri beraktivitas di dalam asrama.</span>
          <span>E-Zen Attendance Engine</span>
        </div>
      </div>
    </div>
  );
}
