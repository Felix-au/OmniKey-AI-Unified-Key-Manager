import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import remarkGithubBlockquoteAlert from 'remark-github-blockquote-alert'
import { useNavigate } from 'react-router-dom'
import logoUrl from '../assets/logo.png'

// GitHub markdown CSS (official)
import 'github-markdown-css/github-markdown.css'
// GitHub dark syntax highlighting
import 'highlight.js/styles/github.css'

const RAW_DOC_URL = 'https://raw.githubusercontent.com/Felix-au/OmniKey-AI-Unified-Key-Manager/main/API_Documentation.md'

export default function DocsPage() {
  const navigate = useNavigate()
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const isDark = document.documentElement.classList.contains('dark')

  useEffect(() => {
    fetch(RAW_DOC_URL)
      .then(r => {
        if (!r.ok) throw new Error('fetch failed')
        return r.text()
      })
      .then(text => { setContent(text); setLoading(false) })
      .catch(() => {
        fetch('/API_Documentation.md')
          .then(r => r.ok ? r.text() : Promise.reject())
          .then(text => { setContent(text); setLoading(false) })
          .catch(() => { setError(true); setLoading(false) })
      })
  }, [])

  return (
    <div className="min-h-screen" style={{ backgroundColor: isDark ? '#0d1117' : '#ffffff' }}>
      {/* ── Sticky minimal navbar ── */}
      <header
        className="sticky top-0 z-50 border-b"
        style={{
          backgroundColor: isDark ? '#161b22cc' : '#ffffffcc',
          borderColor: isDark ? '#30363d' : '#d0d7de',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-sm transition-opacity hover:opacity-70"
            style={{ color: isDark ? '#e6edf3' : '#24292f' }}
          >
            <img src={logoUrl} alt="OmniKey AI" className="h-5 w-5 object-contain" />
            <span className="font-semibold tracking-tight">OmniKey AI</span>
          </button>
          <span style={{ color: isDark ? '#30363d' : '#d0d7de' }} className="select-none">/</span>
          <span className="text-sm font-semibold" style={{ color: isDark ? '#e6edf3' : '#24292f' }}>
            API Documentation
          </span>
          <div className="ml-auto flex items-center gap-3">
            <a
              href="https://github.com/Felix-au/OmniKey-AI-Unified-Key-Manager/blob/main/API_Documentation.md"
              target="_blank"
              rel="noreferrer"
              className="text-xs transition-colors px-3 py-1.5 rounded-lg border"
              style={{
                color: isDark ? '#8b949e' : '#57606a',
                borderColor: isDark ? '#30363d' : '#d0d7de',
              }}
            >
              View on GitHub ↗
            </a>
            <button
              onClick={() => navigate('/keys')}
              className="text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-md"
              style={{ background: 'linear-gradient(to right, #7c3aed, #4338ca)' }}
            >
              Get Started →
            </button>
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="max-w-5xl mx-auto px-6 py-12">
        {loading && (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div
              className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: '#7c3aed', borderTopColor: 'transparent' }}
            />
            <p className="text-sm" style={{ color: isDark ? '#8b949e' : '#57606a' }}>
              Loading documentation…
            </p>
          </div>
        )}

        {error && (
          <div className="text-center py-32">
            <p className="text-sm" style={{ color: isDark ? '#8b949e' : '#57606a' }}>
              Failed to load documentation.
            </p>
            <a
              href="https://github.com/Felix-au/OmniKey-AI-Unified-Key-Manager/blob/main/API_Documentation.md"
              target="_blank"
              rel="noreferrer"
              className="text-sm mt-2 inline-block"
              style={{ color: '#7c3aed' }}
            >
              View on GitHub instead →
            </a>
          </div>
        )}

        {!loading && !error && (
          <div
            className={`markdown-body ${isDark ? 'dark' : ''}`}
            data-color-mode={isDark ? 'dark' : 'light'}
            data-dark-theme="dark"
            data-light-theme="light"
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkGithubBlockquoteAlert]}
              rehypePlugins={[rehypeHighlight]}
            >
              {content}
            </ReactMarkdown>
          </div>
        )}
      </main>

      <footer
        className="border-t py-8 text-center text-xs"
        style={{
          borderColor: isDark ? '#30363d' : '#d0d7de',
          color: isDark ? '#8b949e' : '#57606a',
        }}
      >
        OmniKey AI · API Reference · Built for developers.
      </footer>

      {/* ── Override github-markdown-css background to match theme ── */}
      <style>{`
        .markdown-body {
          background-color: transparent !important;
          color: ${isDark ? '#e6edf3' : '#24292f'} !important;
          font-size: 16px;
          line-height: 1.7;
        }
        .markdown-body h1, .markdown-body h2 {
          border-bottom: 1px solid ${isDark ? '#30363d' : '#d0d7de'};
          padding-bottom: 0.4em;
        }
        .markdown-body table tr {
          background-color: ${isDark ? '#0d1117' : '#ffffff'};
          border-color: ${isDark ? '#30363d' : '#d0d7de'};
        }
        .markdown-body table tr:nth-child(2n) {
          background-color: ${isDark ? '#161b22' : '#f6f8fa'};
        }
        .markdown-body code:not(pre code) {
          background-color: ${isDark ? '#6e768166' : '#afb8c133'};
          color: ${isDark ? '#e6edf3' : '#24292f'};
          border-radius: 6px;
          padding: 0.2em 0.4em;
        }
        .markdown-body pre {
          background-color: ${isDark ? '#161b22' : '#f6f8fa'} !important;
          border: 1px solid ${isDark ? '#30363d' : '#d0d7de'};
          border-radius: 8px;
        }
        .markdown-body pre code {
          background-color: transparent !important;
          color: inherit;
        }
        .markdown-body blockquote {
          border-left: 4px solid ${isDark ? '#30363d' : '#d0d7de'};
          color: ${isDark ? '#8b949e' : '#57606a'};
        }
        .markdown-body a {
          color: ${isDark ? '#58a6ff' : '#0969da'};
        }
        /* GitHub Alert styles */
        .markdown-alert {
          padding: 0.75rem 1rem;
          border-left: 4px solid;
          border-radius: 0 6px 6px 0;
          margin-bottom: 1rem;
        }
        .markdown-alert-note {
          border-color: ${isDark ? '#388bfd' : '#0969da'};
          background-color: ${isDark ? '#388bfd1a' : '#ddf4ff'};
        }
        .markdown-alert-tip {
          border-color: ${isDark ? '#3fb950' : '#1a7f37'};
          background-color: ${isDark ? '#3fb9501a' : '#dafbe1'};
        }
        .markdown-alert-warning {
          border-color: ${isDark ? '#d29922' : '#9a6700'};
          background-color: ${isDark ? '#d299221a' : '#fff8c5'};
        }
        .markdown-alert-caution {
          border-color: ${isDark ? '#f85149' : '#cf222e'};
          background-color: ${isDark ? '#f851491a' : '#ffebe9'};
        }
        .markdown-alert-important {
          border-color: ${isDark ? '#a371f7' : '#8250df'};
          background-color: ${isDark ? '#a371f71a' : '#fbefff'};
        }
        .markdown-alert-title {
          font-weight: 600;
          font-size: 0.875rem;
          margin-bottom: 0.25rem;
          display: flex;
          align-items: center;
          gap: 0.375rem;
        }
      `}</style>
    </div>
  )
}
