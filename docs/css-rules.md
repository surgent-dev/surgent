# CSS Rules (@apps/web)

Gotchas and fixes for the conversation UI styling. Read this before touching `globals.css`, `markdown.tsx`, or any Streamdown/ScrollArea related code.

## Radix ScrollArea + wide content (code blocks, tables)

Radix `ScrollArea` Viewport wraps children in `<div style="display:table;min-width:100%">`.
`display:table` expands to fit the widest child, so a wide code block or table makes the wrapper wider than the viewport. This prevents inner `overflow-x:auto` from ever triggering a scrollbar — the content fits its (now-huge) parent, so there's nothing to scroll. The overflow then gets silently clipped by `overflow:hidden` higher up.

**Fix** (`globals.css`):

```css
[data-slot='scroll-area-viewport'] > div {
  display: block !important;
  min-width: 0 !important;
}
```

`display:block` constrains to parent width. `!important` is required because Radix applies these as inline `style=""`. With this, `<pre overflow-x:auto>` and Streamdown's table `overflow-x:auto` wrapper work correctly.

## Flexbox min-width chain

Every flex ancestor from `SplitView` down to the scroll container needs `min-w-0`. Without it, `min-width:auto` (the flex default) prevents children from shrinking below content width.

Files: `split-view.tsx`, `conversation.tsx`.

Reference: https://github.com/philipwalton/flexbugs

## Streamdown code blocks

Streamdown has built-in Shiki highlighting, copy/download buttons, and a language header on code blocks. Do NOT override `components: { code }` on the `<Streamdown>` component — that replaces the entire code block renderer and loses Shiki highlighting.

The header visibility was previously killed with `[data-code-block-header] { display:none }` — don't re-add that.

## Streamdown tables

Streamdown renders tables with `w-full` (width: 100%) inside an `overflow-x:auto` wrapper div. Override the table to `width: max-content; max-width: none` so it can exceed container width and trigger horizontal scroll. Cap cells at `max-width: 40ch` with `overflow-wrap: anywhere` so individual columns don't get infinitely wide.

Reference: https://github.com/ant-design/x/pull/1324

## Long tokens / word breaking

Use `[word-break:break-word] [overflow-wrap:anywhere]` on prose containers (markdown.tsx, message.tsx). Do NOT use `break-normal` — it sets `word-break: normal` which prevents breaking long URLs, hashes, and code tokens.
