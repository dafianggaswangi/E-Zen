/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { HelpCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'warning' | 'primary' | 'success';
}

export default function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Ya, Lanjutkan',
  cancelLabel = 'Batal',
  onConfirm,
  onCancel,
  variant = 'primary'
}: ConfirmationModalProps) {
  
  const getIcon = () => {
    switch (variant) {
      case 'danger':
        return <AlertTriangle className="w-6 h-6 text-rose-600" />;
      case 'warning':
        return <AlertTriangle className="w-6 h-6 text-amber-600" />;
      case 'success':
        return <CheckCircle2 className="w-6 h-6 text-emerald-600" />;
      default:
        return <Info className="w-6 h-6 text-red-600" />;
    }
  };

  const getConfirmButtonClass = () => {
    switch (variant) {
      case 'danger':
        return 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs focus:ring-rose-500';
      case 'warning':
        return 'bg-amber-500 hover:bg-amber-600 text-white shadow-xs focus:ring-amber-500';
      case 'success':
        return 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs focus:ring-emerald-500';
      default:
        return 'bg-slate-900 hover:bg-slate-800 text-white shadow-xs focus:ring-slate-700';
    }
  };

  const getHeaderBorder = () => {
    switch (variant) {
      case 'danger':
        return 'border-rose-100 bg-rose-50/20';
      case 'warning':
        return 'border-amber-100 bg-amber-50/20';
      case 'success':
        return 'border-emerald-100 bg-emerald-50/20';
      default:
        return 'border-slate-100 bg-slate-50/20';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 overflow-y-auto">
          {/* Backdrop with elegant micro-blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
          />

          {/* Modal box */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="relative bg-white rounded-2xl shadow-xl max-w-sm w-full overflow-hidden border border-slate-100"
          >
            <div className={`p-5 flex items-start gap-4 border-b ${getHeaderBorder()}`}>
              {getIcon()}
              <div className="space-y-1 flex-1">
                <h3 className="font-bold text-sm text-slate-950 tracking-tight">{title}</h3>
                <p className="text-xs text-slate-550 leading-relaxed font-medium">{message}</p>
              </div>
            </div>

            <div className="bg-slate-50/70 p-4 flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={onCancel}
                className="px-3.5 py-2 border border-slate-200 rounded-lg bg-white text-slate-650 hover:bg-slate-50 font-semibold transition-all shadow-2xs"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className={`px-4 py-2 rounded-lg font-bold transition-all shadow-2xs focus:ring-2 focus:ring-offset-1 ${getConfirmButtonClass()}`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
