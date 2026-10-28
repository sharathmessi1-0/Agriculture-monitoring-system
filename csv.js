const columns = [
  'field_name',
  'field_id',
  'data_source',
  'soil_moisture',
  'temperature',
  'humidity',
  'soil_ph',
  'rainfall',
  'recorded_at',
]

function escapeCsv(value) {
  const text = String(value ?? '')
  const safe = typeof value === 'string' && /^[\t\r ]*[=+\-@]/.test(text) ? `'${text}` : text
  return `"${safe.replaceAll('"', '""')}"`
}

export function createReadingsCsv(rows, fields) {
  return [
    columns.join(','),
    ...rows.map((row) => columns.map((column) => {
      if (column === 'recorded_at') return escapeCsv(row.recorded_at || row.created_at || row.timestamp)
      if (column === 'field_name') {
        return escapeCsv(row.field_name || fields.find((field) => field.id === row.field_id)?.name)
      }
      if (column === 'data_source') return escapeCsv(row.is_demo ? 'DEMO' : 'RECORDED')
      return escapeCsv(row[column])
    }).join(',')),
  ].join('\r\n')
}
