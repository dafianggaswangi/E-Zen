/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { 
  Volume2, 
  VolumeX, 
  Radio, 
  Play, 
  Settings, 
  UserCheck, 
  Search, 
  MessageSquare, 
  Info, 
  Sliders, 
  Activity, 
  RefreshCw,
  Bell,
  SlidersHorizontal,
  ChevronDown,
  Megaphone
} from 'lucide-react';
import { Santri, LeavePermission, Ustadz } from '../types';

interface VoiceAnnouncerProps {
  permissions: LeavePermission[];
  santriList: Santri[];
  isHidden?: boolean;
  currentUstadz?: Ustadz | null;
}

export default function VoiceAnnouncer({ permissions, santriList, isHidden = false, currentUstadz }: VoiceAnnouncerProps) {
  // TTS State
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<'id' | 'ar' | 'en'>(() => {
    return (localStorage.getItem('ezen_selected_language') as 'id' | 'ar' | 'en') || 'id';
  });
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>('');
  const [pitch, setPitch] = useState<number>(() => {
    const saved = localStorage.getItem('ezen_voice_pitch');
    return saved ? parseFloat(saved) : 0.85; // Deeper voice for male feel by default
  });
  const [rate, setRate] = useState<number>(() => {
    const saved = localStorage.getItem('ezen_voice_rate');
    return saved ? parseFloat(saved) : 0.9; // Slightly slower for clear announcement
  });
  const [volume, setVolume] = useState<number>(1.0);
  
  // Announcement templates dict
  const defaultTemplates = {
    id: "Perhatian perhatian. Panggilan ditujukan kepada santri bernama [nama], kelas [kelas], asrama [asrama]. Izin keluar pondok Anda telah disetujui untuk keperluan [keperluan]. Harap segera laporkan diri Anda ke pos keamanan gerbang utama. Sekali lagi, dipanggil kepada [nama], kelas [kelas]. Terima kasih.",
    ar: "انتباه انتباه. نداء إلى الطالب [nama]، من الفصل [kelas]، سكن [asrama]. لقد تمت الموافقة على إذن الخروج الخاص بك لغرض [keperluan]. يرجى الحضور فوراً إلى بوابة الأمن الرئيسية. شكراً لكم.",
    en: "Attention please. Direct call to student [nama], class [kelas], dorm [asrama]. Your permission to leave the boarding school has been approved for [keperluan]. Please head directly to the main security gate. Thank you."
  };

  const [templates, setTemplates] = useState<Record<'id' | 'ar' | 'en', string>>(() => {
    const saved = localStorage.getItem('ezen_voice_templates');
    return saved ? JSON.parse(saved) : defaultTemplates;
  });

  const activeTemplate = templates[selectedLanguage];

  // Auto announce toggles / configurations
  const [autoAnnounceApproved, setAutoAnnounceApproved] = useState<boolean>(() => {
    return localStorage.getItem('ezen_auto_announce_approved') === 'true';
  });

  const [autoAnnounceReturned, setAutoAnnounceReturned] = useState<boolean>(() => {
    return localStorage.getItem('ezen_auto_announce_returned') === 'true';
  });

  // Entering/Return Templates state (Izin Masuk)
  const defaultReturnTemplates = {
    id: "Alhamdulillah. Santri bernama [nama], kelas [kelas], asrama [asrama] telah kembali melapor masuk ke pondok dari keperluan [keperluan] dengan selamat. Terima kasih.",
    ar: "الحمد لله. لقد عاد الطالب [nama] من الفصل [kelas] سكن [asrama] بعد [keperluan] بالسلامة. شكراً لكم.",
    en: "Alhamdulillah. Student [nama], class [kelas], dorm [asrama] has returned safely from [keperluan]. Thank you."
  };

  const [returnTemplates, setReturnTemplates] = useState<Record<'id' | 'ar' | 'en', string>>(() => {
    const saved = localStorage.getItem('ezen_voice_return_templates');
    return saved ? JSON.parse(saved) : defaultReturnTemplates;
  });

  const activeReturnTemplate = returnTemplates[selectedLanguage];

  const handleUpdateActiveReturnTemplate = (val: string) => {
    setReturnTemplates(prev => {
      const updated = { ...prev, [selectedLanguage]: val };
      localStorage.setItem('ezen_voice_return_templates', JSON.stringify(updated));
      return updated;
    });
  };

  const formatReturnAnnouncementText = (name: string, className: string, roomName: string, leaveType: string, reason: string) => {
    let result = activeReturnTemplate;
    result = result.replace(/\[nama\]/gi, name);
    result = result.replace(/\[kelas\]/gi, className);
    result = result.replace(/\[asrama\]/gi, roomName || 'Asrama');
    result = result.replace(/\[jenis_izin\]/gi, leaveType || 'Keluar Pondok');
    result = result.replace(/\[keperluan\]/gi, reason || 'Keperluan Penting');
    return result;
  };

  const mountedPermissionsRef = useRef<Record<string, LeavePermission['status']>>({});
  const isFirstLoadRef = useRef(true);

  // Queue references to enforce sequential TTS announcements and prevent overlapping audio
  const queueRef = useRef<Array<{ text: string; studentName: string }>>([]);
  const isSpeakingRef = useRef<boolean>(false);

  // Search/Select Santri state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSantriId, setSelectedSantriId] = useState<string>('');
  
  // Feedback states
  const [isPlaying, setIsPlaying] = useState(false);
  const [lastAnnouncedText, setLastAnnouncedText] = useState('');
  const [announcementHistory, setAnnouncementHistory] = useState<Array<{ id: string; name: string; time: string; text: string; lang: string }>>(() => {
    const saved = localStorage.getItem('ezen_announcement_history_v2');
    return saved ? JSON.parse(saved) : [];
  });
  const [showSettings, setShowSettings] = useState(false);
  const [previewText, setPreviewText] = useState('');

  // Speech instance reference
  const synthRef = useRef<SpeechSynthesis | null>(typeof window !== 'undefined' ? window.speechSynthesis : null);

  // Load available voices
  const loadVoices = () => {
    if (!synthRef.current) return;
    const allVoices = synthRef.current.getVoices();
    
    // Sort all voices to prioritize current language
    const currentLangPrefix = selectedLanguage === 'id' ? 'id' : selectedLanguage === 'ar' ? 'ar' : 'en';
    
    const matchedVoices = allVoices.filter(v => v.lang.startsWith(currentLangPrefix) || v.lang.toLowerCase().includes(selectedLanguage === 'id' ? 'indonesia' : selectedLanguage === 'ar' ? 'arabic' : 'english'));
    const otherVoices = allVoices.filter(v => !(v.lang.startsWith(currentLangPrefix) || v.lang.toLowerCase().includes(selectedLanguage === 'id' ? 'indonesia' : selectedLanguage === 'ar' ? 'arabic' : 'english')));
    
    const sorted = [...matchedVoices, ...otherVoices];
    setVoices(sorted);

    // Auto-select best voice for this language
    if (sorted.length > 0) {
      const savedVoiceKey = `ezen_voice_name_${selectedLanguage}`;
      const savedVoice = localStorage.getItem(savedVoiceKey);
      const foundSaved = sorted.find(v => v.name === savedVoice);
      if (foundSaved) {
        setSelectedVoiceName(foundSaved.name);
      } else if (matchedVoices.length > 0) {
        // Try to look for a male sounding voice first
        const maleVoice = matchedVoices.find(v => 
          v.name.toLowerCase().includes('male') || 
          v.name.toLowerCase().includes('david') ||
          v.name.toLowerCase().includes('google id') ||
          v.name.toLowerCase().includes('maged') || // common arabic male
          v.name.toLowerCase().includes('tarik') // common arabic male
        );
        setSelectedVoiceName(maleVoice ? maleVoice.name : matchedVoices[0].name);
      } else {
        setSelectedVoiceName(sorted[0].name);
      }
    }
  };

  useEffect(() => {
    loadVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, [selectedLanguage]);

  // Keep language setting synchronized
  const handleLanguageChange = (lang: 'id' | 'ar' | 'en') => {
    setSelectedLanguage(lang);
    localStorage.setItem('ezen_selected_language', lang);
  };

  // Save template & voice to local storage
  const handleSaveSettings = () => {
    localStorage.setItem('ezen_voice_templates', JSON.stringify(templates));
    localStorage.setItem('ezen_voice_return_templates', JSON.stringify(returnTemplates));
    localStorage.setItem(`ezen_voice_name_${selectedLanguage}`, selectedVoiceName);
    localStorage.setItem('ezen_voice_pitch', String(pitch));
    localStorage.setItem('ezen_voice_rate', String(rate));
    localStorage.setItem('ezen_auto_announce_approved', String(autoAnnounceApproved));
    localStorage.setItem('ezen_auto_announce_returned', String(autoAnnounceReturned));
    alert('Pengaturan pemanggil suara berhasil disimpan!');
  };

  const handleUpdateActiveTemplate = (val: string) => {
    setTemplates(prev => {
      const updated = { ...prev, [selectedLanguage]: val };
      localStorage.setItem('ezen_voice_templates', JSON.stringify(updated));
      return updated;
    });
  };

  // Replace placeholders helper
  const formatAnnouncementText = (name: string, className: string, roomName: string, leaveType: string, reason: string) => {
    let result = activeTemplate;
    result = result.replace(/\[nama\]/gi, name);
    result = result.replace(/\[kelas\]/gi, className);
    result = result.replace(/\[asrama\]/gi, roomName || 'Asrama');
    result = result.replace(/\[jenis_izin\]/gi, leaveType || 'Keluar Pondok');
    result = result.replace(/\[keperluan\]/gi, reason || 'Keperluan Penting');
    return result;
  };

  // Find selected student for live layout preview
  useEffect(() => {
    const student = santriList.find(s => s.id === selectedSantriId);
    if (student) {
      const currentActivePerm = permissions.find(p => p.studentId === student.id && p.status !== 'Kembali');
      setPreviewText(
        formatAnnouncementText(
          student.name,
          student.className,
          student.roomName || 'Asrama',
          currentActivePerm?.leaveType || 'Izin Keluar',
          currentActivePerm?.reason || 'Keperluan Pribadi'
        )
      );
    } else {
      setPreviewText(
        formatAnnouncementText(
          "Ahmad Fauzi",
          "Kelas 10-A",
          "Asrama Al-Ghazali",
          selectedLanguage === 'id' ? 'Izin Belanja' : selectedLanguage === 'ar' ? 'إذن للتسوق' : 'Shopping Leave',
          selectedLanguage === 'id' ? 'Beli perlengkapan harian' : selectedLanguage === 'ar' ? 'شراء المستلزمات اليومية' : 'Buy daily necessities'
        )
      );
    }
  }, [selectedSantriId, templates, selectedLanguage, santriList, permissions]);

  // Listen for real-time changes in permissions to trigger automatic announcements
  useEffect(() => {
    if (!permissions || permissions.length === 0) return;

    // Populate previous statuses ref on initial load to avoid speaking historic records
    if (isFirstLoadRef.current) {
      const initialMap: Record<string, LeavePermission['status']> = {};
      permissions.forEach(p => {
        initialMap[p.id] = p.status;
      });
      mountedPermissionsRef.current = initialMap;
      isFirstLoadRef.current = false;
      return;
    }

    const prevMap = { ...mountedPermissionsRef.current };
    const currentMap: Record<string, LeavePermission['status']> = {};

    permissions.forEach(p => {
      currentMap[p.id] = p.status;
      const prevStatus = prevMap[p.id];

      // Case 1: Newly Approved Leave Permission (Izin Baru Disetujui/Sedang Berjalan)
      if (prevStatus === undefined) {
        if (autoAnnounceApproved && (p.status === 'Disetujui' || p.status === 'Sedang Berjalan')) {
          const text = formatAnnouncementText(
            p.studentName,
            p.className,
            p.roomName || 'Asrama',
            p.leaveType,
            p.reason
          );
          setTimeout(() => {
            announceText(text, p.studentName);
          }, 600);
        }
      }
      // Case 2: Status changed to 'Kembali' (Melapor Masuk / Izin Masuk)
      else if (prevStatus !== 'Kembali' && p.status === 'Kembali') {
        if (autoAnnounceReturned) {
          const text = formatReturnAnnouncementText(
            p.studentName,
            p.className,
            p.roomName || 'Asrama',
            p.leaveType,
            p.reason
          );
          setTimeout(() => {
            announceText(text, p.studentName);
          }, 600);
        }
      }
    });

    mountedPermissionsRef.current = currentMap;
  }, [permissions, autoAnnounceApproved, autoAnnounceReturned, selectedLanguage, templates, returnTemplates]);

  // Process the Speech Synthesis queue sequentially
  const processQueue = () => {
    if (!synthRef.current) return;
    if (isSpeakingRef.current) return;
    
    if (queueRef.current.length === 0) {
      setIsPlaying(false);
      return;
    }

    const nextCall = queueRef.current.shift();
    if (!nextCall) return;

    isSpeakingRef.current = true;
    setIsPlaying(true);
    setLastAnnouncedText(nextCall.text);

    const utterance = new SpeechSynthesisUtterance(nextCall.text);
    
    // Voice mapping
    if (selectedVoiceName) {
      const voice = voices.find(v => v.name === selectedVoiceName);
      if (voice) {
        utterance.voice = voice;
      }
    }

    // Language setting
    utterance.lang = selectedLanguage === 'id' ? 'id-ID' : selectedLanguage === 'ar' ? 'ar-SA' : 'en-US';
    utterance.pitch = pitch;
    utterance.rate = rate;
    utterance.volume = volume;

    utterance.onstart = () => {
      setIsPlaying(true);
    };

    utterance.onend = () => {
      isSpeakingRef.current = false;
      // Allow a tiny delay (800ms) between announcements for clear auditory separation
      setTimeout(() => {
        processQueue();
      }, 800);
    };

    utterance.onerror = (e) => {
      console.error('SpeechSynthesis error:', e);
      isSpeakingRef.current = false;
      setTimeout(() => {
        processQueue();
      }, 800);
    };

    // Save into history
    setAnnouncementHistory(prev => {
      const newHistoryItem = {
        id: Math.random().toString(36).substr(2, 9),
        name: nextCall.studentName,
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        text: nextCall.text,
        lang: selectedLanguage
      };
      const updated = [newHistoryItem, ...prev].slice(0, 50);
      localStorage.setItem('ezen_announcement_history_v2', JSON.stringify(updated));
      return updated;
    });

    synthRef.current.speak(utterance);
  };

  // Execute text to speech announcement
  const announceText = (textToSpeak: string, studentName: string) => {
    if (!synthRef.current) {
      alert('Fitur TTS tidak didukung dalam peramban ini.');
      return;
    }

    // Queue up this announcement and initiate background queue processing
    queueRef.current.push({ text: textToSpeak, studentName });
    processQueue();
  };

  const handleStopAnnounce = () => {
    if (synthRef.current) {
      queueRef.current = [];
      isSpeakingRef.current = false;
      synthRef.current.cancel();
      setIsPlaying(false);
    }
  };

  // Filter students based on search input
  const searchedSantri = searchQuery === '' 
    ? []
    : santriList.filter(s => 
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.className.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 5); // Limit suggestions to 5

  // List of active permits (either approved but not yet departed or currently active)
  const activePermsToAnnounce = permissions.filter(p => p.status === 'Sedang Berjalan' || p.status === 'Disetujui');

  const handleClearHistory = () => {
    setAnnouncementHistory([]);
    localStorage.removeItem('ezen_announcement_history_v2');
  };

  const isAdmin = currentUstadz?.username === 'admin';

  if (!isAdmin) {
    return (
      <div className={`max-w-xl mx-auto space-y-5 ${isHidden ? 'hidden' : ''}`}>
        {/* Simple Header */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-50 rounded-full blur-2xl -mr-8 -mt-8 opacity-70"></div>
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-red-600 shrink-0">
              <Megaphone className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="font-extrabold text-sm text-slate-900">Pemanggil Suara Santri</h2>
              <p className="text-[10px] text-slate-500 font-semibold">Klik ikon speaker untuk menyuarakan panggilan otomatis</p>
            </div>
          </div>

          {/* Clean minimal language selector */}
          <div className="mt-4 bg-slate-50 p-1 rounded-xl flex gap-1 border border-slate-200/50">
            {[
              { id: 'id', label: '🇮🇩 Indonesia' },
              { id: 'ar', label: '🇸🇦 Arab (العربية)' },
              { id: 'en', label: '🇬🇧 English' }
            ].map((lang) => (
              <button
                key={lang.id}
                type="button"
                onClick={() => handleLanguageChange(lang.id as 'id' | 'ar' | 'en')}
                className={`flex-1 py-1.5 rounded-lg text-center transition-all cursor-pointer text-[10px] font-black ${
                  selectedLanguage === lang.id
                    ? 'bg-white text-red-650 shadow-3xs border border-slate-200/40'
                    : 'text-slate-500 hover:bg-white/40'
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>

        {/* Searching Database Directly */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-2xs space-y-3">
          <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">Cari Nama Santri</span>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama santri..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:border-red-650"
            />
          </div>

          {/* Inline suggestions search results */}
          {searchQuery.trim().length >= 3 && (
            <div className="border border-slate-100 rounded-xl divide-y divide-slate-100 overflow-hidden bg-white mt-1.5 shadow-3xs">
              {(() => {
                const results = santriList.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 5);
                if (results.length === 0) {
                  return <p className="p-3 text-[10px] text-slate-400 text-center font-semibold">Nama santri tidak ditemukan.</p>;
                }
                return results.map((santri) => (
                  <div
                    key={santri.id}
                    className="p-3 hover:bg-slate-50/50 transition-colors flex items-center justify-between text-xs"
                  >
                    <span className="font-extrabold text-slate-800 text-sm">{santri.name}</span>
                    <button
                      onClick={() => {
                        const p = permissions.find(perm => perm.studentId === santri.id && perm.status !== 'Kembali');
                        const text = p 
                          ? formatAnnouncementText(santri.name, santri.className, santri.roomName || 'Asrama', p.leaveType, p.reason)
                          : formatAnnouncementText(santri.name, santri.className, santri.roomName || 'Asrama', 'Izin Keluar', 'Keperluan');
                        announceText(text, santri.name);
                      }}
                      className="h-8 w-8 rounded-lg bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shrink-0 cursor-pointer shadow-3xs transition-all hover:scale-105 active:scale-95"
                      title="Panggil"
                    >
                      <Volume2 className="w-4 h-4 text-white" />
                    </button>
                  </div>
                ));
              })()}
            </div>
          )}
        </div>

        {/* Active List to call */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-2xs space-y-4">
          <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">
            Daftar Santri Berizin Keluar ({activePermsToAnnounce.length})
          </span>
          
          {activePermsToAnnounce.length === 0 ? (
            <div className="p-6 border border-dashed border-slate-200 rounded-xl text-center bg-slate-50/40">
              <Info className="w-5 h-5 text-slate-300 mx-auto mb-1" />
              <p className="text-[10px] font-bold text-slate-400 font-semibold">Tidak ada pengumuman antrean keluar gerbang.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {activePermsToAnnounce.map((perm) => (
                <div 
                  key={perm.id} 
                  className="p-3 bg-white border border-slate-200 rounded-xl hover:shadow-2xs transition-all flex justify-between items-center"
                >
                  <span className="font-extrabold text-sm text-slate-850 truncate">{perm.studentName}</span>
                  <button
                    onClick={() => {
                      const customAnnouncement = formatAnnouncementText(
                        perm.studentName,
                        perm.className,
                        perm.roomName || 'Asrama',
                        perm.leaveType,
                        perm.reason
                      );
                      announceText(customAnnouncement, perm.studentName);
                    }}
                    className="h-8 w-8 rounded-lg bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shrink-0 cursor-pointer shadow-3xs transition-all hover:scale-105 active:scale-95"
                    title="Panggil"
                  >
                    <Volume2 className="w-4 h-4 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 lg:grid-cols-3 gap-6 ${isHidden ? 'hidden' : ''}`}>
      
      {/* COLUMN 1 & 2: SPEAKER INTERFACE & ACTIVE PERMIT CALLS */}
      <div className="lg:col-span-2 space-y-6">
        
        {/* Main Mic Soundboard Module */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-36 h-36 bg-red-50 rounded-full blur-3xl -mr-16 -mt-16 opacity-70"></div>
          
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-red-650 shrink-0">
              <Megaphone className="w-5 h-5 text-red-600 animate-pulse" />
            </div>
            <div>
              <h2 className="font-extrabold text-sm text-slate-900">Pemanggil Otomatis E-Zen</h2>
              <p className="text-[10px] text-slate-500 font-medium">Pengeras suara digital terintegrasi data perizinan santri</p>
            </div>
          </div>

          {/* Language Selector Tabs */}
          <div className="mb-4 bg-slate-100 p-1 rounded-xl flex gap-1 border border-slate-200/65">
            {[
              { id: 'id', label: '🇮🇩 Indonesia', desc: 'Laras Utama' },
              { id: 'ar', label: '🇸🇦 Arab (العربية)', desc: 'Pronunsiasi Arab' },
              { id: 'en', label: '🇬🇧 English', desc: 'Internasional' }
            ].map((lang) => (
              <button
                key={lang.id}
                type="button"
                onClick={() => handleLanguageChange(lang.id as 'id' | 'ar' | 'en')}
                className={`flex-1 py-2 px-1.5 rounded-lg text-center transition-all cursor-pointer ${
                  selectedLanguage === lang.id
                    ? 'bg-white text-red-650 shadow-3xs font-extrabold text-xs'
                    : 'text-slate-500 hover:bg-white/40 font-bold text-[11px]'
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 mb-5 relative">
            <div className="flex justify-between items-center mb-1.5 border-b border-slate-200 pb-1.5">
              <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <Radio className="w-3.5 h-3.5 text-red-500" /> Live Pratinjau Teks TTS
              </span>
              <div className="flex items-center gap-1.5">
                {isPlaying ? (
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
                  </span>
                ) : (
                  <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                )}
                <span className="text-[9px] text-slate-400 font-bold uppercase">{isPlaying ? 'Sedang Bersuara' : 'Siap Saji'}</span>
              </div>
            </div>

            <textarea
              value={previewText}
              onChange={(e) => setPreviewText(e.target.value)}
              disabled={isPlaying}
              className="w-full text-xs font-mono font-bold text-slate-800 bg-transparent border-0 focus:ring-0 p-0 leading-relaxed resize-none h-28 focus:outline-hidden disabled:opacity-85"
              placeholder="Masukan data santri di bawah untuk menyusun kalimat pengumuman otomatis..."
            ></textarea>

            {/* Hint of placeholder values */}
            <p className="text-[9px] text-slate-400 mt-2 font-medium">
              * Teks di atas akan dibacakan langsung oleh suara peramban terpilih ({selectedLanguage.toUpperCase()}).
            </p>
          </div>

          {/* Quick Speak controls */}
          <div className="flex flex-wrap gap-2.5 items-center justify-between">
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const targetName = santriList.find(s => s.id === selectedSantriId)?.name || "Santri";
                  announceText(previewText, targetName);
                }}
                disabled={isPlaying}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-750 text-white rounded-lg flex items-center gap-1.5 shadow-sm text-xs font-black cursor-pointer transition-colors disabled:opacity-40"
              >
                <Play className="w-4 h-4 text-white fill-white" />
                MULAI PANGGILAN SUARA
              </button>

              {isPlaying && (
                <button
                  onClick={handleStopAnnounce}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-950 text-white rounded-lg flex items-center gap-1.5 shadow-sm text-xs font-bold cursor-pointer transition-colors"
                >
                  <VolumeX className="w-4 h-4 text-white" />
                  HENTIKAN
                </button>
              )}
            </div>

            {/* Mode Settings Toggle */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`px-3 py-2 rounded-lg border text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                showSettings 
                  ? 'bg-red-50 border-red-200 text-red-700' 
                  : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
              }`}
            >
              <Settings className={`w-3.5 h-3.5 ${showSettings ? 'animate-spin' : ''}`} />
              {showSettings ? 'Sembunyikan Setelan' : 'Buka Setelan Suara'}
            </button>
          </div>

          {/* Collapsible settings panel */}
          {showSettings && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="mt-6 pt-5 border-t border-slate-105 space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Voice Selection dropdown */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1 tracking-wider uppercase">Pilihan Mesin Suara (TTS {selectedLanguage.toUpperCase()})</label>
                  <div className="relative">
                    <select
                      value={selectedVoiceName}
                      onChange={(e) => setSelectedVoiceName(e.target.value)}
                      className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-705 focus:outline-hidden appearance-none cursor-pointer"
                    >
                      {voices.map((v) => {
                        const isCurrentLang = v.lang.startsWith(selectedLanguage === 'id' ? 'id' : selectedLanguage === 'ar' ? 'ar' : 'en');
                        return (
                          <option key={v.name} value={v.name}>
                            {v.name} ({v.lang}){isCurrentLang ? ' ⭐ Cocok' : ''}
                          </option>
                        );
                      })}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
                  </div>
                  <span className="text-[9px] text-emerald-700 font-extrabold mt-1 block">
                    * {selectedLanguage === 'id' ? 'Gunakan "Google Bahasa Indonesia" untuk suara Indonesia alami.' : selectedLanguage === 'ar' ? 'Pilih engine Arab seperti Maged/Tarik/Google Arabic agar pengucapan tepat.' : 'Pilih engine English (Google US English) untuk intonasi Inggris lancar.'}
                  </span>
                </div>

                {/* Male Tone Controls */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1 tracking-wider uppercase">Setelan Nada & Kecepatan (Laras Laki-laki)</label>
                  <div className="space-y-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    {/* Pitch Slider */}
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 font-semibold">Tinggi Nada (Pitch): <b className="text-slate-700 font-extrabold">{pitch}</b></span>
                      <span className="text-[9px] text-red-600 bg-red-50 font-bold px-1 rounded">Semakin rendah = suara cowok bass</span>
                    </div>
                    <input 
                      type="range" 
                      min="0.5" 
                      max="1.5" 
                      step="0.05"
                      value={pitch} 
                      onChange={(e) => setPitch(parseFloat(e.target.value))}
                      className="w-full accent-red-600 cursor-pointer h-1 rounded"
                    />

                    {/* Speed/Rate Slider */}
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 font-semibold">Kecepatan Baca (Speed): <b className="text-slate-700 font-extrabold">{rate}</b></span>
                      <span className="text-[9px] text-slate-400 font-bold">Standard: 1.0</span>
                    </div>
                    <input 
                      type="range" 
                      min="0.5" 
                      max="1.5" 
                      step="0.05"
                      value={rate} 
                      onChange={(e) => setRate(parseFloat(e.target.value))}
                      className="w-full accent-red-600 cursor-pointer h-1 rounded"
                    />
                  </div>
                </div>

              </div>

              {/* Background Live Automation Toggles */}
              <div className="bg-slate-50 border border-slate-205 p-4 rounded-xl space-y-3">
                <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  <Bell className="w-4 h-4 text-red-600 shrink-0" />
                  Sistem Asisten Pengumuman Otomatis (Real-time Background Automation)
                </span>
                
                <p className="text-[11px] text-slate-500 leading-normal font-medium">
                  Sistem memantau database cloud Firestore secara real-time. Jika Anda mengaktifkan salah satu opsi di bawah ini, 
                  peramban Anda akan melafalkan panggilan secara otomatis saat data berubah, bahkan ketika Anda sedang berada di halaman monitor lain.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  {/* Toggle 1: Approved / Departure */}
                  <label className="flex items-start gap-3 p-3 bg-white border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                    <input 
                      type="checkbox"
                      checked={autoAnnounceApproved}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setAutoAnnounceApproved(val);
                        localStorage.setItem('ezen_auto_announce_approved', String(val));
                      }}
                      className="mt-1 h-4 w-4 rounded-xs border-slate-300 text-red-600 focus:ring-red-600 cursor-pointer"
                    />
                    <div>
                      <span className="block text-xs font-bold text-slate-800">Umumkan Izin Baru Disetujui (Keluar)</span>
                      <span className="block text-[10px] text-slate-400 mt-0.5">Suarakan otomatis ketika ada perizinan baru yang disetujui / aktif keluar pondok.</span>
                    </div>
                  </label>

                  {/* Toggle 2: Return / Entry (Izin Masuk) */}
                  <label className="flex items-start gap-3 p-3 bg-white border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                    <input 
                      type="checkbox"
                      checked={autoAnnounceReturned}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setAutoAnnounceReturned(val);
                        localStorage.setItem('ezen_auto_announce_returned', String(val));
                      }}
                      className="mt-1 h-4 w-4 rounded-xs border-slate-300 text-red-600 focus:ring-red-600 cursor-pointer"
                    />
                    <div>
                      <span className="block text-xs font-bold text-slate-800">Umumkan Santri Melapor Kembali (Izin Masuk)</span>
                      <span className="block text-[10px] text-slate-400 mt-0.5">Suarakan otomatis saat satpam memasukkan laporan santri kembali dari berpergian.</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Template Sentence Setting */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-slate-400 tracking-wider uppercase">Format Susunan Kalimat Pengeras Suara ({selectedLanguage.toUpperCase()})</label>
                  <button 
                    onClick={() => {
                      handleUpdateActiveTemplate(defaultTemplates[selectedLanguage]);
                    }}
                    className="text-[10px] text-red-600 hover:underline font-bold"
                  >
                    Reset ke Bawaan
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={activeTemplate}
                  onChange={(e) => handleUpdateActiveTemplate(e.target.value)}
                  className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg p-3 focus:outline-hidden focus:border-red-600"
                  placeholder="Gunakan tanda: [nama], [kelas], [asrama], [jenis_izin], [keperluan] untuk nilai otomatis"
                ></textarea>
                
                {/* Placeholders chips */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {['[nama]', '[kelas]', '[asrama]', '[jenis_izin]', '[keperluan]'].map(chip => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => {
                        handleUpdateActiveTemplate(activeTemplate + ' ' + chip);
                      }}
                      className="text-[10px] bg-white border border-slate-250 hover:bg-slate-50 font-bold px-2 py-0.5 rounded-md text-slate-600 transition-all cursor-pointer"
                    >
                      + {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Entering/Return Template Sentence Setting */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-slate-400 tracking-wider uppercase">Format Susunan Kalimat Kembali / Izin Masuk ({selectedLanguage.toUpperCase()})</label>
                  <button 
                    onClick={() => {
                      handleUpdateActiveReturnTemplate(defaultReturnTemplates[selectedLanguage]);
                    }}
                    className="text-[10px] text-red-600 hover:underline font-bold"
                  >
                    Reset ke Bawaan
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={activeReturnTemplate}
                  onChange={(e) => handleUpdateActiveReturnTemplate(e.target.value)}
                  className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg p-3 focus:outline-hidden focus:border-red-600"
                  placeholder="Gunakan tanda: [nama], [kelas], [asrama], [jenis_izin], [keperluan] untuk nilai otomatis"
                ></textarea>
                
                {/* Placeholders chips for returning */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {['[nama]', '[kelas]', '[asrama]', '[jenis_izin]', '[keperluan]'].map(chip => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => {
                        handleUpdateActiveReturnTemplate(activeReturnTemplate + ' ' + chip);
                      }}
                      className="text-[10px] bg-white border border-slate-250 hover:bg-slate-50 font-bold px-2 py-0.5 rounded-md text-slate-600 transition-all cursor-pointer"
                    >
                      + {chip}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-950 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  Simpan Konfigurasi
                </button>
              </div>

            </motion.div>
          )}

        </div>

        {/* Searching Database Directly */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
            <div>
              <h3 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">Cari Santri Untuk Dipanggil</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Ketik nama untuk menyusun panggilan instan</p>
            </div>
            {selectedSantriId && (
              <button
                onClick={() => {
                  setSelectedSantriId('');
                  setSearchQuery('');
                }}
                className="text-[10px] text-red-600 hover:underline font-bold text-left"
              >
                Atur Ulang / Hapus Pilihan
              </button>
            )}
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Ketik minimal 3 huruf nama santri santri..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-205 rounded-xl text-xs focus:outline-hidden focus:border-red-650"
            />

            {/* Suggestions dropdown dropdown list */}
            {searchedSantri.length > 0 && (
              <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-slate-150 rounded-xl shadow-lg divide-y divide-slate-100 overflow-hidden">
                {searchedSantri.map((santri) => {
                  const isSActive = selectedSantriId === santri.id;
                  return (
                    <button
                      key={santri.id}
                      type="button"
                      onClick={() => {
                        setSelectedSantriId(santri.id);
                        setSearchQuery(santri.name);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-extrabold text-slate-800">{santri.name}</p>
                        <p className="text-[10px] text-slate-400 font-medium">{santri.className} • {santri.roomName || 'Tanpa Asrama'}</p>
                      </div>
                      <span className="text-[10px] bg-red-50 text-red-700 font-black border border-red-100 px-2 py-0.5 rounded">
                        Pilih Santri
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick list of students who actively have permission right now */}
          <div>
            <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2.5">
              Klik Cepat Santri Izin Keluar Aktif ({activePermsToAnnounce.length} Santri)
            </span>
            {activePermsToAnnounce.length === 0 ? (
              <div className="p-5 border border-dashed border-slate-200 rounded-xl text-center bg-slate-50/50">
                <Info className="w-6 h-6 text-slate-300 mx-auto mb-1" />
                <p className="text-[11px] font-bold text-slate-450">Tidak ada perizinan keluar gerbang yang aktif.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
                {activePermsToAnnounce.map((perm) => (
                  <div 
                    key={perm.id} 
                    className={`p-3 bg-white border rounded-xl hover:shadow-2xs transition-all flex justify-between items-center ${
                      selectedSantriId === perm.studentId ? 'border-red-500 bg-red-50/20' : 'border-slate-150'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[9px] font-mono font-bold text-red-600 bg-red-50 px-1 rounded">
                          {perm.id}
                        </span>
                        <span className={`text-[8px] font-extrabold px-1.5 rounded uppercase leading-none ${
                          perm.status === 'Sedang Berjalan' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {perm.status === 'Sedang Berjalan' ? 'DILUAR' : 'DISETUJUI'}
                        </span>
                      </div>
                      <p className="font-extrabold text-xs text-slate-800 truncate">{perm.studentName}</p>
                      <p className="text-[10px] text-slate-400 font-semibold truncate">{perm.className} • {perm.roomName}</p>
                    </div>
                    
                    <button
                      onClick={() => {
                        setSelectedSantriId(perm.studentId || '');
                        // Prepare text and Speak directly
                        const customAnnouncement = formatAnnouncementText(
                          perm.studentName,
                          perm.className,
                          perm.roomName || 'Asrama',
                          perm.leaveType,
                          perm.reason
                        );
                        announceText(customAnnouncement, perm.studentName);
                      }}
                      className="h-8 w-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center shrink-0 border border-red-100 cursor-pointer shadow-3xs hover:scale-105 active:scale-95 transition-transform"
                      title="Klik untuk Panggil Suara Langsung"
                    >
                      <Volume2 className="w-4 h-4 text-red-650" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* COLUMN 3: ANNOUNCEMENT HISTORY LOG */}
      <div className="space-y-6">
        
        {/* Help Tip of speech browser compliance */}
        <div className="bg-amber-50 border border-amber-200/60 p-4 rounded-xl space-y-2 text-xs">
          <div className="flex items-center gap-1.5 font-extrabold text-amber-900">
            <Info className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Kepatuhan Mesin Peramban</span>
          </div>
          <p className="text-amber-850 text-[11px] font-medium leading-relaxed">
            Fitur pengeras suara ini menggunakan <b>Web Speech API</b> bawaan sistem operasi PC/Handphone Anda. 
            Suara laki-laki/perempuan diatur otomatis sesuai database yang diunduh oleh browser Anda.
          </p>
          <div className="text-[10px] text-amber-700 bg-amber-100/50 p-2 rounded-lg font-semibold leading-normal">
            ⚙️ <b>Tips Terbaik</b>: Jika suara terasa terlalu tinggi/melengking, kurangi **Pitch** slider di tab setelan menjadi <b>(0.8 atau 0.85)</b> untuk mendapatkan warna suara baritone (pria dewasa) yang matang.
          </div>
        </div>

        {/* Real-time History Feed panel */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-red-550 mr-0.5 animate-pulse" />
              <h3 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">Log Riwayat Panggilan</h3>
            </div>
            {announcementHistory.length > 0 && (
              <button
                onClick={handleClearHistory}
                className="text-[10px] text-slate-450 hover:text-red-600 font-bold"
              >
                Hapus Semua
              </button>
            )}
          </div>

          {announcementHistory.length === 0 ? (
            <div className="p-8 text-center text-slate-400 space-y-1 bg-slate-50/50 border border-dashed border-slate-150 rounded-xl">
              <VolumeX className="w-8 h-8 text-slate-205 mx-auto opacity-75" />
              <p className="text-[11px] font-bold text-slate-500">Belum ada riwayat suara.</p>
              <p className="text-[9px] text-slate-400">Klik tombol panggil untuk memulai audio speech.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {announcementHistory.map((item) => (
                <div key={item.id} className="p-2.5 bg-slate-50 border border-slate-150 rounded-lg hover:bg-slate-100/50 transition-all text-xs">
                  <div className="flex justify-between items-center mb-1 text-[10px] font-semibold text-slate-400">
                    <span className="font-bold text-red-650">{item.name}</span>
                    <span>🕒 {item.time}</span>
                  </div>
                  <p className="text-[10.5px] italic text-slate-600 select-all font-medium leading-relaxed">
                    "{item.text.length > 100 ? item.text.substring(0, 100) + '...' : item.text}"
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
