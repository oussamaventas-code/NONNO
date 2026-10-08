import { useEffect, useState } from 'react'
import { getSiteContent, loadSiteContent } from '../data/siteContent'

export function useSiteContent() {
  const [content, setContent] = useState(getSiteContent)

  useEffect(() => {
    const sync = () => setContent(getSiteContent())
    const refresh = () => loadSiteContent()
    window.addEventListener('nonno:site-content', sync)
    refresh()
    const timer = window.setInterval(refresh, 60000)
    window.addEventListener('focus', refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('nonno:site-content', sync)
    }
  }, [])

  return content
}
