import { useCallback, useEffect, useRef, useState } from 'react'

export default function useToast() {
  const [message, setMessage] = useState('')
  const timer = useRef(null)
  const notify = useCallback((text) => {
    setMessage(text)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setMessage(''), 3200)
  }, [])
  useEffect(() => () => window.clearTimeout(timer.current), [])
  return [message, notify]
}
