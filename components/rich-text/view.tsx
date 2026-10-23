import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkBreaks from "remark-breaks";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

/*
 * Shows rich text (Markdown + $maths$) safely: raw HTML is never rendered, links open in a new tab without referrer,
 * maths is drawn with KaTeX. Old plain-text values look the same as before (line breaks are kept).
 * Works in Server and Client Components.
 */

const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code ?? []), ["className", /^language-./, "math-inline", "math-display"]],
  },
};

export type RichMode = "inline" | "abstract" | "full";

const BASE: Record<RichMode, string> = {
  inline: "[&_p]:m-0 [&_p]:inline",
  abstract: "[&_p]:my-0 [&_p+p]:mt-3 [&_ul]:my-2 [&_ol]:my-2 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:ps-6 [&_ol]:ps-6",
  full: "[&_p]:my-0 [&_p+p]:mt-3 [&_h3]:mb-1 [&_h3]:mt-4 [&_h3]:text-[1.05em] [&_h3]:font-semibold [&_h4]:mt-3 [&_h4]:font-semibold [&_ul]:my-2 [&_ol]:my-2 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:ps-6 [&_ol]:ps-6 [&_li]:my-0.5 [&_blockquote]:my-2 [&_blockquote]:border-s-[3px] [&_blockquote]:border-[#DADDE3] [&_blockquote]:ps-3 [&_blockquote]:text-[#4A5263] [&_a]:text-[#2F5FD0] [&_a]:underline [&_code]:rounded-[3px] [&_code]:bg-[#EEF0EC] [&_code]:px-1 [&_code]:font-mono [&_code]:text-[0.9em] [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-[6px] [&_pre]:bg-[#EEF0EC] [&_pre]:p-3 [&_table]:my-2 [&_table]:border-collapse [&_td]:border [&_td]:border-[#DADDE3] [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-[#DADDE3] [&_th]:px-2 [&_th]:py-1 [&_th]:text-left",
};

export function RichTextView({ text, mode = "full", className = "", as = "div" }: { text: string | null | undefined; mode?: RichMode; className?: string; as?: "div" | "span" }) {
  if (!text) return null;
  const Tag = as;
  return (
    <Tag className={`${BASE[mode]} ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]}
        rehypePlugins={[[rehypeSanitize, schema], [rehypeKatex, { throwOnError: false, strict: "ignore" }]]}
        components={{ a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer nofollow">{children}</a> }}
        disallowedElements={mode === "full" ? ["img"] : ["img", "h1", "h2", "h3", "h4", "h5", "h6", "table", "pre", "blockquote", "a"]}
        unwrapDisallowed
      >
        {text}
      </ReactMarkdown>
    </Tag>
  );
}
