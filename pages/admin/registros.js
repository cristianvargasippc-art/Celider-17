import Head from "next/head";
import { useEffect, useMemo, useState } from "react";

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const DISTRITOS = ["todos", "17-01", "17-02", "17-03", "17-04", "17-05"];

export default function AdminRegistros() {
  const [session, setSession] = useState(null);
  const [tab, setTab] = useState("registros");
  const [registros, setRegistros] = useState([]);
  const [biblioteca, setBiblioteca] = useState([]);
  const [filtroDistrito, setFiltroDistrito] = useState("todos");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);
  const [form, setForm] = useState({
    titulo: "",
    descripcion: "",
    categoria: "Manual",
    file: null,
    visible: true
  });

  useEffect(() => {
    init();
  }, []);

  async function init() {
    setLoading(true);
    setError("");
    try {
      const me = await fetch("/api/me");
      const meData = await me.json();
      if (!me.ok) throw new Error("Inicia sesión para entrar al panel.");
      setSession(meData);
      await Promise.all([loadRegistros(), loadBiblioteca()]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadRegistros() {
    const res = await fetch("/api/admin/registros");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "No se pudieron cargar los registros.");
    setRegistros(data.data || []);
  }

  async function loadBiblioteca() {
    const res = await fetch("/api/admin/biblioteca");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "No se pudo cargar la biblioteca.");
    setBiblioteca(data.data || []);
  }

  async function publicarDocumento(event) {
    event.preventDefault();
    if (!form.titulo || !form.file) {
      setError("Ingresa un título y selecciona un PDF.");
      return;
    }
    if (form.file.size > 25 * 1024 * 1024) {
      setError("El PDF no puede pesar mas de 25 MB.");
      return;
    }

    setUploading(true);
    setError("");
    try {
      const fileBase64 = await fileToBase64(form.file);
      const res = await fetch("/api/admin/biblioteca", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: form.titulo,
          descripcion: form.descripcion,
          categoria: form.categoria,
          visible: form.visible,
          fileName: form.file.name,
          fileBase64
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo publicar el documento.");
      setForm({ titulo: "", descripcion: "", categoria: "Manual", file: null, visible: true });
      await loadBiblioteca();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function toggleVisible(doc) {
    setError("");
    const res = await fetch("/api/admin/biblioteca", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: doc.id, visible: !doc.visible })
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "No se pudo actualizar el documento.");
      return;
    }
    await loadBiblioteca();
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/";
  }

  const registrosFiltrados = useMemo(() => {
    if (filtroDistrito === "todos") return registros;
    return registros.filter((registro) => registro.distrito === filtroDistrito);
  }, [registros, filtroDistrito]);

  const stats = useMemo(() => {
    const conDocs = registros.filter((r) => r.cedula_file && r.foto_file).length;
    return {
      total: registros.length,
      conDocs,
      biblioteca: biblioteca.length,
      pendientes: registros.length - conDocs
    };
  }, [registros, biblioteca]);

  return (
    <>
      <Head>
        <title>Panel Admin CELIDER 17</title>
      </Head>
      <main className="admin-shell">
        <aside className="admin-sidebar">
          <div>
            <div className="admin-brand">CELIDER <span>17</span></div>
            <p className="admin-muted">Panel de administración</p>
          </div>
          <nav className="admin-nav">
            <button className={tab === "registros" ? "active" : ""} onClick={() => setTab("registros")}>Registros</button>
            <button className={tab === "biblioteca" ? "active" : ""} onClick={() => setTab("biblioteca")}>Biblioteca</button>
          </nav>
          <div className="admin-sidebar-foot">
            <p>{session?.email || "Sesión"}</p>
            <button className="btn btn-ghost btn-full" onClick={logout}>Salir</button>
          </div>
        </aside>

        <section className="admin-main">
          <header className="admin-topbar">
            <div>
              <div className="section-tag">Administrador</div>
              <h1>{tab === "registros" ? "Registros y documentos" : "Biblioteca pública"}</h1>
            </div>
            <a className="btn btn-outline" href="/">Ver home</a>
          </header>

          {error ? <div className="alert alert-error">{error}</div> : null}
          {loading ? (
            <div className="admin-empty"><span className="spinner" /> Cargando panel...</div>
          ) : tab === "registros" ? (
            <>
              <div className="admin-stats">
                <Stat label="Registros" value={stats.total} />
                <Stat label="Con PDFs" value={stats.conDocs} />
                <Stat label="Pendientes" value={stats.pendientes} />
                <Stat label="Biblioteca" value={stats.biblioteca} />
              </div>

              <div className="admin-toolbar">
                <div className="admin-filters">
                  {DISTRITOS.map((d) => (
                    <button key={d} className={`btn btn-sm ${filtroDistrito === d ? "btn-primary" : "btn-ghost"}`} onClick={() => setFiltroDistrito(d)}>
                      {d === "todos" ? "Todos" : d}
                    </button>
                  ))}
                </div>
                <button className="btn btn-outline" onClick={loadRegistros}>Actualizar</button>
              </div>

              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      {["Participante", "Distrito", "Rol", "Contacto", "Centro", "Documentos", "Condición"].map((head) => (
                        <th key={head}>{head}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {registrosFiltrados.map((registro) => (
                      <tr key={registro.id}>
                        <td>
                          <strong>{registro.nombre} {registro.apellido}</strong>
                          <span>{registro.fecha}</span>
                        </td>
                        <td><span className="badge badge-blue">{registro.distrito}</span></td>
                        <td><span className="badge badge-cyan">{registro.rol}</span></td>
                        <td>
                          <span>{registro.email}</span>
                          <span>{registro.telefono}</span>
                        </td>
                        <td>{registro.centro}</td>
                        <td>
                          <div className="admin-doc-actions">
                            {registro.cedula_url ? <button className="btn btn-sm btn-outline" type="button" onClick={() => setPreview({ title: `Cedula - ${registro.nombre} ${registro.apellido}`, url: registro.cedula_url, path: registro.cedula_file })}>Cedula</button> : <span className="admin-muted">Sin cedula</span>}
                            {registro.foto_url ? <button className="btn btn-sm btn-outline" type="button" onClick={() => setPreview({ title: `Foto 2x2 - ${registro.nombre} ${registro.apellido}`, url: registro.foto_url, path: registro.foto_file })}>Foto 2x2</button> : <span className="admin-muted">Sin foto</span>}
                          </div>
                        </td>
                        <td>{registro.condicion === "si" ? registro.condicion_detalle || "Si" : "No"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!registrosFiltrados.length ? <div className="admin-empty">No hay registros para este filtro.</div> : null}
              </div>
            </>
          ) : (
            <div className="admin-grid">
              <form className="admin-form glass" onSubmit={publicarDocumento}>
                <h2>Publicar PDF</h2>
                <label className="form-label">Título</label>
                <input className="form-input" value={form.titulo} onChange={(e) => setForm((s) => ({ ...s, titulo: e.target.value }))} />
                <label className="form-label">Categoría</label>
                <input className="form-input" value={form.categoria} onChange={(e) => setForm((s) => ({ ...s, categoria: e.target.value }))} />
                <label className="form-label">Descripción</label>
                <textarea className="form-textarea" value={form.descripcion} onChange={(e) => setForm((s) => ({ ...s, descripcion: e.target.value }))} />
                <label className="form-label">Archivo PDF</label>
                <input className="form-input" type="file" onChange={(e) => setForm((s) => ({ ...s, file: e.target.files?.[0] || null }))} />
                <p className="admin-muted">{form.file ? form.file.name : "Puedes subir un PDF con cualquier nombre."}</p>
                <label className="admin-check">
                  <input type="checkbox" checked={form.visible} onChange={(e) => setForm((s) => ({ ...s, visible: e.target.checked }))} />
                  Visible en el home
                </label>
                <button className="btn btn-primary btn-full" disabled={uploading}>{uploading ? <span className="spinner" /> : "Publicar"}</button>
              </form>

              <div className="admin-library-list">
                {biblioteca.map((doc) => (
                  <article className="glass admin-doc-card" key={doc.id}>
                    <div>
                      <span className="badge badge-cyan">{doc.categoria || "PDF"}</span>
                      <h3>{doc.titulo}</h3>
                      <p>{doc.descripcion || doc.file_name}</p>
                    </div>
                    <div className="admin-doc-actions">
                      {doc.url ? <button className="btn btn-sm btn-outline" type="button" onClick={() => setPreview({ title: doc.titulo || doc.file_name || "PDF", url: doc.url, path: doc.file_path })}>Ver PDF</button> : null}
                      <button className={`btn btn-sm ${doc.visible ? "btn-success" : "btn-ghost"}`} onClick={() => toggleVisible(doc)}>
                        {doc.visible ? "Visible" : "Oculto"}
                      </button>
                    </div>
                  </article>
                ))}
                {!biblioteca.length ? <div className="admin-empty">Todavía no hay documentos publicados.</div> : null}
              </div>
            </div>
          )}
        </section>
      </main>
      {preview ? (
        <div className="pdf-preview-overlay" onClick={(event) => event.target === event.currentTarget && setPreview(null)}>
          <div className="pdf-preview-panel">
            <header className="pdf-preview-header">
              <div>
                <strong>{preview.title}</strong>
                <span>{preview.path}</span>
              </div>
              <div className="admin-doc-actions">
                <a className="btn btn-sm btn-outline" href={preview.url} target="_blank" rel="noreferrer">Abrir aparte</a>
                <button className="btn btn-sm btn-ghost" type="button" onClick={() => setPreview(null)}>Cerrar</button>
              </div>
            </header>
            <iframe className="pdf-preview-frame" src={preview.url} title={preview.title} />
          </div>
        </div>
      ) : null}
    </>
  );
}

function Stat({ label, value }) {
  return (
    <div className="glass admin-stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
