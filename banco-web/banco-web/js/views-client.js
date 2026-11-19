"use strict";
/* ============================================================
   views-client.js — banca, cuentas, solicitudes, trámite, perfil
   ============================================================ */

/* ---------- Mi banca ---------- */
route("/banca", async () => {
  const u = getUser();
  const [c, s] = await Promise.all([
    api("/cuentas"),
    u.rol === "cliente" ? api("/solicitudes", { query: { limit: 5 } }) : Promise.resolve(null),
  ]);
  const cuentas = c.ok ? unwrapList(c.data) : [];
  const total = cuentas.reduce((a, x) => a + Number(x.saldo || 0), 0);
  const titulo = u.rol === "admin" ? "Todas las cuentas" : `Hola, ${esc(u.nombre)}`;
  const html = `
    <div class="container">
      <h1>${titulo}</h1>
      ${u.rol === "cliente" ? `<p class="lead">Este es el resumen de tu banca.</p>` : ""}
      <section>
        <div class="section-head"><h2><svg class="heading-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/></svg>Cuentas</h2>${u.rol === "cliente" ? `<span class="muted">Saldo total: <b class="saldo-total">${money(total)}</b></span>` : ""}</div>
        ${c.ok ? `<div class="grid cols-3">${cuentas.map((a) => `
          <a class="card cuenta ${a.tipo === "ahorro" ? "cuenta-ahorro" : "cuenta-debito"}" href="#/cuenta/${esc(a.id)}" aria-label="Cuenta ${a.tipo === "ahorro" ? "de ahorro" : "de débito"} ${esc(a.numeroEnmascarado)}">
            <span class="cuenta-top"><span class="tag">${a.tipo === "ahorro" ? "Ahorro" : "Débito"}</span><span class="cuenta-chip" aria-hidden="true"></span></span>
            <span class="num-cuenta">${esc(a.numeroEnmascarado)}</span>
            <strong class="saldo">${money(a.saldo)}</strong>
            <small>${esc(a.moneda)} · ${a.estado === "activa" ? "Activa" : "<span class='bad-text'>Bloqueada</span>"}</small>
          </a>`).join("") || emptyState("Todavía no tienes cuentas en esta banca demo.")}</div>` : errorBox(c.error)}
      </section>
      ${s ? `<section>
        <div class="section-head"><h2>Mis solicitudes</h2><div class="actions"><a class="btn sm" href="#/solicitudes">Ver todas</a><a class="btn primary sm" href="#/solicitar">Nueva solicitud</a></div></div>
        ${s.ok ? solicitudesTabla(unwrapList(s.data), false) : errorBox(s.error)}
      </section>` : ""}
      ${leyenda("Todos los datos son ficticios y de uso académico.")}
    </div>`;
  return page(html);
}, { auth: true, roles: ["cliente", "admin"] });

/* ---------- Cuenta y movimientos ---------- */
route("/cuenta/:id", async ({ params }) => {
  const f = App.current.query;
  const [c, m] = await Promise.all([
    api(`/cuentas/${params.id}`),
    api(`/cuentas/${params.id}/movimientos`, { query: { desde: f.desde, hasta: f.hasta, tipo: f.tipo, page: f.page || 1, limit: 10 } }),
  ]);
  if (!c.ok) return page(`<div class="container narrow">${errorBox(c.error)}<p><a href="#/banca">← Mi banca</a></p></div>`);
  const a = c.data;
  const movs = m.ok ? unwrapList(m.data) : [];
  const html = `
    <div class="container">
      <p><a href="#/banca">← Mi banca</a></p>
      <h1>Cuenta ${esc(a.numeroEnmascarado)}</h1>
      <div class="stats">${stat("Saldo", money(a.saldo))}${stat("Tipo", a.tipo === "ahorro" ? "Ahorro" : "Débito")}${stat("Estado", a.estado === "activa" ? "Activa" : "Bloqueada")}${stat("Abierta", fday(a.creadaEn))}</div>
      <section class="card">
        <h2>Movimientos</h2>
        <form class="toolbar" id="filtros">
          ${fieldHtml("Desde", "desde", { type: "date", value: f.desde || "" })}
          ${fieldHtml("Hasta", "hasta", { type: "date", value: f.hasta || "" })}
          ${selectHtml("Tipo", "tipo", [["", "Todos"], ["deposito", "Depósito"], ["retiro", "Retiro"], ["pago", "Pago"], ["compra", "Compra"], ["transferencia", "Transferencia"]], f.tipo || "")}
          <button class="btn primary">Filtrar</button><button type="button" class="btn ghost" id="limpiar">Limpiar</button>
        </form>
        ${m.ok ? `<div class="table-wrap"><table class="table"><thead><tr><th>Fecha</th><th>Concepto</th><th>Tipo</th><th class="r">Monto</th><th class="r">Saldo</th></tr></thead><tbody>
          ${movs.map((x) => `<tr><td>${fdate(x.fecha)}</td><td>${esc(x.concepto)}<small>${esc(x.referencia || "")}</small></td><td><span class="badge gray">${esc(x.tipo)}</span></td>
            <td class="r ${Number(x.monto) < 0 ? "neg" : "pos"}">${money(x.monto)}</td><td class="r">${money(x.saldoResultante)}</td></tr>`).join("") || '<tr><td colspan="5" class="muted center">Sin movimientos con esos filtros.</td></tr>'}
        </tbody></table></div>${pagerHtml(m.meta)}` : errorBox(m.error, false)}
      </section>
    </div>`;
  return page(html, (root) => {
    const go = (extra) => {
      const d = readForm(root.querySelector("#filtros"));
      const p = new URLSearchParams();
      Object.entries({ ...d, ...extra }).forEach(([k, v]) => v && p.set(k, v));
      location.hash = `#/cuenta/${params.id}${p.toString() ? "?" + p : ""}`;
    };
    root.querySelector("#filtros").onsubmit = (e) => { e.preventDefault(); const d = readForm(e.target); if (d.desde && d.hasta && d.desde > d.hasta) return toast("La fecha inicial no puede ser mayor a la final", "error"); go({ page: 1 }); };
    root.querySelector("#limpiar").onclick = () => (location.hash = `#/cuenta/${params.id}`);
    bindPager(root, (p) => go({ page: p }));
  });
}, { auth: true, roles: ["cliente", "admin"] });

/* ---------- Lista de solicitudes (cliente, analista, admin) ---------- */
function solicitudesTabla(lista, staff) {
  if (!lista.length) return `<div class="card empty"><p class="muted">Aún no hay solicitudes.</p>${staff ? "" : '<a class="btn primary" href="#/solicitar">Iniciar una solicitud</a>'}</div>`;
  return `<div class="table-wrap"><table class="table clicky"><thead><tr><th>Folio</th><th>Producto</th>${staff ? "<th>Cliente</th>" : ""}<th class="r">Monto</th><th>Plazo</th><th>Estado</th><th>Actualizada</th></tr></thead><tbody>
    ${lista.map((s) => `<tr data-href="#/solicitud/${s.id}"><td><a href="#/solicitud/${s.id}">${esc(s.folio)}</a></td><td>${esc(s.producto?.nombre)}<small>${TIPO_LABEL[s.tipo]}</small></td>${staff ? `<td>Usuario ${s.usuarioId}</td>` : ""}
      <td class="r">${money(s.montoSolicitado)}</td><td>${s.plazoMeses} m</td><td>${badge(s.estado)}</td><td>${fday(s.actualizadaEn)}</td></tr>`).join("")}
  </tbody></table></div>`;
}
function bindRowLinks(root) {
  root.querySelectorAll("tr[data-href]").forEach((tr) => (tr.onclick = (e) => { if (e.target.closest("a,button")) return; location.hash = tr.dataset.href; }));
}
async function renderListaSolicitudes(staff) {
  const f = App.current.query;
  const r = await api("/solicitudes", { query: { estado: f.estado, tipo: f.tipo, page: f.page || 1, limit: 10 } });
  const html = `
    <div class="container">
      <div class="section-head"><h1>${staff ? "Bandeja de solicitudes" : "Mis solicitudes"}</h1>
        ${staff ? "" : '<a class="btn primary" href="#/solicitar">Nueva solicitud</a>'}</div>
      <form class="toolbar" id="filtros">
        ${selectHtml("Estado", "estado", [["", "Todos"], ...Object.entries(ESTADOS).map(([k, v]) => [k, v[0]])], f.estado || "")}
        ${selectHtml("Tipo", "tipo", [["", "Todos"], ["hipoteca", "Hipoteca"], ["prestamo", "Crédito personal"]], f.tipo || "")}
        <button class="btn primary">Filtrar</button><button type="button" class="btn ghost" id="limpiar">Limpiar</button>
      </form>
      ${r.ok ? solicitudesTabla(unwrapList(r.data), staff) + pagerHtml(r.meta) : errorBox(r.error)}
    </div>`;
  const base = staff ? "#/bandeja" : "#/solicitudes";
  return page(html, (root) => {
    const go = (extra) => {
      const d = readForm(root.querySelector("#filtros"));
      const p = new URLSearchParams();
      Object.entries({ ...d, ...extra }).forEach(([k, v]) => v && p.set(k, v));
      location.hash = base + (p.toString() ? "?" + p : "");
    };
    root.querySelector("#filtros").onsubmit = (e) => { e.preventDefault(); go({ page: 1 }); };
    root.querySelector("#limpiar").onclick = () => (location.hash = base);
    bindPager(root, (p) => go({ page: p }));
    bindRowLinks(root);
  });
}
route("/solicitudes", () => renderListaSolicitudes(false), { auth: true, roles: ["cliente", "admin"] });
route("/bandeja", () => renderListaSolicitudes(true), { auth: true, roles: ["analista", "admin"] });

/* ---------- Nueva solicitud (paso 1) ---------- */
route("/solicitar", async ({ query }) => {
  const u = getUser();
  if (!isLogged()) { location.hash = `#/login?next=${encodeURIComponent("#/solicitar" + (query.producto ? "?producto=" + query.producto : ""))}`; return page(""); }
  if (u.rol !== "cliente" && u.rol !== "admin") return page(`<div class="container narrow"><div class="card error-box"><h2>Solo los clientes pueden solicitar créditos</h2></div></div>`);
  const pr = await api("/productos");
  if (!pr.ok) return page(`<div class="container narrow">${errorBox(pr.error)}</div>`);
  const productos = unwrapList(pr.data);
  let sel = productos.find((p) => String(p.id) === String(query.producto)) || productos[0];

  const html = `
    <div class="container narrow">
      <h1>Solicitar un crédito</h1>
      <p class="lead">Paso 1 de 7 · Elige el producto y el monto. Después capturarás tus datos y documentos.</p>
      <form class="card" id="solForm" novalidate>
        <fieldset class="product-pick"><legend>Producto</legend>
          ${productos.map((p) => `<label class="pick ${p.id === sel.id ? "on" : ""}"><input type="radio" name="productoId" value="${p.id}" ${p.id === sel.id ? "checked" : ""}>
            <span><b>${esc(p.nombre)}</b><small>${TIPO_LABEL[p.tipo]} · ${num(p.tasaAnual, 2)}% anual</small></span></label>`).join("")}
        </fieldset>
        <div id="campos"></div>
        <p class="form-error" role="alert"></p>
        <div id="estimado" class="notice"></div>
        <button class="btn primary block">Crear solicitud</button>
      </form>
      ${leyenda("Las cifras son demostrativas. Máximo 3 solicitudes activas por cliente.")}
    </div>`;

  return page(html, (root) => {
    const form = root.querySelector("#solForm");
    const campos = root.querySelector("#campos");
    const est = root.querySelector("#estimado");
    let timer;

    function drawCampos() {
      const hip = sel.tipo === "hipoteca";
      campos.innerHTML = `
        ${fieldHtml("Monto solicitado (MXN)", "montoSolicitado", { type: "number", num: true, attrs: `min="${sel.montoMin}" max="${sel.montoMax}" step="1000" required`, value: hip ? Math.round(sel.montoMin * 2) : sel.montoMin, hint: `Entre ${money(sel.montoMin)} y ${money(sel.montoMax)}` })}
        ${selectHtml("Plazo", "plazoMeses", sel.plazosMeses.map((m) => [m, plazoTxt(m)]))}
        ${hip ? fieldHtml("Valor del inmueble (MXN)", "valorInmueble", { type: "number", num: true, attrs: 'min="1" step="1000" required', value: Math.round(sel.montoMin * 2 / (1 - sel.engancheMinPct / 100) / 1000) * 1000 + 100000, hint: `El enganche mínimo es ${sel.engancheMinPct}% del valor. Lo calcula el banco.` }) : ""}`;
      campos.querySelectorAll("input,select").forEach((i) => (i.oninput = i.onchange = schedule));
      schedule();
    }
    function schedule() { clearTimeout(timer); timer = setTimeout(estimar, 350); }
    async function estimar() {
      const d = readForm(form);
      const hip = sel.tipo === "hipoteca";
      if (!d.montoSolicitado || (hip && !d.valorInmueble)) { est.hidden = true; return; }
      const body = hip
        ? { valorInmueble: d.valorInmueble, enganche: d.valorInmueble - d.montoSolicitado, plazoMeses: Number(d.plazoMeses), productoId: sel.id }
        : { monto: d.montoSolicitado, plazoMeses: Number(d.plazoMeses), productoId: sel.id };
      const r = await api(`/simuladores/${sel.tipo}`, { method: "POST", body });
      est.hidden = false;
      if (r.ok) { est.className = "notice ok"; est.innerHTML = `Mensualidad estimada: <b>${money(r.data.mensualidad)}</b>${r.data.mensajeEnganche ? ` · ${esc(r.data.mensajeEnganche)}` : ""}`; }
      else { est.className = "notice bad"; est.textContent = r.error.message; }
    }
    form.querySelectorAll("[name=productoId]").forEach((r) => (r.onchange = () => {
      sel = productos.find((p) => String(p.id) === r.value);
      form.querySelectorAll(".pick").forEach((l) => l.classList.toggle("on", l.contains(r) && r.checked));
      drawCampos();
    }));
    drawCampos();

    form.onsubmit = async (e) => {
      e.preventDefault();
      const d = readForm(form);
      const body = { productoId: sel.id, montoSolicitado: d.montoSolicitado, plazoMeses: Number(d.plazoMeses) };
      if (sel.tipo === "hipoteca") body.valorInmueble = d.valorInmueble;
      const r = await submitForm(form, () => api("/solicitudes", { method: "POST", body }));
      if (r.ok) { toast("Solicitud creada. Ahora captura tus datos y documentos."); location.hash = `#/solicitud/${r.data.id}`; }
    };
  });
});

/* ============================================================
   Detalle de solicitud — el trámite completo
   ============================================================ */
const ESTADO_CIVIL = [["soltero", "Soltero(a)"], ["casado", "Casado(a)"], ["divorciado", "Divorciado(a)"], ["viudo", "Viudo(a)"], ["union_libre", "Unión libre"]];
const avaluoCache = {
  get: (id) => { try { return JSON.parse(sessionStorage.getItem("avaluo:" + id)); } catch { return null; } },
  set: (id, v) => sessionStorage.setItem("avaluo:" + id, JSON.stringify(v)),
};

function tramiteSteps(s, pg, hip, docs, inmueble, avaluo) {
  const avanzados = ["en_avaluo", "avaluo_completado", "en_analisis", "aprobada", "condicionada", "rechazada", "oferta_aceptada", "oferta_rechazada", "formalizada"];
  const analisis = ["aprobada", "condicionada", "rechazada", "oferta_aceptada", "oferta_rechazada", "formalizada"];
  const oferta = ["oferta_aceptada", "oferta_rechazada", "formalizada"];
  const datosOk = !!pg.solicitanteCompleto || !!s.solicitante || avanzados.includes(s.estado);
  const docsOk = (Array.isArray(pg.documentosPendientes) && pg.documentosPendientes.length === 0) || analisis.includes(s.estado) || s.estado === "avaluo_completado";
  const pasos = [
    { label: "Datos", ok: datosOk },
    { label: "Documentos", ok: docsOk },
  ];
  if (hip) {
    pasos.push({ label: "Casa", ok: !!pg.inmuebleRegistrado || !!inmueble || ["en_avaluo", "avaluo_completado", ...analisis].includes(s.estado) });
    pasos.push({ label: "Avalúo", ok: (pg.avaluoEstado || avaluo?.estado) === "completado" || ["avaluo_completado", ...analisis].includes(s.estado) });
  }
  pasos.push({ label: "Análisis", ok: !!s.resultadoAnalisis || analisis.includes(s.estado) });
  pasos.push({ label: "Oferta", ok: oferta.includes(s.estado) });
  pasos.push({ label: "Formalizar", ok: s.estado === "formalizada" });
  let actual = pasos.findIndex((step) => !step.ok);
  if (s.estado === "rechazada" || s.estado === "cancelada") actual = Math.max(0, pasos.findIndex((step) => step.label === "Análisis"));
  if (actual < 0) actual = pasos.length - 1;
  return `<nav class="tramite-steps" id="tramiteSteps" aria-label="Pasos del trámite"><ol>${pasos.map((step, i) => {
    const cls = step.ok ? "done" : i === actual ? "current" : "pending";
    return `<li class="tramite-step ${cls}" ${i === actual ? 'aria-current="step"' : ""}><span class="tramite-step-dot">${step.ok ? "✓" : i + 1}</span><span>${esc(step.label)}</span></li>`;
  }).join("")}</ol></nav>`;
}

function secAvaluoHtml(a, staff) {
  if (!a) return "";
  return `<div class="card sub"><h4>Avalúo ${esc(a.folio)} ${a.estado === "completado" ? '<span class="badge green">completado</span>' : '<span class="badge blue">' + esc(a.estado) + "</span>"}</h4>
    ${kv([["Valor comercial", `<b>${money(a.valorComercial)}</b>`], ["Conservación", esc(a.estadoConservacion)], ["Valuador", esc(a.valuadorNombre)], ["Fecha de visita", fdate(a.fechaVisita)]])}
    <p class="muted">${esc(a.observaciones)}</p>${staff ? `<a class="btn sm" href="#/avaluo/${a.id}">Abrir avalúo</a>` : ""}</div>`;
}

route("/solicitud/:id", async ({ params }) => {
  const id = params.id;
  const u = getUser();
  const rol = u.rol;
  const canClient = rol === "cliente" || rol === "admin";
  const canAnalyst = rol === "analista" || rol === "admin";
  const sr = await api(`/solicitudes/${id}`);
  const backHref = rol === "valuador" ? "#/avaluos" : canAnalyst ? "#/bandeja" : "#/solicitudes";
  if (!sr.ok) return page(`<div class="container narrow">${errorBox(sr.error)}<p><a href="${backHref}">← Volver</a></p></div>`);
  const s = sr.data;
  const pg = s.progreso || {};
  const hip = s.tipo === "hipoteca";
  const final = ESTADOS_FINALES.includes(s.estado);
  const editable = canClient && !!pg.editable;
  const docs = s.documentos || [];

  const [hist, sol, inm, oferta, amort, avList] = await Promise.all([
    api(`/solicitudes/${id}/historial`),
    api(`/solicitudes/${id}/solicitante`),
    hip ? api(`/solicitudes/${id}/inmueble`) : null,
    canClient && ["aprobada", "condicionada", "oferta_aceptada"].includes(s.estado) ? api(`/solicitudes/${id}/oferta`) : null,
    canClient && s.estado === "formalizada" ? api(`/solicitudes/${id}/amortizacion`) : null,
    hip && (rol === "analista" || rol === "valuador" || rol === "admin") && s.estado !== "borrador" ? api("/avaluos", { query: { limit: 100 } }) : null,
  ]);
  const solD = sol.ok ? sol.data : null;
  const inmD = inm && inm.ok ? inm.data : null;
  let avaluo = avaluoCache.get(id);
  if (avList && avList.ok) avaluo = unwrapList(avList.data).find((a) => String(a.solicitudId) === String(id)) || avaluo;
  const staffView = rol !== "cliente";

  /* ----- Encabezado ----- */
  const aprobado = s.montoAprobado !== null && s.montoAprobado !== undefined;
  const header = `
    ${tramiteSteps(s, pg, hip, docs, inmD, avaluo)}
    <div class="card hdr">
      <div class="hdr-top"><div><span class="tag ${hip ? "tag-hip" : ""}">${TIPO_LABEL[s.tipo]}</span><h1>${esc(s.folio)}</h1><p class="muted">${esc(s.producto?.nombre)} · ${num(s.producto?.tasaAnual, 2)}% anual</p></div>${badge(s.estado)}</div>
      ${progressBar(pg.porcentaje || 0)}
      <p class="next"><b>${pg.porcentaje ?? 0}%</b> · ${esc(pg.siguientePaso || "")}</p>
    </div>
    <div class="stats">
      ${stat("Monto solicitado", money(s.montoSolicitado))}${stat("Plazo", plazoTxt(s.plazoMeses))}
      ${hip ? stat("Valor del inmueble", money(s.valorInmueble), "Enganche " + money(s.enganche)) : ""}
      ${aprobado ? stat("Monto aprobado", money(s.montoAprobado), `${num(s.tasaAprobada, 2)}% · ${plazoTxt(s.plazoAprobado)}`) : ""}
      ${aprobado ? stat("Mensualidad", money(s.mensualidadAprobada)) : ""}
    </div>`;

  /* ----- Acciones principales ----- */
  const acc = [];
  if (!final) {
    if (s.estado === "datos_completos" && hip && (canClient || canAnalyst)) acc.push(["avaluo", "Pedir avalúo de la casa", "primary"]);
    if ((s.estado === "datos_completos" && !hip) || s.estado === "avaluo_completado") if (canClient || canAnalyst) acc.push(["analisis", "Enviar a análisis", "primary"]);
    if (s.estado === "oferta_aceptada" && canClient) acc.push(["formalizar", "Formalizar crédito", "primary"]);
    if (canClient) acc.push(["cancelar", "Cancelar solicitud", "danger"]);
  }
  const acciones = acc.length
    ? `<section class="card acciones"><h3>¿Qué sigue?</h3><p class="muted">${esc(pg.siguientePaso || "")}</p><div class="actions">${acc.map(([k, t, c]) => `<button class="btn ${c}" data-act="${k}">${esc(t)}</button>`).join("")}</div></section>`
    : final ? `<section class="card"><p>${s.estado === "rechazada" ? "Esta solicitud no fue aprobada." : "Esta solicitud ya terminó."} ${esc(s.motivoResolucion || "")}</p></section>` : "";

  /* ----- Solicitante ----- */
  const sectSolicitante = `
    <details class="card sect" ${editable && !solD ? "open" : ""}>
      <summary><span class="stepn">2</span> Datos del solicitante ${solD ? '<span class="badge green">capturados</span>' : '<span class="badge gray">pendiente</span>'}</summary>
      ${editable ? `<form id="formSolicitante" novalidate>
        <div class="form-grid">
          ${fieldHtml("Fecha de nacimiento", "fechaNacimiento", { type: "date", value: solD?.fechaNacimiento || "", attrs: "required" })}
          ${fieldHtml("CURP (ficticia, 18 caracteres)", "curpFicticia", { value: solD?.curpFicticia || "", attrs: 'required maxlength="18" minlength="18" style="text-transform:uppercase"' })}
          ${selectHtml("Estado civil", "estadoCivil", ESTADO_CIVIL, solD?.estadoCivil || "soltero")}
          ${fieldHtml("Dependientes", "dependientes", { type: "number", num: true, value: solD?.dependientes ?? 0, attrs: 'min="0" max="20"' })}
          ${fieldHtml("Domicilio", "domicilio", { value: solD?.domicilio || "", attrs: "required" })}
          ${fieldHtml("Ciudad", "ciudad", { value: solD?.ciudad || "", attrs: "required" })}
          ${fieldHtml("Empresa", "empresa", { value: solD?.empresa || "", attrs: "required" })}
          ${fieldHtml("Puesto", "puesto", { value: solD?.puesto || "", attrs: "required" })}
          ${selectHtml("Tipo de empleo", "tipoEmpleo", [["asalariado", "Asalariado"], ["independiente", "Independiente"]], solD?.tipoEmpleo || "asalariado")}
          ${fieldHtml("Antigüedad (meses)", "antiguedadMeses", { type: "number", num: true, value: solD?.antiguedadMeses ?? "", attrs: 'min="0" max="720" required', hint: "Menos de 6 meses: el análisis la rechazará" })}
          ${fieldHtml("Ingreso mensual (MXN)", "ingresoMensual", { type: "number", num: true, value: solD?.ingresoMensual ?? "", attrs: 'min="1" step="any" required' })}
          ${fieldHtml("Otros ingresos", "otrosIngresos", { type: "number", num: true, value: solD?.otrosIngresos ?? 0, attrs: 'min="0" step="any"' })}
          ${fieldHtml("Gastos mensuales", "gastosMensuales", { type: "number", num: true, value: solD?.gastosMensuales ?? 0, attrs: 'min="0" step="any"' })}
          ${fieldHtml("Deudas mensuales", "deudasMensuales", { type: "number", num: true, value: solD?.deudasMensuales ?? 0, attrs: 'min="0" step="any"' })}
        </div>
        <h4>Referencias personales <small class="muted">(de 2 a 5, con teléfonos distintos)</small></h4>
        <div id="refs"></div>
        <button type="button" class="btn sm" id="addRef">+ Agregar referencia</button>
        <p class="form-error" role="alert"></p>
        <div class="actions"><button class="btn primary">Guardar datos</button></div>
      </form>`
      : solD ? kv([
        ["Fecha de nacimiento", fday(solD.fechaNacimiento)], ["CURP", esc(solD.curpFicticia)], ["Estado civil", esc(solD.estadoCivil)], ["Dependientes", solD.dependientes],
        ["Domicilio", esc(solD.domicilio + ", " + solD.ciudad)], ["Empresa", esc(solD.empresa + " — " + solD.puesto)], ["Tipo de empleo", esc(solD.tipoEmpleo)], ["Antigüedad", solD.antiguedadMeses + " meses"],
        ["Ingreso mensual", money(solD.ingresoMensual)], ["Otros ingresos", money(solD.otrosIngresos)], ["Gastos mensuales", money(solD.gastosMensuales)], ["Deudas mensuales", money(solD.deudasMensuales)],
        ["Referencias", (solD.referencias || []).map((r) => `${esc(r.nombre)} (${esc(r.relacion)}, ${esc(r.telefono)})`).join("<br>")],
      ]) : '<p class="muted">Aún no hay datos del solicitante.</p>'}
    </details>`;

  /* ----- Documentos ----- */
  const sectDocs = `
    <details class="card sect" ${editable && docs.some((d) => d.estado === "pendiente") && solD ? "open" : ""}>
      <summary><span class="stepn">3</span> Documentos ${pg.documentosPendientes?.length ? `<span class="badge amber">${pg.documentosPendientes.length} pendiente${pg.documentosPendientes.length > 1 ? "s" : ""}</span>` : '<span class="badge green">completos</span>'}
        ${pg.documentosRechazados?.length ? `<span class="badge red">${pg.documentosRechazados.length} rechazado(s)</span>` : ""}</summary>
      <p class="muted">No se suben archivos reales: solo se registra el nombre (.pdf, .jpg, .jpeg o .png).</p>
      <div class="table-wrap"><table class="table"><thead><tr><th>Documento</th><th>Estado</th><th>Archivo</th><th></th></tr></thead><tbody>
      ${docs.map((d) => {
        const entregar = canClient && !final && (d.estado === "pendiente" || d.estado === "rechazado");
        const revisar = canAnalyst && d.documentoId && d.estado !== "pendiente" && !final;
        return `<tr><td>${esc(DOC_LABEL[d.tipo] || d.tipo)}<small>${esc(d.descripcion)}</small></td><td>${docBadge(d.estado)}</td>
          <td>${esc(d.nombreArchivoSimulado || "—")}${d.observaciones ? `<small class="bad-text">${esc(d.observaciones)}</small>` : ""}</td>
          <td class="acciones-cell">${entregar ? `<input type="file" class="docfile" accept=".pdf,.jpg,.jpeg,.png" data-tipo="${d.tipo}" aria-label="Archivo para ${esc(DOC_LABEL[d.tipo] || d.tipo)}"><button class="btn sm primary" data-entregar="${d.tipo}">${d.estado === "rechazado" ? "Volver a entregar" : "Entregar"}</button>` : ""}
          ${revisar ? `<button class="btn sm" data-validar="${d.documentoId}">Validar</button><button class="btn sm danger" data-rechazar="${d.documentoId}">Rechazar</button>` : ""}</td></tr>`;
      }).join("")}
      </tbody></table></div>
    </details>`;

  /* ----- Inmueble ----- */
  const TIPOS_INM = [["casa", "Casa"], ["departamento", "Departamento"], ["terreno", "Terreno"]];
  const sectInmueble = !hip ? "" : `
    <details class="card sect" ${editable && !inmD && solD ? "open" : ""}>
      <summary><span class="stepn">4</span> Datos de la casa ${inmD ? '<span class="badge green">registrada</span>' : '<span class="badge gray">pendiente</span>'}</summary>
      ${editable ? `<form id="formInmueble" novalidate>
        <div class="form-grid">
          ${selectHtml("Tipo de inmueble", "tipo", TIPOS_INM, inmD?.tipo || "casa")}
          ${fieldHtml("Dirección", "direccion", { value: inmD?.direccion || "", attrs: "required" })}
          ${fieldHtml("Colonia", "colonia", { value: inmD?.colonia || "", attrs: "required" })}
          ${fieldHtml("Ciudad", "ciudad", { value: inmD?.ciudad || "", attrs: "required" })}
          ${fieldHtml("Estado", "estado", { value: inmD?.estado || "", attrs: "required" })}
          ${fieldHtml("Código postal", "cp", { value: inmD?.cp || "", attrs: 'required pattern="\\d{5}" maxlength="5" inputmode="numeric"' })}
          ${fieldHtml("m² de terreno", "m2Terreno", { type: "number", num: true, value: inmD?.m2Terreno ?? "", attrs: 'min="1" step="any" required' })}
          ${fieldHtml("m² de construcción", "m2Construccion", { type: "number", num: true, value: inmD?.m2Construccion ?? "", attrs: 'min="0" step="any"' })}
          ${fieldHtml("Antigüedad (años)", "antiguedadAnios", { type: "number", num: true, value: inmD?.antiguedadAnios ?? "", attrs: 'min="0" required' })}
          ${fieldHtml("Recámaras", "recamaras", { type: "number", num: true, value: inmD?.recamaras ?? "", attrs: 'min="0"' })}
          ${fieldHtml("Baños", "banos", { type: "number", num: true, value: inmD?.banos ?? "", attrs: 'min="0" step="any"' })}
          ${fieldHtml("Valor estimado por ti (MXN)", "valorEstimadoCliente", { type: "number", num: true, value: inmD?.valorEstimadoCliente ?? s.valorInmueble ?? "", attrs: 'min="1" step="any" required' })}
        </div>
        <p class="form-error" role="alert"></p>
        <div class="actions"><button class="btn primary">Guardar casa</button></div>
      </form>`
      : inmD ? kv([["Tipo", esc(inmD.tipo)], ["Dirección", esc(`${inmD.direccion}, ${inmD.colonia}, ${inmD.ciudad}, ${inmD.estado} ${inmD.cp}`)], ["Terreno", num(inmD.m2Terreno) + " m²"], ["Construcción", num(inmD.m2Construccion) + " m²"], ["Antigüedad", inmD.antiguedadAnios + " años"], ["Recámaras / baños", `${inmD.recamaras ?? "—"} / ${inmD.banos ?? "—"}`], ["Valor estimado", money(inmD.valorEstimadoCliente)]])
        : '<p class="muted">Aún no se registra la casa.</p>'}
      ${secAvaluoHtml(avaluo, staffView)}
    </details>`;

  /* ----- Análisis ----- */
  const ra = s.resultadoAnalisis;
  const sectAnalisis = !ra ? "" : `
    <section class="card sect-open"><h3>Resultado del análisis ${badge(s.estado)}</h3>
      <p>${esc(s.motivoResolucion || "")}</p>
      <ul class="rules">${(ra.reglas || []).map((r) => `<li class="${r.cumple ? "ok" : "bad"}"><span class="mark">${r.cumple ? "✓" : "✗"}</span><span>${esc(r.descripcion)}<small>Valor: ${esc(r.valor)} · Límite: ${esc(r.limite)}</small></span></li>`).join("")}</ul>
      ${kv([["Puntaje de buró (ficticio)", ra.puntajeBuro], ["Ingreso neto", money(ra.ingresoNeto)], ["Pago máximo", money(ra.pagoMaximo)], ["Mensualidad solicitada", money(ra.mensualidadSolicitada)], ra.montoMaximo ? ["Monto máximo", money(ra.montoMaximo)] : null, s.engancheRequerido ? ["Enganche requerido", money(s.engancheRequerido)] : null])}
    </section>`;

  /* ----- Oferta ----- */
  const o = oferta && oferta.ok ? oferta.data : null;
  const sectOferta = !o ? "" : `
    <section class="card oferta"><div class="section-head"><h3>Tu oferta ${o.condicionada ? '<span class="badge amber">con condiciones</span>' : ""}</h3>
      <span class="badge ${o.vigente ? "green" : "red"}">${o.vigente ? "Vigente hasta " + fday(o.vigenteHasta) : "Vencida"}</span></div>
      <div class="big-number">${money(o.mensualidad)}<small> / mes</small></div>
      ${kv([["Monto", money(o.monto)], ["Tasa anual", num(o.tasaAnual, 2) + "%"], ["Plazo", plazoTxt(o.plazoMeses)], ["Total a pagar", money(o.totalPagar)], ["Intereses", money(o.totalIntereses)], ["CAT demostrativo", num(o.catDemo, 2) + "%"], o.engancheRequerido ? ["Enganche requerido", money(o.engancheRequerido)] : null])}
      <p class="muted">${esc(o.condiciones)}</p>
      ${["aprobada", "condicionada"].includes(s.estado) && canClient ? `<div class="actions"><button class="btn primary" data-act="aceptar" ${o.vigente ? "" : "disabled"}>Aceptar oferta</button><button class="btn" data-act="rechazar">Rechazar oferta</button></div>` : ""}
      ${leyenda(o.leyenda)}</section>`;

  /* ----- Crédito formalizado ----- */
  const am = amort && amort.ok ? amort.data : null;
  const sectAmort = !am ? "" : `
    <section class="card"><h3>Tu crédito y tabla de pagos</h3>
      ${kv([["Monto", money(am.monto)], ["Tasa", num(am.tasaAnual, 2) + "%"], ["Plazo", plazoTxt(am.plazoMeses)], ["Mensualidad", money(am.mensualidad)], ["Total de intereses", money(am.totalIntereses)], ["Total a pagar", money(am.totalPagar)]])}
      ${!hip ? '<p class="notice ok">El dinero ya se depositó en tu primera cuenta activa (movimiento “Disposición de préstamo”). <a href="#/banca">Ver mis cuentas</a></p>' : ""}
      <h4>Evolución del saldo</h4>${lineChart(am.tabla)}${tablaPagos(am.tabla)}${leyenda(am.leyenda)}</section>`;

  /* ----- Resolución manual (analista) ----- */
  const sectResolucion = canAnalyst && ["aprobada", "condicionada", "rechazada"].includes(s.estado) ? `
    <details class="card sect"><summary>Ajustar resolución (analista)</summary>
      <form id="formResolucion" novalidate><div class="form-grid">
        ${selectHtml("Nueva resolución", "estado", [["aprobada", "Aprobada"], ["condicionada", "Condicionada"], ["rechazada", "Rechazada"]], s.estado)}
        ${fieldHtml("Monto (opcional)", "monto", { type: "number", num: true, attrs: 'min="1" step="any"' })}
        ${fieldHtml("Tasa % (opcional)", "tasa", { type: "number", num: true, attrs: 'min="0" max="100" step="0.01"' })}
        ${fieldHtml("Plazo en meses (opcional)", "plazo", { type: "number", num: true, attrs: 'min="1" max="480"' })}
      </div>
      <label class="field"><span>Motivo (mínimo 5 caracteres)</span><textarea name="motivo" rows="2" required minlength="5"></textarea></label>
      <p class="form-error" role="alert"></p><div class="actions"><button class="btn primary">Guardar resolución</button></div></form>
    </details>` : "";

  /* ----- Historial ----- */
  const h = hist.ok ? unwrapList(hist.data) : [];
  const sectHistorial = `
    <details class="card sect"><summary>Historial de la solicitud</summary>
      <ol class="timeline">${h.map((x) => `<li><b>${badge(x.estadoNuevo)}</b><span>${esc(x.nota || "")}</span><time>${fdate(x.fecha)}</time></li>`).join("") || '<li class="muted">Sin movimientos.</li>'}</ol>
    </details>`;

  const html = `
    <div class="container">
      <p><a href="${backHref}">← Volver</a></p>
      ${header}${acciones}${sectOferta}${sectAnalisis}${sectAmort}
      ${sectResolucion}
      <h2 class="sect-title">Expediente</h2>
      ${sectSolicitante}${sectDocs}${sectInmueble}${sectHistorial}
      ${leyenda("Información ficticia con fines académicos. Ninguna cifra tiene validez real.")}
    </div>`;

  return page(html, (root) => {
    /* ---- acciones principales ---- */
    const run = async (label, fn, okMsg) => {
      root.querySelectorAll("button").forEach((b) => (b.disabled = true));
      const r = await fn();
      if (!r.ok) { toast(r.error.message, "error"); return reload(); }
      toast(okMsg || r.message || "Listo");
      return r;
    };
    root.querySelectorAll("[data-act]").forEach((b) => (b.onclick = async () => {
      const a = b.dataset.act;
      if (a === "avaluo") {
        const r = await run(a, () => api(`/solicitudes/${id}/avaluo`, { method: "POST" }), "Avalúo generado");
        if (r) { avaluoCache.set(id, r.data); reload(); }
      } else if (a === "analisis") {
        if (await run(a, () => api(`/solicitudes/${id}/analisis`, { method: "POST" }), "Análisis terminado")) reload();
      } else if (a === "aceptar") {
        if (!confirm("¿Aceptar esta oferta?")) return;
        if (await run(a, () => api(`/solicitudes/${id}/oferta/aceptar`, { method: "POST" }), "Oferta aceptada")) reload();
      } else if (a === "rechazar") {
        const motivo = await askText({ title: "Rechazar oferta", label: "Motivo (opcional)", submit: "Rechazar oferta" });
        if (motivo === null) return;
        if (await run(a, () => api(`/solicitudes/${id}/oferta/rechazar`, { method: "POST", body: motivo ? { motivo } : undefined }), "Oferta rechazada")) reload();
      } else if (a === "formalizar") {
        if (!confirm("¿Formalizar el crédito? " + (hip ? "" : "El dinero se depositará en tu cuenta."))) return;
        if (await run(a, () => api(`/solicitudes/${id}/formalizar`, { method: "POST" }), "Crédito formalizado")) reload();
      } else if (a === "cancelar") {
        const motivo = await askText({ title: "Cancelar solicitud", label: "Motivo (opcional)", submit: "Cancelar solicitud" });
        if (motivo === null) return;
        if (await run(a, () => api(`/solicitudes/${id}/cancelar`, { method: "POST", body: motivo ? { motivo } : undefined }), "Solicitud cancelada")) reload();
      }
    }));

    /* ---- solicitante ---- */
    const fs = root.querySelector("#formSolicitante");
    if (fs) {
      let refs = (solD?.referencias?.length ? solD.referencias : [{}, {}]).map((r) => ({ nombre: r.nombre || "", telefono: r.telefono || "", relacion: r.relacion || "" }));
      const box = fs.querySelector("#refs");
      const drawRefs = () => {
        box.innerHTML = refs.map((r, i) => `<div class="ref-row">
          <label class="field"><span>Nombre</span><input name="ref${i}_nombre" value="${esc(r.nombre)}" required></label>
          <label class="field"><span>Teléfono</span><input name="ref${i}_telefono" value="${esc(r.telefono)}" inputmode="tel" required></label>
          <label class="field"><span>Relación</span><input name="ref${i}_relacion" value="${esc(r.relacion)}" required></label>
          ${refs.length > 2 ? `<button type="button" class="btn ghost sm" data-delref="${i}" aria-label="Quitar referencia">✕</button>` : ""}</div>`).join("");
        box.querySelectorAll("input").forEach((inp) => (inp.oninput = () => { const [, i, k] = inp.name.match(/^ref(\d+)_(\w+)$/); refs[i][k] = inp.value; }));
        box.querySelectorAll("[data-delref]").forEach((b) => (b.onclick = () => { refs.splice(Number(b.dataset.delref), 1); drawRefs(); }));
        fs.querySelector("#addRef").hidden = refs.length >= 5;
      };
      fs.querySelector("#addRef").onclick = () => { if (refs.length < 5) { refs.push({ nombre: "", telefono: "", relacion: "" }); drawRefs(); } };
      drawRefs();
      fs.onsubmit = async (e) => {
        e.preventDefault();
        const d = readForm(fs);
        const body = {};
        ["fechaNacimiento", "curpFicticia", "estadoCivil", "dependientes", "domicilio", "ciudad", "empresa", "puesto", "tipoEmpleo", "antiguedadMeses", "ingresoMensual", "otrosIngresos", "gastosMensuales", "deudasMensuales"].forEach((k) => (body[k] = d[k]));
        body.curpFicticia = (body.curpFicticia || "").toUpperCase();
        body.referencias = refs.map((r) => ({ nombre: r.nombre.trim(), telefono: r.telefono.trim(), relacion: r.relacion.trim() }));
        await submitForm(fs, () => api(`/solicitudes/${id}/solicitante`, { method: "PUT", body }), (r) => { toast(r.message || "Datos guardados"); reload(); });
      };
    }

    /* ---- inmueble ---- */
    const fi = root.querySelector("#formInmueble");
    if (fi) fi.onsubmit = async (e) => {
      e.preventDefault();
      const body = readForm(fi);
      await submitForm(fi, () => api(`/solicitudes/${id}/inmueble`, { method: "PUT", body }), (r) => { toast(r.message || "Casa guardada"); reload(); });
    };

    /* ---- documentos ---- */
    root.querySelectorAll("[data-entregar]").forEach((b) => (b.onclick = async () => {
      const tipo = b.dataset.entregar;
      const file = root.querySelector(`.docfile[data-tipo="${tipo}"]`)?.files?.[0];
      const nombre = file ? file.name : `${tipo}_demo.pdf`;
      if (!/\.(pdf|jpe?g|png)$/i.test(nombre)) return toast("El archivo debe ser .pdf, .jpg, .jpeg o .png", "error");
      b.disabled = true;
      const r = await api(`/solicitudes/${id}/documentos`, { method: "POST", body: { tipo, nombreArchivoSimulado: nombre } });
      if (!r.ok) { b.disabled = false; return toast(r.error.message, "error"); }
      toast(r.message || "Documento entregado");
      reload();
    }));
    root.querySelectorAll("[data-validar]").forEach((b) => (b.onclick = async () => {
      b.disabled = true;
      const r = await api(`/solicitudes/${id}/documentos/${b.dataset.validar}`, { method: "PATCH", body: { estado: "validado" } });
      if (!r.ok) { b.disabled = false; return toast(r.error.message, "error"); }
      toast("Documento validado"); reload();
    }));
    root.querySelectorAll("[data-rechazar]").forEach((b) => (b.onclick = async () => {
      const obs = await askText({ title: "Rechazar documento", label: "Observaciones (obligatorias)", required: true, submit: "Rechazar" });
      if (!obs) return;
      const r = await api(`/solicitudes/${id}/documentos/${b.dataset.rechazar}`, { method: "PATCH", body: { estado: "rechazado", observaciones: obs } });
      if (!r.ok) return toast(r.error.message, "error");
      toast("Documento rechazado"); reload();
    }));

    /* ---- resolución ---- */
    const fr = root.querySelector("#formResolucion");
    if (fr) fr.onsubmit = async (e) => {
      e.preventDefault();
      const body = readForm(fr);
      await submitForm(fr, () => api(`/solicitudes/${id}/resolucion`, { method: "PATCH", body }), () => { toast("Resolución actualizada"); reload(); });
    };

    bindTablaPagos(root);
  });
}, { auth: true });

/* ---------- Perfil ---------- */
route("/perfil", async () => {
  const r = await api("/usuarios/perfil");
  if (!r.ok) return page(`<div class="container narrow">${errorBox(r.error)}</div>`);
  const p = r.data;
  return page(`
    <div class="container narrow">
      <h1>Mi perfil</h1>
      <div class="grid cols-2">
        <form class="card" id="formPerfil" novalidate>
          <h3>Mis datos</h3>
          ${kv([["Código", esc(p.codigo)], ["Correo", esc(p.email)], ["Rol", esc(ROL_LABEL[p.rol] || p.rol)]])}
          ${fieldHtml("Nombre", "nombre", { value: p.nombre, attrs: "required" })}
          ${fieldHtml("Apellidos", "apellidos", { value: p.apellidos, attrs: "required" })}
          ${fieldHtml("Teléfono", "telefono", { value: p.telefono || "", type: "tel" })}
          <p class="form-error" role="alert"></p><button class="btn primary">Guardar cambios</button>
        </form>
        <form class="card" id="formPass" novalidate>
          <h3>Cambiar contraseña</h3>
          ${fieldHtml("Contraseña actual", "passwordActual", { type: "password", attrs: 'required autocomplete="current-password"' })}
          ${fieldHtml("Contraseña nueva", "passwordNueva", { type: "password", attrs: 'required minlength="8" autocomplete="new-password"', hint: "Mínimo 8 caracteres, una mayúscula y un número" })}
          <p class="form-error" role="alert"></p><button class="btn primary">Cambiar contraseña</button>
        </form>
      </div>
    </div>`, (root) => {
    const fp = root.querySelector("#formPerfil");
    fp.onsubmit = async (e) => {
      e.preventDefault();
      const d = readForm(fp);
      const body = {};
      ["nombre", "apellidos", "telefono"].forEach((k) => { if (d[k] !== undefined) body[k] = d[k]; });
      await submitForm(fp, () => api("/usuarios/perfil", { method: "PATCH", body }), (res) => {
        localStorage.setItem("usuario", JSON.stringify(res.data));
        toast("Perfil actualizado"); renderNav();
      });
    };
    const fw = root.querySelector("#formPass");
    fw.onsubmit = async (e) => {
      e.preventDefault();
      const body = { passwordActual: fw.elements.passwordActual.value, passwordNueva: fw.elements.passwordNueva.value };
      await submitForm(fw, () => api("/usuarios/perfil/password", { method: "PATCH", body }), () => { toast("Contraseña actualizada"); fw.reset(); });
    };
  });
}, { auth: true });
