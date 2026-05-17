import { getClientIp, rateLimit } from '../../lib/rateLimit'
import { sanitizeEmail, validateEmail } from '../../lib/sanitize'
import { createSessionToken, sessionCookie } from '../../lib/session'
import { verifyPassword } from '../../lib/password'

const ADMINS = [
  {
    email: process.env.ADMIN_EMAIL,
    passwordHash: process.env.ADMIN_PASSWORD_HASH,
    nombre: 'Administrador Principal',
    rol: 'admin'
  },
  {
    email: process.env.SECRETARIA_EMAIL,
    passwordHash: process.env.SECRETARIA_PASSWORD_HASH,
    nombre: 'Secretaria General',
    rol: 'secretaria'
  }
]

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const ip = getClientIp(req)
  const { allowed } = rateLimit({ key: `login:${ip}`, limit: 5, windowMs: 60 * 60 * 1000 })

  if (!allowed) {
    return res.status(429).json({ error: 'Demasiados intentos. Espera 1 hora.' })
  }

  const email = sanitizeEmail(req.body?.email)
  const pass = String(req.body?.pass || req.body?.password || '')

  if (!email || !pass) return res.status(400).json({ error: 'Campos incompletos.' })
  if (!validateEmail(email)) return res.status(400).json({ error: 'Correo invalido.' })
  if (pass.length > 128) return res.status(400).json({ error: 'Contrasena invalida.' })

  const user = ADMINS.find((item) => item.email?.toLowerCase() === email)

  if (!user || !verifyPassword(pass, user.passwordHash)) {
    return res.status(401).json({ error: 'Credenciales incorrectas.' })
  }

  const token = createSessionToken({ email: user.email, role: user.rol })
  res.setHeader('Set-Cookie', sessionCookie(token))

  return res.status(200).json({
    ok: true,
    nombre: user.nombre,
    rol: user.rol,
    email: user.email
  })
}
