import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const isTableRow = (l: string) => /^\s*\|.*\|\s*$/.test(l);
const isHeader = (l: string) => /^\s*#{1,6}\s/.test(l);
const isHr = (l: string) => /^\s*([-*_])\1{2,}\s*$/.test(l) && !isTableRow(l);

/**
 * GFM requires block elements (tables especially) to be separated from
 * surrounding text by a blank line. LLM output is often tightly packed, which
 * makes tables/headers render as raw text. This inserts the blank lines markdown
 * needs so those blocks parse reliably.
 */
function normalizeMarkdown(src: string): string {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const prev = out.length ? out[out.length - 1] : "";
    const prevBlank = prev.trim() === "";
    // Blank line before the first row of a table, before a header, before an hr.
    if (
      !prevBlank &&
      ((isTableRow(line) && !isTableRow(prev)) || isHeader(line) || isHr(line))
    ) {
      out.push("");
    }
    out.push(line);
    // Blank line after a table block ends (next line is real text).
    const next = lines[i + 1];
    if (isTableRow(line) && next !== undefined && next.trim() !== "" && !isTableRow(next)) {
      out.push("");
    }
  }
  return out.join("\n");
}

/**
 * Themed markdown renderer for agent chat messages. Supports GFM (tables,
 * strikethrough, task lists) and maps every element to the dark UI palette so
 * bold/headers/tables actually render instead of showing raw `**` and `#`.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="md-body text-[12.5px] leading-relaxed text-bone">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mb-1.5 mt-2 text-[15px] font-semibold text-bone first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-1.5 mt-2 text-[13.5px] font-semibold text-bone first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-1 mt-2 text-[12.5px] font-semibold text-bone/90 first:mt-0">{children}</h3>
          ),
          p: ({ children }) => <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-bone">{children}</strong>,
          em: ({ children }) => <em className="italic text-bone/90">{children}</em>,
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-brass-bright underline decoration-brass/40 underline-offset-2 hover:decoration-brass"
            >
              {children}
            </a>
          ),
          ul: ({ children }) => <ul className="my-1.5 list-disc space-y-0.5 pl-4 marker:text-bone-faint/50">{children}</ul>,
          ol: ({ children }) => <ol className="my-1.5 list-decimal space-y-0.5 pl-4 marker:text-bone-faint/50">{children}</ol>,
          li: ({ children }) => <li className="pl-0.5">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-1.5 border-l-2 border-brass/40 pl-3 italic text-bone-dim">{children}</blockquote>
          ),
          code: ({ children }) => (
            <code className="rounded bg-black/40 px-1 py-0.5 font-mono text-[11.5px] text-brass-bright">{children}</code>
          ),
          hr: () => <hr className="my-2.5 border-hairline" />,
          table: ({ children }) => (
            <div className="my-2 max-w-full overflow-x-auto">
              <table className="w-full border-collapse text-[11.5px]">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-white/[0.04]">{children}</thead>,
          th: ({ children }) => (
            <th className="border border-hairline px-2 py-1 text-left font-semibold text-bone">{children}</th>
          ),
          td: ({ children }) => (
            <td className="border border-hairline px-2 py-1 align-top text-bone-dim">{children}</td>
          ),
        }}
      >
        {normalizeMarkdown(children)}
      </ReactMarkdown>
    </div>
  );
}
