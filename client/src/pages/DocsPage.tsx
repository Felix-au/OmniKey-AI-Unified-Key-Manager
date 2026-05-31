import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { useNavigate } from 'react-router-dom'
import logoUrl from '../assets/logo.png'
import 'highlight.js/styles/github-dark.css'

const RAW_DOC_URL = 'https://raw.githubusercontent.com/Felix-au/OmniKey-AI-Unified-Key-Manager/main/API_Documentation.md'

import { useState, useEffect } from 'react'

export default function DocsPage() {
  const navigate = useNavigate()
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    // Try fetching from GitHub raw first, fall back to bundled text
    fetch(RAW_DOC_URL)
      .then(r => {
        if (!r.ok) throw new Error('fetch failed')
        return r.text()
      })
      .then(text => { setContent(text); setLoading(false) })
      .catch(() => {
        // Fall back: import the file relative to the project root served statically
        fetch('/API_Documentation.md')
          .then(r => r.ok ? r.text() : Promise.reject())
          .then(text => { setContent(text); setLoading(false) })
          .catch(() => { setError(true); setLoading(false) })
      })
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Sticky minimal navbar ── */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <img src={logoUrl} alt="OmniKey AI" className="h-5 w-5 object-contain" />
            <span className="font-semibold tracking-tight">OmniKey AI</span>
          </button>
          <span className="text-border select-none">/</span>
          <span className="text-sm font-semibold text-foreground">API Documentation</span>
          <div className="ml-auto flex items-center gap-3">
            <a
              href="https://github.com/Felix-au/OmniKey-AI-Unified-Key-Manager/blob/main/API_Documentation.md"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-accent/60 transition-all"
            >
              View on GitHub ↗
            </a>
            <button
              onClick={() => navigate('/keys')}
              className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-md shadow-violet-500/20 hover:opacity-90 transition-opacity"
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
            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Loading documentation…</p>
          </div>
        )}

        {error && (
          <div className="text-center py-32">
            <p className="text-muted-foreground text-sm">Failed to load documentation.</p>
            <a
              href="https://github.com/Felix-au/OmniKey-AI-Unified-Key-Manager/blob/main/API_Documentation.md"
              target="_blank"
              rel="noreferrer"
              className="text-violet-500 hover:underline text-sm mt-2 inline-block"
            >
              View on GitHub instead →
            </a>
          </div>
        )}

        {!loading && !error && (
          <article className="
            prose prose-slate dark:prose-invert max-w-none
            prose-headings:font-bold prose-headings:tracking-tight
            prose-h1:text-3xl prose-h2:text-2xl prose-h2:border-b prose-h2:border-border prose-h2:pb-2 prose-h2:mt-10
            prose-h3:text-lg prose-h3:text-foreground
            prose-a:text-violet-500 prose-a:no-underline hover:prose-a:underline
            prose-code:text-violet-400 prose-code:bg-muted/60 prose-code:rounded prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[13px]
            prose-pre:bg-slate-950 prose-pre:border prose-pre:border-border prose-pre:rounded-xl prose-pre:overflow-x-auto
            prose-table:text-sm prose-th:bg-muted/60 prose-th:font-semibold
            prose-blockquote:border-violet-500 prose-blockquote:text-muted-foreground
            prose-strong:text-foreground
          ">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
            >
              {content}
            </ReactMarkdown>
          </article>
        )}
      </main>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        OmniKey AI · API Reference · Built for developers.
      </footer>
    </div>
  )
}
