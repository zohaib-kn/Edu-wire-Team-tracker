import { Fragment } from 'react'

const URL_TOKEN_REGEX = /(https?:\/\/[^\s<>"']+)/g

function splitTrailingPunctuation(rawUrl: string): { url: string; trailing: string } {
  let url = rawUrl
  let trailing = ''

  while (url.length > 0) {
    const lastChar = url[url.length - 1]
    if (/[.,;:!?]/.test(lastChar)) {
      trailing = lastChar + trailing
      url = url.slice(0, -1)
      continue
    }
    if (lastChar === ')') {
      const openCount = (url.match(/\(/g) || []).length
      const closeCount = (url.match(/\)/g) || []).length
      if (closeCount > openCount) {
        trailing = lastChar + trailing
        url = url.slice(0, -1)
        continue
      }
    }
    if (lastChar === ']') {
      const openCount = (url.match(/\[/g) || []).length
      const closeCount = (url.match(/\]/g) || []).length
      if (closeCount > openCount) {
        trailing = lastChar + trailing
        url = url.slice(0, -1)
        continue
      }
    }
    break
  }

  return { url, trailing }
}

function isSafeHttpUrl(candidate: string): boolean {
  try {
    const parsed = new URL(candidate)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export interface SafeFormattedTextProps {
  text: string
  className?: string
}

/**
 * Renders plain text preserving line breaks while turning valid http/https URLs
 * into safe external links without interpreting HTML.
 */
export function SafeFormattedText({ text, className }: SafeFormattedTextProps) {
  const parts = text.split(URL_TOKEN_REGEX)

  return (
    <span className={className}>
      {parts.map((part, idx) => {
        if (idx % 2 === 1) {
          const { url, trailing } = splitTrailingPunctuation(part)
          if (isSafeHttpUrl(url)) {
            return (
              <Fragment key={idx}>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-brand-blue hover:underline break-all"
                >
                  {url}
                </a>
                {trailing}
              </Fragment>
            )
          }
        }
        return <Fragment key={idx}>{part}</Fragment>
      })}
    </span>
  )
}

