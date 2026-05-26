import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import type { Components } from 'react-markdown'
import { cn } from '@/lib/utils'

interface MarkdownRendererProps {
  content: string
  className?: string
  /** Use compact styles for dense chat messages (smaller font, tighter spacing) */
  compact?: boolean
}

const components: Components = {
  // ── Headings ──────────────────────────────────────────────────────────────
  h1: ({ children }) => (
    <h1 className="text-lg font-bold mt-4 mb-2 border-b border-border pb-1">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-base font-bold mt-3 mb-1.5">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold mt-2.5 mb-1">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-sm font-semibold mt-2 mb-0.5 text-muted-foreground">{children}</h4>
  ),

  // ── Paragraph ─────────────────────────────────────────────────────────────
  p: ({ children }) => (
    <p className="leading-relaxed mb-2 last:mb-0">{children}</p>
  ),

  // ── Lists ─────────────────────────────────────────────────────────────────
  ul: ({ children }) => (
    <ul className="list-disc list-outside pl-4 mb-2 space-y-0.5">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-outside pl-4 mb-2 space-y-0.5">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="leading-relaxed">{children}</li>
  ),

  // ── Inline Code ───────────────────────────────────────────────────────────
  code: ({ inline, className, children, ...props }: any) => {
    if (inline) {
      return (
        <code
          className="bg-muted text-foreground font-mono text-[0.82em] px-1.5 py-0.5 rounded border border-border"
          {...props}
        >
          {children}
        </code>
      )
    }
    // Block code — rendered by rehype-highlight, just ensure proper wrapper
    return (
      <code className={cn('font-mono text-[0.82em]', className)} {...props}>
        {children}
      </code>
    )
  },

  // ── Code Block wrapper ────────────────────────────────────────────────────
  pre: ({ children }) => (
    <div className="relative group my-2">
      <pre className="overflow-x-auto rounded-xl border p-4 text-[0.82em] leading-relaxed bg-[#f6f8fa] dark:bg-[#0d1117] border-[#d0d7de] dark:border-[#30363d]">
        {children}
      </pre>
    </div>
  ),

  // ── Blockquote ────────────────────────────────────────────────────────────
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-primary/40 pl-3 my-2 text-muted-foreground italic">
      {children}
    </blockquote>
  ),

  // ── Horizontal Rule ───────────────────────────────────────────────────────
  hr: () => <hr className="my-3 border-border" />,

  // ── Links ─────────────────────────────────────────────────────────────────
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-500 hover:text-blue-600 dark:text-blue-400 underline underline-offset-2"
    >
      {children}
    </a>
  ),

  // ── Strong / Em ───────────────────────────────────────────────────────────
  strong: ({ children }) => <strong className="font-bold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,

  // ── Strikethrough (GFM) ───────────────────────────────────────────────────
  del: ({ children }) => <del className="line-through text-muted-foreground">{children}</del>,

  // ── Table (GFM) ───────────────────────────────────────────────────────────
  table: ({ children }) => (
    <div className="overflow-x-auto my-3 rounded-xl border border-border">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-muted/60 border-b border-border">{children}</thead>
  ),
  tbody: ({ children }) => <tbody className="divide-y divide-border">{children}</tbody>,
  tr: ({ children }) => <tr className="hover:bg-muted/30 transition-colors">{children}</tr>,
  th: ({ children }) => (
    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 text-xs">{children}</td>
  ),
}

export function MarkdownRenderer({ content, className, compact }: MarkdownRendererProps) {
  return (
    <div
      className={cn(
        'markdown-body leading-relaxed',
        compact ? 'text-xs' : 'text-sm',
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
