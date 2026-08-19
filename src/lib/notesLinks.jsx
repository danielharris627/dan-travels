const LINK_PATTERN = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g

export function renderNotesWithLinks(text) {
  if (!text) return null

  const nodes = []
  let lastIndex = 0
  let match
  let key = 0

  while ((match = LINK_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index))
    }
    nodes.push(
      <a
        key={key++}
        href={match[2]}
        target="_blank"
        rel="noreferrer"
        className="text-teal underline decoration-dotted underline-offset-2 hover:text-teal/70"
      >
        {match[1]}
      </a>
    )
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }

  return nodes
}
