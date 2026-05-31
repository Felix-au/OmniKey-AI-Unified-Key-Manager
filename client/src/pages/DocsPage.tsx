import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import rehypeSlug from 'rehype-slug'
import remarkGithubBlockquoteAlert from 'remark-github-blockquote-alert'
import { useNavigate } from 'react-router-dom'
import logoUrl from '../assets/logo.png'

// Official GitHub markdown body CSS
import 'github-markdown-css/github-markdown.css'

const RAW_DOC_URL =
  'https://raw.githubusercontent.com/Felix-au/OmniKey-AI-Unified-Key-Manager/main/API_Documentation.md'

// ── Sun / Moon icons ──────────────────────────────────────────────────────────
const SunIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2m-7.07-14.07 1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2m-4.93-7.07-1.41 1.41M6.34 17.66l-1.41 1.41" />
  </svg>
)
const MoonIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
  </svg>
)

export default function DocsPage() {
  const navigate = useNavigate()
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // ── Reactive dark mode ────────────────────────────────────────────────────
  const [dark, setDark] = useState(() =>
    typeof window !== 'undefined' &&
    document.documentElement.classList.contains('dark')
  )
  const toggleDark = () => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  // ── Fetch markdown ────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(RAW_DOC_URL)
      .then(r => { if (!r.ok) throw new Error('fetch'); return r.text() })
      .then(text => { setContent(text); setLoading(false) })
      .catch(() =>
        fetch('/API_Documentation.md')
          .then(r => r.ok ? r.text() : Promise.reject())
          .then(text => { setContent(text); setLoading(false) })
          .catch(() => { setError(true); setLoading(false) })
      )
  }, [])

  const bg    = dark ? '#0d1117' : '#ffffff'
  const navBg = dark ? '#161b22cc' : '#ffffffcc'
  const border= dark ? '#30363d'  : '#d0d7de'
  const text  = dark ? '#e6edf3'  : '#24292f'
  const muted = dark ? '#8b949e'  : '#57606a'
  const codeBg= dark ? '#161b22'  : '#f6f8fa'

  return (
    <div style={{ minHeight: '100vh', backgroundColor: bg }}>

      {/* ── Navbar ── */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, backgroundColor: navBg, borderBottom: `1px solid ${border}`, backdropFilter: 'blur(12px)' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => navigate('/')}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', color: text, fontSize: 14, fontWeight: 600 }}
          >
            <img src={logoUrl} alt="OmniKey AI" style={{ height: 20, width: 20, objectFit: 'contain' }} />
            OmniKey AI
          </button>
          <span style={{ color: border, userSelect: 'none' }}>/</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: text }}>API Documentation</span>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Dark / light toggle */}
            <button
              onClick={toggleDark}
              title="Toggle theme"
              style={{
                background: 'none', border: `1px solid ${border}`, cursor: 'pointer',
                color: muted, borderRadius: 8, padding: '6px 8px',
                display: 'flex', alignItems: 'center',
              }}
            >
              {dark ? <SunIcon /> : <MoonIcon />}
            </button>
            <a
              href="https://github.com/Felix-au/OmniKey-AI-Unified-Key-Manager/blob/main/API_Documentation.md"
              target="_blank" rel="noreferrer"
              style={{ fontSize: 12, color: muted, textDecoration: 'none', border: `1px solid ${border}`, borderRadius: 8, padding: '6px 12px' }}
            >
              View on GitHub ↗
            </a>
            <button
              onClick={() => navigate('/keys')}
              style={{ background: 'linear-gradient(to right,#7c3aed,#4338ca)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: '8px 16px', borderRadius: 12 }}
            >
              Get Started →
            </button>
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <main style={{ maxWidth: 960, margin: '0 auto', padding: '48px 24px' }}>
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '128px 0', gap: 16 }}>
            <div style={{ width: 32, height: 32, border: '3px solid #7c3aed', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            <p style={{ fontSize: 14, color: muted }}>Loading documentation…</p>
          </div>
        )}
        {error && (
          <div style={{ textAlign: 'center', padding: '128px 0' }}>
            <p style={{ fontSize: 14, color: muted }}>Failed to load documentation.</p>
            <a href="https://github.com/Felix-au/OmniKey-AI-Unified-Key-Manager/blob/main/API_Documentation.md"
              target="_blank" rel="noreferrer" style={{ color: '#7c3aed', fontSize: 14 }}>
              View on GitHub instead →
            </a>
          </div>
        )}

        {!loading && !error && (
          <div className={`markdown-body ${dark ? 'dark-mode' : 'light-mode'}`}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkGithubBlockquoteAlert]}
              rehypePlugins={[rehypeSlug, rehypeHighlight]}
            >
              {content}
            </ReactMarkdown>
          </div>
        )}
      </main>

      <footer style={{ borderTop: `1px solid ${border}`, padding: '32px 0', textAlign: 'center', fontSize: 12, color: muted }}>
        OmniKey AI · API Reference · Built for developers.
      </footer>

      {/* ── Scoped styles ── */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ── github-markdown-css theme overrides ── */
        .markdown-body.dark-mode {
          --color-prettylights-syntax-comment: #8b949e;
          --color-prettylights-syntax-constant: #79c0ff;
          --color-prettylights-syntax-entity: #d2a8ff;
          --color-prettylights-syntax-storage-modifier-import: #c9d1d9;
          --color-prettylights-syntax-entity-tag: #7ee787;
          --color-prettylights-syntax-keyword: #ff7b72;
          --color-prettylights-syntax-string: #a5d6ff;
          --color-prettylights-syntax-variable: #ffa657;
          --color-prettylights-syntax-brackethighlighter-unmatched: #f85149;
          --color-prettylights-syntax-invalid-illegal-text: #f0f6fc;
          --color-prettylights-syntax-invalid-illegal-bg: #8e1519;
          --color-prettylights-syntax-carriage-return-text: #f0f6fc;
          --color-prettylights-syntax-carriage-return-bg: #b62324;
          --color-prettylights-syntax-string-regexp: #7ee787;
          --color-prettylights-syntax-markup-list: #f2cc60;
          --color-prettylights-syntax-markup-heading: #1f6feb;
          --color-prettylights-syntax-markup-italic: #c9d1d9;
          --color-prettylights-syntax-markup-bold: #c9d1d9;
          --color-prettylights-syntax-markup-deleted-text: #ffdcd7;
          --color-prettylights-syntax-markup-deleted-bg: #67060c;
          --color-prettylights-syntax-markup-inserted-text: #aff5b4;
          --color-prettylights-syntax-markup-inserted-bg: #033a16;
          --color-prettylights-syntax-markup-changed-text: #ffdfb6;
          --color-prettylights-syntax-markup-changed-bg: #5a1e02;
          --color-prettylights-syntax-markup-ignored-text: #c9d1d9;
          --color-prettylights-syntax-markup-ignored-bg: #1158c7;
          --color-prettylights-syntax-meta-diff-range: #d2a8ff;
          --color-prettylights-syntax-brackethighlighter-angle: #8b949e;
          --color-prettylights-syntax-sublimelinter-gutter-mark: #484f58;
          --color-prettylights-syntax-constant-other-reference-link: #a5d6ff;
          --color-fg-default: #e6edf3;
          --color-fg-muted: #8b949e;
          --color-fg-subtle: #6e7681;
          --color-canvas-default: #0d1117;
          --color-canvas-subtle: #161b22;
          --color-border-default: #30363d;
          --color-border-muted: #21262d;
          --color-neutral-muted: rgba(110,118,129,0.4);
          --color-accent-fg: #58a6ff;
          --color-accent-emphasis: #1f6feb;
          --color-attention-subtle: rgba(187,128,9,0.15);
          --color-danger-fg: #f85149;
        }
        .markdown-body.light-mode {
          --color-fg-default: #24292f;
          --color-fg-muted: #57606a;
          --color-fg-subtle: #6e7781;
          --color-canvas-default: #ffffff;
          --color-canvas-subtle: #f6f8fa;
          --color-border-default: #d0d7de;
          --color-border-muted: hsla(210,18%,87%,1);
          --color-neutral-muted: rgba(175,184,193,0.2);
          --color-accent-fg: #0969da;
          --color-accent-emphasis: #0969da;
          --color-attention-subtle: #fff8c5;
          --color-danger-fg: #cf222e;
        }

        /* Transparent background so page bg shows through */
        .markdown-body { background-color: transparent !important; }

        /* Fix: inline code text always visible */
        .markdown-body code:not(pre code) {
          background-color: ${dark ? 'rgba(110,118,129,0.4)' : 'rgba(175,184,193,0.2)'} !important;
          color: ${dark ? '#e6edf3' : '#24292f'} !important;
          padding: 0.2em 0.4em;
          border-radius: 6px;
          font-size: 85%;
        }

        /* Fix: pre/code blocks always readable */
        .markdown-body pre {
          background-color: ${codeBg} !important;
          border: 1px solid ${border} !important;
          border-radius: 8px !important;
        }
        .markdown-body pre code {
          background-color: transparent !important;
          color: ${dark ? '#e6edf3' : '#24292f'} !important;
          font-size: 85% !important;
        }

        /* hljs tokens forced readable in dark */
        ${dark ? `
          .hljs { background: transparent !important; color: #e6edf3 !important; }
          .hljs-keyword, .hljs-selector-tag, .hljs-built_in { color: #ff7b72 !important; }
          .hljs-string, .hljs-attr { color: #a5d6ff !important; }
          .hljs-number, .hljs-literal { color: #79c0ff !important; }
          .hljs-comment { color: #8b949e !important; }
          .hljs-variable, .hljs-template-variable { color: #ffa657 !important; }
          .hljs-type, .hljs-class .hljs-title { color: #7ee787 !important; }
          .hljs-section, .hljs-name { color: #7ee787 !important; }
          .hljs-meta { color: #d2a8ff !important; }
          .hljs-punctuation { color: #c9d1d9 !important; }
        ` : `
          .hljs { background: transparent !important; color: #24292f !important; }
        `}

        /* ── GitHub alert boxes ── */
        .markdown-alert {
          padding: 0.75rem 1rem;
          border-left: 4px solid;
          border-radius: 0 6px 6px 0;
          margin-bottom: 1rem;
        }
        .markdown-alert-note   { border-color: ${dark ? '#388bfd' : '#0969da'}; background-color: ${dark ? '#388bfd1a' : '#ddf4ff'}; }
        .markdown-alert-tip    { border-color: ${dark ? '#3fb950' : '#1a7f37'}; background-color: ${dark ? '#3fb9501a' : '#dafbe1'}; }
        .markdown-alert-warning{ border-color: ${dark ? '#d29922' : '#9a6700'}; background-color: ${dark ? '#d299221a' : '#fff8c5'}; }
        .markdown-alert-caution{ border-color: ${dark ? '#f85149' : '#cf222e'}; background-color: ${dark ? '#f851491a' : '#ffebe9'}; }
        .markdown-alert-important{ border-color: ${dark ? '#a371f7' : '#8250df'}; background-color: ${dark ? '#a371f71a' : '#fbefff'}; }
        .markdown-alert-title {
          font-weight: 600; font-size: 0.875rem; margin-bottom: 0.25rem;
          display: flex; align-items: center; gap: 0.375rem;
          color: ${dark ? '#e6edf3' : '#24292f'};
        }
        .markdown-alert p { color: ${dark ? '#e6edf3' : '#24292f'}; }
      `}</style>
    </div>
  )
}
