"use strict";
/* ============================================================
   core.js — cliente de la API, sesión, utilidades de UI y router
   ============================================================ */

const DEFAULT_BASE = "http://localhost:8000/api/v1";
const baseUrl = () => (localStorage.getItem("apiBase") || DEFAULT_BASE).replace(/\/+$/, "");

/* ---------- Sesión ---------- */
const getUser = () => {
  try { return JSON.parse(localStorage.getItem("usuario")); } catch { return null; }
};
const isLogged = () => !!localStorage.getItem("token") && !!getUser();
function setSession(data) {
  localStorage.setItem("token", data.accessToken);
  localStorage.setItem("usuario", JSON.stringify(data.usuario));
}
function cerrarSesion() {
  localStorage.removeItem("token");
  localStorage.removeItem("usuario");
}
const homeFor = (rol) =>
  ({ cliente: "#/banca", analista: "#/bandeja", valuador: "#/avaluos", admin: "#/admin" }[rol] || "#/");

/* ---------- Cliente de la API ---------- */
async function api(ruta, { method = "GET", body, query } = {}) {
  const token = localStorage.getItem("token");
  let url = baseUrl() + ruta;
  if (query) {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== "") p.set(k, v);
    const s = p.toString();
    if (s) url += "?" + s;
  }
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    return {
      ok: false,
      error: {
        code: "SIN_CONEXION",
        message: `No se pudo conectar con la API (${baseUrl()}). Verifica que esté encendida y que el puerto de esta página esté en CORS_ORIGINS.`,
      },
    };
  }
  if (res.status === 204) return { ok: true, data: null, status: 204 };
  let json;
  try { json = await res.json(); } catch {
    return { ok: false, status: res.status, error: { code: "RESPUESTA_INVALIDA", message: `Respuesta inesperada del servidor (HTTP ${res.status}).` } };
  }
  json.status = res.status;
  if (res.status === 401 && ruta !== "/auth/login") {
    cerrarSesion();
    toast("Tu sesión terminó. Inicia sesión de nuevo.", "warn");
    location.hash = "#/login";
  }
  return json;
}

/* ---------- Utilidades de formato ---------- */
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (n) =>
  n === null || n === undefined || n === "" ? "—"
    : new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(n));
const num = (n, d = 0) =>
  n === null || n === undefined ? "—" : new Intl.NumberFormat("es-MX", { maximumFractionDigits: d }).format(Number(n));
const fdate = (s) => {
  if (!s) return "—";
  const d = new Date(String(s).length === 10 ? s + "T00:00:00" : s + "Z");
  return isNaN(d) ? esc(s) : d.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: String(s).length === 10 ? undefined : "short" });
};
const fday = (s) => {
  if (!s) return "—";
  const d = new Date(String(s).length === 10 ? s + "T00:00:00" : s + "Z");
  return isNaN(d) ? esc(s) : d.toLocaleDateString("es-MX", { dateStyle: "medium" });
};
const plazoTxt = (m) => (m % 12 === 0 && m >= 12 ? `${m} meses (${m / 12} años)` : `${m} meses`);

const ESTADOS = {
  borrador: ["En captura", "gray"],
  datos_completos: ["Lista para evaluar", "blue"],
  en_avaluo: ["Avalúo en proceso", "blue"],
  avaluo_completado: ["Avalúo listo", "blue"],
  en_analisis: ["En análisis", "amber"],
  aprobada: ["Aprobada", "green"],
  condicionada: ["Aprobada con condiciones", "amber"],
  rechazada: ["No aprobada", "red"],
  oferta_aceptada: ["Oferta aceptada", "green"],
  oferta_rechazada: ["Oferta rechazada", "gray"],
  formalizada: ["Crédito activo", "green"],
  cancelada: ["Cancelada", "gray"],
};
const ESTADOS_FINALES = ["formalizada", "cancelada", "oferta_rechazada", "rechazada"];
const badge = (estado) => {
  const [t, c] = ESTADOS[estado] || [estado, "gray"];
  return `<span class="badge ${c}">${esc(t)}</span>`;
};
const DOC_LABEL = {
  identificacion: "Identificación oficial",
  comprobante_domicilio: "Comprobante de domicilio",
  comprobante_ingresos: "Comprobante de ingresos",
  estados_cuenta: "Estados de cuenta",
  escrituras: "Escrituras",
  predial: "Predial",
};
const docBadge = (estado) => {
  const m = { pendiente: "gray", entregado: "blue", validado: "green", rechazado: "red" };
  return `<span class="badge ${m[estado] || "gray"}">${esc(estado)}</span>`;
};
const TIPO_LABEL = { hipoteca: "Hipoteca", prestamo: "Crédito personal" };
const ROL_LABEL = { cliente: "Cliente", analista: "Analista", valuador: "Valuador", admin: "Administrador" };

/* ---------- Toasts ---------- */
function toast(msg, type = "ok") {
  let box = document.getElementById("toasts");
  if (!box) { box = document.createElement("div"); box.id = "toasts"; document.body.appendChild(box); }
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.setAttribute("role", "status");
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 300); }, type === "error" ? 6500 : 4000);
}

/* ---------- Diálogos ---------- */
function openDialog(title, bodyHtml, mount) {
  const dlg = document.createElement("dialog");
  dlg.innerHTML = `<div class="dlg-head"><h3>${esc(title)}</h3><button type="button" class="btn ghost sm" data-close aria-label="Cerrar">✕</button></div><div class="dlg-body">${bodyHtml}</div>`;
  document.body.appendChild(dlg);
  dlg.addEventListener("close", () => dlg.remove());
  dlg.querySelector("[data-close]").addEventListener("click", () => dlg.close());
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
  dlg.showModal();
  mount && mount(dlg);
  return dlg;
}
/** Pide un texto corto. Devuelve string ("" si lo dejó vacío) o null si cancela. */
function askText({ title, label, required = false, minLength = 0, submit = "Continuar", placeholder = "" }) {
  return new Promise((resolve) => {
    let done = false;
    const dlg = openDialog(title, `
      <form>
        <label class="field"><span>${esc(label)}</span>
          <textarea name="t" rows="3" placeholder="${esc(placeholder)}" ${required ? "required" : ""} minlength="${minLength}"></textarea>
        </label>
        <div class="actions"><button type="button" class="btn ghost" data-close2>Cancelar</button><button class="btn primary">${esc(submit)}</button></div>
      </form>`, (d) => {
      d.querySelector("[data-close2]").onclick = () => d.close();
      d.querySelector("form").onsubmit = (e) => {
        e.preventDefault();
        done = true;
        resolve(d.querySelector("textarea").value.trim());
        d.close();
      };
    });
    dlg.addEventListener("close", () => { if (!done) resolve(null); });
  });
}

/* ---------- Formularios ---------- */
function readForm(form) {
  const o = {};
  for (const el of form.elements) {
    if (!el.name || el.disabled) continue;
    if (el.type === "checkbox") { o[el.name] = el.checked; continue; }
    if (el.type === "radio" && !el.checked) continue;
    let v = el.value.trim();
    if (v === "") { o[el.name] = undefined; continue; }
    if (el.dataset.num !== undefined) v = Number(v);
    o[el.name] = v;
  }
  return o;
}
function clearErrors(form) {
  form.querySelectorAll(".field-error").forEach((e) => e.remove());
  form.querySelectorAll(".invalid").forEach((e) => e.classList.remove("invalid"));
  const g = form.querySelector(".form-error");
  if (g) g.textContent = "";
}
/** Marca en rojo cada campo que reporta la API (error.details) o muestra el mensaje general. */
function showErrors(form, error) {
  clearErrors(form);
  const g = form.querySelector(".form-error");
  const general = [];
  if (error.code === "ERROR_VALIDACION" && Array.isArray(error.details)) {
    error.details.forEach((d) => {
      const parts = String(d.campo || "").split(".");
      let name = parts[parts.length - 1];
      const ri = parts.indexOf("referencias");
      if (ri >= 0 && parts.length > ri + 2) name = `ref${parts[ri + 1]}_${parts[ri + 2]}`;
      const input = form.elements[name];
      if (input && input.classList) {
        input.classList.add("invalid");
        const m = document.createElement("small");
        m.className = "field-error";
        m.textContent = d.mensaje;
        (input.closest("label,.field") || input.parentElement).appendChild(m);
      } else general.push(`${d.campo}: ${d.mensaje}`);
    });
    if (g) g.textContent = general.length ? general.join(" · ") : "Revisa los campos marcados.";
    form.querySelector(".invalid")?.focus();
  } else if (g) g.textContent = error.message;
  else toast(error.message, "error");
}
/** Ejecuta fn() con los botones del formulario bloqueados. fn devuelve la respuesta de la API. */
async function submitForm(form, fn, onOk) {
  clearErrors(form);
  const btns = [...form.querySelectorAll("button")];
  btns.forEach((b) => (b.disabled = true));
  const r = await fn();
  btns.forEach((b) => (b.disabled = false));
  if (!r.ok) { showErrors(form, r.error); return r; }
  onOk && onOk(r);
  return r;
}

/* ---------- Piezas de UI ---------- */
const page = (html, mount) => ({ html, mount });
const errorBox = (error, retry = true) => `
  <div class="card error-box"><h3>No se pudo cargar</h3><p>${esc(error?.message || "Error desconocido")}</p>
  ${retry ? '<button class="btn" data-retry>Reintentar</button>' : ""}</div>`;
const loading = () => `<div class="loading" role="status" aria-label="Cargando contenido"><span class="skeleton skeleton-title"></span><span class="skeleton skeleton-row"></span><span class="skeleton skeleton-row"></span><span class="skeleton skeleton-card"></span></div>`;
const emptyState = (message) => `<div class="empty-state" role="status"><svg viewBox="0 0 120 90" aria-hidden="true"><path d="M17 37 60 9l43 28v42H17z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M47 79V52h26v27M28 43h8m48 0h8" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><circle cx="92" cy="21" r="10" fill="var(--primary-soft)" stroke="currentColor" stroke-width="3"/></svg><p>${esc(message)}</p></div>`;

function donutChart(a, b, options = {}) {
  const rows = Array.isArray(a) ? a : [
    { label: options.labels?.[0] || "Capital", value: a },
    { label: options.labels?.[1] || "Intereses", value: b },
  ];
  const colors = ["#176b62", "#d19a43", "#4f78a5", "#9a6caf", "#d06b56", "#68843d", "#54777c"];
  const total = rows.reduce((sum, row) => sum + Math.max(0, Number(row.value) || 0), 0);
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const segments = rows.map((row, i) => {
    const value = Math.max(0, Number(row.value) || 0);
    const length = total ? (value / total) * circumference : 0;
    const segment = `<circle class="donut-segment" cx="60" cy="60" r="${radius}" fill="none" stroke="${colors[i % colors.length]}" stroke-width="17" stroke-dasharray="${length} ${circumference - length}" stroke-dashoffset="${-offset}" transform="rotate(-90 60 60)"><title>${esc(row.label)}: ${esc(options.format === "money" ? money(value) : num(value))}</title></circle>`;
    offset += length;
    return segment;
  }).join("");
  const legend = rows.map((row, i) => {
    const value = Math.max(0, Number(row.value) || 0);
    const pct = total ? Math.round((value / total) * 100) : 0;
    const text = options.format === "money" ? money(value) : num(value);
    return `<li><i style="--legend-color:${colors[i % colors.length]}"></i><span>${esc(row.label)}</span><b>${esc(text)}</b><small>${pct}%</small></li>`;
  }).join("");
  return `<div class="donut-chart"><svg viewBox="0 0 120 120" role="img" aria-label="${esc(options.title || "Gráfica de dona")}">${segments}<circle cx="60" cy="60" r="34" fill="var(--card)"/><text x="60" y="57" text-anchor="middle" class="donut-total">${esc(num(total))}</text><text x="60" y="70" text-anchor="middle" class="donut-caption">TOTAL</text></svg><ul class="donut-legend">${legend || `<li>${esc("Sin datos para mostrar")}</li>`}</ul></div>`;
}

function lineChart(tabla) {
  const rows = (tabla || []).filter((row) => row && Number.isFinite(Number(row.saldo)));
  if (!rows.length) return emptyState("Todavía no hay datos para graficar.");
  const sample = rows.length > 32 ? rows.filter((_, i) => i % Math.ceil(rows.length / 32) === 0 || i === rows.length - 1) : rows;
  const values = sample.map((row) => Math.max(0, Number(row.saldo)));
  const max = Math.max(1, ...values);
  const width = 640, height = 220, left = 54, right = 18, top = 18, bottom = 32;
  const x = (i) => left + (sample.length <= 1 ? 0 : i * (width - left - right) / (sample.length - 1));
  const y = (v) => top + (1 - v / max) * (height - top - bottom);
  const pts = sample.map((row, i) => `${x(i).toFixed(1)},${y(values[i]).toFixed(1)}`).join(" ");
  const area = `${left},${height - bottom} ${pts} ${x(sample.length - 1).toFixed(1)},${height - bottom}`;
  const guides = [0, .5, 1].map((pct) => {
    const gy = y(max * pct);
    return `<line x1="${left}" y1="${gy}" x2="${width - right}" y2="${gy}" class="chart-gridline"/><text x="${left - 8}" y="${gy + 4}" text-anchor="end" class="chart-axis">${esc(num(max * pct))}</text>`;
  }).join("");
  const points = sample.map((row, i) =>
    `<circle class="chart-point" cx="${x(i).toFixed(1)}" cy="${y(values[i]).toFixed(1)}" r="4" tabindex="0" role="img" aria-label="Pago ${esc(row.numero ?? i + 1)}: saldo ${esc(money(values[i]))}" data-chart-value="${esc(money(values[i]))}" data-chart-index="${esc(row.numero ?? i + 1)}"><title>Pago ${esc(row.numero ?? i + 1)} · ${esc(money(values[i]))}</title></circle>`
  ).join("");
  return `<div class="line-chart"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Evolución del saldo por pago">${guides}<polygon points="${area}" class="chart-area"/><polyline points="${pts}" class="chart-line"/>${points}<text x="${left}" y="${height - 7}" class="chart-axis">Inicio</text><text x="${width - right}" y="${height - 7}" text-anchor="end" class="chart-axis">Pago ${esc(sample[sample.length - 1].numero ?? sample.length)}</text><g class="chart-tooltip" hidden><rect width="126" height="28" rx="6"/><text x="10" y="19"></text></g></svg></div>`;
}

function bindCharts(root) {
  root.querySelectorAll(".line-chart").forEach((chart) => {
    const svg = chart.querySelector("svg");
    const tooltip = chart.querySelector(".chart-tooltip");
    const text = tooltip?.querySelector("text");
    const rect = tooltip?.querySelector("rect");
    chart.querySelectorAll(".chart-point").forEach((point) => {
      const show = () => {
        const x = Number(point.getAttribute("cx"));
        const y = Number(point.getAttribute("cy"));
        tooltip.hidden = false;
        text.textContent = `Pago ${point.dataset.chartIndex}: ${point.dataset.chartValue}`;
        rect.setAttribute("width", Math.min(290, text.getComputedTextLength() + 20));
        tooltip.setAttribute("transform", `translate(${Math.max(0, Math.min(640 - rect.getAttribute("width"), x - 60))} ${Math.max(0, y - 38)})`);
      };
      point.addEventListener("mouseenter", show);
      point.addEventListener("focus", show);
      point.addEventListener("mouseleave", () => { tooltip.hidden = true; });
      point.addEventListener("blur", () => { tooltip.hidden = true; });
    });
  });
}

const animatedValues = new WeakSet();
function animateNumbers(root) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  root.querySelectorAll(".big-number, .saldo, .saldo-total, .stat-v").forEach((el) => {
    if (animatedValues.has(el)) return;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const match = node.nodeValue.match(/\d[\d,]*(?:\.\d+)?/);
      if (!match) continue;
      const target = Number(match[0].replace(/,/g, ""));
      if (!Number.isFinite(target) || target <= 0) break;
      animatedValues.add(el);
      const decimals = (match[0].split(".")[1] || "").length;
      const before = node.nodeValue.slice(0, match.index);
      const after = node.nodeValue.slice(match.index + match[0].length);
      const start = performance.now();
      const tick = (now) => {
        const pct = Math.min(1, (now - start) / 700);
        const value = target * (1 - Math.pow(1 - pct, 3));
        node.nodeValue = before + new Intl.NumberFormat("es-MX", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value) + after;
        if (pct < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      break;
    }
  });
}

function observeReveal(root) {
  const items = root.querySelectorAll(".card, .section-head, .stats");
  if (!items.length || matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
    items.forEach((item) => item.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver((entries, current) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        current.unobserve(entry.target);
      }
    });
  }, { threshold: .08 });
  items.forEach((item) => {
    item.classList.add("reveal");
    observer.observe(item);
  });
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("tema", theme);
  const button = document.getElementById("btnTheme");
  if (button) {
    const dark = theme === "dark";
    button.setAttribute("aria-label", dark ? "Activar modo claro" : "Activar modo oscuro");
    button.setAttribute("title", dark ? "Activar modo claro" : "Activar modo oscuro");
    button.innerHTML = dark
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5 8.5 8.5 0 1 0 20.5 15.5Z"/></svg>';
  }
}
const fieldHtml = (label, name, { type = "text", value = "", attrs = "", hint = "", num = false } = {}) => `
  <label class="field"><span>${esc(label)}</span>
  <input name="${name}" type="${type}" value="${esc(value)}" ${num ? "data-num" : ""} ${attrs}>${hint ? `<em>${esc(hint)}</em>` : ""}</label>`;
const selectHtml = (label, name, opts, value = "", attrs = "") => `
  <label class="field"><span>${esc(label)}</span>
  <select name="${name}" ${attrs}>${opts.map(([v, t]) => `<option value="${esc(v)}" ${String(v) === String(value) ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label>`;
const kv = (pairs) =>
  `<dl class="kv">${pairs.filter((p) => p).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v === null || v === undefined || v === "" ? "—" : v}</dd></div>`).join("")}</dl>`;
const stat = (label, value, sub = "") =>
  `<div class="stat"><span class="stat-l">${esc(label)}</span><strong class="stat-v">${value}</strong>${sub ? `<small>${sub}</small>` : ""}</div>`;
const progressBar = (pct) =>
  `<div class="progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></div>`;
const leyenda = (t) => (t ? `<p class="leyenda">${esc(t)}</p>` : "");

function pagerHtml(meta) {
  if (!meta) return "";
  const pages = Math.max(1, Math.ceil(meta.total / meta.limit));
  if (pages <= 1) return `<p class="muted pager-info">${meta.total} resultado${meta.total === 1 ? "" : "s"}</p>`;
  return `<nav class="pager" aria-label="Paginación">
    <button class="btn sm" data-page="${meta.page - 1}" ${meta.page <= 1 ? "disabled" : ""}>← Anterior</button>
    <span>Página ${meta.page} de ${pages} · ${meta.total} resultados</span>
    <button class="btn sm" data-page="${meta.page + 1}" ${meta.page >= pages ? "disabled" : ""}>Siguiente →</button></nav>`;
}
function bindPager(root, cb) {
  root.querySelectorAll("[data-page]").forEach((b) => (b.onclick = () => cb(Number(b.dataset.page))));
}
function tablaPagos(tabla, max = 24) {
  const rows = (tabla || []).filter((r) => r && typeof r === "object");
  const fechas = rows.some((r) => r.fechaPago);
  const body = (list) => list.map((r) => `<tr><td>${esc(r.numero)}</td>${fechas ? `<td>${fday(r.fechaPago)}</td>` : ""}<td>${money(r.pago)}</td><td>${money(r.capital)}</td><td>${money(r.interes)}</td><td>${money(r.saldo)}</td></tr>`).join("");
  return `<div class="table-wrap tall"><table class="table pagos"><thead><tr><th>#</th>${fechas ? "<th>Fecha</th>" : ""}<th>Pago</th><th>Capital</th><th>Interés</th><th>Saldo</th></tr></thead>
    <tbody>${body(rows.slice(0, max))}</tbody>${rows.length > max ? `<tbody data-rest hidden>${body(rows.slice(max))}</tbody>` : ""}</table></div>
    ${rows.length > max ? `<button class="btn sm" data-toggle-rest>Ver los ${rows.length} pagos</button>` : ""}`;
}
function bindTablaPagos(root) {
  const btn = root.querySelector("[data-toggle-rest]");
  if (!btn) return;
  btn.onclick = () => {
    const rest = root.querySelector("[data-rest]");
    rest.hidden = !rest.hidden;
    btn.textContent = rest.hidden ? "Ver todos los pagos" : "Ver menos";
  };
}
const unwrapList = (d) => (Array.isArray(d) ? d : d?.items || d?.productos || []);

/* ---------- Router ---------- */
const App = { routes: [], navId: 0, current: null };
function route(pattern, handler, opts = {}) {
  const re = new RegExp("^" + pattern.replace(/:(\w+)/g, "(?<$1>[^/]+)") + "$");
  App.routes.push({ re, handler, opts });
}
async function navigate(keepScroll = false) {
  const view = document.getElementById("view");
  const raw = location.hash.slice(1) || "/";
  const [path, qs] = raw.split("?");
  const query = Object.fromEntries(new URLSearchParams(qs || ""));
  const id = ++App.navId;
  renderNav();
  for (const r of App.routes) {
    const m = path.match(r.re);
    if (!m) continue;
    const user = getUser();
    if (r.opts.auth && !isLogged()) { location.hash = `#/login?next=${encodeURIComponent(raw)}`; return; }
    if (r.opts.roles && !r.opts.roles.includes(user?.rol)) {
      view.innerHTML = `<div class="container narrow"><div class="card error-box"><h2>No tienes acceso</h2><p>Tu rol (${esc(ROL_LABEL[user?.rol] || "—")}) no puede ver esta pantalla.</p><a class="btn" href="${homeFor(user?.rol)}">Ir a mi inicio</a></div></div>`;
      return;
    }
    App.current = { path, query, params: m.groups || {} };
    const scrollY = window.scrollY;
    if (!keepScroll) view.innerHTML = `<div class="container">${loading()}</div>`;
    let out;
    try { out = await r.handler({ params: m.groups || {}, query }); }
    catch (e) { console.error(e); out = page(`<div class="container narrow">${errorBox({ message: "Ocurrió un error al mostrar la pantalla: " + e.message })}</div>`); }
    if (id !== App.navId) return; // el usuario ya navegó a otra pantalla
    view.innerHTML = out.html;
    view.querySelectorAll("[data-retry]").forEach((b) => (b.onclick = () => navigate()));
    out.mount && out.mount(view);
    bindCharts(view);
    animateNumbers(view);
    observeReveal(view);
    window.scrollTo(0, keepScroll ? scrollY : 0);
    document.title = (view.querySelector("h1")?.textContent || "Banamex") + " · Banamex";
    view.focus({ preventScroll: true });
    return;
  }
  view.innerHTML = `<div class="container narrow"><div class="card error-box"><h2>Página no encontrada</h2><a class="btn" href="#/">Volver al inicio</a></div></div>`;
}
const reload = () => navigate(true);

/* ---------- Navegación superior ---------- */
function menuFor(rol) {
  const pub = [["#/", "Productos"], ["#/simulador", "Simulador"]];
  const by = {
    cliente: [["#/banca", "Mi banca"], ["#/solicitudes", "Mis solicitudes"], ["#/solicitar", "Solicitar"], ["#/simulador", "Simulador"]],
    analista: [["#/bandeja", "Bandeja"], ["#/avaluos", "Avalúos"], ["#/simulador", "Simulador"]],
    valuador: [["#/avaluos", "Mis avalúos"]],
    admin: [["#/admin", "Estadísticas"], ["#/bandeja", "Solicitudes"], ["#/avaluos", "Avalúos"], ["#/admin/usuarios", "Usuarios"], ["#/admin/productos", "Productos"], ["#/banca", "Cuentas"]],
  };
  return rol ? by[rol] || pub : pub;
}
function renderNav() {
  const nav = document.getElementById("nav");
  const wasOpen = nav.classList.contains("is-open");
  const u = isLogged() ? getUser() : null;
  const cur = "#" + (location.hash.slice(1).split("?")[0] || "/");
  const links = menuFor(u?.rol).map(([h, t]) => `<a href="${h}" ${cur === h ? 'aria-current="page"' : ""}>${esc(t)}</a>`).join("");
  const right = `<button class="btn ghost sm theme-toggle" id="btnTheme" type="button" aria-label="Activar modo oscuro"></button>` + (u
    ? `<a class="user-chip" href="#/perfil" title="Mi perfil"><span class="avatar">${esc((u.nombre || "?")[0])}</span><span>${esc(u.nombre)}<small>${esc(ROL_LABEL[u.rol] || u.rol)}</small></span></a><button class="btn ghost sm" id="btnSalir">Salir</button>`
    : `<a class="btn ghost sm" href="#/login">Entrar</a><a class="btn primary sm" href="#/registro">Crear cuenta</a>`);
  nav.innerHTML = `<div class="nav-links">${links}</div><div class="nav-right">${right}</div>`;
  nav.classList.toggle("is-open", wasOpen);
  const themeButton = document.getElementById("btnTheme");
  themeButton.onclick = () => applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  applyTheme(document.documentElement.dataset.theme || "light");
  const menuButton = document.getElementById("btnMenu");
  if (menuButton) {
    menuButton.setAttribute("aria-expanded", String(wasOpen));
    menuButton.setAttribute("aria-label", wasOpen ? "Cerrar menú de navegación" : "Abrir menú de navegación");
    menuButton.onclick = () => {
      const open = nav.classList.toggle("is-open");
      menuButton.setAttribute("aria-expanded", String(open));
      menuButton.setAttribute("aria-label", open ? "Cerrar menú de navegación" : "Abrir menú de navegación");
    };
    nav.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
      nav.classList.remove("is-open");
      menuButton.setAttribute("aria-expanded", "false");
      menuButton.setAttribute("aria-label", "Abrir menú de navegación");
    }));
  }
  const out = document.getElementById("btnSalir");
  if (out) out.onclick = () => { cerrarSesion(); toast("Sesión cerrada"); location.hash = "#/"; renderNav(); };
}

/* ---------- Configuración de la API y estado ---------- */
async function pingHealth() {
  const el = document.getElementById("apiStatus");
  if (!el) return;
  const r = await api("/health");
  el.className = "dot " + (r.ok ? "on" : "off");
  el.title = r.ok ? "API en línea" : "API sin conexión";
  const t = document.getElementById("apiStatusText");
  if (t) t.textContent = r.ok ? "API en línea" : "API sin conexión";
}
function configApi() {
  openDialog("Dirección de la API", `
    <form>
      ${fieldHtml("URL base", "base", { value: baseUrl(), hint: "Ejemplo: http://192.168.1.20:8000/api/v1" })}
      <p class="muted">Si esta página corre en un puerto distinto de 3000, agrégalo a <code>CORS_ORIGINS</code> en el <code>.env</code> de la API.</p>
      <div class="actions"><button type="button" class="btn ghost" data-reset>Restablecer</button><button class="btn primary">Guardar</button></div>
    </form>`, (d) => {
    d.querySelector("[data-reset]").onclick = () => { localStorage.removeItem("apiBase"); d.close(); pingHealth(); toast("URL restablecida"); };
    d.querySelector("form").onsubmit = (e) => {
      e.preventDefault();
      const v = d.querySelector("[name=base]").value.trim();
      if (!/^https?:\/\//.test(v)) return toast("Escribe una URL que empiece con http:// o https://", "error");
      localStorage.setItem("apiBase", v);
      d.close(); pingHealth(); toast("URL guardada"); navigate();
    };
  });
}

window.addEventListener("hashchange", () => navigate());
window.addEventListener("DOMContentLoaded", () => {
  if (!document.documentElement.dataset.theme) {
    const stored = localStorage.getItem("tema");
    applyTheme(stored || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  }
  document.getElementById("btnConfig").onclick = configApi;
  pingHealth();
  navigate();
});
