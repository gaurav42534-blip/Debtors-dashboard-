export function exportToCSV(data: Record<string, string | number>[], filename: string) {
  if (data.length === 0) return

  const headers = Object.keys(data[0])
  const csvRows: string[] = []

  // Header row
  csvRows.push(headers.map(h => `"${h}"`).join(','))

  // Data rows
  for (const row of data) {
    const values = headers.map(h => {
      const val = row[h]
      // Escape double quotes and wrap in quotes
      const escaped = String(val).replace(/"/g, '""')
      return `"${escaped}"`
    })
    csvRows.push(values.join(','))
  }

  const csvString = csvRows.join('\n')
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}.csv`
  link.click()

  URL.revokeObjectURL(url)
}
