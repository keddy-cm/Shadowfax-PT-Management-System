import React, { useState } from 'react';
import {
  Smartphone,
  Copy,
  Check,
  ExternalLink,
  X,
  ShieldCheck,
  KeyRound,
  EyeOff,
} from 'lucide-react';

interface SharePtPortalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SharePtPortalModal: React.FC<SharePtPortalModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const getPortalUrl = () => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}${window.location.pathname}?portal=pt`;
    }
    return '?portal=pt';
  };

  const portalUrl = getPortalUrl();

  const handleCopy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(portalUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 p-5 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">
                PT Worker Self-Service Portal Link
              </h3>
              <p className="text-xs text-slate-300">
                Dedicated & fully separate URL for PT workers
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Isolation Guarantee */}
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3 text-xs text-emerald-900">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-bold">100% Isolated Worker Portal</p>
              <p className="text-emerald-800 leading-relaxed">
                When workers open this link, they <strong>cannot see</strong> your main DC dashboard, reports, rates, or any other worker's data. They only see their own individual earnings and scan logs.
              </p>
            </div>
          </div>

          {/* Shareable URL Box */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
              Worker Direct Access URL:
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={portalUrl}
                className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs text-slate-800 font-semibold focus:outline-none"
              />
              <button
                onClick={handleCopy}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 shrink-0"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-950" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied!' : 'Copy Link'}</span>
              </button>
            </div>
          </div>

          {/* Login Rules Explanation for Supervisors */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs space-y-2.5">
            <div className="flex items-center gap-2 font-bold text-slate-800">
              <KeyRound className="w-4 h-4 text-amber-600" />
              <span>How PT Workers Log In (Automatic):</span>
            </div>
            <ul className="space-y-2 text-slate-600 pl-1">
              <li className="flex items-start gap-2">
                <span className="font-mono bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded text-[11px] font-bold">1</span>
                <span><strong>Username:</strong> PT Scan ID (Mobile number or barcode number registered in DC roster).</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-mono bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded text-[11px] font-bold">2</span>
                <span><strong>Password:</strong> Last 5 digits of their Valinor ID (e.g. if Valinor ID is <code className="font-mono font-bold bg-slate-200 px-1 rounded">VAL16945</code>, password is <code className="font-mono font-bold bg-slate-200 px-1 rounded">16945</code>).</span>
              </li>
              <li className="flex items-start gap-2">
                <EyeOff className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <span>All logins are created <strong>automatically</strong> from the DC roster. No manual user creation is required.</span>
              </li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <a
              href={portalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-600" />
              <span>Open in New Tab to Preview</span>
            </a>

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
