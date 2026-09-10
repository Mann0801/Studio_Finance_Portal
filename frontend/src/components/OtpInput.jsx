import { useEffect, useRef, useState } from 'react'

/** A row of single-digit boxes for entering a numeric code — auto-advances
 * as each digit is typed, and calls onComplete the instant every box is
 * filled (no separate "Verify" button/tap needed). To reset after a failed
 * attempt, remount it from the parent with a changed `key` prop. */
export default function OtpInput({ length, onComplete, disabled }) {
  const [digits, setDigits] = useState(() => Array(length).fill(''))
  const inputRefs = useRef([])

  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  useEffect(() => {
    if (digits.every((d) => d !== '')) onComplete(digits.join(''))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits])

  const setDigit = (i, value) => {
    const clean = value.replace(/\D/g, '').slice(-1)
    setDigits((prev) => {
      const next = [...prev]
      next[i] = clean
      return next
    })
    if (clean && i < length - 1) inputRefs.current[i + 1]?.focus()
  }

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      inputRefs.current[i - 1]?.focus()
    }
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    if (!pasted) return
    const next = Array(length).fill('')
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i]
    setDigits(next)
    inputRefs.current[Math.min(pasted.length, length - 1)]?.focus()
  }

  return (
    <div className="otp-input" onPaste={handlePaste}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (inputRefs.current[i] = el)}
          value={d}
          onChange={(e) => setDigit(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          inputMode="numeric"
          maxLength={1}
          disabled={disabled}
          aria-label={`Digit ${i + 1}`}
        />
      ))}
    </div>
  )
}
