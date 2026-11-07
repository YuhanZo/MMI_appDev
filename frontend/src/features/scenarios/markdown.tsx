import type { ReactNode } from 'react'

// Just enough Markdown for model answers: paragraphs, headings, bullet and numbered
// lists (nested by indent), fenced code, **bold** and `code`. It builds React elements
// only, never HTML strings, so an answer can't inject markup.

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <strong key={i}>{part.slice(2, -2)}</strong>
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) return <code key={i}>{part.slice(1, -1)}</code>
    return part
  })
}

type Item = { depth: number; text: string }

const BULLET = /^(\s*)[-*•]\s+(.*)$/
const NUMBERED = /^(\s*)\d+[.)]\s+(.*)$/
const HEADING = /^#{1,6}\s+(.*)$/

export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const blocks: ReactNode[] = []
  let para: string[] = []
  let list: { ordered: boolean; items: Item[] } | null = null

  const flushPara = () => {
    if (para.length) blocks.push(<p key={blocks.length}>{inline(para.join(' '))}</p>)
    para = []
  }
  const flushList = () => {
    if (!list) return
    const items = list.items.map((it, i) => (
      <li key={i} style={it.depth ? { marginLeft: `${it.depth * 1.25}em` } : undefined}>
        {inline(it.text)}
      </li>
    ))
    blocks.push(list.ordered ? <ol key={blocks.length}>{items}</ol> : <ul key={blocks.length}>{items}</ul>)
    list = null
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.trim().startsWith('```')) {
      flushPara()
      flushList()
      const code: string[] = []
      for (i++; i < lines.length && !lines[i].trim().startsWith('```'); i++) code.push(lines[i])
      blocks.push(
        <pre key={blocks.length}>
          <code>{code.join('\n')}</code>
        </pre>,
      )
      continue
    }
    const bullet = BULLET.exec(line)
    const numbered = bullet ? null : NUMBERED.exec(line)
    const match = bullet ?? numbered
    if (match) {
      flushPara()
      const ordered = Boolean(numbered)
      const depth = Math.floor(match[1].replace(/\t/g, '  ').length / 2)
      if (list && (list.ordered !== ordered && depth === 0)) flushList()
      if (!list) list = { ordered, items: [] }
      list.items.push({ depth, text: match[2] })
      continue
    }
    if (!line.trim()) {
      flushPara()
      flushList()
      continue
    }
    const heading = HEADING.exec(line)
    if (heading) {
      flushPara()
      flushList()
      blocks.push(
        <p key={blocks.length} className="md-heading">
          {inline(heading[1])}
        </p>,
      )
      continue
    }
    flushList()
    para.push(line.trim())
  }
  flushPara()
  flushList()
  return <div className="md">{blocks}</div>
}
