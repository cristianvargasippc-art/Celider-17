import { useEffect, useState } from 'react'

export default function AdminRegistros() {
  const [registros, setRegistros] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/registros')
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'No se pudieron cargar los registros')
        return data
      })
      .then((data) => setRegistros(data.data || data.registros || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: 32 }}>
      <h1>Registros CELIDER 17</h1>
      {loading ? <p>Cargando...</p> : null}
      {error ? <p>{error}</p> : null}
      {!loading && !error ? (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Nombre', 'Apellido', 'Distrito', 'Rol', 'Email', 'Telefono', 'Centro'].map((header) => (
                  <th key={header} style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #234' }}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {registros.map((registro) => (
                <tr key={registro.id}>
                  <td style={{ padding: 10 }}>{registro.nombre}</td>
                  <td style={{ padding: 10 }}>{registro.apellido}</td>
                  <td style={{ padding: 10 }}>{registro.distrito}</td>
                  <td style={{ padding: 10 }}>{registro.rol}</td>
                  <td style={{ padding: 10 }}>{registro.email}</td>
                  <td style={{ padding: 10 }}>{registro.telefono}</td>
                  <td style={{ padding: 10 }}>{registro.centro}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </main>
  )
}
