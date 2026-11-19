"use strict";
/* ============================================================
   views-staff.js — avalúos (valuador/analista) y administración
   ============================================================ */

/* ---------- Lista de avalúos ---------- */
route("/avaluos", async () => {
  const f = App.current.query;
  const u = getUser();
  const r = await api("/avaluos", { query: { estado: f.estado, page: f.page || 1, limit: 10 } });
  const lista = r.ok ? unwrapList(r.data) : [];
  const html = `
    <div class="container">
      <h1>${u.rol === "valuador" ? "Mis avalúos asignados" : "Avalúos"}</h1>
      <form class="toolbar" id="filtros">
        ${selectHtml("Estado", "estado", [["", "Todos"], ["solicitado", "Solicitado"], ["completado", "Completado"]], f.estado || "")}
        <button class="btn primary">Filtrar</button><button type="button" class="btn ghost" id="limpiar">Limpiar</button>
      </form>
      ${r.ok ? `<div class="table-wrap"><table class="table clicky"><thead><tr><th>Folio</th><th>Solicitud</th><th>Valuador</th><th>Estado</th><th class="r">Valor comercial</th><th>Conservación</th><th>Visita</th></tr></thead><tbody>
        ${lista.map((a) => `<tr data-href="#/avaluo/${a.id}"><td><a href="#/avaluo/${a.id}">${esc(a.folio)}</a></td><td><a href="#/solicitud/${a.solicitudId}">#${a.solicitudId}</a></td><td>${esc(a.valuadorNombre)}</td>
          <td><span class="badge ${a.estado === "completado" ? "green" : "blue"}">${esc(a.estado)}</span></td><td class="r">${money(a.valorComercial)}</td><td>${esc(a.estadoConservacion || "—")}</td><td>${fday(a.fechaVisita)}</td></tr>`).join("") || '<tr><td colspan="7" class="muted center">No hay avalúos.</td></tr>'}
      </tbody></table></div>${pagerHtml(r.meta)}` : errorBox(r.error)}
    </div>`;
  return page(html, (root) => {
    const go = (extra) => {
      const d = readForm(root.querySelector("#filtros"));
      const p = new URLSearchParams();
      Object.entries({ ...d, ...extra }).forEach(([k, v]) => v && p.set(k, v));
      location.hash = "#/avaluos" + (p.toString() ? "?" + p : "");
    };
    root.querySelector("#filtros").onsubmit = (e) => { e.preventDefault(); go({ page: 1 }); };
    root.querySelector("#limpiar").onclick = () => (location.hash = "#/avaluos");
    bindPager(root, (p) => go({ page: p }));
    bindRowLinks(root);
  });
}, { auth: true, roles: ["valuador", "analista", "admin"] });

/* ---------- Detalle de avalúo ---------- */
route("/avaluo/:id", async ({ params }) => {
  const r = await api(`/avaluos/${params.id}`);
  if (!r.ok) return page(`<div class="container narrow">${errorBox(r.error)}<p><a href="#/avaluos">← Avalúos</a></p></div>`);
  const a = r.data;
  const u = getUser();
  const puedeAjustar = u.rol === "valuador" || u.rol === "admin";
  return page(`
    <div class="container narrow">
      <p><a href="#/avaluos">← Avalúos</a></p>
      <h1>${esc(a.folio)}</h1>
      <div class="card">
        ${kv([["Estado", `<span class="badge ${a.estado === "completado" ? "green" : "blue"}">${esc(a.estado)}</span>`], ["Solicitud", `<a href="#/solicitud/${a.solicitudId}">Ver solicitud #${a.solicitudId}</a>`], ["Valuador", esc(a.valuadorNombre)],
          ["Solicitado", fdate(a.fechaSolicitud)], ["Visita", fdate(a.fechaVisita)], ["Valor comercial", `<b>${money(a.valorComercial)}</b>`], ["Conservación", esc(a.estadoConservacion)], ["Generado automáticamente", a.generadoAutomaticamente ? "Sí" : "No"]])}
        <p class="muted">${esc(a.observaciones)}</p>
      </div>
      ${puedeAjustar ? `<form class="card" id="formAjuste" novalidate>
        <h3>Ajustar resultado del avalúo</h3>
        <p class="muted">Solo es posible mientras la solicitud no haya pasado a análisis.</p>
        ${fieldHtml("Valor comercial (MXN)", "valorComercial", { type: "number", num: true, value: a.valorComercial ?? "", attrs: 'min="1" step="any" required' })}
        ${selectHtml("Estado de conservación", "estadoConservacion", [["excelente", "Excelente"], ["bueno", "Bueno"], ["regular", "Regular"], ["malo", "Malo"]], a.estadoConservacion || "bueno")}
        <label class="field"><span>Observaciones</span><textarea name="observaciones" rows="3" required>${esc(a.observaciones)}</textarea></label>
        <p class="form-error" role="alert"></p><button class="btn primary">Guardar resultado</button>
      </form>` : ""}
    </div>`, (root) => {
    const f = root.querySelector("#formAjuste");
    if (f) f.onsubmit = async (e) => {
      e.preventDefault();
      const body = readForm(f);
      await submitForm(f, () => api(`/avaluos/${a.id}/resultado`, { method: "PATCH", body }), () => { toast("Avalúo actualizado"); reload(); });
    };
  });
}, { auth: true, roles: ["valuador", "analista", "admin", "cliente"] });

/* ---------- Estadísticas ---------- */
function barrasPorEstado(obj, labels = {}) {
  const entries = Object.entries(obj || {});
  const max = Math.max(1, ...entries.map(([, v]) => Number(v) || 0));
  const colors = {
    borrador: "#68777a", datos_completos: "#4f78a5", en_avaluo: "#4f78a5",
    avaluo_completado: "#4f78a5", en_analisis: "#c0872d", aprobada: "#26734d",
    condicionada: "#c0872d", rechazada: "#ad4141", oferta_aceptada: "#26734d",
    oferta_rechazada: "#68777a", formalizada: "#26734d", cancelada: "#68777a",
  };
  if (!entries.length) return emptyState("Todavía no hay solicitudes para mostrar.");
  return `<ul class="status-bars">${entries.map(([key, value]) => {
    const n = Math.max(0, Number(value) || 0);
    const width = Math.min(100, n / max * 100);
    return `<li><div class="status-label"><span>${esc(labels[key] || key)}</span><b>${esc(num(n))}</b></div><div class="status-track"><i style="width:${width}%;--status-color:${colors[key] || "#4f78a5"}"></i></div></li>`;
  }).join("")}</ul>`;
}
route("/admin", async () => {
  const r = await api("/admin/estadisticas");
  if (!r.ok) return page(`<div class="container">${errorBox(r.error)}</div>`);
  const d = r.data;
  const estLabels = Object.fromEntries(Object.entries(ESTADOS).map(([k, v]) => [k, v[0]]));
  return page(`
    <div class="container">
      <h1>Estadísticas</h1>
      <div class="stats">
        ${stat("Solicitudes", num(d.totalSolicitudes))}${stat("Monto total aprobado", money(d.montoTotalAprobado))}
        ${stat("Tasa de aprobación", num(d.tasaAprobacionPct, 1) + "%", `${d.solicitudesFavorables} de ${d.solicitudesResueltas} resueltas`)}${stat("Cuentas", num(d.totalCuentas))}
      </div>
      <div class="grid cols-2">
        <section class="card"><h3><svg class="heading-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V5m0 14h17M8 16v-5m5 5V7m5 9V3"/></svg>Solicitudes por estado</h3>${barrasPorEstado(d.solicitudesPorEstado, estLabels)}</section>
        <div>
          <section class="card"><h3><svg class="heading-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3v9h9"/></svg>Solicitudes por tipo</h3>${donutChart(Object.entries(d.solicitudesPorTipo || {}).map(([key, value]) => ({ label: TIPO_LABEL[key] || key, value })), { title: "Solicitudes por tipo" })}</section>
          <section class="card"><h3><svg class="heading-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2m1-15a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v2"/></svg>Usuarios por rol</h3>${donutChart(Object.entries(d.usuariosPorRol || {}).map(([key, value]) => ({ label: ROL_LABEL[key] || key, value })), { title: "Usuarios por rol" })}</section>
        </div>
      </div>
    </div>`);
}, { auth: true, roles: ["admin"] });

/* ---------- Usuarios ---------- */
route("/admin/usuarios", async () => {
  const f = App.current.query;
  const me = getUser();
  const r = await api("/admin/usuarios", { query: { rol: f.rol, activo: f.activo, busqueda: f.busqueda, page: f.page || 1, limit: 10 } });
  const lista = r.ok ? unwrapList(r.data) : [];
  return page(`
    <div class="container">
      <div class="section-head"><h1>Usuarios</h1><button class="btn primary" id="btnNuevo">Crear personal</button></div>
      <form class="toolbar" id="filtros">
        ${fieldHtml("Buscar", "busqueda", { value: f.busqueda || "", attrs: 'minlength="2" maxlength="80" placeholder="Nombre o correo"' })}
        ${selectHtml("Rol", "rol", [["", "Todos"], ...Object.entries(ROL_LABEL)], f.rol || "")}
        ${selectHtml("Estado", "activo", [["", "Todos"], ["true", "Activos"], ["false", "Inactivos"]], f.activo || "")}
        <button class="btn primary">Filtrar</button><button type="button" class="btn ghost" id="limpiar">Limpiar</button>
      </form>
      ${r.ok ? `<div class="table-wrap"><table class="table"><thead><tr><th>Código</th><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th></th></tr></thead><tbody>
        ${lista.map((x) => `<tr><td>${esc(x.codigo)}</td><td>${esc(x.nombre + " " + x.apellidos)}</td><td>${esc(x.email)}</td><td>${esc(ROL_LABEL[x.rol] || x.rol)}</td>
          <td><span class="badge ${x.activo ? "green" : "gray"}">${x.activo ? "Activo" : "Inactivo"}</span></td>
          <td>${x.id === me.id ? '<span class="muted">(tú)</span>' : `<button class="btn sm ${x.activo ? "danger" : ""}" data-toggle="${x.id}" data-activo="${x.activo}">${x.activo ? "Desactivar" : "Activar"}</button>`}</td></tr>`).join("") || '<tr><td colspan="6" class="muted center">Sin resultados.</td></tr>'}
      </tbody></table></div>${pagerHtml(r.meta)}` : errorBox(r.error)}
    </div>`, (root) => {
    const go = (extra) => {
      const d = readForm(root.querySelector("#filtros"));
      const p = new URLSearchParams();
      Object.entries({ ...d, ...extra }).forEach(([k, v]) => v && p.set(k, v));
      location.hash = "#/admin/usuarios" + (p.toString() ? "?" + p : "");
    };
    root.querySelector("#filtros").onsubmit = (e) => { e.preventDefault(); go({ page: 1 }); };
    root.querySelector("#limpiar").onclick = () => (location.hash = "#/admin/usuarios");
    bindPager(root, (p) => go({ page: p }));
    root.querySelectorAll("[data-toggle]").forEach((b) => (b.onclick = async () => {
      const activar = b.dataset.activo !== "true";
      if (!activar && !confirm("¿Desactivar a este usuario? No podrá iniciar sesión.")) return;
      b.disabled = true;
      const res = await api(`/admin/usuarios/${b.dataset.toggle}/estado`, { method: "PATCH", body: { activo: activar } });
      if (!res.ok) { b.disabled = false; return toast(res.error.message, "error"); }
      toast(activar ? "Usuario activado" : "Usuario desactivado"); reload();
    }));
    root.querySelector("#btnNuevo").onclick = () => openDialog("Crear personal interno", `
      <form novalidate>
        <div class="form-grid">${fieldHtml("Nombre", "nombre", { attrs: "required" })}${fieldHtml("Apellidos", "apellidos", { attrs: "required" })}</div>
        ${fieldHtml("Correo", "email", { type: "email", attrs: "required", hint: "Ejemplo: nombre@demo-banco.test" })}
        ${fieldHtml("Teléfono (opcional)", "telefono", { type: "tel" })}
        ${fieldHtml("Contraseña", "password", { type: "password", attrs: 'required minlength="8"', hint: "8+ caracteres, una mayúscula y un número" })}
        ${selectHtml("Rol", "rol", [["valuador", "Valuador"], ["analista", "Analista"], ["admin", "Administrador"]], "analista")}
        <p class="form-error" role="alert"></p><div class="actions"><button class="btn primary">Crear usuario</button></div>
      </form>`, (dlg) => {
      const f = dlg.querySelector("form");
      f.onsubmit = async (e) => {
        e.preventDefault();
        await submitForm(f, () => api("/admin/usuarios", { method: "POST", body: readForm(f) }), () => { dlg.close(); toast("Usuario creado"); reload(); });
      };
    });
  });
}, { auth: true, roles: ["admin"] });

/* ---------- Productos ---------- */
function productoForm(p) {
  const docs = Object.keys(DOC_LABEL);
  p = p || { tipo: "prestamo", activo: true, plazosMeses: [12, 24, 36], documentosRequeridos: ["identificacion", "comprobante_domicilio", "comprobante_ingresos"], requisitos: [] };
  return `<form novalidate>
    ${fieldHtml("Nombre", "nombre", { value: p.nombre || "", attrs: "required" })}
    <div class="form-grid">
      ${selectHtml("Tipo", "tipo", [["prestamo", "Crédito personal"], ["hipoteca", "Hipoteca"]], p.tipo)}
      ${fieldHtml("Tasa anual (%)", "tasaAnual", { type: "number", num: true, value: p.tasaAnual ?? "", attrs: 'min="0" max="100" step="0.01" required' })}
      ${fieldHtml("Monto mínimo", "montoMin", { type: "number", num: true, value: p.montoMin ?? "", attrs: 'min="1" step="any" required' })}
      ${fieldHtml("Monto máximo", "montoMax", { type: "number", num: true, value: p.montoMax ?? "", attrs: 'min="1" step="any" required' })}
      ${fieldHtml("Plazos (meses, separados por coma)", "plazosMeses", { value: (p.plazosMeses || []).join(", "), attrs: "required" })}
      ${fieldHtml("Enganche mínimo % (solo hipoteca)", "engancheMinPct", { type: "number", num: true, value: p.engancheMinPct ?? "", attrs: 'min="0" max="100" step="0.01"' })}
    </div>
    <label class="field"><span>Descripción</span><textarea name="descripcion" rows="2" required>${esc(p.descripcion || "")}</textarea></label>
    <fieldset class="checkgrid"><legend>Documentos requeridos</legend>
      ${docs.map((d) => `<label><input type="checkbox" name="doc_${d}" ${(p.documentosRequeridos || []).includes(d) ? "checked" : ""}> ${esc(DOC_LABEL[d])}</label>`).join("")}
    </fieldset>
    <label class="field"><span>Requisitos (uno por línea)</span><textarea name="requisitos" rows="3">${esc((p.requisitos || []).join("\n"))}</textarea></label>
    <label class="field"><span>Condiciones</span><textarea name="condiciones" rows="2" required>${esc(p.condiciones || "")}</textarea></label>
    <label class="check"><input type="checkbox" name="activo" ${p.activo ? "checked" : ""}> Producto activo</label>
    <p class="form-error" role="alert"></p>
    <div class="actions"><button class="btn primary">Guardar producto</button></div>
  </form>`;
}
function productoBody(f) {
  const d = readForm(f);
  const body = {
    nombre: d.nombre, tipo: d.tipo, descripcion: d.descripcion, tasaAnual: d.tasaAnual, montoMin: d.montoMin, montoMax: d.montoMax,
    plazosMeses: (d.plazosMeses || "").split(",").map((x) => Number(x.trim())).filter((x) => x > 0),
    documentosRequeridos: Object.keys(DOC_LABEL).filter((k) => d["doc_" + k]),
    requisitos: (d.requisitos || "").split("\n").map((x) => x.trim()).filter(Boolean),
    condiciones: d.condiciones, activo: !!d.activo,
  };
  if (d.tipo === "hipoteca") body.engancheMinPct = d.engancheMinPct;
  return body;
}
route("/admin/productos", async () => {
  const [a, i] = await Promise.all([api("/productos"), api("/productos", { query: { activo: "false" } })]);
  if (!a.ok) return page(`<div class="container">${errorBox(a.error)}</div>`);
  const mapa = new Map();
  [...unwrapList(a.data), ...(i.ok ? unwrapList(i.data) : [])].forEach((p) => mapa.set(p.id, p));
  const lista = [...mapa.values()].sort((x, y) => x.id - y.id);
  return page(`
    <div class="container">
      <div class="section-head"><h1>Productos</h1><button class="btn primary" id="btnNuevo">Nuevo producto</button></div>
      <div class="table-wrap"><table class="table"><thead><tr><th>#</th><th>Nombre</th><th>Tipo</th><th>Tasa</th><th>Monto</th><th>Plazos</th><th>Estado</th><th></th></tr></thead><tbody>
      ${lista.map((p) => `<tr><td>${p.id}</td><td>${esc(p.nombre)}</td><td>${TIPO_LABEL[p.tipo]}</td><td>${num(p.tasaAnual, 2)}%</td><td>${money(p.montoMin)} – ${money(p.montoMax)}</td><td>${(p.plazosMeses || []).join(", ")}</td>
        <td><span class="badge ${p.activo ? "green" : "gray"}">${p.activo ? "Activo" : "Inactivo"}</span></td>
        <td class="acciones-cell"><button class="btn sm" data-edit="${p.id}">Editar</button>${p.activo ? `<button class="btn sm danger" data-del="${p.id}">Desactivar</button>` : ""}</td></tr>`).join("")}
      </tbody></table></div>
    </div>`, (root) => {
    const abrir = (p) => openDialog(p?.id ? "Editar producto" : "Nuevo producto", productoForm(p), (dlg) => {
      const f = dlg.querySelector("form");
      f.onsubmit = async (e) => {
        e.preventDefault();
        const body = productoBody(f);
        const call = p?.id ? () => api(`/productos/${p.id}`, { method: "PUT", body }) : () => api("/productos", { method: "POST", body });
        await submitForm(f, call, () => { dlg.close(); toast("Producto guardado"); reload(); });
      };
    });
    root.querySelector("#btnNuevo").onclick = () => abrir(null);
    root.querySelectorAll("[data-edit]").forEach((b) => (b.onclick = () => abrir(mapa.get(Number(b.dataset.edit)))));
    root.querySelectorAll("[data-del]").forEach((b) => (b.onclick = async () => {
      if (!confirm("¿Desactivar este producto? Dejará de ofrecerse.")) return;
      const r = await api(`/productos/${b.dataset.del}`, { method: "DELETE" });
      if (!r.ok) return toast(r.error.message, "error");
      toast("Producto desactivado"); reload();
    }));
  });
}, { auth: true, roles: ["admin"] });
