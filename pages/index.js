import Head from 'next/head'
import { useState, useEffect, useRef } from 'react'

// ── API HELPER ──
async function apiFetch(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) }
  const res = await fetch(path, { ...opts, headers })
  return res
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
        ctx.fillStyle = `rgba(0,180,255,${p.opacity})`
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
            ctx.strokeStyle = `rgba(0,180,255,${0.12 * (1 - dist / 120)})`
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
      document.getElementById('admin')?.scrollIntoView({ behavior: 'smooth' })
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

  async function enviarRegistro() {
    const r = regState
    if (!r.distrito || !r.rol || !r.nombre || !r.apellido || !r.edad ||
        !r.telefono || !r.email || !r.centro || !r.condicion) {
      setRegAlert({ type:'error', msg:'Completa todos los campos obligatorios.' }); return
    }
    if (!r.cedula_file) { setRegAlert({ type:'error', msg:'Adjunta tu cédula o acta en PDF.' }); return }
    if (!r.foto_file)   { setRegAlert({ type:'error', msg:'Adjunta tu fotografía 2×2 en PDF.' }); return }
    if (r.condicion === 'si' && !r.condicion_detalle) {
      setRegAlert({ type:'error', msg:'Describe la condición médica.' }); return
    }

    setRegLoading(true); setRegAlert({ type:'', msg:'' })
    try {
      const res = await fetch('/api/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(r)
      })
      const data = await res.json()
      if (!res.ok) { setRegAlert({ type:'error', msg: data.error }); return }
      setRegAlert({ type:'success', msg:'Registro exitoso. Tu participacion en CELIDER 17 ha sido confirmada.' })
      setRegState({ distrito:'',rol:'',nombre:'',apellido:'',edad:'',telefono:'',email:'',centro:'',condicion:'',condicion_detalle:'',calificacion:0,cedula_file:'',foto_file:'' })
    } catch { setRegAlert({ type:'error', msg:'Error de conexión. Intenta nuevamente.' }) }
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
    const encabezados = ['ID','Fecha','Distrito','Rol','Nombre','Apellido','Edad','Telefono','Correo','Centro','Condicion','Detalle','Calificacion']
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
  const CATEGORIA_LABEL = { regional:'Regional', capacitacion:'Capacitacion', modelo:'Modelo ONU', torneo:'Torneo', gala:'Gala' }
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
        <link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@300;400;500;600;700&family=Exo+2:ital,wght@0,100;0,300;0,400;0,600;0,800;1,300&display=swap" rel="stylesheet" />
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
            <button className="btn btn-outline btn-sm" onClick={() => document.getElementById('admin')?.scrollIntoView({behavior:'smooth'})}>
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
            Gestion 2026 – 2027 &nbsp;·&nbsp; Plancha #1
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
              { n:'6',     l:'Objetivos Estrategicos' },
              { n:'2026',  l:'Gestion Activa' },
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
          <div className="section-tag">Objetivos estrategicos</div>
          <h2 className="section-title">Los <span>6 pilares</span> de la gestion</h2>
          <p className="section-desc">Acciones concretas orientadas a potenciar el voluntariado y transformar la Regional 17 durante 2026–2027.</p>

          <div style={styles.objetivosGrid}>
            {[
              { n:'01', t:'Ampliar la Participacion Distrital', d:'Articulacion con todos los distritos para aumentar la presencia activa de estudiantes y voluntarios en actividades regionales y nacionales.' },
              { n:'02', t:'Mejorar Procesos Formativos', d:'Instrumentos de diagnostico y retroalimentacion en talleres y capacitaciones para asegurar una formacion de mayor calidad.' },
              { n:'03', t:'Registro y Verificacion de Evidencias', d:'Mecanismo institucional para recepcion, organizacion y validacion de evidencias e informes de actividades realizadas.' },
              { n:'04', t:'Posicionar el Talento Juvenil', d:'Fomentar la participacion destacada en eventos nacionales para obtener reconocimientos que fortalezcan la imagen institucional.' },
              { n:'05', t:'Cohesion y Sentido de Pertenencia', d:'Actividades integradoras que promuevan la union, el trabajo en equipo y el compromiso de los voluntarios.' },
              { n:'06', t:'Meta Institucional: 2,500 Impactados', d:'Acciones estrategicas en los 5 distritos para alcanzar la meta establecida por el PLERD con seguimiento verificable.' },
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
          <h2 className="section-title">Quienes nos <span>representan</span></h2>
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
          <div className="section-tag">Agenda Tentativa 2026–2027</div>
          <h2 className="section-title">Calendario de <span>actividades</span></h2>
          <p className="section-desc">Eventos, capacitaciones y modelos planificados para la gestion.</p>

          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {(agenda.length ? agenda : [
              { dia:'15', mes:'Ago 2026', titulo:'Inicio Oficial de Gestion 2026–2027',    descripcion:'Acto inaugural y presentacion de la Plancha #1', categoria:'regional' },
              { dia:'20', mes:'Sep 2026', titulo:'Capacitacion Distrital — Distrito 17-01', descripcion:'Formacion en oratoria, debate y liderazgo',         categoria:'capacitacion' },
              { dia:'10', mes:'Oct 2026', titulo:'Modelo Distrital 17-03 Bayaguana',        descripcion:'Modelo Distrital de las Naciones Unidas',           categoria:'modelo' },
              { dia:'25', mes:'Nov 2026', titulo:'IV Torneo Regional de Debate',            descripcion:'Competencia de debate academico · Regional 17',     categoria:'torneo' },
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
          <p className="section-desc">Repositorio digital de manuales, guias y materiales de capacitacion para todos los comites y distritos.</p>

          <div className="file-upload-area" style={{ maxWidth:540, marginBottom:32 }}
            onClick={() => document.getElementById('biblioInput').click()}>
            <div style={{ fontSize:32, color:'var(--blue-neon)' }}>+</div>
            <p>Subir documento al repositorio — Solo administradores — PDF unicamente</p>
            <input type="file" id="biblioInput" accept=".pdf" style={{ display:'none' }}
              onChange={e => {
                const f = e.target.files[0]
                if (!f) return
                if (f.type !== 'application/pdf') { alert('Solo PDF.'); return }
                setBiblioFiles(prev => [...prev, { nombre: f.name, size: (f.size/1024).toFixed(0)+'KB' }])
                e.target.value = ''
              }} />
          </div>

          {biblioFiles.length > 0 && (
            <div style={styles.biblioGrid}>
              {biblioFiles.map((d, i) => (
                <div key={i} className="glass" style={styles.biblioDoc}>
                  <div style={styles.biblioDocIcon}>PDF</div>
                  <div style={styles.biblioDocName}>{d.nombre}</div>
                  <div style={styles.biblioDocSize}>{d.size}</div>
                </div>
              ))}
            </div>
          )}

          <h3 style={{ fontFamily:'Rajdhani,sans-serif', fontSize:'1.2rem', color:'var(--blue-glow)', marginBottom:20, marginTop:40, letterSpacing:'0.05em' }}>
            Manuales Generales por Comite
          </h3>
          <div style={styles.comitesGrid}>
            {[
              { nombre:'Asamblea General',   tipo:'Manual', desc:'Reglas de procedimiento, resoluciones y guia de delegados para la AG.' },
              { nombre:'Consejo de Seguridad', tipo:'Manual', desc:'Procedimientos del CS, veto, resoluciones vinculantes y guia de delegado.' },
              { nombre:'Comite Juridico',    tipo:'Manual', desc:'Marco legal de la ONU, resoluciones y guia de redaccion de resoluciones.' },
              { nombre:'ECOSOC',             tipo:'Manual', desc:'Desarrollo sostenible, agenda social y procedimientos del ECOSOC.' },
              { nombre:'Sec. Capacitaciones', tipo:'Guia',  desc:'Materiales didacticos, dinamicas y guia para facilitadores de talleres.' },
              { nombre:'Sec. Comunicaciones', tipo:'Guia',  desc:'Manual de identidad institucional, redes sociales y comunicado oficial.' },
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
          <h2 className="section-title">Consultar tu <span>Designacion</span></h2>
          <p className="section-desc">Ingresa tu correo o nombre completo para conocer tu rol y designacion oficial dentro de la Regional 17.</p>

          <div className="glass" style={{ maxWidth:580, margin:'0 auto', padding:'32px' }}>
            <div className="form-group">
              <label className="form-label">Correo electronico o nombre</label>
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
                    No se encontro ninguna designacion con esos datos. Verifica tu correo o contacta a tu coordinador.
                  </div>
                ) : consultaRes.map((r, i) => (
                  <div key={i} className="glass-bright" style={{ padding:'20px', marginBottom:12 }}>
                    <div style={{ fontFamily:'Rajdhani,sans-serif', color:'var(--success)', fontSize:'13px', letterSpacing:'0.1em', marginBottom:14 }}>
                      DESIGNACION ENCONTRADA
                    </div>
                    {[
                      ['Nombre',         `${r.nombre} ${r.apellido}`],
                      ['Distrito',       r.distrito],
                      ['Rol / Categoria',r.rol],
                      ['Centro Educativo',r.centro],
                      ['Fecha de registro',r.fecha],
                    ].map(([k,v]) => (
                      <div key={k} style={{ display:'flex', gap:12, marginBottom:8, fontSize:'14px' }}>
                        <span style={{ color:'var(--blue-neon)', fontWeight:600, minWidth:160, fontFamily:'Rajdhani,sans-serif', fontSize:'12px', letterSpacing:'0.08em', textTransform:'uppercase', paddingTop:2 }}>{k}</span>
                        <span style={{ color:'var(--white)' }}>{v}</span>
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
          <p className="section-desc">Completa el formulario para registrarte como delegado, tecnico o docente en la Regional 17.</p>

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
                <label className="form-label">Rol / Categoria *</label>
                <select className="form-select" value={regState.rol} onChange={e => setReg('rol', e.target.value)}>
                  <option value="">Seleccionar rol</option>
                  <option value="delegado">Delegado</option>
                  <option value="tecnico">Tecnico</option>
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
                <label className="form-label">Telefono *</label>
                <input type="tel" className="form-input" placeholder="809-000-0000" value={regState.telefono} onChange={e => setReg('telefono', e.target.value)} maxLength={20} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Correo Electronico *</label>
                <input type="email" className="form-input" placeholder="tu@correo.com" value={regState.email} onChange={e => setReg('email', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Centro Educativo *</label>
                <input type="text" className="form-input" placeholder="Nombre del centro" value={regState.centro} onChange={e => setReg('centro', e.target.value)} maxLength={200} />
              </div>
            </div>

            {/* Condicion Medica */}
            <SectionHeader title="Condicion Medica" />
            <div className="form-group">
              <label className="form-label">Presenta alguna condicion medica? *</label>
              <select className="form-select" value={regState.condicion} onChange={e => setReg('condicion', e.target.value)}>
                <option value="">Seleccionar</option>
                <option value="no">No</option>
                <option value="si">Si</option>
              </select>
              {regState.condicion === 'si' && (
                <div className="condicion-si" style={{ display:'block' }}>
                  <label className="form-label">Tipo de medicamento o enfermedad *</label>
                  <textarea className="form-textarea" rows={3}
                    placeholder="Describa la condicion, medicamentos o cuidados especiales..."
                    value={regState.condicion_detalle}
                    onChange={e => setReg('condicion_detalle', e.target.value)}
                    maxLength={500} />
                  <p className="form-hint">Esta informacion es confidencial y solo visible para administradores.</p>
                </div>
              )}
            </div>

            {/* Documentos */}
            <SectionHeader title="Documentos Requeridos" />
            <div className="form-group">
              <label className="form-label">Cedula o Acta de Nacimiento (nombre del archivo PDF) *</label>
              <input type="text" className="form-input" placeholder="Ej: cedula_juan_perez.pdf"
                value={regState.cedula_file} onChange={e => setReg('cedula_file', e.target.value)} />
              <p className="form-hint">Ingresa el nombre del archivo. Sube el archivo al bucket celider17-docs en Supabase Storage.</p>
            </div>
            <div className="form-group">
              <label className="form-label">Fotografia 2x2 (nombre del archivo PDF) *</label>
              <input type="text" className="form-input" placeholder="Ej: foto_juan_perez.pdf"
                value={regState.foto_file} onChange={e => setReg('foto_file', e.target.value)} />
              <p className="form-hint">Ingresa el nombre del archivo. Sube el archivo al bucket celider17-docs en Supabase Storage.</p>
            </div>

            {/* Calificacion */}
            <SectionHeader title="Evaluacion del Proceso" />
            <div className="form-group">
              <label className="form-label">Como calificarias el proceso de registro?</label>
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
              Tu informacion esta encriptada y protegida. Solo administradores autorizados tienen acceso a tus datos.
            </div>

            <button className="btn btn-primary btn-full" onClick={enviarRegistro} disabled={regLoading}>
              {regLoading ? <span className="spinner" /> : 'Enviar Registro'}
            </button>
          </div>
        </div>
      </section>

      {/* ── PANEL ADMIN ── */}
      {sesion && (
        <section id="admin" className="section" style={{ background:'var(--ink)' }}>
          <div className="container">

            {/* Admin Header */}
            <div style={styles.adminHeader}>
              <div>
                <div className="section-tag" style={{ marginBottom:4 }}>Panel de Administracion</div>
                <h2 style={{ fontFamily:'Rajdhani,sans-serif', fontSize:'1.8rem', color:'var(--white)' }}>
                  CELIDER 17 &nbsp;<span style={{ color:'var(--blue-neon)' }}>Dashboard</span>
                </h2>
                <div style={{ fontSize:'13px', color:'var(--silver)', marginTop:4 }}>
                  Sesion: <strong style={{ color:'var(--blue-glow)' }}>{sesion.nombre}</strong> &nbsp;·&nbsp; {sesion.rol}
                </div>
              </div>
              <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                <button className="btn btn-success btn-sm" onClick={exportarXLSX}>Exportar CSV</button>
                <button className="btn btn-outline btn-sm" onClick={fetchRegistros}>Actualizar</button>
                <button className="btn btn-danger btn-sm" onClick={cerrarSesion}>Cerrar sesion</button>
              </div>
            </div>

            {/* KPI Cards */}
            <div style={styles.kpiGrid}>
              <KpiCard label="Total Registros"     value={totalReg}       color="var(--blue-neon)" />
              <KpiCard label="Promedio Calificacion" value={avgCalif}     color="var(--cyan)" />
              <KpiCard label="Con Condicion Medica" value={conCondicion}  color="var(--warning)" />
              <KpiCard label="Distritos Activos"    value={porDistrito.filter(d=>d.n>0).length} color="var(--success)" />
            </div>

            {/* Distribucion por distrito (bar chart visual) */}
            <div className="glass" style={{ padding:'28px', marginBottom:24 }}>
              <div style={{ fontFamily:'Rajdhani,sans-serif', fontSize:'14px', letterSpacing:'0.12em', color:'var(--blue-neon)', marginBottom:20 }}>
                DISTRIBUCION POR DISTRITO
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {porDistrito.map(({ d, n }) => (
                  <div key={d} style={{ display:'flex', alignItems:'center', gap:14 }}>
                    <span style={{ fontFamily:'Rajdhani,sans-serif', fontSize:'13px', color:'var(--silver)', minWidth:50, letterSpacing:'0.05em' }}>{d}</span>
                    <div style={{ flex:1, height:10, background:'rgba(0,180,255,0.08)', borderRadius:5, overflow:'hidden' }}>
                      <div style={{
                        height:'100%',
                        width: totalReg > 0 ? `${Math.round((n/totalReg)*100)}%` : '0%',
                        background:'linear-gradient(90deg, var(--blue), var(--blue-neon))',
                        borderRadius:5,
                        boxShadow:'0 0 8px rgba(0,180,255,0.5)',
                        transition:'width 0.8s ease',
                        minWidth: n > 0 ? '6px' : '0',
                      }} />
                    </div>
                    <span style={{ fontFamily:'Rajdhani,sans-serif', fontSize:'13px', color:'var(--white)', minWidth:24 }}>{n}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Distribucion por rol */}
            <div className="glass" style={{ padding:'28px', marginBottom:24 }}>
              <div style={{ fontFamily:'Rajdhani,sans-serif', fontSize:'14px', letterSpacing:'0.12em', color:'var(--blue-neon)', marginBottom:20 }}>
                DISTRIBUCION POR ROL
              </div>
              <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
                {porRol.map(({ r, n }) => (
                  <div key={r} className="glass-bright" style={{ padding:'16px 24px', minWidth:130, textAlign:'center' }}>
                    <div style={{ fontFamily:'Rajdhani,sans-serif', fontSize:'2rem', fontWeight:700, color:'var(--blue-glow)' }}>{n}</div>
                    <div style={{ fontFamily:'Rajdhani,sans-serif', fontSize:'12px', letterSpacing:'0.1em', color:'var(--silver)', textTransform:'uppercase' }}>{r}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Filtros */}
            <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
              {['todos', ...DISTRITOS].map(d => (
                <button key={d}
                  className={`btn btn-sm ${filtroDistrito === d ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setFiltroDistrito(d)}>
                  {d === 'todos' ? 'Todos' : `Distrito ${d}`}
                </button>
              ))}
            </div>

            {/* Tabla */}
            <div className="glass" style={{ overflow:'hidden' }}>
              <div style={{ overflowX:'auto' }}>
                {adminLoading ? (
                  <div style={{ padding:'40px', textAlign:'center', color:'var(--silver)' }}>
                    <span className="spinner" style={{ width:28, height:28, borderWidth:3 }} />
                  </div>
                ) : (
                  <table style={styles.adminTable}>
                    <thead>
                      <tr>
                        {['#','Distrito','Rol','Nombre','Apellido','Edad','Telefono','Correo','Centro','Condicion Medica','Calif.'].map(h => (
                          <th key={h} style={styles.th}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {registrosFiltrados.length === 0 ? (
                        <tr>
                          <td colSpan={11} style={{ ...styles.td, textAlign:'center', color:'var(--silver)', padding:'32px' }}>
                            {sesion ? 'No hay registros para este filtro.' : 'Inicia sesion para ver los registros.'}
                          </td>
                        </tr>
                      ) : registrosFiltrados.map((r, i) => (
                        <tr key={r.id} style={styles.tr}>
                          <td style={styles.td}>{i+1}</td>
                          <td style={styles.td}><span className="badge badge-blue">{r.distrito}</span></td>
                          <td style={styles.td}><span className={`badge ${ROL_CLASS[r.rol] || 'badge-blue'}`}>{r.rol}</span></td>
                          <td style={styles.td}>{r.nombre}</td>
                          <td style={styles.td}>{r.apellido}</td>
                          <td style={styles.td}>{r.edad}</td>
                          <td style={styles.td}>{r.telefono}</td>
                          <td style={{ ...styles.td, maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.email}</td>
                          <td style={styles.td}>{r.centro}</td>
                          <td style={styles.td}>
                            {r.condicion === 'si'
                              ? <span style={{ color:'var(--warning)', fontSize:'12px' }}>Si: {(r.condicion_detalle||'').substring(0,30)}</span>
                              : <span style={{ color:'var(--success)', fontSize:'12px' }}>No</span>}
                          </td>
                          <td style={styles.td}>
                            <span style={{ color:'var(--blue-glow)', fontFamily:'Rajdhani,sans-serif' }}>
                              {'★'.repeat(r.calificacion||0)}{'☆'.repeat(5-(r.calificacion||0))}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div style={{ padding:'14px 20px', borderTop:'1px solid var(--border)', fontSize:'12px', color:'var(--silver)', fontFamily:'Rajdhani,sans-serif', letterSpacing:'0.08em' }}>
                {registrosFiltrados.length} REGISTRO(S) — Filtro: {filtroDistrito.toUpperCase()}
              </div>
            </div>

          </div>
        </section>
      )}

      {/* ── FOOTER ── */}
      <footer style={styles.footer}>
        <div style={styles.footerLogo}>CELIDER <span style={{ color:'var(--blue-neon)' }}>17</span></div>
        <p style={{ color:'var(--silver)', fontSize:'13px' }}>Club Escolar de Liderazgo · Regional 17 Monte Plata</p>
        <p style={{ color:'var(--silver)', fontSize:'13px', marginTop:6 }}>Gestion 2026–2027 · Plancha #1 · Un CELIDER que Transforma</p>
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
              <button className={`tab-btn${loginTab==='login'?' active':''}`} onClick={() => setLoginTab('login')}>Iniciar Sesion</button>
              <button className={`tab-btn${loginTab==='recuperar'?' active':''}`} onClick={() => setLoginTab('recuperar')}>Recuperar Acceso</button>
            </div>

            {loginTab === 'login' ? (
              <>
                {loginErr && <div className="alert alert-error" style={{ display:'block' }}>{loginErr}</div>}
                <div className="form-group">
                  <label className="form-label">Correo Electronico</label>
                  <input type="email" className="form-input" placeholder="tu@correo.com"
                    value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleLogin()} autoComplete="email" />
                </div>
                <div className="form-group">
                  <label className="form-label">Contrasena</label>
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
    <div style={{ fontFamily:'Rajdhani,sans-serif', fontSize:'13px', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--blue-neon)', borderBottom:'1px solid var(--border)', paddingBottom:8, marginBottom:18, marginTop:28 }}>
      {title}
    </div>
  )
}

function KpiCard({ label, value, color }) {
  return (
    <div className="glass-bright" style={{ padding:'24px', textAlign:'center' }}>
      <div style={{ fontFamily:'Rajdhani,sans-serif', fontSize:'2.8rem', fontWeight:700, color, lineHeight:1, textShadow:`0 0 20px ${color}55` }}>
        {value}
      </div>
      <div style={{ fontFamily:'Rajdhani,sans-serif', fontSize:'11px', letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--silver)', marginTop:8 }}>
        {label}
      </div>
    </div>
  )
}

// ── STYLES ──
const styles = {
  topbar: { position:'fixed', top:0, left:0, right:0, zIndex:200, background:'rgba(2,12,27,0.92)', backdropFilter:'blur(20px)', borderBottom:'1px solid rgba(0,180,255,0.12)', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 2rem', height:64 },
  logo: { display:'flex', alignItems:'center', gap:12, textDecoration:'none' },
  logoBadge: { width:38, height:38, background:'linear-gradient(135deg,var(--blue),var(--blue-neon))', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:15, color:'#fff', boxShadow:'var(--glow-sm)' },
  logoText: { fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:17, color:'var(--white)', lineHeight:1.2 },
  logoSub: { fontSize:10, color:'var(--silver)', fontWeight:300, letterSpacing:'0.05em' },
  navLinks: { display:'flex', alignItems:'center', gap:6 },
  navLink: { color:'rgba(168,196,224,0.75)', textDecoration:'none', fontFamily:'Rajdhani,sans-serif', fontSize:'14px', fontWeight:500, padding:'6px 12px', borderRadius:6, transition:'all .2s', letterSpacing:'0.05em', textTransform:'uppercase' },

  hero: { minHeight:'100vh', background:'linear-gradient(160deg, var(--ink) 0%, var(--ink-2) 40%, var(--ink-3) 100%)', display:'flex', alignItems:'center', justifyContent:'center', textAlign:'center', padding:'100px 2rem 60px', position:'relative', overflow:'hidden' },
  canvas: { position:'absolute', inset:0, pointerEvents:'none' },
  heroContent: { position:'relative', zIndex:2, maxWidth:800 },
  heroOrb1: { position:'absolute', top:'-20%', left:'-10%', width:500, height:500, background:'radial-gradient(circle, rgba(13,110,253,0.15) 0%, transparent 70%)', borderRadius:'50%', pointerEvents:'none' },
  heroOrb2: { position:'absolute', bottom:'-10%', right:'-5%', width:400, height:400, background:'radial-gradient(circle, rgba(0,212,255,0.1) 0%, transparent 70%)', borderRadius:'50%', pointerEvents:'none' },
  heroBadge: { display:'inline-flex', alignItems:'center', gap:8, background:'rgba(0,180,255,0.1)', border:'1px solid rgba(0,180,255,0.25)', borderRadius:50, padding:'6px 18px', fontSize:11, fontFamily:'Rajdhani,sans-serif', fontWeight:600, letterSpacing:'0.15em', textTransform:'uppercase', color:'var(--blue-neon)', marginBottom:24 },
  heroBadgeDot: { width:6, height:6, background:'var(--blue-neon)', borderRadius:'50%', boxShadow:'0 0 8px var(--blue-neon)', animation:'pulse 2s infinite' },
  heroTitle: { fontFamily:'Rajdhani,sans-serif', fontSize:'clamp(3rem,8vw,6rem)', fontWeight:700, color:'var(--white)', letterSpacing:'0.04em', lineHeight:1.0, marginBottom:20, textShadow:'0 0 60px rgba(0,180,255,0.2)' },
  heroTitleAccent: { color:'var(--blue-glow)', textShadow:'0 0 40px rgba(0,212,255,0.5)' },
  heroDesc: { fontSize:'1.05rem', color:'var(--silver)', fontWeight:300, marginBottom:40, lineHeight:1.7 },
  heroBtns: { display:'flex', gap:14, justifyContent:'center', flexWrap:'wrap', marginBottom:60 },
  heroStats: { display:'flex', gap:48, justifyContent:'center', borderTop:'1px solid rgba(0,180,255,0.1)', paddingTop:32, flexWrap:'wrap' },
  stat: { textAlign:'center' },
  statN: { fontFamily:'Rajdhani,sans-serif', fontSize:'2.2rem', fontWeight:700, color:'var(--blue-glow)', textShadow:'0 0 20px rgba(0,212,255,0.4)' },
  statL: { fontSize:'11px', color:'var(--silver)', textTransform:'uppercase', letterSpacing:'0.1em', marginTop:4 },
  heroLine1: { position:'absolute', left:0, top:'50%', width:'100%', height:1, background:'linear-gradient(90deg,transparent,rgba(0,180,255,0.15),transparent)', pointerEvents:'none' },
  heroLine2: { position:'absolute', top:0, left:'30%', width:1, height:'100%', background:'linear-gradient(180deg,transparent,rgba(0,180,255,0.08),transparent)', pointerEvents:'none' },

  objetivosGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:20 },
  objetivoCard: { padding:'28px', position:'relative', overflow:'hidden', transition:'all .25s', cursor:'default' },
  objetivoNum: { fontFamily:'Rajdhani,sans-serif', fontSize:'2.5rem', fontWeight:700, color:'var(--blue-dim)', marginBottom:10, lineHeight:1 },
  objetivoTitle: { fontFamily:'Rajdhani,sans-serif', fontSize:'1.1rem', fontWeight:700, color:'var(--white)', marginBottom:10, letterSpacing:'0.02em' },
  objetivoDesc: { fontSize:'0.88rem', color:'var(--silver)', lineHeight:1.7, fontWeight:300 },
  objetivoBar: { position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg,var(--blue),var(--blue-neon))', boxShadow:'0 0 10px rgba(0,180,255,0.5)' },

  planchaGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:20 },
  miembroCard: { overflow:'hidden', transition:'all .25s' },
  miembroImgWrap: { height:180, background:'linear-gradient(160deg,var(--ink-3),var(--blue-dim))', position:'relative', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:8 },
  miembroImgPh: { display:'flex', flexDirection:'column', alignItems:'center', gap:8 },
  miembroInitials: { width:72, height:72, background:'rgba(0,180,255,0.15)', border:'1px solid rgba(0,180,255,0.3)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Rajdhani,sans-serif', fontSize:'1.6rem', fontWeight:700, color:'var(--blue-neon)', letterSpacing:'0.05em' },
  miembroImgLabel: { fontSize:'10px', color:'rgba(168,196,224,0.45)', letterSpacing:'0.05em', textAlign:'center' },
  miembroImgGlow: { position:'absolute', inset:0, background:'linear-gradient(to bottom, transparent 60%, rgba(2,12,27,0.9))', pointerEvents:'none' },
  miembroBody: { padding:'18px 16px' },
  miembroNombre: { fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:'1.05rem', color:'var(--white)', marginBottom:4 },
  miembroCargo: { fontFamily:'Rajdhani,sans-serif', fontSize:'11px', color:'var(--blue-neon)', textTransform:'uppercase', letterSpacing:'0.1em', fontWeight:600, marginBottom:10 },
  miembroTray: { fontSize:'11px', color:'var(--silver)', fontWeight:300 },

  agendaItem: { display:'flex', alignItems:'center', gap:20, padding:'20px 24px', transition:'all .2s' },
  agendaFecha: { minWidth:68, textAlign:'center', padding:'8px 10px', background:'rgba(0,180,255,0.1)', border:'1px solid rgba(0,180,255,0.2)', borderRadius:8 },
  agendaDia: { fontFamily:'Rajdhani,sans-serif', fontSize:'1.6rem', fontWeight:700, color:'var(--blue-glow)', lineHeight:1 },
  agendaMes: { fontSize:'10px', textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--silver)' },
  agendaInfo: { flex:1 },
  agendaTitulo: { fontFamily:'Rajdhani,sans-serif', fontSize:'1rem', fontWeight:600, color:'var(--white)', marginBottom:4, letterSpacing:'0.02em' },
  agendaDesc: { fontSize:'12px', color:'var(--silver)', fontWeight:300 },

  biblioGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:14, marginTop:20 },
  biblioDoc: { padding:'18px 14px', textAlign:'center', transition:'all .2s' },
  biblioDocIcon: { fontFamily:'Rajdhani,sans-serif', fontSize:'13px', fontWeight:700, color:'var(--danger)', letterSpacing:'0.1em', marginBottom:10, padding:'6px 10px', border:'1px solid rgba(255,59,92,0.3)', borderRadius:4, display:'inline-block' },
  biblioDocName: { fontSize:'12px', color:'var(--white)', wordBreak:'break-word', fontWeight:500, marginBottom:4 },
  biblioDocSize: { fontSize:'11px', color:'var(--silver)' },
  comitesGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:14 },
  comiteCard: { padding:'18px 20px', transition:'all .2s' },
  comiteCardHeader: { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10, gap:8 },
  comiteNombre: { fontFamily:'Rajdhani,sans-serif', fontSize:'0.95rem', fontWeight:700, color:'var(--white)' },
  comiteDesc: { fontSize:'12px', color:'var(--silver)', fontWeight:300, lineHeight:1.6 },

  adminHeader: { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:28, flexWrap:'wrap', gap:16 },
  kpiGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:16, marginBottom:24 },

  adminTable: { width:'100%', borderCollapse:'collapse', fontSize:'13px' },
  th: { background:'rgba(0,20,50,0.9)', color:'var(--blue-neon)', padding:'12px 14px', textAlign:'left', fontFamily:'Rajdhani,sans-serif', fontSize:'11px', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', whiteSpace:'nowrap', borderBottom:'1px solid var(--border)' },
  td: { padding:'11px 14px', color:'var(--silver)', borderBottom:'1px solid rgba(0,180,255,0.06)', verticalAlign:'middle', fontSize:'13px' },
  tr: { transition:'background .15s', cursor:'default' },

  footer: { background:'var(--ink-2)', borderTop:'1px solid var(--border)', padding:'48px 2rem', textAlign:'center' },
  footerLogo: { fontFamily:'Rajdhani,sans-serif', fontWeight:700, fontSize:'1.8rem', color:'var(--white)', marginBottom:10 },
}
