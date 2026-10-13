import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';

export interface CancelFundingModalData {
  requestId: string;
  projectName: string;
  projectKey: string;
  userEmail: string;
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
  }) => Promise<void> | void;
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

  const defaultMessage = (projName: string) =>
    `Following an automated review of your account, we have found that we have canceled your complimentary project funding and special tier status for ${projName || 'your project'}.\n\nYour token allocation has been returned to the standard tier quota (1M tokens). Multimodal access (Vision, Voice STT, TTS, Image Gen) and extended promotional budgets have been deactivated for this project key.\n\nPlease change to a subscribed plan to restore high-volume routing and unrestricted feature access.`;

  useEffect(() => {
    if (data && isOpen) {
      setSendEmail(true);
      setRecipientEmail(data.userEmail || '');
      setSubject(`Notice: Project Funding Status Update for ${data.projectName || 'Your Project'} - OmniKey AI`);
      setMessageText(defaultMessage(data.projectName));
      setActiveTab('edit');
    }
  }, [data, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || !data) return null;

  const maskedKey = data.projectKey
    ? data.projectKey.slice(0, 15) + '•'.repeat(16)
    : 'N/A';

  const handleResetToDefault = () => {
    setMessageText(defaultMessage(data.projectName));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm({
      requestId: data.requestId,
      sendEmail,
      recipientEmail: recipientEmail.trim(),
      subject: subject.trim(),
      messageText: messageText.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity duration-200"
        onClick={() => {
          if (!isSubmitting) onClose();
        }}
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
            <p className="text-xs text-slate-550 dark:text-zinc-400 mt-1">
              Revoke special permissions and optionally notify developer via Resend API
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 text-lg p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          
          {/* Target Project Summary Callout */}
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-rose-600 dark:text-rose-450 uppercase tracking-wider text-[11px]">
                Target Project & Developer
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
            <p className="text-[11px] text-slate-550 dark:text-zinc-400 pt-1 border-t border-rose-500/10">
              ⚠️ <strong>Impact:</strong> Reverts user token pool limit back to 1M, revokes <code className="text-violet-500">isPromoted</code> status, and removes Vision, Voice, TTS, and Image Gen access.
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
                    className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all ${
                      activeTab === 'edit'
                        ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Edit Message
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('preview')}
                    className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all ${
                      activeTab === 'preview'
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
                    placeholder="Notice: Project Funding Status Update"
                    className="h-9 text-xs"
                  />
                </div>

                {activeTab === 'edit' ? (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-slate-600 dark:text-zinc-300 uppercase tracking-wider">
                        Email Message Body (Editable)
                      </label>
                      <button
                        type="button"
                        onClick={handleResetToDefault}
                        className="text-[10px] text-violet-500 hover:text-violet-400 underline font-medium"
                      >
                        Reset to default text
                      </button>
                    </div>
                    <Textarea
                      rows={5}
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      placeholder="Enter the explanation/body to be sent..."
                      className="text-xs leading-relaxed font-sans"
                    />
                    <span className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1 block">
                      Separate paragraphs with double enter. This text will be wrapped into OmniKey AI's branded notification email.
                    </span>
                  </div>
                ) : (
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
                        <div className="text-[10px] text-slate-400">OmniKey AI - Developer Portal</div>
                      </div>

                      <div className="space-y-2 text-[12px] leading-relaxed text-slate-600 dark:text-slate-300">
                        <p className="font-medium text-slate-900 dark:text-slate-100">Hello,</p>
                        {messageText.split(/\n\n+/).map((para, i) => (
                          <p key={i} className="whitespace-pre-line">{para}</p>
                        ))}
                      </div>

                      <div className="mt-3 p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 text-[11px] space-y-1">
                        <div><strong>Project:</strong> {data.projectName}</div>
                        <div><strong>Project Key:</strong> <code className="font-mono text-[10px] bg-slate-200 dark:bg-zinc-800 px-1 rounded">{maskedKey}</code></div>
                      </div>

                      <div className="mt-4 text-center">
                        <span className="inline-block bg-violet-600 text-white font-semibold text-[11px] px-4 py-1.5 rounded-lg shadow-sm">
                          View Plans & Subscribe →
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-600 dark:text-amber-400">
                ℹ️ <strong>Email disabled:</strong> Funding and permissions will be cancelled in the database without sending an email notification.
              </div>
            )}
          </div>

          {/* Footer Action Buttons */}
          <div className="pt-2 flex justify-end gap-2 border-t border-slate-200 dark:border-zinc-800">
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
