/** A small element builder (ARIA's pages are plain DOM). */
export type Attrs = Record<string, string | undefined>;
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: (Node | string | null | false)[]
) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined) el.setAttribute(k, v);
  for (const c of children) if (c !== null && c !== false) el.append(c);
  return el;
}
