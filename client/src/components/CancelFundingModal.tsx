import React, { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';

export interface CancelFundingModalData {
  requestId: string;
  projectName: string;
  projectKey: string;
  userEmail: string;
  /** Raw token count (e.g. 14_000_000) */
  totalTokens?: number;
  /** Total API requests made via this project */
  totalRequests?: number;
  /** Cost saved in INR (pre-calculated by AdminPage) */
  costSavedINR?: number;
}

interface CancelFundingModalProps {
  isOpen: boolean;
  data: CancelFundingModalData | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onConfirm: (payload: {
    requestId: string;
    sendEmail: boolean;
    recipientEmail: string;
    subject: string;
    messageText: string;
    variables: Record<string, string>;
  }) => Promise<void> | void;
}

// ─── Formatting helpers ───────────────────────────────────────────────────────
function fmtTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}
function fmtCostINR(inr: number): string {
  return `\u20B9${inr.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}
function fmtRequests(n: number): string {
  return n.toLocaleString('en-IN');
}

// ─── Variable definitions ─────────────────────────────────────────────────────
const VARIABLES: Array<{ key: string; label: string }> = [
  { key: 'tokensUsed', label: 'Tokens Used' },
  { key: 'costSaved', label: 'Cost Saved' },
  { key: 'totalRequests', label: 'Total Requests' },
  { key: 'projectName', label: 'Project Name' },
  { key: 'userEmail', label: 'Dev Email' },
  { key: 'projectKey', label: 'Project Key' },
];

// ─── Default polite email template ───────────────────────────────────────────
function buildDefaultMessage(): string {
  return [
    `We hope this message finds you well.`,
    `Following a routine automated review of account usage, we are reaching out regarding your project "{{projectName}}" ({{projectKey}}).`,
    `Your project has made exceptional use of OmniKey AI's complimentary funded tier, here is a summary of your usage to date:\n\n• Tokens consumed: {{tokensUsed}}\n• Total API requests: {{totalRequests}}\n• Estimated cost offset by OmniKey's free pool: {{costSaved}}`,
    `While we are genuinely excited by your adoption, the volume of resources consumed has reached a level that is unfortunately too high for us to continue sustaining under the free funded pool, particularly given our own server and infrastructure costs that scale with every request. To ensure fair access for all developers and to keep the platform healthy, we have paused the complimentary funding for this project.`,
    `As a result, the following changes have taken effect:\n\n• Token allocation has been returned to the standard 1M tier.\n• Extended multimodal permissions (Vision, Voice STT/TTS, Image Generation) have been deactivated.\n• The promotional pool upgrade has been revoked.`,
    `We warmly encourage you to consider switching to a paid tier, which offers premium high-volume routing and unrestricted feature access at a sustainable price by contacting us. Switching to a paid tier will restore all capabilities immediately.`,
    `If you have any questions or believe this change was made in error, please do not hesitate to reach out to us. We truly value your work and look forward to continuing to support your project.`,
    `Warm regards,\nThe OmniKey AI Team`,
  ].join('\n\n');
}

// ─── Variable interpolation ───────────────────────────────────────────────────
function interpolate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) =>
    key in vars ? vars[key] : `{{${key}}}`
  );
}

export function CancelFundingModal({
  isOpen,
  data,
  isSubmitting = false,
  onClose,
  onConfirm,
}: CancelFundingModalProps) {
  const [sendEmail, setSendEmail] = useState(true);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [messageText, setMessageText] = useState('');
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Build the resolved variable map from current data
  const buildVarMap = (d: CancelFundingModalData): Record<string, string> => ({
    tokensUsed: d.totalTokens != null ? fmtTokens(d.totalTokens) : '—',
    costSaved: d.costSavedINR != null ? fmtCostINR(d.costSavedINR) : '—',
    totalRequests: d.totalRequests != null ? fmtRequests(d.totalRequests) : '—',
    projectName: d.projectName || 'Your Project',
    userEmail: d.userEmail || '—',
    projectKey: d.projectKey ? (d.projectKey.slice(0, 15) + '\u2022'.repeat(8)) : '—',
  });

  useEffect(() => {
    if (data && isOpen) {
      setSendEmail(true);
      setRecipientEmail(data.userEmail || '');
      setSubject(`Important: Funding Status Update for ${data.projectName || 'Your Project'} \u2014 OmniKey AI`);
      setMessageText(buildDefaultMessage());
      setActiveTab('edit');
    }
  }, [data, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || !data) return null;

  const varMap = buildVarMap(data);

  const maskedKey = data.projectKey
    ? data.projectKey.slice(0, 15) + '\u2022'.repeat(16)
    : 'N/A';

  // Insert {{variable}} at current cursor position in the textarea
  const insertVariable = (varKey: string) => {
    const textarea = textareaRef.current;
    const token = `{{${varKey}}}`;
    if (!textarea) {
      setMessageText((prev) => prev + ' ' + token);
      return;
    }
    const start = textarea.selectionStart ?? messageText.length;
    const end = textarea.selectionEnd ?? messageText.length;
    const next = messageText.slice(0, start) + token + messageText.slice(end);
    setMessageText(next);
    requestAnimationFrame(() => {
      textarea.focus();
      const pos = start + token.length;
      textarea.setSelectionRange(pos, pos);
    });
  };

  const handleResetToDefault = () => setMessageText(buildDefaultMessage());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm({
      requestId: data.requestId,
      sendEmail,
      recipientEmail: recipientEmail.trim(),
      subject: subject.trim(),
      messageText: messageText.trim(),
      variables: varMap,
    });
  };

  const previewText = interpolate(messageText, varMap);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity duration-200"
        onClick={() => { if (!isSubmitting) onClose(); }}
      />

      {/* Modal Card */}
      <div className="relative z-50 w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-slate-900 dark:text-zinc-100">

        {/* Header */}
        <div className="p-6 pb-4 border-b border-slate-200 dark:border-zinc-800 flex items-start justify-between bg-slate-50/50 dark:bg-zinc-900/50">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Cancel Project Funding
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              Revoke special permissions and optionally notify developer via Resend API
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 text-lg p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
          >
            &#x2715;
          </button>
        </div>

        {/* Scrollable Content + Sticky Footer */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">

            {/* Target Project Summary Callout */}
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider text-[11px]">
                  Target Project &amp; Developer
                </span>
                <span className="font-mono text-[10px] text-slate-400 dark:text-zinc-500">
                  UID / ID: {data.requestId}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500 dark:text-zinc-400">Project:</span>{' '}
                  <strong className="text-slate-900 dark:text-zinc-100">{data.projectName}</strong>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-zinc-400">Developer:</span>{' '}
                  <strong className="text-slate-900 dark:text-zinc-100">{data.userEmail}</strong>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-slate-500 dark:text-zinc-400">Key:</span>{' '}
                  <code className="font-mono text-[11px] bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-slate-700 dark:text-zinc-300">
                    {maskedKey}
                  </code>
                </div>
              </div>

              {/* Usage metrics mini-dashboard */}
              {(data.totalTokens != null || data.totalRequests != null || data.costSavedINR != null) && (
                <div className="pt-2 border-t border-rose-500/10 grid grid-cols-3 gap-2">
                  {data.totalTokens != null && (
                    <div className="text-center">
                      <div className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-0.5">Tokens Used</div>
                      <div className="text-sm font-bold text-slate-900 dark:text-zinc-100">{fmtTokens(data.totalTokens)}</div>
                    </div>
                  )}
                  {data.totalRequests != null && (
                    <div className="text-center">
                      <div className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-0.5">Requests</div>
                      <div className="text-sm font-bold text-slate-900 dark:text-zinc-100">{fmtRequests(data.totalRequests)}</div>
                    </div>
                  )}
                  {data.costSavedINR != null && (
                    <div className="text-center">
                      <div className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-0.5">Cost Saved</div>
                      <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{fmtCostINR(data.costSavedINR)}</div>
                    </div>
                  )}
                </div>
              )}

              <p className="text-[11px] text-slate-500 dark:text-zinc-400 pt-1 border-t border-rose-500/10">
                &#x26A0;&#xFE0F; <strong>Impact:</strong> Reverts token pool limit to 1M, revokes <code className="text-violet-500">isPromoted</code> status, and removes Vision, Voice, TTS, and Image Gen access.
              </p>
            </div>

            {/* Email Notification Option */}
            <div className="space-y-4 pt-1">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={sendEmail}
                    onChange={(e) => setSendEmail(e.target.checked)}
                    className="rounded border-input text-rose-600 focus:ring-rose-500 h-4 w-4"
                  />
                  <span className="text-xs font-bold text-slate-900 dark:text-zinc-200">
                    Send Cancellation Email via Resend API
                  </span>
                </label>

                {sendEmail && (
                  <div className="flex rounded-lg border border-slate-200 dark:border-zinc-800 p-0.5 bg-slate-100 dark:bg-zinc-800/60 text-xs">
                    <button
                      type="button"
                      onClick={() => setActiveTab('edit')}
                      className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all ${activeTab === 'edit'
                        ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                    >
                      Edit Message
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('preview')}
                      className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all ${activeTab === 'preview'
                        ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                    >
                      Email Preview
                    </button>
                  </div>
                )}
              </div>

              {sendEmail ? (
                <div className="space-y-3.5 bg-slate-50/50 dark:bg-zinc-900/30 p-4 rounded-xl border border-slate-200 dark:border-zinc-800">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-zinc-300 uppercase tracking-wider mb-1">
                      Recipient Email
                    </label>
                    <Input
                      type="email"
                      required={sendEmail}
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      placeholder="developer@example.com"
                      className="h-9 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-zinc-300 uppercase tracking-wider mb-1">
                      Email Subject
                    </label>
                    <Input
                      type="text"
                      required={sendEmail}
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Important: Funding Status Update"
                      className="h-9 text-xs"
                    />
                  </div>

                  {activeTab === 'edit' ? (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[11px] font-bold text-slate-600 dark:text-zinc-300 uppercase tracking-wider">
                          Email Message Body
                        </label>
                        <button
                          type="button"
                          onClick={handleResetToDefault}
                          className="text-[10px] text-violet-500 hover:text-violet-400 underline font-medium"
                        >
                          Reset to default
                        </button>
                      </div>

                      {/* Variable Chip Toolbar */}
                      <div className="mb-2 flex flex-wrap items-center gap-1.5 p-2.5 rounded-lg bg-slate-100/80 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700">
                        <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mr-1 shrink-0">
                          Insert variable:
                        </span>
                        {VARIABLES.map(({ key }) => (
                          <button
                            key={key}
                            type="button"
                            title={`Current value: ${varMap[key]}`}
                            onClick={() => insertVariable(key)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-violet-400/40 bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 text-[10px] font-semibold hover:bg-violet-100 dark:hover:bg-violet-500/20 hover:border-violet-500/60 transition-colors cursor-pointer whitespace-nowrap"
                          >
                            <span className="opacity-50">+</span>
                            {`{{${key}}}`}
                            <span className="opacity-40 font-normal truncate max-w-[5rem]">= {varMap[key]}</span>
                          </button>
                        ))}
                      </div>

                      <Textarea
                        ref={textareaRef}
                        rows={8}
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        placeholder="Enter the email body text..."
                        className="text-xs leading-relaxed font-sans"
                      />
                      <span className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1 block">
                        Click a chip to insert at cursor. Separate paragraphs with a blank line. Variables are resolved to live values before sending.
                      </span>
                    </div>
                  ) : (
                    /* ── Live Email Preview ── */
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                        Live In-Screen Email Preview
                      </label>
                      <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-slate-950 p-4 text-xs text-slate-800 dark:text-slate-200 shadow-inner">
                        <div className="border-b border-rose-500/30 pb-2 mb-3">
                          <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-500 border border-rose-500/20 mb-1">
                            Funding Status: Cancelled
                          </span>
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                            Important Account Review Notice
                          </h4>
                          <div className="text-[10px] text-slate-400">OmniKey AI &#8212; Developer Portal</div>
                        </div>

                        <div className="space-y-2 text-[12px] leading-relaxed text-slate-600 dark:text-slate-300">
                          <p className="font-medium text-slate-900 dark:text-slate-100">Hello {data.userEmail},</p>
                          {previewText.split(/\n\n+/).map((para, i) => (
                            <p key={i} className="whitespace-pre-line">{para}</p>
                          ))}
                        </div>

                        {/\{\{\w+\}\}/.test(previewText) && (
                          <div className="mt-3 p-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-300/40 text-[10px] text-amber-700 dark:text-amber-400 font-medium">
                            &#x26A0;&#xFE0F; Some variables could not be resolved and will be sent as-is.
                          </div>
                        )}

                        <div className="mt-3 p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 text-[11px] space-y-1">
                          <div><strong>Project:</strong> {data.projectName}</div>
                          <div><strong>Project Key:</strong>{' '}
                            <code className="font-mono text-[10px] bg-slate-200 dark:bg-zinc-800 px-1 rounded">{maskedKey}</code>
                          </div>
                        </div>

                        <div className="mt-4 text-center">
                          <span className="inline-block bg-violet-600 text-white font-semibold text-[11px] px-4 py-1.5 rounded-lg shadow-sm">
                            View Plans &amp; Subscribe &#x2192;
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-600 dark:text-amber-400">
                  &#x2139;&#xFE0F; <strong>Email disabled:</strong> Funding and permissions will be cancelled in the database without sending an email notification.
                </div>
              )}
            </div>{/* end email notification section */}
          </div>{/* end scrollable body */}

          {/* Sticky Footer Action Buttons */}
          <div className="flex-shrink-0 px-6 py-3 flex items-center justify-between gap-2 border-t border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSubmitting}
              onClick={onClose}
              className="text-xs"
            >
              Keep Funding
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || (sendEmail && (!recipientEmail || !subject || !messageText))}
              className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold px-4 shadow-lg shadow-rose-600/20 border-none"
            >
              {isSubmitting
                ? 'Cancelling...'
                : sendEmail
                  ? 'Confirm Cancellation & Send Email'
                  : 'Confirm Cancellation (No Email)'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
