"use client";

// components/assistant/markdown.tsx
// Small markdown renderer for assistant replies. No dependencies: the subset
// the model actually emits (headings, paragraphs, bullet/numbered lists,
// bold/italic/inline code, pipe tables, hr, blockquote, fenced code) is
// rendered as React elements styled with Zelt tokens.
//
// It is paired with normalizeMarkdown() below, which repairs the two things
// models get wrong most often: blocks glued together without blank lines, and
// emphasis markers that wrap a whole sentence, which used to show up as stray
// asterisks and odd italics.
import type { ReactNode } from "react";

/** Split a block into inline nodes: **bold**, `code`, *italic*, [text](url). */
function inline(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(
    /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*\n]+\*|_[^_\n]+_|\[[^\]]+\]\([^)\s]+\))/g
  );
  return parts.filter(Boolean).map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (/^(\*\*|__)[\s\S]+(\*\*|__)$/.test(part)) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return <code key={key}>{part.slice(1, -1)}</code>;
    }
    if (/^(\*|_)[\s\S]+(\*|_)$/.test(part) && part.length > 2) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
    if (link) {
      return (
        <a key={key} href={link[2]} target="_blank" rel="noreferrer noopener">
          {link[1]}
        </a>
      );
    }
    return part;
  });
}

/** Split a markdown table row into cells, dropping the outer pipes. */
function cells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

/** A `---` separator row in a pipe table (---, :--, --:, :-:). */
function isSeparatorRow(line: string): boolean {
  return /^\|?[\s:|-]*-{2,}[\s:|-]*\|?$/.test(line.trim());
}

function Table({ rows, keyPrefix }: { rows: string[]; keyPrefix: string }) {
  const header = cells(rows[0]);
  const body = rows.slice(1).filter((r) => !isSeparatorRow(r)).map(cells);
  return (
    <div className="zmd-table">
      <table>
        <thead>
          <tr>
            {header.map((h, i) => (
              <th key={i}>{inline(h, `${keyPrefix}-h${i}`)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, ri) => (
            <tr key={ri}>
              {row.map((c, ci) => (
                <td key={ci}>{inline(c, `${keyPrefix}-r${ri}c${ci}`)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const UL_ITEM = /^\s*[-*•]\s+(.*)$/;
const OL_ITEM = /^\s*\d+[.)]\s+(.*)$/;

/**
 * Render a list. Items keep their marker in the gutter (list-style-position:
 * outside, via CSS) so wrapped lines align with the text, not the number.
 */
function List({
  items,
  ordered,
  keyPrefix,
}: {
  items: string[];
  ordered: boolean;
  keyPrefix: string;
}) {
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag>
      {items.map((item, i) => (
        <li key={i}>{inline(item, `${keyPrefix}-i${i}`)}</li>
      ))}
    </Tag>
  );
}

/**
 * Render one markdown document. Blocks are separated by blank lines; anything
 * that is not a recognised block falls through to a paragraph.
 */
export function Markdown({ text }: { text: string }) {
  const source = normalizeMarkdown(text);
  const lines = source.split("\n");
  const blocks: ReactNode[] = [];

  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Blank line — block separator.
    if (trimmed === "") {
      i++;
      continue;
    }

    // Fenced code block.
    if (trimmed.startsWith("```")) {
      const lang = trimmed.slice(3).trim();
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        body.push(lines[i]);
        i++;
      }
      i++; // closing fence
      blocks.push(
        <pre key={key++} data-lang={lang || undefined}>
          <code>{body.join("\n")}</code>
        </pre>
      );
      continue;
    }

    // Horizontal rule.
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push(<hr key={key++} />);
      i++;
      continue;
    }

    // Heading (#, ##, ###, ####).
    const heading = /^(#{1,4})\s+(.*)$/.exec(trimmed);
    if (heading) {
      const level = Math.min(heading[1].length + 1, 4); // # -> h2, ## -> h3 …
      const Tag = (`h${level}` as unknown) as "h2";
      blocks.push(<Tag key={key++}>{inline(heading[2], `hd${key}`)}</Tag>);
      i++;
      continue;
    }

    // Pipe table: a header row followed by a separator row.
    if (trimmed.startsWith("|") || (trimmed.includes("|") && isSeparatorRow(lines[i + 1] ?? ""))) {
      const rows: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(lines[i]);
        i++;
      }
      if (rows.length >= 2) {
        blocks.push(<Table key={key++} rows={rows} keyPrefix={`tbl${key}`} />);
        continue;
      }
      // A single pipe line is not a table — fall through to paragraph.
      i -= rows.length;
    }

    // Bullet list.
    if (UL_ITEM.test(line)) {
      const items: string[] = [];
      while (i < lines.length && UL_ITEM.test(lines[i])) {
        items.push(UL_ITEM.exec(lines[i])![1]);
        i++;
      }
      blocks.push(<List key={key++} items={items} ordered={false} keyPrefix={`ul${key}`} />);
      continue;
    }

    // Numbered list.
    if (OL_ITEM.test(line)) {
      const items: string[] = [];
      while (i < lines.length && OL_ITEM.test(lines[i])) {
        items.push(OL_ITEM.exec(lines[i])![1]);
        i++;
      }
      blocks.push(<List key={key++} items={items} ordered keyPrefix={`ol${key}`} />);
      continue;
    }

    // Blockquote.
    if (trimmed.startsWith(">")) {
      const body: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        body.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      blocks.push(
        <blockquote key={key++}>{inline(body.join(" "), `bq${key}`)}</blockquote>
      );
      continue;
    }

    // Paragraph: consume until a blank line or the start of another block.
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].trim().startsWith("```") &&
      !lines[i].trim().startsWith("|") &&
      !lines[i].trim().startsWith(">") &&
      !/^(#{1,4})\s+/.test(lines[i].trim()) &&
      !/^(-{3,}|\*{3,}|_{3,})$/.test(lines[i].trim()) &&
      !UL_ITEM.test(lines[i]) &&
      !OL_ITEM.test(lines[i])
    ) {
      para.push(lines[i].trim());
      i++;
    }
    blocks.push(<p key={key++}>{inline(para.join(" "), `p${key}`)}</p>);
  }

  return <div className="zmd">{blocks}</div>;
}

/**
 * Repair the markdown models actually emit.
 *
 * - Blocks glued together: a heading or list that starts mid-line, a list item
 *   appended straight onto the previous sentence, "Title: - item".
 * - Emphasis markers wrapping a whole sentence (`*Weekly Hours Cap: 48 hours.*`),
 *   which render as random italics instead of emphasis.
 * - Suspicious emphasis left with an unmatched marker (`Auto-Assign:*`).
 */
export function normalizeMarkdown(input: string): string {
  let text = input.replace(/\r\n?/g, "\n");

  // Tabs to spaces so indentation checks are predictable.
  text = text.replace(/\t/g, "  ");

  // Strip emphasis that wraps a whole line/sentence — these are always the
  // model decorating a statement, never real emphasis.
  text = text.replace(
    /(^|\n)\s*\*([^*\n]{12,}?)\*\s*(?=\n|$)/g,
    (_m, lead, body: string) => `${lead}${body.trim()}`
  );

  // Drop dangling single markers left after the step above ("Auto-Assign:*").
  text = text.replace(/([A-Za-z0-9).,])\*+(?=\s|$)/g, "$1");

  // A bullet or number glued onto the end of a sentence: "…done. - Next step".
  text = text.replace(/([^\n\s])\s+([-*•]\s+)/g, "$1\n$2");
  text = text.replace(/([^\n\s])\s+(\d+[.)]\s+)/g, "$1\n$2");

  // A heading that starts mid-line: "…text ## Section".
  text = text.replace(/([^\n])\s+(#{1,4}\s+)/g, "$1\n\n$2");

  // A bullet/number run that starts mid-line without a preceding space:
  // "…following:- Item". Already covered above, but this catches "*Item".
  text = text.replace(/([^\n\s])([-*•]\s{1,})(?=[A-Z])/g, "$1\n$2");

  // Blank line before a list that starts immediately after a text line.
  text = text.replace(/([^\n])\n(?=\s*[-*•]\s+)/g, "$1\n\n");
  text = text.replace(/([^\n])\n(?=\s*\d+[.)]\s+)/g, "$1\n\n");

  // Blank line before a pipe table that starts right after text.
  text = text.replace(/([^\n])\n(?=\s*\|)/g, "$1\n\n");

  // Collapse runs of blank lines.
  text = text.replace(/\n{3,}/g, "\n\n");

  return text.trim();
}

/**
 * Turn a reply into a plain-text preview (used for the collapsed result line
 * and for the hover title on long messages).
 */
export function markdownToPlainText(input: string, maxLength = 160): string {
  const flat = normalizeMarkdown(input)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^\s*\|.*$/gm, " ")
    .replace(/^#{1,4}\s+/gm, "")
    .replace(/^\s*[-*•]\s+/gm, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/(\*\*|__|\*|_)/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return flat.length > maxLength ? `${flat.slice(0, maxLength - 1).trimEnd()}…` : flat;
}
