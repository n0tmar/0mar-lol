"use client";

import { useMemo } from "react";
import { marked } from "marked";

function preprocess(text: string, idMap: Record<string, string>): string {
  return text.replace(/@([a-f0-9-]{36})\b/g, (_match, id) => {
    const title = idMap[id];
    return title ? `[${title}](/posts/${id})` : `[@${id.slice(0, 8)}](/posts/${id})`;
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function safeHref(href: string): string | null {
  const trimmed = href.trim().toLowerCase();
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("#")
  ) {
    return href;
  }
  return null;
}

const renderer = new marked.Renderer();
// Raw HTML from post bodies is escaped, never executed.
renderer.html = ({ text }) => escapeHtml(text);
renderer.link = function ({ href, title, tokens }) {
  const safe = safeHref(href ?? "");
  if (!safe) {
    // Dangerous scheme (javascript:, data:, ...) — render link text only.
    return this.parser?.parseInline(tokens) ?? "";
  }
  const escapedTitle = title ? ` title="${escapeHtml(title)}"` : "";
  return `<a href="${escapeHtml(safe)}"${escapedTitle} rel="noopener noreferrer">${this.parser?.parseInline(tokens) ?? ""}</a>`;
};

export function Markdown({ children, idMap }: { children: string; idMap?: Record<string, string> }) {
  const html = useMemo(() => {
    const processed = preprocess(children, idMap ?? {});
    return marked.parse(processed, {
      async: false,
      renderer,
    }) as string;
  }, [children, idMap]);

  return (
    <div
      className="markdown"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
