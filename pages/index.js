import Head from 'next/head'
import { useState, useEffect, useRef } from 'react'

// ── API HELPER ──
async function apiFetch(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) }
  const res = await fetch(path, { ...opts, headers })
  return res
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function Home() {
  const [sesion, setSesion]           = useState(null)
  const [loginOpen, setLoginOpen]     = useState(false)
  const [loginEmail, setLoginEmail]   = useState('')
  const [loginPass, setLoginPass]     = useState('')
  const [loginErr, setLoginErr]       = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [showPass, setShowPass]       = useState(false)
  const [loginTab, setLoginTab]       = useState('login')

  const [agenda, setAgenda]           = useState([])
  const [registros, setRegistros]     = useState([])
  const [filtroDistrito, setFiltroDistrito] = useState('todos')
  const [adminLoading, setAdminLoading] = useState(false)

  const [regState, setRegState]       = useState({
    distrito:'', rol:'', nombre:'', apellido:'', edad:'',
    telefono:'', email:'', centro:'', condicion:'',
    condicion_detalle:'', calificacion:0,
    cedula_file:'', foto_file:''
  })
  const [regFiles, setRegFiles]       = useState({ cedula:null, foto:null })
  const [regAlert, setRegAlert]       = useState({ type:'', msg:'' })
  const [regLoading, setRegLoading]   = useState(false)

  const [consultaQ, setConsultaQ]     = useState('')
  const [consultaRes, setConsultaRes] = useState(null)

  const [biblioFiles, setBiblioFiles] = useState([])
  const [canvasRef]                   = useState(useRef(null))

  // ── INIT ──
  useEffect(() => {
    const s = sessionStorage.getItem('c17_sesion')
    if (s) setSesion(JSON.parse(s))
    fetchAgenda()
    fetchBiblioteca()
    initCanvas()
  }, [])

  useEffect(() => {
    if (sesion) fetchRegistros()
  }, [sesion, filtroDistrito])

  // ── 3D PARTICLE CANVAS ──
  function initCanvas() {
    const canvas = document.getElementById('heroCanvas')
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const particles = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 1.8 + 0.4,
      opacity: Math.random() * 0.6 + 0.1,
    }))

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy
        if (p.x < 0) p.x = canvas.width
        if (p.x > canvas.width) p.x = 0
        if (p.y < 0) p.y = canvas.height
        if (p.y > canvas.height) p.y = 0

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(148,163,184,${p.opacity * 0.35})`
        ctx.fill()
      })

      particles.forEach((a, i) => {
        particles.slice(i + 1).forEach(b => {
          const dx = a.x - b.x, dy = a.y - b.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 120) {
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.strokeStyle = `rgba(148,163,184,${0.08 * (1 - dist / 120)})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        })
      })
      requestAnimationFrame(draw)
    }
    draw()

    window.addEventListener('resize', () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    })
  }

  // ── LOGIN ──
  async function handleLogin() {
    if (!loginEmail || !loginPass) { setLoginErr('Completa todos los campos.'); return }
    setLoginLoading(true); setLoginErr('')
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, pass: loginPass })
      })
      const data = await res.json()
      if (!res.ok) { setLoginErr(data.error); return }

      sessionStorage.setItem('c17_sesion', JSON.stringify(data))
      setSesion(data)
      setLoginOpen(false)
      setLoginEmail(''); setLoginPass('')
      window.location.href = '/admin/registros'
    } catch { setLoginErr('Error de conexión.') }
    finally { setLoginLoading(false) }
  }

  function cerrarSesion() {
    fetch('/api/logout', { method: 'POST' }).catch(() => {})
    sessionStorage.clear()
    setSesion(null)
    setRegistros([])
  }

  // ── AGENDA ──
  async function fetchAgenda() {
    try {
      const res = await fetch('/api/agenda')
      const data = await res.json()
      if (data.data) setAgenda(data.data)
    } catch {}
  }

  async function fetchBiblioteca() {
    try {
      const res = await fetch('/api/biblioteca')
      const data = await res.json()
      if (data.data) setBiblioFiles(data.data)
    } catch {}
  }

  // ── REGISTROS ADMIN ──
  async function fetchRegistros() {
    setAdminLoading(true)
    try {
      const q = filtroDistrito !== 'todos' ? `?distrito=${filtroDistrito}` : ''
      const res = await apiFetch(`/api/admin/registros${q}`)
      const data = await res.json()
      setRegistros(data.data || data.registros || [])
    } catch {}
    finally { setAdminLoading(false) }
  }

  // ── REGISTRO ──
  function setReg(key, val) { setRegState(s => ({ ...s, [key]: val })) }

  function setPdfFile(key, file) {
    if (!file) {
      setRegFiles(s => ({ ...s, [key]: null }))
      setReg(key === 'cedula' ? 'cedula_file' : 'foto_file', '')
      return
    }
    if (file.size > 25 * 1024 * 1024) {
      setRegAlert({ type:'error', msg:'El PDF no puede pesar más de 25 MB.' })
      return
    }
    setRegAlert({ type:'', msg:'' })
    setRegFiles(s => ({ ...s, [key]: file }))
    setReg(key === 'cedula' ? 'cedula_file' : 'foto_file', file.name)
  }

  async function uploadRegistroPdf(type, file, email) {
    const fileBase64 = await fileToBase64(file)
    const res = await fetch('/api/upload-doc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, email, fileName: file.name, fileBase64 })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'No se pudo subir el PDF.')
    return data.path
  }

  async function enviarRegistro() {
    const r = regState
    if (!r.distrito || !r.rol || !r.nombre || !r.apellido || !r.edad ||
        !r.telefono || !r.email || !r.centro || !r.condicion) {
      setRegAlert({ type:'error', msg:'Completa todos los campos obligatorios.' }); return
    }
    if (!regFiles.cedula) { setRegAlert({ type:'error', msg:'Adjunta tu cédula o acta en PDF.' }); return }
    if (!regFiles.foto)   { setRegAlert({ type:'error', msg:'Adjunta tu fotografía 2x2 en PDF.' }); return }
    if (r.condicion === 'si' && !r.condicion_detalle) {
      setRegAlert({ type:'error', msg:'Describe la condición médica.' }); return
    }

    setRegLoading(true); setRegAlert({ type:'', msg:'' })
    try {
      setRegAlert({ type:'success', msg:'Subiendo documentos PDF...' })
      const cedulaPath = await uploadRegistroPdf('cedula', regFiles.cedula, r.email)
      const fotoPath = await uploadRegistroPdf('foto', regFiles.foto, r.email)
      const payload = { ...r, cedula_file: cedulaPath, foto_file: fotoPath }

      const res = await fetch('/api/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (!res.ok) { setRegAlert({ type:'error', msg: data.error }); return }
      setRegAlert({ type:'success', msg:'Registro exitoso. Tu participación en CELIDER 17 ha sido confirmada.' })
      setRegState({ distrito:'',rol:'',nombre:'',apellido:'',edad:'',telefono:'',email:'',centro:'',condicion:'',condicion_detalle:'',calificacion:0,cedula_file:'',foto_file:'' })
      setRegFiles({ cedula:null, foto:null })
    } catch (error) { setRegAlert({ type:'error', msg:error.message || 'Error de conexión. Intenta nuevamente.' }) }
    finally { setRegLoading(false) }
  }

  // ── CONSULTA ──
  async function handleConsulta() {
    if (!consultaQ || consultaQ.length < 3) return
    try {
      const res = await fetch(`/api/consulta?q=${encodeURIComponent(consultaQ)}`)
      const data = await res.json()
      setConsultaRes(data.data || [])
    } catch { setConsultaRes([]) }
  }

  // ── EXPORT XLSX ──
  async function exportarXLSX() {
    if (!registros.length) { alert('No hay registros para exportar.'); return }
    const encabezados = ['ID','Fecha','Distrito','Rol','Nombre','Apellido','Edad','Teléfono','Correo','Centro','Condición','Detalle','Calificación']
    const filas = registros.map(r => [r.id,r.fecha,r.distrito,r.rol,r.nombre,r.apellido,r.edad,r.telefono,r.email,r.centro,r.condicion,r.condicion_detalle||'',r.calificacion])
    const escapeCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`
    const csv = [encabezados, ...filas].map(row => row.map(escapeCell).join(',')).join('\r\n')
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `CELIDER17_${new Date().toISOString().slice(0,10)}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const DISTRITOS = ['17-01','17-02','17-03','17-04','17-05']
  const ROLES = ['delegado','tecnico','docente','directiva']
  const CATEGORIA_LABEL = { regional:'Regional', capacitacion:'Capacitación', modelo:'Modelo ONU', torneo:'Torneo', gala:'Gala' }
  const CATEGORIA_CLASS = { regional:'badge-success', capacitacion:'badge-cyan', modelo:'badge-blue', torneo:'badge-warning', gala:'badge-cyan' }
  const ROL_CLASS = { delegado:'badge-blue', tecnico:'badge-success', docente:'badge-warning', directiva:'badge-cyan' }

  const registrosFiltrados = filtroDistrito === 'todos' ? registros : registros.filter(r => r.distrito === filtroDistrito)

  // stats for admin dashboard
  const totalReg   = registros.length
  const porDistrito = DISTRITOS.map(d => ({ d, n: registros.filter(r => r.distrito === d).length }))
  const porRol     = ROLES.map(r => ({ r, n: registros.filter(x => x.rol === r).length }))
  const avgCalif   = registros.length ? (registros.reduce((a,r)=>a+(r.calificacion||0),0)/registros.length).toFixed(1) : '—'
  const conCondicion = registros.filter(r => r.condicion === 'si').length

  return (
    <>
      <Head>
        <title>CELIDER 17 — Un CELIDER que Transforma</title>
        <meta name="description" content="Plataforma oficial CELIDER Regional 17 Monte Plata 2026-2027" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </Head>

      {/* ── TOPBAR ── */}
      <nav style={styles.topbar}>
        <a href="#inicio" style={styles.logo}>
          <div style={styles.logoBadge}>C17</div>
          <div>
            <div style={styles.logoText}>CELIDER 17</div>
            <div style={styles.logoSub}>Regional Monte Plata · 2026–2027</div>
          </div>
        </a>
        <div style={styles.navLinks}>
          {['inicio','objetivos','plancha','agenda','biblioteca','consulta','registro'].map(s => (
            <a key={s} href={`#${s}`} style={styles.navLink}>{s.charAt(0).toUpperCase()+s.slice(1)}</a>
          ))}
          {sesion ? (
            <button className="btn btn-outline btn-sm" onClick={() => { window.location.href = '/admin/registros' }}>
              Panel Admin
            </button>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={() => setLoginOpen(true)}>
              Ingresar
            </button>
          )}
        </div>
      </nav>

      {/* ── HERO ── */}
      <section id="inicio" style={styles.hero}>
        <canvas id="heroCanvas" style={styles.canvas} />
        <div style={styles.heroContent}>
          <div style={styles.heroOrb1} />
          <div style={styles.heroOrb2} />

          <div style={styles.heroBadge}>
            <span style={styles.heroBadgeDot} />
            Gestión 2026 – 2027 &nbsp;·&nbsp; Plancha #1
          </div>

          <h1 style={styles.heroTitle}>
            UN CELIDER<br />
            <span style={styles.heroTitleAccent}>QUE TRANSFORMA</span>
          </h1>

          <p style={styles.heroDesc}>
            Construyendo liderazgos, realidades y comunidades<br />
            en los 5 distritos educativos de la Regional 17.
          </p>

          <div style={styles.heroBtns}>
            <a href="#registro" className="btn btn-primary">Registrarse</a>
            <a href="#objetivos" className="btn btn-outline">Ver propuesta</a>
            <button className="btn btn-ghost" onClick={() => setLoginOpen(true)}>Ingresar al sistema</button>
          </div>

          <div style={styles.heroStats}>
            {[
              { n:'5',     l:'Distritos Educativos' },
              { n:'2,500', l:'Meta de Impacto' },
              { n:'6',     l:'Objetivos estratégicos' },
              { n:'2026',  l:'Gestión activa' },
            ].map(s => (
              <div key={s.l} style={styles.stat}>
                <div style={styles.statN}>{s.n}</div>
                <div style={styles.statL}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 3D accent lines */}
        <div style={styles.heroLine1} />
        <div style={styles.heroLine2} />
      </section>

      {/* ── OBJETIVOS ── */}
      <section id="objetivos" className="section grid-bg">
        <div className="container">
          <div className="section-tag">Objetivos estratégicos</div>
          <h2 className="section-title">Los <span>6 pilares</span> de la gestión</h2>
          <p className="section-desc">Acciones concretas orientadas a potenciar el voluntariado y transformar la Regional 17 durante 2026–2027.</p>

          <div style={styles.objetivosGrid}>
            {[
              { n:'01', t:'Ampliar la participación distrital', d:'Articulación con todos los distritos para aumentar la presencia activa de estudiantes y voluntarios en actividades regionales y nacionales.' },
              { n:'02', t:'Mejorar procesos formativos', d:'Instrumentos de diagnóstico y retroalimentación en talleres y capacitaciones para asegurar una formación de mayor calidad.' },
              { n:'03', t:'Registro y verificación de evidencias', d:'Mecanismo institucional para recepción, organización y validación de evidencias e informes de actividades realizadas.' },
              { n:'04', t:'Posicionar el talento juvenil', d:'Fomentar la participación destacada en eventos nacionales para obtener reconocimientos que fortalezcan la imagen institucional.' },
              { n:'05', t:'Cohesión y sentido de pertenencia', d:'Actividades integradoras que promuevan la unión, el trabajo en equipo y el compromiso de los voluntarios.' },
              { n:'06', t:'Meta institucional: 2,500 impactados', d:'Acciones estratégicas en los 5 distritos para alcanzar la meta establecida por el PLERD con seguimiento verificable.' },
            ].map(o => (
              <div key={o.n} className="glass" style={styles.objetivoCard}>
                <div style={styles.objetivoNum}>{o.n}</div>
                <h3 style={styles.objetivoTitle}>{o.t}</h3>
                <p style={styles.objetivoDesc}>{o.d}</p>
                <div style={styles.objetivoBar} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PLANCHA ── */}
      <section id="plancha" className="section" style={{ background:'var(--ink-2)' }}>
        <div className="container">
          <div className="section-tag">Integrantes de la Plancha #1</div>
          <h2 className="section-title">Quiénes nos <span>representan</span></h2>
          <p className="section-desc">El equipo comprometido con transformar la Regional 17 durante 2026–2027.</p>

          <div style={styles.planchaGrid}>
            {[
              { nombre:'Mairenis Travieso',    cargo:'Presidenta',              trayectoria:'Voluntaria Nacional desde 2022 · MINUME XIV', img:'2' },
              { nombre:'Isaira Cuello',         cargo:'Secretaria General',      trayectoria:'Voluntaria Nacional desde 2023 · MINUME XIV', img:'3' },
              { nombre:'Elisandra Tolentino',   cargo:'Sec. de Comunicaciones',  trayectoria:'Voluntaria Regional desde 2024 · MINUME XV',  img:'4' },
              { nombre:'Albert De Jesus',       cargo:'Sec. de Capacitaciones',  trayectoria:'Regional desde 2024 · MINUME XVI',            img:'5' },
              { nombre:'Carlos Alfredo Mejia',  cargo:'Sec. de Proyectos',       trayectoria:'Voluntario Nacional desde 2022 · MINUME XIII', img:'6' },
            ].map((m, i) => (
              <div key={m.nombre} className="glass" style={styles.miembroCard}>
                <div style={styles.miembroImgWrap}>
                  <div style={styles.miembroImgPh}>
                    <div style={styles.miembroInitials}>{m.nombre.split(' ').map(w=>w[0]).slice(0,2).join('')}</div>
                    <div style={styles.miembroImgLabel}>IMAGEN {m.img} · Foto 2x2</div>
                  </div>
                  <div style={styles.miembroImgGlow} />
                </div>
                <div style={styles.miembroBody}>
                  <div style={styles.miembroNombre}>{m.nombre}</div>
                  <div style={styles.miembroCargo}>{m.cargo}</div>
                  <p style={styles.miembroTray}>{m.trayectoria}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── AGENDA ── */}
      <section id="agenda" className="section grid-bg">
        <div className="container">
          <div className="section-tag">Agenda tentativa 2026–2027</div>
          <h2 className="section-title">Calendario de <span>actividades</span></h2>
          <p className="section-desc">Eventos, capacitaciones y modelos planificados para la gestión.</p>

          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {(agenda.length ? agenda : [
              { dia:'15', mes:'Ago 2026', titulo:'Inicio oficial de gestión 2026–2027',     descripcion:'Acto inaugural y presentación de la Plancha #1', categoria:'regional' },
              { dia:'20', mes:'Sep 2026', titulo:'Capacitación distrital — Distrito 17-01',  descripcion:'Formación en oratoria, debate y liderazgo',         categoria:'capacitacion' },
              { dia:'10', mes:'Oct 2026', titulo:'Modelo Distrital 17-03 Bayaguana',        descripcion:'Modelo Distrital de las Naciones Unidas',           categoria:'modelo' },
              { dia:'25', mes:'Nov 2026', titulo:'IV Torneo Regional de Debate',            descripcion:'Competencia de debate académico · Regional 17',     categoria:'torneo' },
              { dia:'14', mes:'Feb 2027', titulo:'Esmeralda Awards — Gala de Reconocimiento', descripcion:'Reconocimiento al voluntariado destacado',        categoria:'gala' },
              { dia:'30', mes:'May 2027', titulo:'MUNRE Esmeralda — Modelo Regional',       descripcion:'Modelo Regional de las Naciones Unidas',            categoria:'modelo' },
            ]).map((ev, i) => (
              <div key={i} className="glass" style={styles.agendaItem}>
                <div style={styles.agendaFecha}>
                  <div style={styles.agendaDia}>{ev.dia}</div>
                  <div style={styles.agendaMes}>{ev.mes}</div>
                </div>
                <div style={styles.agendaInfo}>
                  <div style={styles.agendaTitulo}>{ev.titulo}</div>
                  <div style={styles.agendaDesc}>{ev.descripcion}</div>
                </div>
                <span className={`badge ${CATEGORIA_CLASS[ev.categoria] || 'badge-blue'}`}>
                  {CATEGORIA_LABEL[ev.categoria] || ev.categoria}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BIBLIOTECA ── */}
      <section id="biblioteca" className="section" style={{ background:'var(--ink-2)' }}>
        <div className="container">
          <div className="section-tag">Banco de materiales formativos</div>
          <h2 className="section-title">Biblioteca <span>MUN</span></h2>
          <p className="section-desc">Repositorio digital de manuales, guías y materiales de capacitación para todos los comités y distritos.</p>

          <div className="file-upload-area" style={{ display:'none', maxWidth:540, marginBottom:32 }}
            onClick={() => document.getElementById('biblioInput').click()}>
            <div style={{ fontSize:32, color:'var(--blue-neon)' }}>+</div>
            <p>Subir documento al repositorio — Solo administradores — PDF únicamente</p>
            <input type="file" id="biblioInput" style={{ display:'none' }}
              onChange={e => {
                const f = e.target.files[0]
                if (!f) return
                setBiblioFiles(prev => [...prev, { nombre: f.name, size: (f.size/1024).toFixed(0)+'KB' }])
                e.target.value = ''
              }} />
          </div>

          {biblioFiles.length > 0 && (
            <div style={styles.biblioGrid}>
              {biblioFiles.map((d, i) => (
                <a key={d.id || i} className="glass" style={{ ...styles.biblioDoc, textDecoration:'none' }} href={d.url} target="_blank" rel="noreferrer">
                  <div style={styles.biblioDocIcon}>PDF</div>
                  <div style={styles.biblioDocName}>{d.titulo || d.nombre || d.file_name}</div>
                  <div style={styles.biblioDocSize}>{d.categoria || d.size || 'Ver / descargar'}</div>
                </a>
              ))}
            </div>
          )}

          <h3 style={{ fontFamily:'Inter,sans-serif', fontSize:'1.2rem', color:'#93c5fd', marginBottom:20, marginTop:40, letterSpacing:0 }}>
            Manuales generales por comité
          </h3>
          <div style={styles.comitesGrid}>
            {[
              { nombre:'Asamblea General',   tipo:'Manual', desc:'Reglas de procedimiento, resoluciones y guía de delegados para la AG.' },
              { nombre:'Consejo de Seguridad', tipo:'Manual', desc:'Procedimientos del CS, veto, resoluciones vinculantes y guía de delegado.' },
              { nombre:'Comité Jurídico',    tipo:'Manual', desc:'Marco legal de la ONU, resoluciones y guía de redacción de resoluciones.' },
              { nombre:'ECOSOC',             tipo:'Manual', desc:'Desarrollo sostenible, agenda social y procedimientos del ECOSOC.' },
              { nombre:'Sec. Capacitaciones', tipo:'Guía',  desc:'Materiales didácticos, dinámicas y guía para facilitadores de talleres.' },
              { nombre:'Sec. Comunicaciones', tipo:'Guía',  desc:'Manual de identidad institucional, redes sociales y comunicado oficial.' },
            ].map(c => (
              <div key={c.nombre} className="glass" style={styles.comiteCard}>
                <div style={styles.comiteCardHeader}>
                  <span style={styles.comiteNombre}>{c.nombre}</span>
                  <span className="badge badge-cyan">{c.tipo}</span>
                </div>
                <p style={styles.comiteDesc}>{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CONSULTA ── */}
      <section id="consulta" className="section grid-bg">
        <div className="container">
          <div className="section-tag">Sistema de consulta</div>
          <h2 className="section-title">Consultar tu <span>designación</span></h2>
          <p className="section-desc">Ingresa tu correo o nombre completo para conocer tu rol y designación oficial dentro de la Regional 17.</p>

          <div className="glass" style={{ maxWidth:580, margin:'0 auto', padding:'32px' }}>
            <div className="form-group">
              <label className="form-label">Correo electrónico o nombre</label>
              <div style={{ display:'flex', gap:10 }}>
                <input type="text" className="form-input" placeholder="tu@correo.com o nombre completo"
                  value={consultaQ} onChange={e => setConsultaQ(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleConsulta()} />
                <button className="btn btn-primary" style={{ whiteSpace:'nowrap' }} onClick={handleConsulta}>
                  Consultar
                </button>
              </div>
            </div>

            {consultaRes !== null && (
              <div style={{ marginTop:20 }}>
                {consultaRes.length === 0 ? (
                  <div className="alert alert-error" style={{ display:'block' }}>
                    No se encontró ninguna designación con esos datos. Verifica tu correo o contacta a tu coordinador.
                  </div>
                ) : consultaRes.map((r, i) => (
                  <div key={i} className="glass-bright" style={{ padding:'20px', marginBottom:12 }}>
                    <div style={{ fontFamily:'Inter,sans-serif', color:'var(--success)', fontSize:'13px', letterSpacing:'0.04em', marginBottom:14 }}>
                      DESIGNACIÓN ENCONTRADA
                    </div>
                    {[
                      ['Nombre',         `${r.nombre} ${r.apellido}`],
                      ['Distrito',       r.distrito],
                      ['Rol / Categoría',r.rol],
                      ['Centro Educativo',r.centro],
                      ['Fecha de registro',r.fecha],
                    ].map(([k,v]) => (
                      <div key={k} style={{ display:'flex', gap:12, marginBottom:8, fontSize:'14px' }}>
                        <span style={{ color:'var(--blue-neon)', fontWeight:700, minWidth:160, fontFamily:'Inter,sans-serif', fontSize:'12px', letterSpacing:'0.04em', textTransform:'uppercase', paddingTop:2 }}>{k}</span>
                        <span style={{ color:'#0f172a' }}>{v}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── REGISTRO ── */}
      <section id="registro" className="section" style={{ background:'var(--ink-2)' }}>
        <div className="container">
          <div className="section-tag">Formulario oficial</div>
          <h2 className="section-title">Registro de <span>Participantes</span></h2>
          <p className="section-desc">Completa el formulario para registrarte como delegado, técnico o docente en la Regional 17.</p>

          <div className="glass" style={{ maxWidth:720, margin:'0 auto', padding:'36px' }}>

            {regAlert.msg && (
              <div className={`alert alert-${regAlert.type}`} style={{ display:'block' }}>{regAlert.msg}</div>
            )}

            {/* Grupo y Rol */}
            <SectionHeader title="Grupo y Rol" />
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Distrito Educativo *</label>
                <select className="form-select" value={regState.distrito} onChange={e => setReg('distrito', e.target.value)}>
                  <option value="">Seleccionar distrito</option>
                  {DISTRITOS.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Rol / Categoría *</label>
                <select className="form-select" value={regState.rol} onChange={e => setReg('rol', e.target.value)}>
                  <option value="">Seleccionar rol</option>
                  <option value="delegado">Delegado</option>
                  <option value="tecnico">Técnico</option>
                  <option value="docente">Docente</option>
                  <option value="directiva">Mesa Directiva</option>
                </select>
              </div>
            </div>

            {/* Datos personales */}
            <SectionHeader title="Datos Personales" />
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Nombre *</label>
                <input type="text" className="form-input" placeholder="Nombre(s)" value={regState.nombre} onChange={e => setReg('nombre', e.target.value)} maxLength={100} />
              </div>
              <div className="form-group">
                <label className="form-label">Apellido *</label>
                <input type="text" className="form-input" placeholder="Apellido(s)" value={regState.apellido} onChange={e => setReg('apellido', e.target.value)} maxLength={100} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Edad *</label>
                <input type="number" className="form-input" placeholder="Ej: 17" min={10} max={80} value={regState.edad} onChange={e => setReg('edad', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Teléfono *</label>
                <input type="tel" className="form-input" placeholder="809-000-0000" value={regState.telefono} onChange={e => setReg('telefono', e.target.value)} maxLength={20} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Correo electrónico *</label>
                <input type="email" className="form-input" placeholder="tu@correo.com" value={regState.email} onChange={e => setReg('email', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Centro Educativo *</label>
                <input type="text" className="form-input" placeholder="Nombre del centro" value={regState.centro} onChange={e => setReg('centro', e.target.value)} maxLength={200} />
              </div>
            </div>

            {/* Condición médica */}
            <SectionHeader title="Condición médica" />
            <div className="form-group">
              <label className="form-label">¿Presenta alguna condición médica? *</label>
              <select className="form-select" value={regState.condicion} onChange={e => setReg('condicion', e.target.value)}>
                <option value="">Seleccionar</option>
                <option value="no">No</option>
                <option value="si">Sí</option>
              </select>
              {regState.condicion === 'si' && (
                <div className="condicion-si" style={{ display:'block' }}>
                  <label className="form-label">Tipo de medicamento o enfermedad *</label>
                  <textarea className="form-textarea" rows={3}
                    placeholder="Describe la condición, medicamentos o cuidados especiales..."
                    value={regState.condicion_detalle}
                    onChange={e => setReg('condicion_detalle', e.target.value)}
                    maxLength={500} />
                  <p className="form-hint">Esta información es confidencial y solo visible para administradores.</p>
                </div>
              )}
            </div>

            {/* Documentos */}
            <SectionHeader title="Documentos Requeridos" />
            <div className="form-group">
              <label className="form-label">Cédula o acta de nacimiento (PDF) *</label>
              <input type="file" className="form-input"
                onChange={e => setPdfFile('cedula', e.target.files?.[0])} />
              <p className="form-hint">{regState.cedula_file || 'Selecciona el PDF. Puede tener cualquier nombre y se subirá al enviar el registro.'}</p>
            </div>
            <div className="form-group">
              <label className="form-label">Fotografía 2x2 (PDF) *</label>
              <input type="file" className="form-input"
                onChange={e => setPdfFile('foto', e.target.files?.[0])} />
              <p className="form-hint">{regState.foto_file || 'Selecciona el PDF. Puede tener cualquier nombre y se subirá al enviar el registro.'}</p>
            </div>

            {/* Calificación */}
            <SectionHeader title="Evaluación del proceso" />
            <div className="form-group">
              <label className="form-label">¿Cómo calificarías el proceso de registro?</label>
              <div className="stars-wrap">
                {[1,2,3,4,5].map(n => (
                  <button key={n} type="button"
                    className={`star-btn${regState.calificacion >= n ? ' active' : ''}`}
                    onClick={() => setReg('calificacion', n)}>
                    {regState.calificacion >= n ? '★' : '☆'}
                  </button>
                ))}
              </div>
            </div>

            <div className="security-note" style={{ marginBottom:20 }}>
              Tu información está encriptada y protegida. Solo administradores autorizados tienen acceso a tus datos.
            </div>

            <button className="btn btn-primary btn-full" onClick={enviarRegistro} disabled={regLoading}>
              {regLoading ? <span className="spinner" /> : 'Enviar registro'}
            </button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={styles.footer}>
        <div style={styles.footerLogo}>CELIDER <span style={{ color:'var(--blue-neon)' }}>17</span></div>
        <p style={{ color:'var(--silver)', fontSize:'13px' }}>Club Escolar de Liderazgo · Regional 17 Monte Plata</p>
        <p style={{ color:'var(--silver)', fontSize:'13px', marginTop:6 }}>Gestión 2026–2027 · Plancha #1 · Un CELIDER que Transforma</p>
        <div style={{ marginTop:20, height:1, background:'linear-gradient(90deg,transparent,var(--border-bright),transparent)' }} />
        <p style={{ color:'rgba(168,196,224,0.3)', fontSize:'11px', marginTop:16 }}>
          2026 CELIDER 17 · Sistema seguro · Todos los derechos reservados
        </p>
      </footer>

      {/* ── MODAL LOGIN ── */}
      <div className={`modal-overlay${loginOpen ? ' open' : ''}`} onClick={e => { if (e.target === e.currentTarget) setLoginOpen(false) }}>
        <div className="modal">
          <div className="modal-header">
            <h2>Ingresar a CELIDER 17</h2>
            <button className="modal-close" onClick={() => setLoginOpen(false)}>x</button>
          </div>
          <div className="modal-body">
            <div className="tabs">
              <button className={`tab-btn${loginTab==='login'?' active':''}`} onClick={() => setLoginTab('login')}>Iniciar sesión</button>
              <button className={`tab-btn${loginTab==='recuperar'?' active':''}`} onClick={() => setLoginTab('recuperar')}>Recuperar Acceso</button>
            </div>

            {loginTab === 'login' ? (
              <>
                {loginErr && <div className="alert alert-error" style={{ display:'block' }}>{loginErr}</div>}
                <div className="form-group">
                  <label className="form-label">Correo electrónico</label>
                  <input type="email" className="form-input" placeholder="tu@correo.com"
                    value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleLogin()} autoComplete="email" />
                </div>
                <div className="form-group">
                  <label className="form-label">Contraseña</label>
                  <div className="input-wrap">
                    <input type={showPass ? 'text' : 'password'} className="form-input"
                      placeholder="••••••••" value={loginPass}
                      onChange={e => setLoginPass(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleLogin()} autoComplete="current-password" />
                    <button className="eye-btn" type="button" onClick={() => setShowPass(p => !p)}>
                      {showPass ? 'O' : 'O'}
                    </button>
                  </div>
                </div>
                <button className="btn btn-primary btn-full" onClick={handleLogin} disabled={loginLoading}>
                  {loginLoading ? <span className="spinner" /> : 'Ingresar'}
                </button>
                <div className="security-note" style={{ marginTop:14 }}>
                  Conexion segura · Rate limiting activo · Tus datos estan protegidos
                </div>
              </>
            ) : (
              <>
                <p style={{ fontSize:'13px', color:'var(--silver)', marginBottom:16 }}>
                  Contacta al administrador del sistema para restablecer tu acceso: admin@celider17.do
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ── SUB COMPONENTS ──
function SectionHeader({ title }) {
  return (
    <div style={{ fontFamily:'Inter,sans-serif', fontSize:'13px', fontWeight:800, letterSpacing:'0.04em', textTransform:'uppercase', color:'var(--blue-neon)', borderBottom:'1px solid var(--border)', paddingBottom:8, marginBottom:18, marginTop:28 }}>
      {title}
    </div>
  )
}

function KpiCard({ label, value, color }) {
  return (
    <div className="glass-bright" style={{ padding:'24px', textAlign:'center' }}>
      <div style={{ fontFamily:'Inter,sans-serif', fontSize:'2.8rem', fontWeight:800, color, lineHeight:1, textShadow:'none' }}>
        {value}
      </div>
      <div style={{ fontFamily:'Inter,sans-serif', fontSize:'11px', letterSpacing:'0.04em', textTransform:'uppercase', color:'var(--silver)', marginTop:8 }}>
        {label}
      </div>
    </div>
  )
}

// ── STYLES ──
const styles = {
  topbar: { position:'fixed', top:0, left:0, right:0, zIndex:200, background:'rgba(15,23,42,0.94)', backdropFilter:'blur(14px)', borderBottom:'1px solid rgba(148,163,184,0.18)', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 2rem', height:64 },
  logo: { display:'flex', alignItems:'center', gap:12, textDecoration:'none' },
  logoBadge: { width:38, height:38, background:'var(--blue)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Inter, sans-serif', fontWeight:700, fontSize:15, color:'#fff', boxShadow:'none' },
  logoText: { fontFamily:'Inter, sans-serif', fontWeight:700, fontSize:17, color:'var(--white)', lineHeight:1.2 },
  logoSub: { fontSize:10, color:'var(--silver)', fontWeight:300, letterSpacing:'0.05em' },
  navLinks: { display:'flex', alignItems:'center', gap:6 },
  navLink: { color:'rgba(203,213,225,0.86)', textDecoration:'none', fontFamily:'Inter, sans-serif', fontSize:'13px', fontWeight:600, padding:'6px 12px', borderRadius:6, transition:'all .2s', letterSpacing:'0.01em', textTransform:'uppercase' },

  hero: { minHeight:'100vh', background:'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)', display:'flex', alignItems:'center', justifyContent:'center', textAlign:'center', padding:'100px 2rem 60px', position:'relative', overflow:'hidden' },
  canvas: { position:'absolute', inset:0, pointerEvents:'none', opacity:0.35 },
  heroContent: { position:'relative', zIndex:2, maxWidth:800 },
  heroOrb1: { display:'none' },
  heroOrb2: { display:'none' },
  heroBadge: { display:'inline-flex', alignItems:'center', gap:8, background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.18)', borderRadius:50, padding:'7px 18px', fontSize:12, fontFamily:'Inter, sans-serif', fontWeight:700, letterSpacing:'0.05em', textTransform:'uppercase', color:'#bfdbfe', marginBottom:24 },
  heroBadgeDot: { width:6, height:6, background:'#60a5fa', borderRadius:'50%' },
  heroTitle: { fontFamily:'Inter, sans-serif', fontSize:'clamp(2.8rem,7vw,5.6rem)', fontWeight:800, color:'var(--white)', letterSpacing:0, lineHeight:1.04, marginBottom:20, textShadow:'none' },
  heroTitleAccent: { color:'#bfdbfe', textShadow:'none' },
  heroDesc: { fontSize:'1.05rem', color:'#dbeafe', fontWeight:400, marginBottom:40, lineHeight:1.7 },
  heroBtns: { display:'flex', gap:14, justifyContent:'center', flexWrap:'wrap', marginBottom:60 },
  heroStats: { display:'flex', gap:48, justifyContent:'center', borderTop:'1px solid rgba(255,255,255,0.14)', paddingTop:32, flexWrap:'wrap' },
  stat: { textAlign:'center' },
  statN: { fontFamily:'Inter, sans-serif', fontSize:'2.2rem', fontWeight:800, color:'#bfdbfe', textShadow:'none' },
  statL: { fontSize:'11px', color:'var(--silver)', textTransform:'uppercase', letterSpacing:'0.1em', marginTop:4 },
  heroLine1: { display:'none' },
  heroLine2: { display:'none' },

  objetivosGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:20 },
  objetivoCard: { padding:'28px', position:'relative', overflow:'hidden', transition:'all .25s', cursor:'default' },
  objetivoNum: { fontFamily:'Inter, sans-serif', fontSize:'2.3rem', fontWeight:800, color:'var(--blue-dim)', marginBottom:10, lineHeight:1 },
  objetivoTitle: { fontFamily:'Inter, sans-serif', fontSize:'1.05rem', fontWeight:800, color:'#0f172a', marginBottom:10, letterSpacing:0 },
  objetivoDesc: { fontSize:'0.88rem', color:'#475569', lineHeight:1.7, fontWeight:400 },
  objetivoBar: { position:'absolute', top:0, left:0, right:0, height:3, background:'var(--blue)', boxShadow:'none' },

  planchaGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:20 },
  miembroCard: { overflow:'hidden', transition:'all .25s' },
  miembroImgWrap: { height:180, background:'linear-gradient(160deg,#1e3a5f,#dbeafe)', position:'relative', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:8 },
  miembroImgPh: { display:'flex', flexDirection:'column', alignItems:'center', gap:8 },
  miembroInitials: { width:72, height:72, background:'#fff', border:'1px solid rgba(148,163,184,0.4)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Inter, sans-serif', fontSize:'1.6rem', fontWeight:800, color:'var(--blue)', letterSpacing:0 },
  miembroImgLabel: { fontSize:'10px', color:'rgba(168,196,224,0.45)', letterSpacing:'0.05em', textAlign:'center' },
  miembroImgGlow: { position:'absolute', inset:0, background:'linear-gradient(to bottom, transparent 62%, rgba(15,23,42,0.55))', pointerEvents:'none' },
  miembroBody: { padding:'18px 16px' },
  miembroNombre: { fontFamily:'Inter, sans-serif', fontWeight:800, fontSize:'1.05rem', color:'var(--white)', marginBottom:4 },
  miembroCargo: { fontFamily:'Inter, sans-serif', fontSize:'11px', color:'#93c5fd', textTransform:'uppercase', letterSpacing:'0.04em', fontWeight:700, marginBottom:10 },
  miembroTray: { fontSize:'11px', color:'var(--silver)', fontWeight:300 },

  agendaItem: { display:'flex', alignItems:'center', gap:20, padding:'20px 24px', transition:'all .2s' },
  agendaFecha: { minWidth:68, textAlign:'center', padding:'8px 10px', background:'rgba(37,99,235,0.08)', border:'1px solid rgba(37,99,235,0.2)', borderRadius:8 },
  agendaDia: { fontFamily:'Inter, sans-serif', fontSize:'1.6rem', fontWeight:800, color:'var(--blue)', lineHeight:1 },
  agendaMes: { fontSize:'10px', textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--silver)' },
  agendaInfo: { flex:1 },
  agendaTitulo: { fontFamily:'Inter, sans-serif', fontSize:'1rem', fontWeight:800, color:'#0f172a', marginBottom:4, letterSpacing:0 },
  agendaDesc: { fontSize:'12px', color:'#64748b', fontWeight:400 },

  biblioGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:14, marginTop:20 },
  biblioDoc: { padding:'18px 14px', textAlign:'center', transition:'all .2s' },
  biblioDocIcon: { fontFamily:'Inter, sans-serif', fontSize:'13px', fontWeight:800, color:'var(--danger)', letterSpacing:'0.04em', marginBottom:10, padding:'6px 10px', border:'1px solid rgba(220,38,38,0.25)', borderRadius:4, display:'inline-block' },
  biblioDocName: { fontSize:'12px', color:'#f8fafc', wordBreak:'break-word', fontWeight:700, marginBottom:4 },
  biblioDocSize: { fontSize:'11px', color:'var(--silver)' },
  comitesGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:14 },
  comiteCard: { padding:'18px 20px', transition:'all .2s' },
  comiteCardHeader: { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10, gap:8 },
  comiteNombre: { fontFamily:'Inter, sans-serif', fontSize:'0.95rem', fontWeight:800, color:'#f8fafc' },
  comiteDesc: { fontSize:'12px', color:'#cbd5e1', fontWeight:400, lineHeight:1.6 },

  adminHeader: { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:28, flexWrap:'wrap', gap:16 },
  kpiGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:16, marginBottom:24 },

  adminTable: { width:'100%', borderCollapse:'collapse', fontSize:'13px' },
  th: { background:'rgba(15,23,42,0.9)', color:'#bfdbfe', padding:'12px 14px', textAlign:'left', fontFamily:'Inter, sans-serif', fontSize:'11px', fontWeight:800, letterSpacing:'0.04em', textTransform:'uppercase', whiteSpace:'nowrap', borderBottom:'1px solid var(--border)' },
  td: { padding:'11px 14px', color:'var(--silver)', borderBottom:'1px solid rgba(0,180,255,0.06)', verticalAlign:'middle', fontSize:'13px' },
  tr: { transition:'background .15s', cursor:'default' },

  footer: { background:'var(--ink-2)', borderTop:'1px solid var(--border)', padding:'48px 2rem', textAlign:'center' },
  footerLogo: { fontFamily:'Inter, sans-serif', fontWeight:800, fontSize:'1.8rem', color:'var(--white)', marginBottom:10 },
}

