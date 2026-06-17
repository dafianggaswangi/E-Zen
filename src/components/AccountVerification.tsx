import React, { useState } from 'react';
import { 
  UserCheck, 
  UserX, 
  Search, 
  Users, 
  Check, 
  Trash2, 
  Lock, 
  Unlock, 
  Clock, 
  ShieldCheck,
  ShieldAlert,
  MessageSquare
} from 'lucide-react';
import { Ustadz } from '../types';

interface AccountVerificationProps {
  ustadzList: Ustadz[];
  currentUstadz: Ustadz | null;
  onVerifyUstadz: (username: string, isVerified: boolean) => void;
  onDeleteUstadz: (username: string) => void;
}

export default function AccountVerification({ 
  ustadzList, 
  currentUstadz, 
  onVerifyUstadz, 
  onDeleteUstadz 
}: AccountVerificationProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'verified'>('all');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const isAdmin = currentUstadz?.username === 'admin';

  // Filter accounts
  const filteredUstadz = ustadzList.filter(u => {
    const sMatch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                   u.username.toLowerCase().includes(searchTerm.toLowerCase());
    
    const isVerified = u.isVerified !== false; // Undefined or true counts as verified
    
    if (statusFilter === 'pending') return sMatch && !isVerified;
    if (statusFilter === 'verified') return sMatch && isVerified;
    return sMatch;
  });

  const pendingCount = ustadzList.filter(u => u.isVerified === false).length;
  const verifiedCount = ustadzList.filter(u => u.isVerified !== false).length;

  const handleVerifyClick = async (username: string, name: string) => {
    if (!isAdmin) {
      alert('Tindakan Ditolak: Hanya Akun Admin Utama (@admin) yang dapat menyetujui akun.');
      return;
    }
    try {
      await onVerifyUstadz(username, true);
      showSuccess(`Akun "${name}" (@${username}) berhasil diverifikasi dan sekarang aktif!`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeactivateClick = async (username: string, name: string) => {
    if (!isAdmin) {
      alert('Tindakan Ditolak: Hanya Akun Admin Utama (@admin) yang dapat mengelola akun.');
      return;
    }
    if (username === 'admin') {
      alert('Akun ustadz utama (admin) tidak dapat dinonaktifkan.');
      return;
    }
    if (currentUstadz?.username === username) {
      alert('Anda tidak bisa menonaktifkan akun sendiri yang sedang aktif digunakan.');
      return;
    }
    try {
      await onVerifyUstadz(username, false);
      showSuccess(`Akun "${name}" (@${username}) berhasil dinonaktifkan.`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteClick = async (username: string, name: string) => {
    if (!isAdmin) {
      alert('Tindakan Ditolak: Hanya Akun Admin Utama (@admin) yang dapat menghapus akun.');
      return;
    }
    if (username === 'admin') {
      alert('Akun ustadz utama (admin) tidak dapat dihapus.');
      return;
    }
    if (currentUstadz?.username === username) {
      alert('Anda tidak bisa menghapus akun Anda sendiri.');
      return;
    }
    if (window.confirm(`Apakah Anda yakin ingin menghapus permanen akun "${name}" (@${username})?`)) {
      try {
        await onDeleteUstadz(username);
        showSuccess(`Akun "${name}" (@${username}) berhasil dihapus dari sistem.`);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const showSuccess = (msg: string) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(null), 5000);
  };

  return (
    <div id="acc-verification-container" className="max-w-4xl mx-auto space-y-6">
      
      {/* Alert Warning for Non-Admin accounts */}
      {!isAdmin && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 shadow-2xs">
          <div className="p-2 bg-red-105 border border-red-200 text-red-650 rounded-lg shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-black text-red-900 uppercase tracking-wide">Akses Verifikasi Terbatas (Khusus Admin Utama)</h4>
            <p className="text-[11px] text-red-700 font-medium leading-relaxed mt-0.5">
              Anda saat ini masuk sebagai <strong className="font-extrabold">{currentUstadz?.name || 'Sesi Publik'}</strong>. Hanya akun administrator utama (<strong className="font-extrabold">@admin</strong>) yang diperbolehkan untuk menyetujui, menangguhkan, atau menghapus akun pengurus ustadz. Silakan login kembali dengan PIN utama admin jika Anda perlu melakukan perubahan.
            </p>
          </div>
        </div>
      )}

      {/* KPI Stats Widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-100 rounded-xl p-4 flex items-center justify-between shadow-2xs">
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total Terdaftar</span>
            <span className="text-xl font-extrabold text-slate-900 block mt-1">{ustadzList.length}</span>
          </div>
          <div className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-center text-slate-650">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-xl p-4 flex items-center justify-between shadow-2xs">
          <div>
            <span className="text-[10px] font-black uppercase text-red-500 tracking-wider">Menunggu Verifikasi</span>
            <span className="text-xl font-extrabold text-red-600 block mt-1">
              {pendingCount > 0 ? (
                <span className="inline-flex items-center gap-1.5 animate-pulse bg-red-50 text-red-800 text-xs px-2 py-0.5 rounded-full font-bold border border-red-100">
                  {pendingCount} Akun Baru
                </span>
              ) : (
                '0'
              )}
            </span>
          </div>
          <div className="w-10 h-10 bg-red-50 border border-red-100 rounded-lg flex items-center justify-center text-red-650 animate-pulse">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-xl p-4 flex items-center justify-between shadow-2xs">
          <div>
            <span className="text-[10px] font-black uppercase text-red-500 tracking-wider">Akun Aktif</span>
            <span className="text-xl font-extrabold text-slate-905 block mt-1">{verifiedCount}</span>
          </div>
          <div className="w-10 h-10 bg-red-50/50 border border-red-100 rounded-lg flex items-center justify-center text-red-600">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {actionSuccess && (
        <div className="bg-red-50 border border-red-150 text-red-900 p-3.5 rounded-xl text-xs font-bold leading-relaxed flex items-center gap-2.5 animate-fadeIn">
          <Check className="w-4 h-4 text-red-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Control panel and table */}
      <div className="bg-white border border-slate-100 rounded-xl shadow-2xs overflow-hidden">
        <div className="p-4 md:p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">Kelola Hak Akses Pengurus</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Daftar akun ustadz yang mendaftar ke sistem perizinan e-Pesantren.</p>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'all' 
                  ? 'bg-red-600 text-white font-extrabold shadow-3xs' 
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Semua
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer relative ${
                statusFilter === 'pending' 
                  ? 'bg-red-600 text-white font-extrabold shadow-3xs' 
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Menunggu ({pendingCount})
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-600 rounded-full animate-ping" />
              )}
            </button>
            <button
              onClick={() => setStatusFilter('verified')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'verified' 
                  ? 'bg-red-600 text-white font-extrabold shadow-3xs' 
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Aktif
            </button>
          </div>
        </div>

        {/* Filter search query bar */}
        <div className="p-4 border-b border-slate-100 bg-white">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari berdasarkan nama ustadz atau username..."
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-red-600 focus:bg-white transition-all text-slate-850"
            />
          </div>
        </div>

        {/* User Accounts List */}
        <div className="divide-y divide-slate-100">
          {filteredUstadz.length > 0 ? (
            filteredUstadz.map((ust) => {
              const isVerified = ust.isVerified !== false;
              const isOwnAccount = currentUstadz?.username === ust.username;
              const isMainAdmin = ust.username === 'admin';

              return (
                <div 
                  key={ust.username} 
                  className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                    isOwnAccount ? 'bg-red-50/10 border-l-2 border-red-500' : 'hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-extrabold text-sm ${
                      isVerified 
                        ? 'bg-red-50 text-red-800 border border-red-100' 
                        : 'bg-red-50 text-red-650 border border-red-150 animate-pulse'
                    }`}>
                      {ust.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-xs text-slate-900">{ust.name}</span>
                        {isOwnAccount && (
                          <span className="text-[9px] font-black bg-red-100 border border-red-200 text-red-800 px-2 rounded-md">
                            AKUN ANDA
                          </span>
                        )}
                        {isMainAdmin && (
                          <span className="text-[9px] font-black bg-slate-900 text-white px-2 rounded-md border border-slate-950">
                            ADMIN UTAMA
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 font-mono text-[10px] text-slate-400">
                        <span>@{ust.username}</span>
                        <span>•</span>
                        <span>PIN: {isAdmin || isOwnAccount ? ust.passcode : '••••••'}</span>
                      </div>
                      
                      {/* Responsive Badging */}
                      <div className="mt-2 flex items-center gap-1.5">
                        {isVerified ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-extrabold bg-red-50 border border-red-150 text-red-900 px-2 py-0.5 rounded-md">
                            <Unlock className="w-3 h-3 text-red-620" />
                            DISETUJUI & AKTIF
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[9px] font-extrabold bg-red-50 border border-red-200 text-red-800 px-2 py-0.5 rounded-md">
                            <Lock className="w-3 h-3 text-red-600" />
                            MENUNGGU PERSETUJUAN
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions column */}
                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 mt-2 sm:mt-0">
                    {!isVerified ? (
                      <>
                        <button
                          onClick={() => handleVerifyClick(ust.username, ust.name)}
                          disabled={!isAdmin}
                          className={`px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-3xs cursor-pointer transition-all ${
                            !isAdmin ? 'opacity-30 cursor-not-allowed' : ''
                          }`}
                          title={!isAdmin ? "Dibutuhkan akses Admin Utama" : "Setujui Akun Baru"}
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Setujui</span>
                        </button>
                        <button
                          onClick={() => handleDeleteClick(ust.username, ust.name)}
                          disabled={!isAdmin}
                          className={`px-2.5 py-1.5 bg-white border border-slate-200 text-slate-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200 rounded-lg text-xs font-bold flex items-center justify-center cursor-pointer transition-all ${
                            !isAdmin ? 'opacity-30 cursor-not-allowed' : ''
                          }`}
                          title={!isAdmin ? "Dibutuhkan akses Admin Utama" : "Tolak Pendaftaran"}
                        >
                          <UserX className="w-3.5 h-3.5" />
                          <span className="sm:hidden block ml-1">Tolak</span>
                        </button>
                      </>
                    ) : (
                      <>
                        {!isMainAdmin && (
                          <a
                            href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`Jazakumullah khairan ustadz ${ust.name} atas pendaftarannya. Akun antum sudah kami aktivasi, silahkan login ke aplikasi melalui link: https://e-zen-356173384262.asia-east1.run.app/`)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-3xs"
                            title="Kirim Notifikasi Aktivasi WA ke Ustadz ini"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Kirim WA</span>
                          </a>
                        )}
                        {!isMainAdmin && !isOwnAccount && (
                          <button
                            onClick={() => handleDeactivateClick(ust.username, ust.name)}
                            disabled={!isAdmin}
                            className={`px-3 py-1.5 bg-white border border-red-200 text-red-700 hover:bg-red-50 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-all ${
                              !isAdmin ? 'opacity-30 cursor-not-allowed' : ''
                            }`}
                            title={!isAdmin ? "Dibutuhkan akses Admin Utama" : "Tangguhkan Akses"}
                          >
                            <ShieldAlert className="w-3.5 h-3.5" />
                            <span>Suspensi</span>
                          </button>
                        )}
                        {!isMainAdmin && !isOwnAccount && (
                          <button
                            onClick={() => handleDeleteClick(ust.username, ust.name)}
                            disabled={!isAdmin}
                            className={`px-2.5 py-1.5 bg-white border border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-700 hover:border-red-250 rounded-lg text-xs font-bold flex items-center justify-center cursor-pointer transition-all ${
                              !isAdmin ? 'opacity-30 cursor-not-allowed' : ''
                            }`}
                            title={!isAdmin ? "Dibutuhkan akses Admin Utama" : "Hapus Akun Permanen"}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center text-slate-400 space-y-1 bg-white">
              <Users className="w-8 h-8 text-slate-200 mx-auto opacity-75" />
              <p className="text-xs font-bold text-slate-500">Tidak ada pengurus yang terdaftar.</p>
              <p className="text-[10px] text-slate-400">Silakan registrasikan akun baru melalui layar login.</p>
            </div>
          )}
        </div>
      </div>
      
    </div>
  );
}
