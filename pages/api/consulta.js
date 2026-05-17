import { supabase } from '../../lib/supabase'
import { rateLimit } from '../../lib/rateLimit'
import { sanitizeString } from '../../lib/sanitize'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown'
  const { allowed } = rateLimit({ key: `consulta:${ip}`, max: 20, windowMs: 60 * 1000 })
  if (!allowed) return res.status(429).json({ error: 'Demasiadas consultas. Espera un momento.' })

  const q = sanitizeString(req.query.q || '', 200).toLowerCase()
  if (!q || q.length < 3) return res.status(400).json({ error: 'Ingresa al menos 3 caracteres.' })

  const { data, error } = await supabase
    .from('registros')
    .select('nombre,apellido,distrito,rol,centro,fecha,email')
    .or(`email.eq.${q},nombre.ilike.%${q}%,apellido.ilike.%${q}%`)
    .limit(5)

  if (error) return res.status(500).json({ error: 'Error al consultar.' })
  return res.status(200).json({ data })
}