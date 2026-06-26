// Tiny client-side CSV builder + download. No backend round-trip — we already
// have the rows in memory, so we serialise and trigger a file download.

function escapeCell(value) {
  const s = value == null ? '' : String(value)
  // Quote if the cell contains a comma, quote or newline; double any quotes.
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * Build a CSV string from a header row + array of row arrays.
 * `headers` is a string[]; `rows` is an array of (string|number)[].
 */
export function toCsv(headers, rows) {
  const lines = [headers, ...rows].map((r) => r.map(escapeCell).join(','))
  return lines.join('\r\n')
}

/** Trigger a browser download of `content` as `filename`. */
export function downloadCsv(filename, content) {
  // Prepend a BOM so Excel reads UTF-8 (₹ etc.) correctly.
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
