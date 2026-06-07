'use client'

import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

const storageKey = 'monitorae-theme'

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(storageKey) as Theme | null
    const initialTheme = savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : 'dark'

    setTheme(initialTheme)
    document.documentElement.dataset.theme = initialTheme
  }, [])

  function toggleTheme() {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'

    setTheme(nextTheme)
    window.localStorage.setItem(storageKey, nextTheme)
    document.documentElement.dataset.theme = nextTheme
  }

  return (
    <button
      aria-label="Toggle theme"
      className="theme-toggle"
      onClick={toggleTheme}
      type="button"
    >
      <span>☼</span>
      <span className="theme-toggle-track">
        <span className="theme-toggle-thumb" />
      </span>
      <span>☾</span>
    </button>
  )
}
