import { memo, useEffect, useId, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

let mermaidReady: Promise<typeof import('mermaid')['default']> | null = null;
function loadMermaid() {
  if (!mermaidReady) {
    mermaidReady = import('mermaid').then((m) => {
      m.default.initialize({
        startOnLoad: false,
        theme: 'base',
        securityLevel: 'loose',
        fontFamily: 'Inter Tight, system-ui, sans-serif',
        themeVariables: {
          background: '#131210',
          primaryColor: '#211f1b',
          primaryTextColor: '#ece7dd',
          primaryBorderColor: '#6b655b',
          lineColor: '#948c7f',
          secondaryColor: '#2d2a25',
          tertiaryColor: '#191815',
          fontSize: '14px',
          nodeBorder: '#6b655b',
          clusterBkg: '#191815',
          clusterBorder: '#3d3932',
          edgeLabelBackground: '#191815',
          titleColor: '#ece7dd',
        },
      });
      return m.default;
    });
  }
  return mermaidReady;
}

function Mermaid({ code, done }: { code: string; done: boolean }) {
  const id = useId().replace(/:/g, '');
  const ref = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    if (!done) return;
    let alive = true;
    loadMermaid()
      .then((m) => m.render(`m${id}`, code))
      .then(({ svg }) => {
        if (alive && ref.current) {
          ref.current.innerHTML = svg;
          setErr(false);
        }
      })
      .catch(() => alive && setErr(true));
    return () => {
      alive = false;
    };
  }, [code, done, id]);
  if (!done || err) {
    return (
      <pre className="opacity-70">
        <code>{code}</code>
      </pre>
    );
  }
  return <div ref={ref} className="mermaid-box rounded-xl border border-ink-700 bg-ink-900 p-3 flex justify-center" />;
}

/**
 * remark-math treats a single-line `$$...$$` as inline math. Models write
 * display math that way constantly, so promote any line that is entirely a
 * `$$...$$` expression into a real display block.
 */
function promoteDisplayMath(md: string) {
  return md.replace(/^[ \t]*\$\$([^\n]+?)\$\$[ \t]*$/gm, (_m, inner: string) => `$$\n${inner.trim()}\n$$`);
}

export const Markdown = memo(function Markdown({ text, streaming = false }: { text: string; streaming?: boolean }) {
  const source = useMemo(() => promoteDisplayMath(text), [text]);
  return (
    <div className="prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className ?? '');
            const raw = String(children).replace(/\n$/, '');
            if (match?.[1] === 'mermaid') return <Mermaid code={raw} done={!streaming} />;
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          pre({ children }) {
            // Let the mermaid component escape the <pre> wrapper.
            const child = Array.isArray(children) ? children[0] : children;
            const cls = (child as { props?: { className?: string } })?.props?.className ?? '';
            if (cls.includes('language-mermaid')) return <>{children}</>;
            return <pre>{children}</pre>;
          },
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
});
