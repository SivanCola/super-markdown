# Super Markdown Syntax Guide

Super Markdown uses its own Markdown core for editing, preview, and export.

## Common Blocks

- Headings: `# H1` through `###### H6`
- Paragraphs and blockquotes: `> quoted text`
- Lists: `- item`, `1. item`, and task lists with `- [ ] task`
- Tables with pipe rows and delimiter rows
- Fenced code blocks with a language label
- Horizontal rules with `---`
- Footnotes with `[^id]` and `[^id]: note`

## Rich Blocks

Mermaid diagrams are written as fenced `mermaid` blocks. KaTeX math can be inline with `$...$` or block-level with `$$`.

## Export

HTML, PDF, PNG, and JPEG export use the same Super Markdown renderer as the preview. Mermaid and KaTeX are the only dedicated rendering engines kept by design.
