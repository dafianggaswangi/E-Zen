/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart3, 
  FileText, 
  Users, 
  FileSpreadsheet, 
  Menu, 
  Lock, 
  Unlock, 
  ShieldAlert, 
  ShieldCheck,
  FolderOpen,
  Info,
  CheckCircle,
  AlertCircle,
  Megaphone,
  MessageSquare
} from 'lucide-react';

import { Santri, LeavePermission, SheetsConfig, Ustadz, getLateOccurrencesByMonth } from './types';
import { INITIAL_SANTRI, INITIAL_LEAVE_PERMISSIONS, INITIAL_USTADZ } from './data';
import Dashboard from './components/Dashboard';
import PermissionForm from './components/PermissionForm';
import PermissionList from './components/PermissionList';
import GoogleSheetsConfig from './components/GoogleSheetsConfig';
import StudentManagement from './components/StudentManagement';
import SatpamPortal from './components/SatpamPortal';
import AccountVerification from './components/AccountVerification';
import VoiceAnnouncer from './components/VoiceAnnouncer';
import PrayerAttendance from './components/PrayerAttendance';

// Firebase Integrations
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc, 
  updateDoc, 
  onSnapshot 
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { signInAnonymously } from 'firebase/auth';

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

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
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
  throw new Error(JSON.stringify(errInfo));
}


export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  
  // Database States
  const [permissions, setPermissions] = useState<LeavePermission[]>([]);
  const [santriList, setSantriList] = useState<Santri[]>([]);
  const [ustadzList, setUstadzList] = useState<Ustadz[]>([]);
  
  // Auth Session States
  const [currentUstadz, setCurrentUstadz] = useState<Ustadz | null>(null);
  
  // Lock Screen input states
  const [selectedUstadzUsername, setSelectedUstadzUsername] = useState<string>('admin');
  const [enteredPasscode, setEnteredPasscode] = useState<string>('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isRegisterMode, setIsRegisterMode] = useState<boolean>(false);

  // Lockscreen inline register states
  const [regName, setRegName] = useState<string>('');
  const [regUsername, setRegUsername] = useState<string>('');
  const [regPIN, setRegPIN] = useState<string>('');
  const [regSuccess, setRegSuccess] = useState<string | null>(null);

  const [sheetsConfig, setSheetsConfig] = useState<SheetsConfig>({
    sheetUrl: '',
    sheetId: '',
    apiKey: '',
    appsScriptUrl: '',
    syncEnabled: false
  });
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<{ type: 'success' | 'error' | 'none', msg: string }>({ type: 'none', msg: '' });

  const [firebaseReady, setFirebaseReady] = useState<boolean>(false);

  // Authenticate anonymously on startup
  useEffect(() => {
    signInAnonymously(auth)
      .then((userCredential) => {
        console.log("Authenticated anonymously:", userCredential.user.uid);
        setFirebaseReady(true);
      })
      .catch((err) => {
        console.warn("Firebase Auth is disabled/restricted on this project, proceeding with relaxed persistent model permissions:", err.message || err);
        setFirebaseReady(true);
      });

    // Recover current active session locally for device convenience
    const savedCurrentUst = localStorage.getItem('pesantren_current_ustadz');
    if (savedCurrentUst) {
      setCurrentUstadz(JSON.parse(savedCurrentUst));
    }
  }, []);

  // Real-time subscription to cloud collections
  useEffect(() => {
    if (!firebaseReady) return;

    // 1. Listen for Santri list
    const unsubscribeSantri = onSnapshot(collection(db, 'santri'), async (snapshot) => {
      if (snapshot.empty) {
        const savedSantri = localStorage.getItem('pesantren_santri');
        const initialList = savedSantri ? JSON.parse(savedSantri) : INITIAL_SANTRI;
        console.log("Firestore santri empty, seeding with local data...", initialList);
        for (const s of initialList) {
          try {
            await setDoc(doc(db, 'santri', s.id), s);
          } catch (e) {
            console.error("Error seeding santri:", e);
          }
        }
      } else {
        const list: Santri[] = [];
        snapshot.forEach((doc) => {
          list.push(doc.data() as Santri);
        });
        list.sort((a, b) => a.id.localeCompare(b.id));
        setSantriList(list);
        localStorage.setItem('pesantren_santri', JSON.stringify(list));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'santri');
    });

    // 2. Listen for Ustadz list
    const unsubscribeUstadz = onSnapshot(collection(db, 'ustadz'), async (snapshot) => {
      if (snapshot.empty) {
        const savedUstadz = localStorage.getItem('pesantren_ustadz');
        const initialListRaw = savedUstadz ? JSON.parse(savedUstadz) : INITIAL_USTADZ;
        const initialList = initialListRaw.map((u: any) => ({ ...u, isVerified: true }));
        console.log("Firestore ustadz empty, seeding...", initialList);
        for (const u of initialList) {
          try {
            await setDoc(doc(db, 'ustadz', u.username), u);
          } catch (e) {
            console.error("Error seeding ustadz:", e);
          }
        }
      } else {
        const list: Ustadz[] = [];
        let hasOldAdminPasscode = false;
        snapshot.forEach((doc) => {
          const u = doc.data() as Ustadz;
          if (u.username === 'admin' && u.passcode === '123456') {
            hasOldAdminPasscode = true;
          }
          list.push(u);
        });

        if (hasOldAdminPasscode) {
          console.log("Migrating legacy admin PIN '123456' to new default PIN '246810'...");
          try {
            await setDoc(doc(db, 'ustadz', 'admin'), {
              username: 'admin',
              name: 'Ustadz Abdullah',
              passcode: '246810',
              isVerified: true
            });
          } catch (e) {
            console.error("Error migrating admin PIN", e);
          }
        } else {
          setUstadzList(list);
          localStorage.setItem('pesantren_ustadz', JSON.stringify(list));
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'ustadz');
    });

    // 3. Listen for Permissions (LeavePermissions)
    const unsubscribePermissions = onSnapshot(collection(db, 'permissions'), async (snapshot) => {
      if (snapshot.empty) {
        const savedPermissions = localStorage.getItem('pesantren_permissions');
        const initialList = savedPermissions ? JSON.parse(savedPermissions) : INITIAL_LEAVE_PERMISSIONS;
        console.log("Firestore permissions empty, seeding...", initialList);
        for (const p of initialList) {
          try {
            await setDoc(doc(db, 'permissions', p.id), p);
          } catch (e) {
            console.error("Error seeding permission:", e);
          }
        }
      } else {
        const list: LeavePermission[] = [];
        snapshot.forEach((doc) => {
          list.push(doc.data() as LeavePermission);
        });
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setPermissions(list);
        localStorage.setItem('pesantren_permissions', JSON.stringify(list));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'permissions');
    });

    // 4. Listen for sheetsConfig (document 'default')
    const unsubscribeSheetsConfig = onSnapshot(doc(db, 'sheetsConfig', 'default'), async (snapshot) => {
      if (!snapshot.exists()) {
        const savedConfig = localStorage.getItem('pesantren_sheets_config');
        const defaultConfig = savedConfig ? JSON.parse(savedConfig) : {
          sheetUrl: '',
          sheetId: '',
          apiKey: '',
          appsScriptUrl: '',
          syncEnabled: false
        };
        console.log("Firestore sheetsConfig empty, seeding default...", defaultConfig);
        try {
          await setDoc(doc(db, 'sheetsConfig', 'default'), defaultConfig);
        } catch (e) {
          console.error("Error seeding sheetsConfig:", e);
        }
      } else {
        const config = snapshot.data() as SheetsConfig;
        setSheetsConfig(config);
        localStorage.setItem('pesantren_sheets_config', JSON.stringify(config));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'sheetsConfig/default');
    });

    return () => {
      unsubscribeSantri();
      unsubscribeUstadz();
      unsubscribePermissions();
      unsubscribeSheetsConfig();
    };
  }, [firebaseReady]);

  // Automated background blacklist verification and enforcement
  useEffect(() => {
    if (!firebaseReady || santriList.length === 0 || permissions.length === 0) return;

    santriList.forEach(async (student) => {
      const lateByMonth = getLateOccurrencesByMonth(permissions, student);
      
      let shouldBeBlacklisted = false;
      let reason = '';

      for (const [monthKey, lates] of Object.entries(lateByMonth)) {
        if (lates.length >= 3) {
          shouldBeBlacklisted = true;
          const [year, monthNum] = monthKey.split('-');
          const monthNames = [
            'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
          ];
          const monthName = monthNames[parseInt(monthNum) - 1] || monthNum;
          reason = `Terlambat ${lates.length} kali pada bulan ${monthName} ${year}`;
          break; // Grab first violating month
        }
      }

      if (shouldBeBlacklisted && !student.isBlacklisted) {
        console.log(`Auto-blacklisting student ${student.name} due to: ${reason}`);
        try {
          await updateDoc(doc(db, 'santri', student.id), {
            isBlacklisted: true,
            blacklistReason: reason
          });
        } catch (err) {
          console.error(`Gagal auto-blacklist santri ${student.name}:`, err);
        }
      }
    });
  }, [firebaseReady, santriList, permissions]);

  // Force active tab to dashboard if the user is not the main admin and tries to access admin-only tabs
  useEffect(() => {
    if (['integrasi-sheets', 'verifikasi-ustadz'].includes(activeTab) && currentUstadz?.username !== 'admin') {
      setActiveTab('dashboard');
    }
  }, [currentUstadz, activeTab]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const ust = ustadzList.find(u => u.username === selectedUstadzUsername);
    if (!ust) {
      setLoginError('Pengurus Ustadz tidak terdaftar.');
      return;
    }

    // Default existing ones to verified, explicitly check if blocked/unverified
    if (ust.isVerified === false) {
      setLoginError('Akun Anda belum aktif/diverifikasi. Hubungi Ustadz admin atau pengurus lain untuk memverifikasi akun Anda.');
      return;
    }

    if (ust.passcode === enteredPasscode.trim()) {
      setCurrentUstadz(ust);
      localStorage.setItem('pesantren_current_ustadz', JSON.stringify(ust));
      setEnteredPasscode('');
      setLoginError(null);
    } else {
      setLoginError('PIN Keamanan tidak sesuai. Silakan coba lagi.');
    }
  };

  const handleRegisterInline = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegSuccess(null);
    setLoginError(null);

    const cleanUsername = regUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!cleanUsername) {
      setLoginError('Username tidak valid.');
      return;
    }

    if (ustadzList.some(u => u.username === cleanUsername)) {
      setLoginError('Username tersebut sudah digunakan.');
      return;
    }

    if (!regName.trim() || !regPIN.trim()) {
      setLoginError('Mohon isi semua data registrasi.');
      return;
    }

    const newUstadzObj: Ustadz = {
      username: cleanUsername,
      name: regName.trim(),
      passcode: regPIN.trim(),
      isVerified: false // Requires approval by another logged-in administrator
    };

    try {
      await setDoc(doc(db, 'ustadz', cleanUsername), newUstadzObj);
      setSelectedUstadzUsername(cleanUsername);
      setRegSuccess(`Registrasi Ustadz "${regName.trim()}" sukses! Hubungi administrator/ustadz lain untuk memverifikasi & mengaktifkan akun Anda.`);
      setRegName('');
      setRegUsername('');
      setRegPIN('');
      setIsRegisterMode(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `ustadz/${cleanUsername}`);
    }
  };

  const handleLogout = () => {
    setCurrentUstadz(null);
    localStorage.removeItem('pesantren_current_ustadz');
  };

  const handleAddUstadzDirect = async (newU: Ustadz) => {
    try {
      await setDoc(doc(db, 'ustadz', newU.username), newU);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `ustadz/${newU.username}`);
    }
  };

  const handleDeleteUstadzDirect = async (username: string) => {
    try {
      await deleteDoc(doc(db, 'ustadz', username));
      if (currentUstadz?.username === username) {
        handleLogout();
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `ustadz/${username}`);
    }
  };

  const handleVerifyUstadzDirect = async (username: string, isVerified: boolean) => {
    try {
      await updateDoc(doc(db, 'ustadz', username), { isVerified });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `ustadz/${username}`);
    }
  };

  // Add a new student record to autocomplete database
  const handleAddSantri = (newS: Omit<Santri, 'id'>): Santri => {
    const maxNum = santriList.reduce((max, s) => {
      const match = s.id.match(/^S(\d+)$/);
      if (match) {
        const num = parseInt(match[1]);
        return num > max ? num : max;
      }
      return max;
    }, 0);
    const nextId = `S${String(maxNum + 1).padStart(3, '0')}`;
    const student: Santri = {
      id: nextId,
      ...newS
    };

    setDoc(doc(db, 'santri', nextId), student)
      .catch((err) => {
         handleFirestoreError(err, OperationType.WRITE, `santri/${nextId}`);
      });

    return student;
  };

  const handleAddSantriBulk = async (newStudents: Omit<Santri, 'id'>[]) => {
    const maxNum = santriList.reduce((max, s) => {
      const match = s.id.match(/^S(\d+)$/);
      if (match) {
        const num = parseInt(match[1]);
        return num > max ? num : max;
      }
      return max;
    }, 0);

    const promises = newStudents.map((ns, index) => {
      const nextId = `S${String(maxNum + index + 1).padStart(3, '0')}`;
      const student: Santri = {
        id: nextId,
        ...ns
      };
      return setDoc(doc(db, 'santri', nextId), student);
    });

    try {
      await Promise.all(promises);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, 'santri/bulk');
      throw err;
    }
  };

  const handleDeleteSantri = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'santri', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `santri/${id}`);
    }
  };

  const handleDeleteSantriBulk = async (ids: string[]) => {
    try {
      const promises = ids.map(id => deleteDoc(doc(db, 'santri', id)));
      await Promise.all(promises);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'santri/bulk');
    }
  };

  const handleUpdateSantri = async (id: string, updates: Partial<Santri>) => {
    try {
      await updateDoc(doc(db, 'santri', id), updates);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `santri/${id}`);
    }
  };

  // Submit and save student leave perizinan directly as active approved and departed (Sedang Berjalan)
  const handleSubmitPermission = async (permData: Omit<LeavePermission, 'id' | 'createdAt' | 'status'>) => {
    const maxNum = permissions.reduce((max, p) => {
      const match = p.id.match(/^IZN-2026-(\d+)$/);
      if (match) {
        const num = parseInt(match[1]);
        return num > max ? num : max;
      }
      return max;
    }, 0);
    const uniqueId = `IZN-2026-${String(maxNum + 1).padStart(3, '0')}`;
    const newPermission: LeavePermission = {
      id: uniqueId,
      ...permData,
      status: 'Sedang Berjalan',
      createdAt: new Date().toISOString(),
      createdByUstadz: currentUstadz?.name || 'Sesi Publik'
    };

    try {
      await setDoc(doc(db, 'permissions', uniqueId), newPermission);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `permissions/${uniqueId}`);
    }

    // Dynamic automated write pushing to Google Sheets if App Script hook is set up
    if (sheetsConfig.syncEnabled && sheetsConfig.appsScriptUrl) {
      try {
        await fetch(sheetsConfig.appsScriptUrl, {
          method: 'POST',
          mode: 'no-cors', 
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(newPermission)
        });
        console.log("Written successfully through Apps Script.");
      } catch (err) {
        console.error("Error writing to Google Sheet WebApp:", err);
      }
    }
  };

  // Safe and non-conflicting bulk permission submission
  const handleSubmitPermissionBulk = async (permsData: Omit<LeavePermission, 'id' | 'createdAt' | 'status'>[]) => {
    const baseMaxNum = permissions.reduce((max, p) => {
      const match = p.id.match(/^IZN-2026-(\d+)$/);
      if (match) {
        const num = parseInt(match[1]);
        return num > max ? num : max;
      }
      return max;
    }, 0);

    const promises = permsData.map(async (permData, index) => {
      const nextNum = baseMaxNum + 1 + index;
      const uniqueId = `IZN-2026-${String(nextNum).padStart(3, '0')}`;
      const newPermission: LeavePermission = {
        id: uniqueId,
        ...permData,
        status: 'Sedang Berjalan',
        createdAt: new Date().toISOString(),
        createdByUstadz: currentUstadz?.name || 'Sesi Publik'
      };

      await setDoc(doc(db, 'permissions', uniqueId), newPermission);

      // Push to Google Sheets if App Script is enabled
      if (sheetsConfig.syncEnabled && sheetsConfig.appsScriptUrl) {
        try {
          await fetch(sheetsConfig.appsScriptUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(newPermission)
          });
        } catch (err) {
          console.error("Error writing bulk to Google Sheet:", err);
        }
      }
    });

    try {
      await Promise.all(promises);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, 'permissions/bulk');
      throw err;
    }
  };

  // Update leave status (e.g. Approve, Reject, Return)
  const handleUpdateStatus = async (id: string, newStatus: LeavePermission['status']) => {
    const perm = permissions.find(p => p.id === id);
    if (perm) {
      const updateData: Partial<LeavePermission> = { status: newStatus };
      if (newStatus === 'Kembali') {
        updateData.returnedAt = new Date().toISOString();
      }
      if (!perm.createdByUstadz && currentUstadz) {
        updateData.createdByUstadz = currentUstadz.name;
      }
      try {
        await updateDoc(doc(db, 'permissions', id), updateData);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `permissions/${id}`);
      }
    }
  };

  const handleUpdateStatusBulk = async (ids: string[], newStatus: LeavePermission['status']) => {
    try {
      const promises = ids.map(id => {
        const perm = permissions.find(p => p.id === id);
        if (!perm) return Promise.resolve();
        const updateData: Partial<LeavePermission> = { status: newStatus };
        if (newStatus === 'Kembali') {
          updateData.returnedAt = new Date().toISOString();
        }
        if (!perm.createdByUstadz && currentUstadz) {
          updateData.createdByUstadz = currentUstadz.name;
        }
        return updateDoc(doc(db, 'permissions', id), updateData);
      });
      await Promise.all(promises);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'permissions/bulk-update');
    }
  };

  const handleCancelPermissionBulk = async (ids: string[]) => {
    try {
      const promises = ids.map(id => deleteDoc(doc(db, 'permissions', id)));
      await Promise.all(promises);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'permissions/bulk-delete');
    }
  };

  // Mark notifiedAt record for WhatsApp messages
  const handleMarkNotified = async (id: string) => {
    try {
      await updateDoc(doc(db, 'permissions', id), {
        notifiedAt: new Date().toISOString()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `permissions/${id}`);
    }
  };

  const handleSaveSheetsConfig = async (newConfig: SheetsConfig) => {
    try {
      await setDoc(doc(db, 'sheetsConfig', 'default'), newConfig);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'sheetsConfig/default');
    }
  };

  // Google Sheets read & sync implementation
  const parseCSVData = (text: string): LeavePermission[] => {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return [];

    const firstLine = lines[0];
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const delimiter = semicolonCount > commaCount ? ';' : ',';

    const parseCSVLine = (lineStr: string, delim: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < lineStr.length; i++) {
        const char = lineStr[i];
        if (char === '"' || char === "'") {
          inQuotes = !inQuotes;
        } else if (char === delim && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const rawHeaders = parseCSVLine(lines[0], delimiter).map(h => h.replace(/['"“”]+/g, '').trim());
    
    // Flexible column mapper
    const headerMapping: { [key: string]: string } = {
      id: 'id',
      izn_id: 'id',
      id_perizinan: 'id',
      studentid: 'studentId',
      student_id: 'studentId',
      id_santri: 'studentId',
      studentname: 'studentName',
      student_name: 'studentName',
      nama_santri: 'studentName',
      nama: 'studentName',
      classname: 'className',
      class_name: 'className',
      kelas: 'className',
      roomname: 'roomName',
      room_name: 'roomName',
      asrama: 'roomName',
      guardianname: 'guardianName',
      guardian_name: 'guardianName',
      nama_wali: 'guardianName',
      wali: 'guardianName',
      guardianphone: 'guardianPhone',
      guardian_phone: 'guardianPhone',
      no_hp_wali: 'guardianPhone',
      no_hp: 'guardianPhone',
      telepon: 'guardianPhone',
      hp: 'guardianPhone',
      leavetype: 'leaveType',
      leave_type: 'leaveType',
      jenis_izin: 'leaveType',
      tipe: 'leaveType',
      reason: 'reason',
      alasan: 'reason',
      keperluan: 'reason',
      startdate: 'startDate',
      start_date: 'startDate',
      tanggal_mulai: 'startDate',
      mulai: 'startDate',
      enddate: 'endDate',
      end_date: 'endDate',
      tanggal_selesai: 'endDate',
      selesai: 'endDate',
      status: 'status',
      createdat: 'createdAt',
      created_at: 'createdAt',
      dibuat_pada: 'createdAt',
    };

    const headers = rawHeaders.map(h => {
      const lower = h.toLowerCase().replace(/[\s_-]/g, '');
      for (const [key, prop] of Object.entries(headerMapping)) {
        if (key.toLowerCase().replace(/[\s_-]/g, '') === lower) {
          return prop;
        }
      }
      return h;
    });

    const parsedList: LeavePermission[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const values = parseCSVLine(line, delimiter).map(v => v.replace(/['"“”]+/g, '').trim());
      if (values.length === 0 || (values.length === 1 && values[0] === '')) continue;

      const rowObj: any = {};
      headers.forEach((hdr, idx) => {
        if (hdr) {
          rowObj[hdr] = values[idx] || '';
        }
      });

      const studentNameVal = rowObj.studentName || rowObj.studentname || rowObj.Nama || rowObj.Name || '';
      if (!studentNameVal) continue;

      const idVal = rowObj.id || rowObj.izn_id || `IZN-CSV-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

      parsedList.push({
        id: idVal,
        studentId: rowObj.studentId || `S${String(parsedList.length + 1).padStart(3, '0')}`,
        studentName: studentNameVal,
        className: rowObj.className || 'Pondok',
        roomName: rowObj.roomName || 'Asrama',
        guardianName: rowObj.guardianName || 'Wali',
        guardianPhone: rowObj.guardianPhone || '',
        leaveType: (rowObj.leaveType as any) || 'Pulang',
        reason: rowObj.reason || '',
        startDate: rowObj.startDate || new Date().toISOString().split('T')[0],
        endDate: rowObj.endDate || new Date().toISOString().split('T')[0],
        status: (rowObj.status as any) || 'Pending',
        createdAt: rowObj.createdAt || new Date().toISOString(),
        returnedAt: rowObj.returnedAt ? rowObj.returnedAt : undefined,
        notifiedAt: rowObj.notifiedAt ? rowObj.notifiedAt : undefined,
      });
    }
    return parsedList;
  };

  const handleSyncSheets = async (): Promise<void> => {
    if (!sheetsConfig.sheetId) {
      setSyncStatus({ type: 'error', msg: 'Harap pasang Tautan Google Sheet terlebih dahulu di menu Integrasi.' });
      return;
    }

    setIsSyncing(true);
    setSyncStatus({ type: 'none', msg: '' });

    try {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetsConfig.sheetId}/export?format=csv&t=${Date.now()}`;
      const response = await fetch(csvUrl);
      
      if (!response.ok) {
        throw new Error('Gagal mengunduh berkas. Periksa akses sharing Google Sheet Anda.');
      }

      const csvText = await response.text();
      
      if (csvText.trim().startsWith('<!DOCTYPE html>') || csvText.trim().startsWith('<html')) {
        throw new Error('Google Sheets membatasi akses. Spreadsheet Anda masih diatur PRIVATE.');
      }

      const sheetPermissions = parseCSVData(csvText);

      if (sheetPermissions.length > 0) {
        const merged = [...sheetPermissions];
        permissions.forEach(localItem => {
          if (!merged.some(sheetItem => sheetItem.id === localItem.id)) {
            merged.push(localItem);
          }
        });

        // Write merged sync data to firestore
        for (const item of merged) {
          try {
            await setDoc(doc(db, 'permissions', item.id), item);
          } catch (err) {
            console.error("Error migrating CSV permission to Firestore:", err);
          }
        }
        
        const updatedConfig = {
          ...sheetsConfig,
          lastSync: new Date().toISOString()
        };
        await handleSaveSheetsConfig(updatedConfig);
        setSyncStatus({ type: 'success', msg: `Berhasil tersambung dengan ${sheetPermissions.length} data perizinan dari Google Sheets!` });
      } else {
        setSyncStatus({ type: 'error', msg: 'Data pembacaan kosong. Periksa format header kolom sheet Anda.' });
      }

    } catch (err: any) {
      console.error("Sheets reader error: ", err);
      setSyncStatus({ type: 'error', msg: err.message || 'Gagal tersambung dengan Google Sheet.' });
    } finally {
      setIsSyncing(false);
    }
  };

  // Protected View authentication checker
  const isTabProtected = ['form-izin', 'daftar-izin', 'manajemen-santri', 'integrasi-sheets', 'verifikasi-ustadz'].includes(activeTab);
  const requiresUnlockScreen = isTabProtected && !currentUstadz;

  return (
    <div className="h-screen w-screen bg-slate-50/50 font-sans text-slate-800 overflow-hidden flex">
      
      {/* 1. Backdrop overlay for mobile menu */}
      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-900/40 z-40 md:hidden transition-opacity"
        />
      )}

      {/* 2. Sidebar Navigation (Patriotic Elegant Red & White Theme) */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-red-800 text-white flex flex-col transform transition-transform duration-300 ease-in-out md:static md:translate-x-0 ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      } border-r border-red-950`}>
        {/* Sidebar Header Brand */}
        <div className="p-6 flex items-center justify-between border-b border-red-900/60 bg-red-900/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-white text-red-800 rounded-lg flex items-center justify-center font-black shadow-sm ring-1 ring-white/20 select-none">
              🕌
            </div>
            <div>
              <span className="font-extrabold text-[15px] tracking-tight block">🔴⚪ E-Zen</span>
              <span className="text-[9px] text-red-200 block uppercase tracking-wider font-extrabold">Perizinan Santri</span>
            </div>
          </div>
          <button 
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden text-red-200 hover:text-white p-1 rounded-md"
            title="Tutup Menu"
          >
            ✕
          </button>
        </div>

        {/* Navigation Tab Links list */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {[
            { id: 'dashboard', label: 'Monitor Dashboard', icon: BarChart3, public: true },
            { id: 'form-izin', label: 'Form Pengajuan', icon: FileText, public: false },
            { id: 'daftar-izin', label: 'Daftar Perizinan', icon: Users, public: false },
            { id: 'manajemen-santri', label: 'Data Santri', icon: FolderOpen, public: false },
            { id: 'absensi-shalat', label: 'Absensi Shalat', icon: CheckCircle, public: true },
            { id: 'satpam-portal', label: 'Verifikasi Satpam', icon: ShieldAlert, public: true },
            { id: 'pemanggil-suara', label: 'Pemanggil Suara', icon: Megaphone, public: true },
            { id: 'verifikasi-ustadz', label: 'Verifikasi Akun', icon: ShieldCheck, public: false, adminOnly: true },
            { id: 'integrasi-sheets', label: 'Database Sheet', icon: FileSpreadsheet, public: false, adminOnly: true }
          ].filter(tab => !tab.adminOnly || currentUstadz?.username === 'admin').map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setMobileMenuOpen(false);
                  setSyncStatus({ type: 'none', msg: '' });
                }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer text-left ${
                  isActive 
                    ? 'bg-white text-red-900 font-extrabold shadow-md'
                    : 'text-red-100 hover:bg-red-700/60 hover:text-white'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full transition-all shrink-0 ${
                  isActive ? 'bg-red-600 scale-110' : 'border border-white/20'
                }`}></span>
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1 truncate">{tab.label}</span>
                {!tab.public && !currentUstadz && (
                  <span className="text-[9px] bg-white/15 text-red-100 font-bold px-1.5 rounded-md py-0.2 shrink-0">
                    PIN
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sync Status info widget in sidebar footer */}
        <div className="p-4 border-t border-red-900/60 bg-red-950/20 space-y-3">
          {currentUstadz && (
            <div className="flex justify-between items-center bg-red-900/50 px-3 py-1.5 rounded-lg text-xs">
              <div className="truncate pr-1">
                <span className="text-[9px] text-red-200 block font-bold">Ustadz Sesi:</span>
                <span className="text-[11px] font-bold text-white block truncate">{currentUstadz.name}</span>
              </div>
              <button
                onClick={handleLogout}
                className="text-[9px] bg-white/10 hover:bg-white/20 text-white font-bold px-1.5 py-0.5 rounded-md shrink-0 transition-colors"
              >
                Lock
              </button>
            </div>
          )}
          
          <div className="bg-red-900/30 p-3.5 rounded-xl border border-white/5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] text-red-200 font-extrabold uppercase tracking-wider">Sheet Status</span>
              <div className={`w-1.5 h-1.5 rounded-full transition-all ${
                sheetsConfig.syncEnabled 
                  ? 'bg-emerald-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]' 
                  : 'bg-red-400'
              }`}></div>
            </div>
            <p className="text-[11px] text-red-50 font-extrabold">
              {sheetsConfig.syncEnabled ? 'Database Cloud Active' : 'Offline Mode (Local)'}
            </p>
          </div>
        </div>
      </aside>

      {/* 3. Main Content View Area */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        
        {/* Top Header */}
        <header className="h-20 bg-white border-b border-slate-100 px-6 md:px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {/* Hamburger menu for small devices */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors cursor-pointer"
              title="Buka Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            
            <div className="min-w-0">
              <h1 className="text-base md:text-md font-black text-slate-905 tracking-tight truncate">
                {activeTab === 'dashboard' && 'Monitoring Perizinan Santri'}
                {activeTab === 'form-izin' && 'Pembuatan Perizinan Santri'}
                {activeTab === 'daftar-izin' && 'Pengawasan Log Perizinan'}
                {activeTab === 'manajemen-santri' && 'Basis Data Santri'}
                {activeTab === 'absensi-shalat' && 'Absensi Shalat Jamaah'}
                {activeTab === 'satpam-portal' && 'Portal Keamanan Satpam Gatekeeper'}
                {activeTab === 'pemanggil-suara' && 'Pemanggil Suara Otomatis ("Unlimited" TTS)'}
                {activeTab === 'integrasi-sheets' && 'Database Cloud Google Sheets'}
                {activeTab === 'verifikasi-ustadz' && 'Verifikasi Akun Pengurus'}
              </h1>
              <p className="text-[11px] text-slate-500 truncate hidden sm:block font-medium">
                {activeTab === 'dashboard' && 'Pantau grafik real-time dan jenis izin keluar aktif'}
                {activeTab === 'form-izin' && 'Masukan data permohonan berpergian santri dengan bimbingan wali'}
                {activeTab === 'daftar-izin' && 'Verifikasi, tolak, log kepulangan, serta sinkronisasi status'}
                {activeTab === 'manajemen-santri' && 'Tambah santri secara tunggal maupun impor tabel massal'}
                {activeTab === 'absensi-shalat' && 'Rekam kehadiran shalat fardhu berjamaah santri yang berada di dalam pondok'}
                {activeTab === 'satpam-portal' && 'Verifikasi langsung di pos gerbang saat santri keluar dan masuk'}
                {activeTab === 'pemanggil-suara' && 'Umumkan kepulangan / persetujuan izin santri dengan teknologi suara robot Indonesia'}
                {activeTab === 'integrasi-sheets' && 'Pratinjau naskah integrasi kode Google Apps Script'}
                {activeTab === 'verifikasi-ustadz' && 'Setujui akun pengurus ustadz baru atau tangguhkan akses'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="flex flex-col items-end text-right hidden sm:flex">
              <span className="text-xs font-extrabold text-slate-900">{currentUstadz ? currentUstadz.name : 'Sesi Tamu'}</span>
              <span className="text-[10px] text-slate-400 font-semibold">{currentUstadz ? 'Pengurus Terdaftar' : 'Verifikasi Publik'}</span>
            </div>
            <div className="w-9 h-9 rounded-full bg-red-600 text-white border border-red-200 shadow-3xs flex items-center justify-center font-bold text-xs select-none">
              {currentUstadz ? currentUstadz.name.substring(0, 2).toUpperCase() : 'PS'}
            </div>
          </div>
        </header>

        {/* Content Scroll Container - Added bottom padding for mobile navigation offset */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-28 md:pb-8 space-y-5">
          
          {/* Dynamic Sync feedback notifications */}
          <AnimatePresence>
            {syncStatus.type !== 'none' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                className={`p-4 rounded-xl text-xs flex items-start gap-2.5 border shadow-2xs ${
                  syncStatus.type === 'success' 
                    ? 'bg-red-800 border-red-800 text-white font-semibold' 
                    : 'bg-amber-50 border-amber-150 text-amber-900 font-semibold'
                }`}
              >
                <div className="flex-1">
                  <span className="font-extrabold uppercase text-[10px] tracking-wider block mb-0.5">{syncStatus.type === 'success' ? 'Sinkronisasi Sukses' : 'Gagal Sinkron'}</span>
                  <p className="leading-relaxed font-semibold">{syncStatus.msg}</p>
                </div>
                <button 
                  onClick={() => setSyncStatus({ type: 'none', msg: '' })}
                  className="text-xs font-bold px-2 py-0.5 hover:bg-white/10 rounded-md transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ACCESS SHIELD: REQUIRES USTADZ PASSWORD/PIN */}
          {requiresUnlockScreen ? (
            <div className="max-w-md mx-auto my-12 bg-white rounded-2xl border border-slate-100 shadow-md overflow-hidden">
              <div className="bg-red-800 text-white p-6 text-center space-y-2">
                <div className="w-11 h-11 bg-white/10 rounded-full flex items-center justify-center mx-auto text-white">
                  <Lock className="w-5 h-5 animate-pulse" />
                </div>
                <h2 className="text-xs font-bold uppercase tracking-wider">Akses Terbatas Pengurus</h2>
                <p className="text-[11px] text-red-100 leading-normal font-medium">
                  Menu ini dilindungi PIN. Mohon login menggunakan PIN Ustadz yang telah terdaftar di sistem.
                </p>
              </div>

              <div className="p-6">
                {loginError && (
                  <div className="p-3 bg-rose-50 border border-rose-100 text-rose-800 rounded-lg text-xs font-bold flex items-center gap-2 mb-4">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    {loginError}
                  </div>
                )}

                {regSuccess && (
                  <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-900 rounded-lg text-xs space-y-3 mb-4">
                    <div className="flex items-center gap-2 font-bold">
                      <CheckCircle className="w-4 h-4 text-emerald-650 shrink-0" />
                      <span>{regSuccess}</span>
                    </div>
                    <div className="border-t border-emerald-200/40 pt-2.5 space-y-2">
                      <p className="text-[11px] text-emerald-850 font-semibold leading-relaxed">
                        ⚠️ Akun baru memerlukan persetujuan Admin Utama agar aktif. Silakan tekan tombol di bawah untuk langsung meminta aktivasi via WhatsApp:
                      </p>
                      <a
                        href={`https://api.whatsapp.com/send?text=${encodeURIComponent("Assalamu'alaikum ustadz admin, mohon dibantu aktivasi akun saya di E-Zen. Jazakumullah")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-extrabold rounded-lg cursor-pointer transition-colors shadow-3xs text-center"
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span>Kirim Permohonan Aktivasi via WA</span>
                      </a>
                    </div>
                  </div>
                )}

                {!isRegisterMode ? (
                  // LockScreen LOGIN form
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-705 mb-1">Pilih Akun Ustadz</label>
                      <select
                        value={selectedUstadzUsername}
                        onChange={(e) => setSelectedUstadzUsername(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:outline-hidden text-slate-800"
                      >
                        {ustadzList.map(u => (
                          <option key={u.username} value={u.username}>{u.name} (@{u.username})</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-705 mb-1 row-span-1">PIN Keamanan (Passcode)</label>
                      <input
                        type="password"
                        maxLength={10}
                        value={enteredPasscode}
                        onChange={(e) => setEnteredPasscode(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="Masukkan PIN Angka..."
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden tracking-widest text-center font-bold"
                      />
                    </div>

                     <div className="pt-2 flex flex-col gap-3">
                      <button
                        type="submit"
                        className="w-full bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-2.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-3xs"
                      >
                        <Unlock className="w-4 h-4" />
                        BUKA MENU AKSES
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsRegisterMode(true);
                          setLoginError(null);
                          setRegSuccess(null);
                        }}
                        className="text-[11px] font-bold text-red-605 hover:text-red-800 hover:underline transition-colors cursor-pointer text-center block mt-1"
                      >
                        Pendaftaran Akun Baru
                      </button>
                    </div>
                  </form>
                ) : (
                  // LockScreen REGISTER form
                  <form onSubmit={handleRegisterInline} className="space-y-4">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-1.5 font-bold">Registrasi Akun Baru</h3>
                    
                    <div>
                      <label className="block text-xs font-bold text-slate-705 mb-1">Nama Lengkap & Gelar</label>
                      <input
                        type="text"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder="Contoh: Ustadz M. Hanafi"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-red-600"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-705 mb-1">Username Unik (Tanpa Spasi)</label>
                      <input
                        type="text"
                        value={regUsername}
                        onChange={(e) => setRegUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                        placeholder="Contoh: hanafi"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-red-600 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-705 mb-1">PIN Rahasia (Angka)</label>
                      <input
                        type="password"
                        maxLength={10}
                        value={regPIN}
                        onChange={(e) => setRegPIN(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="Ketik PIN Baru..."
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-red-600 tracking-widest text-center font-bold"
                      />
                    </div>

                    <div className="pt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setIsRegisterMode(false)}
                        className="w-1/2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2 rounded-lg transition-colors cursor-pointer"
                      >
                        Batal
                      </button>

                      <button
                        type="submit"
                        className="w-1/2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-2 rounded-lg transition-all cursor-pointer"
                      >
                        Daftarkan
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          ) : (
            /* Active View Component Loader */
            <div className="focus-mode-view">
              {activeTab === 'dashboard' && (
                <Dashboard 
                  permissions={permissions} 
                  santriList={santriList}
                  onNavigate={(tab) => setActiveTab(tab)}
                  sheetsConfig={sheetsConfig}
                />
              )}

              {activeTab === 'form-izin' && (
                <PermissionForm 
                  santriList={santriList}
                  permissions={permissions}
                  onSubmit={handleSubmitPermission}
                  onSubmitBulk={handleSubmitPermissionBulk}
                  onAddSantri={handleAddSantri}
                  currentUstadz={currentUstadz}
                  sheetsConfig={sheetsConfig}
                />
              )}

              {activeTab === 'daftar-izin' && (
                <PermissionList 
                  permissions={permissions} 
                  onUpdateStatus={handleUpdateStatus}
                  onUpdateStatusBulk={handleUpdateStatusBulk}
                  onCancelPermissionBulk={handleCancelPermissionBulk}
                  onSendNotification={handleMarkNotified}
                  syncWithSheets={sheetsConfig.syncEnabled ? handleSyncSheets : undefined}
                  isSyncing={isSyncing}
                  currentUstadz={currentUstadz}
                  sheetsConfig={sheetsConfig}
                />
              )}

              {activeTab === 'manajemen-santri' && (
                <StudentManagement
                  santriList={santriList}
                  permissions={permissions}
                  onAddSantriBulk={handleAddSantriBulk}
                  onAddSantriSingle={handleAddSantri}
                  onDeleteSantri={handleDeleteSantri}
                  onDeleteSantriBulk={handleDeleteSantriBulk}
                  currentUstadz={currentUstadz}
                  onUpdateSantri={handleUpdateSantri}
                  onUpdateStatus={handleUpdateStatus}
                />
              )}

              {activeTab === 'absensi-shalat' && (
                <PrayerAttendance
                  santriList={santriList}
                  permissions={permissions}
                  firebaseReady={firebaseReady}
                />
              )}

              {activeTab === 'satpam-portal' && (
                <SatpamPortal
                  permissions={permissions}
                  onUpdateStatus={handleUpdateStatus}
                  satpamPhone={sheetsConfig.satpamPhone}
                  sheetsConfig={sheetsConfig}
                />
              )}

              <VoiceAnnouncer
                permissions={permissions}
                santriList={santriList}
                isHidden={activeTab !== 'pemanggil-suara'}
                currentUstadz={currentUstadz}
              />

              {activeTab === 'verifikasi-ustadz' && (
                <AccountVerification
                  ustadzList={ustadzList}
                  currentUstadz={currentUstadz}
                  onVerifyUstadz={handleVerifyUstadzDirect}
                  onDeleteUstadz={handleDeleteUstadzDirect}
                />
              )}

              {activeTab === 'integrasi-sheets' && (
                <GoogleSheetsConfig 
                  config={sheetsConfig} 
                  onSaveConfig={handleSaveSheetsConfig}
                  onSync={handleSyncSheets}
                  isSyncing={isSyncing}
                  ustadzList={ustadzList}
                  onAddUstadz={handleAddUstadzDirect}
                  onDeleteUstadz={handleDeleteUstadzDirect}
                  currentUstadz={currentUstadz}
                  onLogoutUstadz={handleLogout}
                />
              )}
            </div>
          )}

          {/* Clean footer inside the scroll view */}
          <footer className="pt-8 pb-4 border-t border-slate-100 text-center text-[10px] text-slate-400 font-semibold leading-relaxed">
            <p>© 2026 E-Zen - Sistem Aplikasi Manajemen Perizinan & Notifikasi Santri.</p>
            <p className="text-slate-300">Google Sheets Integration Database & WhatsApp Web Redirect.</p>
          </footer>
        </div>

        {/* 4. Bottom Tab Navigation on Mobile (HP) Devices - Pinned at the very bottom */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-red-100 z-40 flex items-center overflow-x-auto scrollbar-none py-1.5 px-2 gap-1 shadow-[0_-3px_12px_rgba(185,28,28,0.06)] justify-between select-none">
          {[
            { id: 'dashboard', label: 'Monitor', icon: BarChart3, public: true },
            { id: 'form-izin', label: 'Form Izin', icon: FileText, public: false },
            { id: 'daftar-izin', label: 'Daftar', icon: Users, public: false },
            { id: 'manajemen-santri', label: 'Santri', icon: FolderOpen, public: false },
            { id: 'absensi-shalat', label: 'Absensi', icon: CheckCircle, public: true },
            { id: 'satpam-portal', label: 'Satpam', icon: ShieldAlert, public: true },
            { id: 'pemanggil-suara', label: 'Panggil', icon: Megaphone, public: true },
            { id: 'verifikasi-ustadz', label: 'Verifikasi', icon: ShieldCheck, public: false, adminOnly: true },
            { id: 'integrasi-sheets', label: 'Database', icon: FileSpreadsheet, public: false, adminOnly: true }
          ].filter(tab => !tab.adminOnly || currentUstadz?.username === 'admin').map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setSyncStatus({ type: 'none', msg: '' });
                }}
                className={`flex flex-col items-center justify-center min-w-[62px] flex-1 px-1 py-1.5 rounded-lg transition-all cursor-pointer relative ${
                  isActive 
                    ? 'bg-red-50 text-red-700 font-black' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-red-600' : 'text-slate-400'}`} />
                <span className="text-[9px] mt-0.5 font-bold tracking-tight">{tab.label}</span>
                {!tab.public && !currentUstadz && (
                  <span className="absolute top-1 right-2 w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse" />
                )}
              </button>
            );
          })}
        </nav>

      </main>

    </div>
  );
}
