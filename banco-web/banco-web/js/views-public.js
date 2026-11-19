"use strict";
/* ============================================================
   views-public.js — inicio, productos, simulador, login, registro
   ============================================================ */

const DEMO_USERS = [
  ["cliente11@demo-banco.test", "Cliente sin solicitudes"],
  ["cliente3@demo-banco.test", "Cliente con hipoteca en avalúo"],
  ["analista1@demo-banco.test", "Analista"],
  ["valuador1@demo-banco.test", "Valuador"],
  ["admin@demo-banco.test", "Administrador"],
];

/* ---------- Inicio / catálogo ---------- */
function productoCard(p) {
  const hip = p.tipo === "hipoteca";
  return `<article class="card producto" data-tipo="${p.tipo}">
    <span class="tag ${hip ? "tag-hip" : ""}">${TIPO_LABEL[p.tipo] || p.tipo}</span>
    <h3>${esc(p.nombre)}</h3>
    <p class="muted">${esc(p.descripcion)}</p>
    <div class="tasa"><strong>${num(p.tasaAnual, 2)}%</strong><span>tasa anual fija</span></div>
    <dl class="mini">
      <div><dt>Monto</dt><dd>${money(p.montoMin)} – ${money(p.montoMax)}</dd></div>
      <div><dt>Plazos</dt><dd>${(p.plazosMeses || []).map((m) => (m / 12 >= 1 && m % 12 === 0 ? m / 12 + " a" : m + " m")).join(" · ")}</dd></div>
      ${hip ? `<div><dt>Enganche mín.</dt><dd>${num(p.engancheMinPct)}%</dd></div>` : ""}
    </dl>
    <div class="actions"><a class="btn sm" href="#/producto/${p.id}">Ver detalles</a><a class="btn primary sm" href="#/simulador?producto=${p.id}">Simular</a></div>
  </article>`;
}

route("/", async () => {
  const r = await api("/productos");
  const lista = r.ok ? unwrapList(r.data) : [];
  const html = `
    <section class="hero">
      <div class="container hero-in">
        <div>
          <p class="eyebrow">Banamex</p>
          <h1>Tu casa y tus planes, con los números claros.</h1>
          <p class="lead">Simula tu mensualidad, solicita una hipoteca o un crédito personal y sigue cada paso del trámite desde un solo lugar.</p>
          <div class="actions"><a class="btn primary lg" href="#/simulador"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19h16M6 16l4-5 3 2 5-7"/><path d="M15 6h3v3"/></svg>Simular mi crédito</a><a class="btn lg" href="#/solicitar">Solicitar ahora</a></div>
        </div>
        <div class="hero-visual">
        <svg class="hero-building" viewBox="0 0 380 300" role="img" aria-label="Ilustración decorativa de una casa y edificios"><defs><linearGradient id="buildingFill" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#f0c77c"/><stop offset="1" stop-color="#d89c49"/></linearGradient></defs><circle cx="200" cy="145" r="118" fill="rgba(255,255,255,.07)"/><path d="M48 251h294" stroke="rgba(255,255,255,.4)" stroke-width="3" stroke-linecap="round"/><path d="M88 250V132l70-51 70 51v118" fill="url(#buildingFill)" stroke="#fff1d2" stroke-width="4" stroke-linejoin="round"/><path d="M66 138 158 70l91 68" fill="none" stroke="#fff1d2" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><path d="M116 250v-56a24 24 0 0 1 48 0v56M180 157h27v34h-27z" fill="#28585a" stroke="#fff1d2" stroke-width="4"/><path d="M241 250V99h70v151" fill="#366a69" stroke="#d7e8dd" stroke-width="4"/><path d="M257 119h16v18h-16zm32 0h16v18h-16zm-32 37h16v18h-16zm32 0h16v18h-16zm-32 37h16v18h-16zm32 0h16v18h-16z" fill="#dbe9d8"/><path d="M60 250v-68h28m225 68v-48h18v48" fill="none" stroke="#d7e8dd" stroke-width="4"/></svg>
        <ul class="hero-steps" aria-label="Cómo funciona">
          <li><b>1</b> Elige un producto</li><li><b>2</b> Captura tus datos y documentos</li>
          <li><b>3</b> Valuamos tu casa (hipoteca)</li><li><b>4</b> Recibe tu oferta</li>
        </ul>
        </div>
      </div>
    </section>
    <section class="container benefits" aria-label="Beneficios">
      <article class="card benefit"><span class="benefit-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></span><h3>Simulación al instante</h3><p class="muted">Explora tus opciones antes de tomar una decisión.</p></article>
      <article class="card benefit"><span class="benefit-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6m-6 4h6m-6 4h3"/></svg></span><h3>Trámite en línea</h3><p class="muted">Completa y consulta tu solicitud desde un solo lugar.</p></article>
      <article class="card benefit"><span class="benefit-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h5l3-7 3 14 2-7h3"/></svg></span><h3>Seguimiento paso a paso</h3><p class="muted">Conoce el estado y lo que sigue en cada etapa.</p></article>
      <article class="card benefit"><span class="benefit-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 4 7v5c0 5 3.5 8 8 9 4.5-1 8-4 8-9V7z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></svg></span><h3>Oferta clara</h3><p class="muted">Consulta los montos, plazos y condiciones del crédito.</p></article>
    </section>
    <section class="container">
      <div class="section-head"><h2><svg class="heading-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M9 21v-7h6v7"/></svg>Nuestros productos</h2>
        <div class="tabs" role="tablist"><button class="tab on" data-f="">Todos</button><button class="tab" data-f="hipoteca">Hipotecas</button><button class="tab" data-f="prestamo">Créditos personales</button></div></div>
      ${r.ok ? `<div class="grid cols-3" id="prods">${lista.map(productoCard).join("") || emptyState("Por ahora no hay productos disponibles.")}</div>` : errorBox(r.error)}
    </section>
    <section class="container faq">
      <div class="section-head"><h2><svg class="heading-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.6 9a2.5 2.5 0 1 1 4.2 1.8c-1.1 1-1.8 1.3-1.8 3m0 3h.01"/></svg>Preguntas frecuentes</h2></div>
      <details class="card faq-item"><summary>¿Los productos y montos son reales?</summary><p>Sí, todos los productos financieros, tasas de interés y montos mostrados en nuestra plataforma están basados en nuestra oferta comercial vigente. Sin embargo, recuerda que los montos máximos de línea de crédito, préstamos o financiamiento están sujetos a una evaluación de riesgo y a la capacidad de pago individual de cada cliente al momento de formalizar la solicitud.   </p></details>
      <details class="card faq-item"><summary>¿Cómo puedo conocer una mensualidad estimada?</summary><p>Puedes utilizar nuestro simulador interactivo disponible en cada detalle de producto. Solo necesitas ingresar el monto deseado y el plazo de pago de tu preferencia. El sistema calculará de forma automática una estimación de tu pago mensual, el cual incluirá el capital, los intereses ordinarios y, en caso de aplicar, los seguros correspondientes.</p></details>
      <details class="card faq-item"><summary>¿Puedo consultar el avance de una solicitud?</summary><p>¡Por supuesto! Una vez que hayas ingresado tu solicitud de crédito o producto financiero, recibirás un número de folio en tu correo electrónico registrado. Con este folio y tu documento de identidad, podrás consultar el estatus y la fase de aprobación en tiempo real desde nuestra banca en línea o aplicación móvil en la sección "Mis Solicitudes".</p></details>
      <details class="card faq-item"><summary>¿Cómo funcionan los documentos de prueba?</summary><p>Los documentos de prueba (como comprobantes de ingresos, identificación oficial o comprobante de domicilio) son necesarios para validar tu identidad y solvencia financiera durante el proceso de análisis. Debes cargarlos en formato digital (PDF, JPG o PNG) directamente en nuestra plataforma de forma segura. Nuestro equipo de validación revisará que sean legibles y cumplan con los requisitos normativos para agilizar la autorización de tu trámite.</p></details>
    </section>`;
  return page(html, (root) => {
    root.querySelectorAll(".tab").forEach((t) => (t.onclick = () => {
      root.querySelectorAll(".tab").forEach((x) => x.classList.toggle("on", x === t));
      root.querySelectorAll("#prods .producto").forEach((c) => (c.hidden = !!t.dataset.f && c.dataset.tipo !== t.dataset.f));
    }));
  });
});

/* ---------- Detalle de producto ---------- */
route("/producto/:id", async ({ params }) => {
  const r = await api(`/productos/${params.id}`);
  if (!r.ok) return page(`<div class="container narrow">${errorBox(r.error)}<p><a href="#/">← Volver</a></p></div>`);
  const p = r.data;
  const u = getUser();
  const solicitarHref = isLogged() ? `#/solicitar?producto=${p.id}` : `#/login?next=${encodeURIComponent("#/solicitar?producto=" + p.id)}`;
  return page(`
    <div class="container narrow">
      <p><a href="#/">← Todos los productos</a></p>
      <span class="tag ${p.tipo === "hipoteca" ? "tag-hip" : ""}">${TIPO_LABEL[p.tipo]}</span>
      <h1>${esc(p.nombre)}</h1>
      <p class="lead">${esc(p.descripcion)}</p>
      <div class="stats">
        ${stat("Tasa anual", num(p.tasaAnual, 2) + "%")}
        ${stat("Monto", money(p.montoMin), "hasta " + money(p.montoMax))}
        ${stat("Plazos", (p.plazosMeses || []).map(plazoTxt).join("<br>"))}
        ${p.tipo === "hipoteca" ? stat("Enganche mínimo", num(p.engancheMinPct) + "%") : ""}
      </div>
      <div class="grid cols-2">
        <section class="card"><h3>Requisitos</h3><ul class="checks">${(p.requisitos || []).map((x) => `<li>${esc(x)}</li>`).join("") || "<li>Sin requisitos adicionales</li>"}</ul></section>
        <section class="card"><h3>Documentos que se piden</h3><ul class="checks">${(p.documentosRequeridos || []).map((x) => `<li>${esc(DOC_LABEL[x] || x)}</li>`).join("")}</ul></section>
      </div>
      <section class="card"><h3>Condiciones</h3><p>${esc(p.condiciones)}</p></section>
      <div class="actions"><a class="btn" href="#/simulador?producto=${p.id}">Simular este producto</a>
        ${!u || u.rol === "cliente" ? `<a class="btn primary" href="${solicitarHref}">Solicitar</a>` : ""}</div>
      ${leyenda("Producto demostrativo. Ninguna cifra representa información financiera real.")}
    </div>`);
});

/* ---------- Simulador ---------- */
route("/simulador", async ({ query }) => {
  const pr = await api("/productos");
  const productos = pr.ok ? unwrapList(pr.data) : [];
  let tipo = query.tipo || (query.producto ? productos.find((p) => String(p.id) === query.producto)?.tipo : null) || "prestamo";
  let preProducto = query.producto || "";

  const html = `
    <div class="container">
      <h1>Simulador</h1>
      <p class="lead">Calcula tu mensualidad al instante. Es solo una simulación demostrativa.</p>
      ${pr.ok ? "" : errorBox(pr.error, false)}
      <div class="tabs big" role="tablist"><button class="tab" data-t="prestamo">Crédito personal</button><button class="tab" data-t="hipoteca">Hipoteca</button></div>
      <div class="grid cols-sim">
        <form class="card" id="simForm" novalidate></form>
        <div id="simOut"><div class="card placeholder"><p class="muted">El resultado aparecerá aquí.</p></div></div>
      </div>
    </div>`;

  return page(html, (root) => {
    const form = root.querySelector("#simForm");
    const out = root.querySelector("#simOut");

    function draw() {
      root.querySelectorAll(".tab").forEach((t) => t.classList.toggle("on", t.dataset.t === tipo));
      const hip = tipo === "hipoteca";
      const lista = productos.filter((p) => p.tipo === tipo);
      const sel = lista.find((p) => String(p.id) === String(preProducto)) ? preProducto : lista[0]?.id || "";
      preProducto = sel;
      form.innerHTML = `
        ${selectHtml("Producto", "productoId", [...lista.map((p) => [p.id, `${p.nombre} — ${num(p.tasaAnual, 2)}%`]), ["", "Tasa personalizada…"]], sel)}
        <div id="tasaWrap" hidden>${fieldHtml("Tasa anual (%)", "tasaAnual", { type: "number", num: true, attrs: 'step="0.01" min="0" max="100"', value: "18" })}</div>
        ${hip ? fieldHtml("Valor del inmueble (MXN)", "valorInmueble", { type: "number", num: true, attrs: 'min="1" step="1000" required', value: "2500000" })
              : fieldHtml("Monto del crédito (MXN)", "monto", { type: "number", num: true, attrs: 'min="1" step="1000" required', value: "50000" })}
        ${hip ? fieldHtml("Enganche (MXN)", "enganche", { type: "number", num: true, attrs: 'min="0" step="1000" required', value: "700000" }) : ""}
        <label class="field"><span>Plazo</span><select name="plazoMeses" id="plazoSel"></select></label>
        <p class="form-error" role="alert"></p>
        <button class="btn primary block"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19h16M6 16l4-5 3 2 5-7"/><path d="M15 6h3v3"/></svg>Calcular</button>`;
      const psel = form.elements.productoId;
      const upd = () => {
        const p = lista.find((x) => String(x.id) === String(psel.value));
        form.querySelector("#tasaWrap").hidden = !!p;
        preProducto = psel.value;
        const plazos = p ? p.plazosMeses : [12, 24, 36, 48, 60, 120, 180, 240];
        form.elements.plazoMeses.innerHTML = plazos.map((m) => `<option value="${m}">${plazoTxt(m)}</option>`).join("");
        if (p) {
          const f = form.elements[hip ? "valorInmueble" : "monto"];
          f.placeholder = hip ? "" : `${money(p.montoMin)} – ${money(p.montoMax)}`;
          if (!hip && (Number(f.value) < p.montoMin || Number(f.value) > p.montoMax)) f.value = p.montoMin;
          if (hip) form.elements.enganche.title = `Mínimo ${p.engancheMinPct}% del valor`;
        }
      };
      psel.onchange = upd;
      upd();
      form.onsubmit = async (e) => {
        e.preventDefault();
        const d = readForm(form);
        const body = { plazoMeses: Number(d.plazoMeses) };
        if (d.productoId) body.productoId = Number(d.productoId); else body.tasaAnual = d.tasaAnual;
        if (hip) { body.valorInmueble = d.valorInmueble; body.enganche = d.enganche; } else body.monto = d.monto;
        const r = await submitForm(form, () => api(`/simuladores/${tipo}`, { method: "POST", body }));
        if (r.ok) showResult(r.data);
      };
    }

    function showResult(d) {
      out.innerHTML = `
        <div class="card result">
          <p class="eyebrow">Mensualidad estimada</p>
          <div class="big-number">${money(d.mensualidad)}</div>
          <p class="muted">${esc(d.productoNombre || "Tasa personalizada")} · ${num(d.tasaAnual, 2)}% anual · ${plazoTxt(d.plazoMeses)}</p>
          <div class="grid cols-2 result-visuals"><div><h3>Distribución del total</h3>${donutChart([{ label: "Capital", value: Number(d.monto) || 0 }, { label: "Intereses", value: Number(d.totalIntereses) || 0 }], { title: "Distribución del pago", format: "money" })}</div><div><h3>Resumen de tu simulación</h3>${kv([["Monto financiado", money(d.monto)], ["Total de intereses", money(d.totalIntereses)], ["Total a pagar", money(d.totalPagar)], ["CAT demostrativo", num(d.catDemo, 2) + "%"]])}</div></div>
          ${d.mensajeEnganche ? `<p class="notice ${d.cumpleEngancheMinimo ? "ok" : "bad"}">${esc(d.mensajeEnganche)} (${num(d.enganchePct, 1)}% · mínimo ${money(d.engancheMinimo)})</p>` : ""}
          <button class="btn" id="btnTabla">Ver tabla de pagos</button>
          <div id="tablaOut"></div>
          ${leyenda(d.leyenda)}
        </div>`;
      bindCharts(out);
      observeReveal(out);
      animateNumbers(out);
      out.querySelector("#btnTabla").onclick = async (e) => {
        e.target.disabled = true;
        const r = await api("/simuladores/amortizacion", { method: "POST", body: { monto: d.monto, tasaAnual: d.tasaAnual, plazoMeses: d.plazoMeses } });
        e.target.disabled = false;
        if (!r.ok) return toast(r.error.message, "error");
        const t = out.querySelector("#tablaOut");
        t.innerHTML = `<h3>Evolución del saldo</h3>${lineChart(r.data.tabla)}${tablaPagos(r.data.tabla)}`;
        bindTablaPagos(t);
        bindCharts(t);
        observeReveal(t);
        animateNumbers(t);
        e.target.hidden = true;
      };
    }

    root.querySelectorAll(".tab").forEach((t) => (t.onclick = () => { tipo = t.dataset.t; out.innerHTML = '<div class="card placeholder"><p class="muted">El resultado aparecerá aquí.</p></div>'; draw(); }));
    draw();
  });
});

/* ---------- Login ---------- */
route("/login", async ({ query }) => {
  if (isLogged()) { location.hash = homeFor(getUser().rol); return page(""); }
  return page(`
    <div class="container auth">
      <form class="card" id="loginForm" novalidate>
        <h1>Iniciar sesión</h1>
        ${fieldHtml("Correo electrónico", "email", { type: "email", attrs: 'required autocomplete="username"' })}
        ${fieldHtml("Contraseña", "password", { type: "password", attrs: 'required autocomplete="current-password"' })}
        <p class="form-error" role="alert"></p>
        <button class="btn primary block">Entrar</button>
        <p class="muted center">¿Aún no tienes cuenta? <a href="#/registro">Créala aquí</a></p>
      </form>
      <aside class="card demo-users">
        <h3>Usuarios de prueba</h3>
        <p class="muted">Cuentas ficticias de laboratorio. Contraseña: <code>Demo1234!</code></p>
        <div class="chips">${DEMO_USERS.map(([e, t]) => `<button type="button" class="chip" data-email="${e}"><b>${esc(t)}</b><small>${e}</small></button>`).join("")}</div>
      </aside>
    </div>`, (root) => {
    const form = root.querySelector("#loginForm");
    root.querySelectorAll(".chip").forEach((c) => (c.onclick = () => {
      form.elements.email.value = c.dataset.email; form.elements.password.value = "Demo1234!"; form.elements.email.focus();
    }));
    form.onsubmit = async (e) => {
      e.preventDefault();
      const d = readForm(form);
      const r = await submitForm(form, () => api("/auth/login", { method: "POST", body: { email: d.email, password: d.password } }));
      if (!r.ok) return;
      setSession(r.data);
      toast(`Bienvenido, ${r.data.usuario.nombre}`);
      const next = query.next ? decodeURIComponent(query.next) : "";
      location.hash = next.startsWith("#/") ? next : homeFor(r.data.usuario.rol);
      renderNav();
    };
  });
});

/* ---------- Registro ---------- */
route("/registro", async () => {
  if (isLogged()) { location.hash = homeFor(getUser().rol); return page(""); }
  return page(`
    <div class="container auth">
      <form class="card" id="regForm" novalidate>
        <h1>Crear cuenta</h1>
        <p class="muted">Te abrimos una cuenta de débito demo para que pruebes la banca.</p>
        <div class="form-grid">
          ${fieldHtml("Nombre", "nombre", { attrs: 'required minlength="2" autocomplete="given-name"' })}
          ${fieldHtml("Apellidos", "apellidos", { attrs: 'required minlength="2" autocomplete="family-name"' })}
        </div>
        ${fieldHtml("Correo electrónico", "email", { type: "email", attrs: 'required autocomplete="email"', hint: "Usa un correo ficticio, por ejemplo nombre@demo-banco.test" })}
        ${fieldHtml("Teléfono (opcional)", "telefono", { type: "tel", attrs: 'inputmode="tel" autocomplete="tel"', hint: "De 10 a 15 dígitos" })}
        ${fieldHtml("Contraseña", "password", { type: "password", attrs: 'required minlength="8" autocomplete="new-password"', hint: "Mínimo 8 caracteres, con una mayúscula y un número. No uses una contraseña real." })}
        <p class="form-error" role="alert"></p>
        <button class="btn primary block">Crear cuenta</button>
        <p class="muted center">¿Ya tienes cuenta? <a href="#/login">Inicia sesión</a></p>
      </form>
    </div>`, (root) => {
    const form = root.querySelector("#regForm");
    form.onsubmit = async (e) => {
      e.preventDefault();
      const d = readForm(form);
      const r = await submitForm(form, () => api("/usuarios/registro", { method: "POST", body: d }));
      if (!r.ok) return;
      const l = await api("/auth/login", { method: "POST", body: { email: d.email, password: d.password } });
      if (l.ok) {
        setSession(l.data);
        toast("Cuenta creada. Ya tienes una cuenta de débito demo.");
        location.hash = "#/banca";
        renderNav();
      } else { toast("Cuenta creada. Inicia sesión para continuar."); location.hash = "#/login"; }
    };
  });
});
