import { supabase } from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const { data, error } = await supabase
    .from('agenda')
    .select('*')
    .order('id', { ascending: true })

  if (error) return res.status(500).json({ error: 'Error al leer agenda.' })

  return res.status(200).json({ data, agenda: data })
}
