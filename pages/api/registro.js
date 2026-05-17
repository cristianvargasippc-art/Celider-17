import { supabase } from '../../lib/supabase'
import { rateLimit } from '../../lib/rateLimit'
import { sanitizeString, validateEmail, validateTelefono } from '../../lib/sanitize'

const DISTRITOS = ['17-01', '17-02', '17-03', '17-04', '17-05']
const ROLES     = ['delegado', 'tecnico', 'docente', 'directiva']

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown'
  const { allowed } = rateLimit({ key: `registro:${ip}`, max: 10, windowMs: 60 * 60 * 1000 })
  if (!allowed) return res.status(429).json({ error: 'Límite de registros alcanzado. Intenta más tarde.' })

  const b = req.body

  // Validaciones
  if (!DISTRITOS.includes(b.distrito))  return res.status(400).json({ error: 'Distrito inválido.' })
  if (!ROLES.includes(b.rol))           return res.status(400).json({ error: 'Rol inválido.' })
  if (!validateEmail(b.email))          return res.status(400).json({ error: 'Correo inválido.' })
  if (!validateTelefono(b.telefono))    return res.status(400).json({ error: 'Teléfono inválido.' })

  const edad = parseInt(b.edad)
  if (isNaN(edad) || edad < 10 || edad > 80) return res.status(400).json({ error: 'Edad inválida.' })

  if (!b.nombre || !b.apellido || !b.centro || !b.condicion) {
    return res.status(400).json({ error: 'Faltan campos obligatorios.' })
  }
  if (b.condicion === 'si' && !b.condicion_detalle) {
    return res.status(400).json({ error: 'Describe la condición médica.' })
  }

  const payload = {
    distrito:          b.distrito,
    rol:               b.rol,
    nombre:            sanitizeString(b.nombre, 100),
    apellido:          sanitizeString(b.apellido, 100),
    edad,
    telefono:          sanitizeString(b.telefono, 20),
    email:             b.email.toLowerCase().trim(),
    centro:            sanitizeString(b.centro, 200),
    condicion:         b.condicion,
    condicion_detalle: b.condicion === 'si' ? sanitizeString(b.condicion_detalle, 500) : null,
    calificacion:      Math.min(5, Math.max(0, parseInt(b.calificacion) || 0)),
    cedula_file:       sanitizeString(b.cedula_file || '', 200),
    foto_file:         sanitizeString(b.foto_file || '', 200),
    fecha:             new Date().toLocaleDateString('es-DO'),
  }

  const { error } = await supabase.from('registros').insert(payload)

  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Ya existe un registro con ese correo.' })
    return res.status(500).json({ error: 'Error al guardar el registro.' })
  }

  return res.status(200).json({ ok: true })
}