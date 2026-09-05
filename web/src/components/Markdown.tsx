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
        fontFamily: 'Instrument Sans, system-ui, sans-serif',
        themeVariables: {
          background: '#131110',
          primaryColor: '#1c1915',
          primaryTextColor: '#efe9dc',
          primaryBorderColor: '#6a6257',
          lineColor: '#8d8477',
          secondaryColor: '#2a2620',
          tertiaryColor: '#15130f',
          fontSize: '14px',
          nodeBorder: '#6a6257',
          clusterBkg: '#15130f',
          clusterBorder: '#3d3730',
          edgeLabelBackground: '#15130f',
          titleColor: '#efe9dc',
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
  return <div ref={ref} className="mermaid-box rounded-xl border hairline bg-ink-900 p-3 flex justify-center" />;
}

/** Inline SVG the tutor drew (geometry, number lines, vectors). Scripts and handlers are stripped. */
function InlineSvg({ code }: { code: string }) {
  const safe = useMemo(
    () =>
      code
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/\son\w+="[^"]*"/gi, '')
        .replace(/\son\w+='[^']*'/gi, '')
        .replace(/href="javascript:[^"]*"/gi, ''),
    [code],
  );
  if (!/^\s*<svg[\s>]/i.test(safe)) return <pre><code>{code}</code></pre>;
  return <div className="svg-box rounded-xl border hairline bg-ink-900 p-3 flex justify-center" dangerouslySetInnerHTML={{ __html: safe }} />;
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
            if (match?.[1] === 'svg' && !streaming) return <InlineSvg code={raw} />;
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          pre({ children }) {
            const child = Array.isArray(children) ? children[0] : children;
            const cls = (child as { props?: { className?: string } })?.props?.className ?? '';
            if (cls.includes('language-mermaid') || (cls.includes('language-svg') && !streaming)) return <>{children}</>;
            return <pre>{children}</pre>;
          },
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
});
