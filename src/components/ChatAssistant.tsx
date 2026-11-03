import React, { useState, useRef, useEffect } from 'react';
import {
  AppDatabase,
  RateConfig,
  ChatMessage,
  BlockType,
} from '../types';
import {
  calculateDashboardSummary,
  calculateDCHourlyBreakdown,
  calculateAllBlocksMetrics,
  calculateTopEarners,
  calculatePTPerformance,
  getActiveRosterScanIds,
  PTPerformanceStats,
} from '../utils/calculator';
import {
  MessageSquare,
  X,
  Send,
  Bot,
  User,
  Sparkles,
  Zap,
  Layers,
  Award,
  AlertTriangle,
  FileSpreadsheet,
  Minimize2,
  Maximize2,
  Trash2,
} from 'lucide-react';

interface ChatAssistantProps {
  db: AppDatabase;
  operationalDate: string;
  currentRate: RateConfig;
  onSelectPtId?: (ptId: string) => void;
  onOpenMailBot?: () => void;
}

export const ChatAssistant: React.FC<ChatAssistantProps> = ({
  db,
  operationalDate,
  currentRate,
  onSelectPtId,
  onOpenMailBot,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome',
      sender: 'assistant',
      text: `Hello! I am your Shadowfax NBP DC Operational Assistant. I have live access to your scan records, roster, block breakdowns, and payment rates for ${operationalDate}. How can I assist you today?`,
      timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Operational query solver
  const resolveOperationalQuery = (query: string): { text: string; dataPayload?: any } => {
    const q = query.toLowerCase().trim();

    const activeScanIdSet = getActiveRosterScanIds(db.roster);
    const summary = calculateDashboardSummary(
      operationalDate,
      db.scanRateRecords,
      db.roster,
      currentRate,
      'ALL'
    );
    const { hourlyStats, peakHour, totalDayScans, totalDayCost } = calculateDCHourlyBreakdown(
      operationalDate,
      db.scanRateRecords,
      db.roster,
      currentRate
    );
    const { metrics: blockMetrics } = calculateAllBlocksMetrics(
      operationalDate,
      db.scanRateRecords,
      db.roster,
      currentRate
    );
    const topEarners = calculateTopEarners(
      operationalDate,
      db.scanRateRecords,
      db.roster,
      currentRate,
      5
    );

    // 1. Top earners
    if (q.includes('top earner') || q.includes('top pt') || q.includes('best pt') || q.includes('highest')) {
      if (topEarners.length === 0) {
        return { text: `No PT scans recorded yet for ${operationalDate}. Please upload a Scan Rate file.` };
      }
      const list = topEarners
        .map(
          (pt: PTPerformanceStats, idx: number) =>
            `${idx + 1}. **${pt.mp_name}** (${pt.scan_id}) - ₹${pt.todayTotalEarnings.toLocaleString()} (${pt.todayTotalScans.toLocaleString()} scans in Block ${pt.assigned_block})`
        )
        .join('\n');
      return {
        text: `🏆 **Top 5 Earners for ${operationalDate}:**\n\n${list}`,
        dataPayload: { type: 'top_earners', data: topEarners },
      };
    }

    // 2. Block queries
    const blockMatch = q.match(/block\s+([a-e])/i) || q.match(/([a-e])\s+block/i);
    if (blockMatch) {
      const targetBlock = blockMatch[1].toUpperCase() as BlockType;
      const bMetric = blockMetrics.find((b) => b.block === targetBlock);
      if (bMetric) {
        return {
          text: `📊 **Block ${targetBlock} Performance (${operationalDate}):**\n• Total Scans: **${bMetric.totalScans.toLocaleString()}** (${bMetric.scanSharePercentage}% of DC volume)\n• Primary Scans: ${bMetric.primaryScans.toLocaleString()} (₹${(bMetric.primaryScans * currentRate.primary_rate).toFixed(2)})\n• Secondary Scans: ${bMetric.secondaryScans.toLocaleString()} (₹${(bMetric.secondaryScans * currentRate.secondary_rate).toFixed(2)})\n• Total Payout: **₹${bMetric.totalCost.toLocaleString()}**\n• Active PTs: ${bMetric.activePTCount}`,
          dataPayload: { type: 'block_metric', data: bMetric },
        };
      }
    }

    if (q.includes('block') || q.includes('all blocks')) {
      const rows = blockMetrics
        .map(
          (b) =>
            `• **Block ${b.block}:** ${b.totalScans.toLocaleString()} scans (${b.scanSharePercentage}%) | ₹${b.totalCost.toLocaleString()} payout | ${b.activePTCount} PTs`
        )
        .join('\n');
      return {
        text: `📊 **Block-Wise Performance Overview (${operationalDate}):**\n\n${rows}`,
      };
    }

    // 3. Peak hours
    if (q.includes('peak') || q.includes('hour') || q.includes('hourly') || q.includes('velocity')) {
      if (!peakHour || peakHour.totalScans === 0) {
        return { text: `No hourly scan data recorded for ${operationalDate}.` };
      }
      return {
        text: `⏰ **Hourly Peak Analysis (${operationalDate}):**\n• Peak Hour: **${peakHour.label} IST**\n• Peak Volume: **${peakHour.totalScans.toLocaleString()} scans/hr**\n• Peak Payout: ₹${peakHour.totalCost.toLocaleString()}\n• Active PTs during peak: ${peakHour.activePTs}\n• Primary scans at peak: ${peakHour.primaryScans.toLocaleString()} | Secondary: ${peakHour.secondaryScans.toLocaleString()}`,
      };
    }

    // 4. Specific PT search
    const idMatch = q.match(/\b\d{6,12}\b/);
    if (idMatch) {
      const searchId = idMatch[0];
      const ptInRoster = db.roster.find(
        (r) => r.scan_id === searchId || r.valinor_id.toLowerCase() === searchId.toLowerCase()
      );
      if (ptInRoster) {
        const perf = calculatePTPerformance(
          ptInRoster.scan_id,
          operationalDate,
          db.scanRateRecords,
          db.roster,
          currentRate
        );
        if (perf) {
          return {
            text: `👤 **PT Record Found:**\n• Name: **${perf.mp_name}**\n• Scan ID: **${perf.scan_id}**\n• Valinor ID: ${perf.valinor_id || 'N/A'}\n• Assigned Block: **Block ${perf.assigned_block}**\n• Status: ${perf.status}\n\n**Performance Today (${operationalDate}):**\n• Primary Scans: ${perf.todayPrimaryScans.toLocaleString()} (₹${perf.todayPrimaryEarnings})\n• Secondary Scans: ${perf.todaySecondaryScans.toLocaleString()} (₹${perf.todaySecondaryEarnings})\n• Total Scans: **${perf.todayTotalScans.toLocaleString()}**\n• Total Earnings: **₹${perf.todayTotalEarnings.toLocaleString()}**`,
            dataPayload: { type: 'pt_found', scan_id: perf.scan_id },
          };
        }
      }
    }

    // 5. Unregistered / Machine sorter
    if (q.includes('unregistered') || q.includes('machine') || q.includes('sorter') || q.includes('unmapped')) {
      const unregCount = db.scanRateRecords
        .filter(
          (r) =>
            r.operational_date === operationalDate &&
            !r.is_machine &&
            !activeScanIdSet.has(r.normalized_mp_id)
        )
        .reduce((sum, r) => sum + r.scan_count, 0);

      const machineCount = db.scanRateRecords
        .filter((r) => r.operational_date === operationalDate && r.is_machine)
        .reduce((sum, r) => sum + r.scan_count, 0);

      return {
        text: `🛡️ **DC Compliance & Ingestion Status:**\n• **Unregistered Scans:** ${unregCount.toLocaleString()} scans recorded from non-roster users (strictly hidden from payouts until added in Admin).\n• **Machine Sorter (NBP-MU-01 / bamnoli_dc_muvro_sorter):** ${machineCount.toLocaleString()} scans recorded and **automatically excluded** at ₹0 payment.\n• **Roster Status:** ${db.roster.filter((r) => r.status === 'Active').length} active registered PTs.`,
      };
    }

    // 6. Total payout / summary
    if (q.includes('total') || q.includes('payout') || q.includes('cost') || q.includes('summary')) {
      return {
        text: `💰 **NBP DC Settlement Summary (${operationalDate}):**\n• Total Scans: **${summary.totalCombinedScans.toLocaleString()}**\n• Total Payout: **₹${summary.totalCombinedCost.toLocaleString()}**\n• Primary Scans: ${summary.totalPrimaryScans.toLocaleString()} @ ₹${currentRate.primary_rate.toFixed(2)} = ₹${summary.totalPrimaryCost.toLocaleString()}\n• Secondary Scans: ${summary.totalSecondaryScans.toLocaleString()} @ ₹${currentRate.secondary_rate.toFixed(2)} = ₹${summary.totalSecondaryCost.toLocaleString()}\n• Active PTs Paid: ${Math.max(summary.totalPrimaryPTs, summary.totalSecondaryPTs)}`,
      };
    }

    // 7. MailBot draft
    if (q.includes('email') || q.includes('mail') || q.includes('draft') || q.includes('report')) {
      return {
        text: `✉️ **MailBot Daily Draft:**\n\nSubject: [NBP DC Daily Report] PT Scans & Payout Summary - ${operationalDate}\n\nDear Leadership,\nToday's verified total is **${summary.totalCombinedScans.toLocaleString()} scans** across active PTs with total payout of **₹${summary.totalCombinedCost.toLocaleString()}**. Top producing block is ${blockMetrics.reduce((prev, curr) => (curr.totalScans > prev.totalScans ? curr : prev), blockMetrics[0]).block} Block.\n\nYou can dispatch this email directly using the MailBot tab!`,
      };
    }

    // Default response
    return {
      text: `Here is the current operational status for **${operationalDate}**:\n• Total Active Scans: **${summary.totalCombinedScans.toLocaleString()}**\n• Total Payout: **₹${summary.totalCombinedCost.toLocaleString()}**\n• Active Working PTs: **${Math.max(summary.totalPrimaryPTs, summary.totalSecondaryPTs)}**\n• Primary Rate: ₹${currentRate.primary_rate.toFixed(2)} | Secondary Rate: ₹${currentRate.secondary_rate.toFixed(2)}\n\nYou can ask me about:\n- "Top earners today"\n- "Block A performance"\n- "Peak hours"\n- "Unregistered scans"\n- "Search PT 968893"`,
    };
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim()) return;

    const userMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      sender: 'user',
      text: query.trim(),
      timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      const response = resolveOperationalQuery(userMsg.text);
      const assistantMsg: ChatMessage = {
        id: 'msg-' + (Date.now() + 1),
        sender: 'assistant',
        text: response.text,
        timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        dataPayload: response.dataPayload,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setIsTyping(false);
    }, 400);
  };

  const quickChips = [
    { label: '🏆 Top Earners', query: 'Who are the top earners today?' },
    { label: '📊 Block Breakdown', query: 'Show all blocks breakdown' },
    { label: '⏰ Peak Hours', query: 'What was the peak hour today?' },
    { label: '💰 Total Payout', query: 'What is the total payout calculation?' },
    { label: '🛡️ Compliance & Sorter', query: 'Check unregistered and machine sorter scans' },
  ];

  return (
    <>
      {/* Floating Launcher Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-slate-900 to-amber-950 text-white rounded-full shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all border border-amber-500/40 group"
          title="Open NBP DC Operational Assistant"
        >
          <div className="w-7 h-7 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
            <Bot className="w-4 h-4" />
          </div>
          <span className="font-bold text-xs tracking-wide pr-1">NBP Assistant</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </button>
      )}

      {/* Backdrop for closing by clicking outside */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/25 backdrop-blur-[1px] transition-opacity"
          aria-label="Close Chat Backdrop"
        />
      )}

      {/* Floating Chat Drawer / Window */}
      {isOpen && (
        <div className="fixed bottom-3 sm:bottom-6 right-3 sm:right-6 z-50 w-full sm:w-[440px] max-w-[calc(100vw-24px)] h-[520px] max-h-[calc(100vh-32px)] bg-white border border-slate-300 rounded-2xl shadow-2xl flex flex-col overflow-hidden font-sans animate-fade-in">
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-4 flex items-center justify-between border-b border-slate-700 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-white">NBP DC Assistant</h3>
                  <span className="text-[10px] bg-amber-500/20 text-amber-400 font-mono px-1.5 py-0.2 rounded border border-amber-500/30">
                    ONLINE
                  </span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Live Operations Copilot • {operationalDate}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setMessages([messages[0]])}
                className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
                title="Clear Chat History"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                title="Close Assistant (Esc)"
              >
                <X className="w-4 h-4" />
                <span>Close</span>
              </button>
            </div>
          </div>

          {/* Quick Suggestion Chips */}
          <div className="bg-slate-50 border-b border-slate-200 p-2 overflow-x-auto scrollbar-none flex gap-1.5 shrink-0">
            {quickChips.map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(chip.query)}
                className="text-[11px] font-semibold bg-white hover:bg-amber-50 text-slate-700 hover:text-amber-800 border border-slate-200 hover:border-amber-300 px-2.5 py-1 rounded-full whitespace-nowrap transition-colors shadow-2xs"
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/50">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'assistant' && (
                  <div className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-xs ${
                    msg.sender === 'user'
                      ? 'bg-amber-500 text-slate-950 font-medium rounded-br-xs'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-bl-xs'
                  }`}
                >
                  <div className="whitespace-pre-line">{msg.text}</div>

                  {/* If PT found, provide view details button */}
                  {msg.dataPayload?.type === 'pt_found' && onSelectPtId && (
                    <button
                      onClick={() => onSelectPtId(msg.dataPayload.scan_id)}
                      className="mt-2 text-[11px] font-bold bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-md transition-colors flex items-center gap-1"
                    >
                      <span>Open Full Profile in PT Details &gt;</span>
                    </button>
                  )}

                  <div
                    className={`text-[9px] mt-1 text-right font-mono ${
                      msg.sender === 'user' ? 'text-amber-950/70' : 'text-slate-400'
                    }`}
                  >
                    {msg.timestamp}
                  </div>
                </div>

                {msg.sender === 'user' && (
                  <div className="w-7 h-7 rounded-lg bg-slate-800 text-white flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}

            {isTyping && (
              <div className="flex items-center gap-2 text-slate-500 text-xs italic py-1">
                <Bot className="w-4 h-4 text-amber-600 animate-spin" />
                <span>NBP Assistant is analyzing DC data...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Footer */}
          <div className="p-3 bg-white border-t border-slate-200 shrink-0 space-y-1.5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                placeholder="Ask about scans, top earners, Block D, or PT ID..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-amber-500 font-medium"
              />
              <button
                type="submit"
                disabled={!input.trim()}
                className="p-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl shadow-xs transition-colors disabled:opacity-40"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
              <span>Press <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono text-[10px] text-slate-700">Esc</kbd> or click outside to dismiss</span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-700 hover:text-rose-600 font-bold hover:underline flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>Close Assistant</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
