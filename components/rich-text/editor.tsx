"use client";

import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "@tiptap/markdown";
import { Bold, Code, Heading3, Italic, Link2, List, ListOrdered, Quote, Sigma, Superscript, Subscript, Type } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { RichTextView, type RichMode } from "@/components/rich-text/view";

/*
 * One editor for every text box where authors write (canvas SB02 and the follow-up forms).
 *   inline   — title: italic and maths only, one line.
 *   abstract — italic, lists and maths (lists become "a; b; c" in the published abstract, see lib/rich-text/plain.ts).
 *   full     — messages, rebuttals, responses: bold, italic, parts (headings), lists, quotes, links, code and maths.
 * The value is Markdown with $LaTeX$ maths, posted in a hidden input named `name`. "Plain text" edits it as-is.
 */

const GREEK: [string, string][] = [["α", "\\alpha"], ["β", "\\beta"], ["γ", "\\gamma"], ["δ", "\\delta"], ["ε", "\\varepsilon"], ["θ", "\\theta"], ["λ", "\\lambda"], ["μ", "\\mu"], ["π", "\\pi"], ["σ", "\\sigma"], ["τ", "\\tau"], ["φ", "\\phi"], ["ω", "\\omega"], ["Δ", "\\Delta"], ["Σ", "\\Sigma"], ["Ω", "\\Omega"], ["≤", "\\leq"], ["≥", "\\geq"], ["≈", "\\approx"], ["∞", "\\infty"], ["∈", "\\in"], ["→", "\\to"], ["±", "\\pm"], ["∂", "\\partial"]];

function extensionsFor(mode: RichMode, placeholder: string) {
  const full = mode === "full";
  const lists = mode !== "inline";
  return [
    StarterKit.configure({
      heading: full ? { levels: [3] } : false,
      bold: full ? undefined : false,
      code: full ? undefined : false,
      codeBlock: full ? undefined : false,
      blockquote: full ? undefined : false,
      strike: false,
      underline: false,
      horizontalRule: false,
      bulletList: lists ? undefined : false,
      orderedList: lists ? undefined : false,
      listItem: lists ? undefined : false,
      hardBreak: mode === "inline" ? false : undefined,
      link: full ? { openOnClick: false, autolink: true, protocols: ["https", "mailto"], defaultProtocol: "https" } : false,
    }),
    Placeholder.configure({ placeholder }),
    Markdown,
  ];
}

const btn = "inline-flex size-8 items-center justify-center rounded-[4px] text-[#4A5263] hover:bg-[#EEF0EC] hover:text-[#121826] aria-pressed:bg-[#E6EDFC] aria-pressed:text-[#0E1B3D] disabled:opacity-40";

/** Wrap the selection (or a sample) in maths: $x^{2}$, $x_{i}$, $…$ or a symbol. */
function insertMath(editor: Editor, make: (sel: string) => string, caretBack = 1) {
  const { from, to } = editor.state.selection;
  const sel = editor.state.doc.textBetween(from, to, " ");
  const text = make(sel);
  editor.chain().focus().insertContentAt({ from, to }, text).run();
  const end = from + text.length;
  editor.commands.setTextSelection(Math.max(from + 1, end - caretBack));
}

export function RichTextEditor({ name, value, onChange, mode = "full", id, labelledBy, describedBy, invalid, placeholder = "", disabled, minRows = 4, maxLength }: {
  name?: string; value: string; onChange?: (md: string) => void; mode?: RichMode; id?: string; labelledBy?: string; describedBy?: string;
  invalid?: boolean; placeholder?: string; disabled?: boolean; minRows?: number; maxLength?: number;
}) {
  const t = useT();
  const [md, setMd] = useState(value);
  const [plain, setPlain] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [greekOpen, setGreekOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const lastSet = useRef(value);
  const update = (next: string) => { lastSet.current = next; setMd(next); onChange?.(next); };

  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: extensionsFor(mode, placeholder),
    content: value,
    contentType: "markdown",
    editorProps: {
      attributes: {
        ...(id ? { id } : {}),
        role: "textbox",
        "aria-multiline": mode === "inline" ? "false" : "true",
        ...(labelledBy ? { "aria-labelledby": labelledBy } : {}),
        ...(describedBy ? { "aria-describedby": describedBy } : {}),
        ...(invalid ? { "aria-invalid": "true" } : {}),
        class: "outline-none",
      },
      handleKeyDown: (_view, e) => mode === "inline" && e.key === "Enter",
    },
    onUpdate: ({ editor: ed }) => {
      let next = ed.getMarkdown();
      if (mode === "inline") next = next.replace(/\s*\n+\s*/g, " ");
      if (maxLength && next.length > maxLength) next = next.slice(0, maxLength);
      update(next.trim() ? next : "");
    },
  });

  // A new value from outside (e.g. the form was reset) replaces the content.
  useEffect(() => {
    if (!editor || value === lastSet.current) return;
    lastSet.current = value;
    setMd(value);
    editor.commands.setContent(value, { contentType: "markdown", emitUpdate: false });
  }, [value, editor]);
  useEffect(() => { editor?.setEditable(!disabled); }, [disabled, editor]);

  const active = useEditorState({
    editor,
    selector: ({ editor: e }) => e ? {
      bold: e.isActive("bold"), italic: e.isActive("italic"), h3: e.isActive("heading", { level: 3 }), ul: e.isActive("bulletList"),
      ol: e.isActive("orderedList"), quote: e.isActive("blockquote"), code: e.isActive("code"), link: e.isActive("link"),
    } : null,
  });

  const full = mode === "full";
  const lists = mode !== "inline";
  const hasMath = /\$[^$\n]+\$/.test(md);
  const minH = mode === "inline" ? "min-h-[3.2em]" : minRows >= 8 ? "min-h-[14em]" : minRows >= 5 ? "min-h-[9em]" : "min-h-[6.5em]";
  const box = `rounded-[4px] bg-white ${invalid ? "border-2 border-[#B3261E]" : "border border-[#B7BDC9]"} focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#2F5FD0]`;
  const content = `px-3.5 py-3 text-[16px] leading-[1.6] text-[#121826] ${minH}
    [&_.ProseMirror]:outline-none [&_.ProseMirror_p]:my-0 [&_.ProseMirror_p+p]:mt-3 [&_.ProseMirror_ul]:my-2 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:ps-6
    [&_.ProseMirror_ol]:my-2 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:ps-6 [&_.ProseMirror_h3]:mb-1 [&_.ProseMirror_h3]:mt-3 [&_.ProseMirror_h3]:text-[17px] [&_.ProseMirror_h3]:font-semibold
    [&_.ProseMirror_blockquote]:border-s-[3px] [&_.ProseMirror_blockquote]:border-[#DADDE3] [&_.ProseMirror_blockquote]:ps-3 [&_.ProseMirror_blockquote]:text-[#4A5263]
    [&_.ProseMirror_a]:text-[#2F5FD0] [&_.ProseMirror_a]:underline [&_.ProseMirror_code]:rounded-[3px] [&_.ProseMirror_code]:bg-[#EEF0EC] [&_.ProseMirror_code]:px-1 [&_.ProseMirror_code]:font-mono [&_.ProseMirror_code]:text-[14px]
    [&_.ProseMirror_pre]:rounded-[6px] [&_.ProseMirror_pre]:bg-[#EEF0EC] [&_.ProseMirror_pre]:p-3
    [&_p.is-editor-empty:first-child]:before:pointer-events-none [&_p.is-editor-empty:first-child]:before:float-left [&_p.is-editor-empty:first-child]:before:h-0 [&_p.is-editor-empty:first-child]:before:text-[#8A92A3] [&_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]`;

  const tool = (label: string, Icon: typeof Bold, on: boolean | undefined, run: () => void, show = true) => show ? (
    <button type="button" className={btn} aria-label={t(label)} title={t(label)} aria-pressed={on === undefined ? undefined : on} disabled={disabled || plain || !editor}
      onMouseDown={(e) => e.preventDefault()} onClick={run}><Icon size={16} strokeWidth={2} aria-hidden /></button>
  ) : null;

  const applyLink = () => {
    if (!editor) return;
    const url = linkUrl.trim();
    if (!url) editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href: /^(https?:|mailto:)/i.test(url) ? url : `https://${url}` }).run();
    setLinkOpen(false); setLinkUrl("");
  };

  return (
    <div className={box}>
      {name ? <input type="hidden" name={name} value={md} /> : null}
      <div role="toolbar" aria-label={t("Formatting")} className="flex flex-wrap items-center gap-0.5 border-b border-[#EEF0EC] px-1.5 py-1">
        {tool("Bold", Bold, active?.bold, () => editor?.chain().focus().toggleBold().run(), full)}
        {tool("Italic", Italic, active?.italic, () => editor?.chain().focus().toggleItalic().run())}
        {tool("Section heading", Heading3, active?.h3, () => editor?.chain().focus().toggleHeading({ level: 3 }).run(), full)}
        {lists ? <span aria-hidden className="mx-1 h-5 w-px bg-[#DADDE3]" /> : null}
        {tool("Bulleted list", List, active?.ul, () => editor?.chain().focus().toggleBulletList().run(), lists)}
        {tool("Numbered list", ListOrdered, active?.ol, () => editor?.chain().focus().toggleOrderedList().run(), lists)}
        {tool("Quote", Quote, active?.quote, () => editor?.chain().focus().toggleBlockquote().run(), full)}
        {tool("Link", Link2, active?.link, () => { setLinkUrl(editor?.getAttributes("link").href ?? ""); setLinkOpen((o) => !o); }, full)}
        {tool("Code", Code, active?.code, () => editor?.chain().focus().toggleCode().run(), full)}
        <span aria-hidden className="mx-1 h-5 w-px bg-[#DADDE3]" />
        {tool("Superscript (maths)", Superscript, undefined, () => editor && insertMath(editor, (s) => `$${s || "x"}^{2}$`, 2))}
        {tool("Subscript (maths)", Subscript, undefined, () => editor && insertMath(editor, (s) => `$${s || "x"}_{i}$`, 2))}
        {tool("Maths", Sigma, undefined, () => editor && insertMath(editor, (s) => `$${s}$`, 1))}
        <div className="relative">
          <button type="button" className={`${btn} w-auto px-2 text-[14px]`} aria-label={t("Greek letters and symbols")} title={t("Greek letters and symbols")} aria-expanded={greekOpen}
            disabled={disabled || plain || !editor} onMouseDown={(e) => e.preventDefault()} onClick={() => setGreekOpen((o) => !o)}>αβ</button>
          {greekOpen ? (
            <div className="absolute start-0 top-9 z-20 grid w-[232px] grid-cols-6 gap-0.5 rounded-[6px] border border-[#DADDE3] bg-white p-1.5 shadow-[0_8px_24px_rgba(18,24,38,.14)]">
              {GREEK.map(([ch, tex]) => (
                <button key={tex} type="button" className="h-8 rounded-[4px] text-[15px] hover:bg-[#EEF0EC]" title={tex} aria-label={tex}
                  onMouseDown={(e) => e.preventDefault()} onClick={() => { if (editor) insertMath(editor, () => `$${tex}$`, 0); setGreekOpen(false); }}>{ch}</button>
              ))}
            </div>
          ) : null}
        </div>
        <button type="button" className={`${btn} ms-auto w-auto gap-1 px-2 text-[13px]`} aria-pressed={plain} disabled={disabled}
          onClick={() => { if (plain && editor) editor.commands.setContent(md, { contentType: "markdown", emitUpdate: false }); setPlain((p) => !p); }}>
          <Type size={14} aria-hidden />{t("Plain text")}
        </button>
      </div>
      {linkOpen && !plain ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-[#EEF0EC] px-3 py-2">
          <label className="text-[13px] text-[#4A5263]" htmlFor={`${id ?? name}-link`}>{t("Link address")}</label>
          <input id={`${id ?? name}-link`} value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyLink(); } if (e.key === "Escape") setLinkOpen(false); }}
            placeholder="https://" className="h-8 min-w-0 flex-auto rounded-[4px] border border-[#B7BDC9] px-2 text-[14px]" autoFocus />
          <button type="button" onClick={applyLink} className="h-8 rounded-[4px] bg-[#0E1B3D] px-3 text-[13px] font-semibold text-white">{linkUrl ? t("Apply") : t("Remove link")}</button>
        </div>
      ) : null}
      {plain ? (
        <textarea value={md} disabled={disabled} rows={mode === "inline" ? 2 : Math.max(minRows, 4)} maxLength={maxLength} aria-labelledby={labelledBy} aria-describedby={describedBy} aria-invalid={invalid || undefined}
          onChange={(e) => update(mode === "inline" ? e.target.value.replace(/\n/g, " ") : e.target.value)}
          className="block w-full resize-y rounded-b-[4px] px-3.5 py-3 font-mono text-[14px] leading-[1.6] text-[#121826] outline-none" />
      ) : editor ? (
        <EditorContent editor={editor} className={content} />
      ) : (
        <div className={`${content} whitespace-pre-wrap text-[#121826]`} aria-hidden>{md || <span className="text-[#8A92A3]">{placeholder}</span>}</div>
      )}
      {hasMath ? (
        <div className="border-t border-[#EEF0EC] bg-[#F7F8F6] px-3.5 py-2.5">
          <p className="m-0 font-mono text-[11px] uppercase tracking-[0.06em] text-[#4A5263]">{t("Preview")}</p>
          <RichTextView text={md} mode={mode} className="mt-1 text-[15px] leading-[1.6]" />
        </div>
      ) : null}
    </div>
  );
}
