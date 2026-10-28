import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api',
  timeout: 10000,
})

export function errorMessage(error) {
  const detail = error.response?.data?.detail
  if (Array.isArray(detail)) return detail.map((item) => `${Array.isArray(item.loc) ? item.loc.slice(-1)[0] : 'Input'}: ${item.msg}`).join(' ')
  if (typeof detail === 'string') return detail
  return error.message || 'Something went wrong. Please try again.'
}

export function normalizeReading(reading) {
  return {
    ...reading,
    temperature: reading.temperature ?? reading.temperature_c,
    humidity: reading.humidity ?? reading.humidity_percent,
    rainfall: reading.rainfall ?? reading.rainfall_mm,
  }
}

export default api
