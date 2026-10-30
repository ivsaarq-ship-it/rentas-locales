"use strict";
// Rentas Sandra — todo vive en el celular (IndexedDB). Sin servidor.

/* ================= Base de datos ================= */
const DB_NOMBRE = "rentas-sandra";
let db, E; // E = estado completo

function abrirDB() {
  return new Promise((ok, mal) => {
    const r = indexedDB.open(DB_NOMBRE, 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore("estado");
      r.result.createObjectStore("fotos");
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => mal(r.error);
  });
}
function tx(store, modo, fn) {
  return new Promise((ok, mal) => {
    const t = db.transaction(store, modo);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => ok(req && req.result);
    t.onerror = () => mal(t.error);
  });
}
// Cada cambio queda con fecha; si Drive está conectado se sube solo unos segundos después.
const guardarLocal = () => tx("estado", "readwrite", s => s.put(E, "principal"));
async function guardar() {
  E.guardadoEn = new Date().toISOString();
  await guardarLocal();
  programarSync();
}
const leerFotoLocal = id => tx("fotos", "readonly", s => s.get(id));
// Si la foto se tomó en otro aparato, se baja de Drive la primera vez que se ve.
async function leerFoto(id) {
  const b = await leerFotoLocal(id);
  if (b || !drive.token) return b;
  try {
    const fid = (E.driveFotos || {})[id];
    if (!fid) return undefined;
    const r = await driveFetch(`https://www.googleapis.com/drive/v3/files/${fid}?alt=media`);
    const blob = await r.blob();
    await ponerFoto(id, blob);
    return blob;
  } catch (e) { return undefined; }
}
const ponerFoto = (id, blob) => tx("fotos", "readwrite", s => s.put(blob, id));
const borrarFoto = id => tx("fotos", "readwrite", s => s.delete(id));

function estadoInicial() {
  return {
    version: 1,
    ajustes: { ...AJUSTES_INICIALES, plantillaContrato: PLANTILLA_CONTRATO, plantillaPagare: PLANTILLA_PAGARE, textoRequisitos: TEXTO_REQUISITOS,
      municipios: structuredClone(MUNICIPIOS_INICIALES), inePropietaria: [] },
    plazas: PLAZAS_INICIALES.map(p => ({ ...p, predial: "" })),
    locales: LOCALES_INICIALES.map(([plazaId, numero, nivel, giro, estado], i) => ({
      id: "L" + (i + 1), plazaId, numero, nivel, giro, estado,
      licencia: "No", licenciaVence: "", luz: "", notas: "", fotosEntrega: [], fotosRecepcion: [], fotosLicencia: [],
    })),
    contratos: [], pagos: [], gastos: [], reparaciones: [],
    ultimoRespaldo: "",
  };
}

// Completa datos que no existían en versiones anteriores de la app.
function migrar(e) {
  const a = e.ajustes;
  if (!a.municipios) a.municipios = structuredClone(MUNICIPIOS_INICIALES);
  if (!a.inePropietaria) a.inePropietaria = [];
  if (!a.docsLicencia || a.docsLicencia === DOCS_LICENCIA_ANTERIOR) a.docsLicencia = DOCS_LICENCIA_TEXTO;
  for (const p of e.plazas) if (p.municipio === undefined) p.municipio = (PLAZAS_INICIALES.find(x => x.id === p.id) || {}).municipio || "";
  for (const l of e.locales) if (!l.fotosLicencia) l.fotosLicencia = [];
  if (!e.driveFotos) e.driveFotos = {};
  return e;
}

/* ================= Utilidades ================= */
const $ = s => document.querySelector(s);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pesos = n => "$" + Math.round(Number(n) || 0).toLocaleString("es-MX");
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// Fechas como texto "AAAA-MM-DD" para no pelear con husos horarios.
const hoyISO = () => { const d = new Date(); return iso(d); };
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const aFecha = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const mesActual = () => hoyISO().slice(0, 7);
const sumarMeses = (mes, n) => { const [y, m] = mes.split("-").map(Number); const d = new Date(y, m - 1 + n, 1); return iso(d).slice(0, 7); };
const nombreMes = mes => { const [y, m] = mes.split("-").map(Number); return MESES[m - 1] + " " + y; };
const fechaBonita = s => { if (!s) return ""; const d = aFecha(s); return d.getDate() + " " + MESES[d.getMonth()].slice(0, 3) + " " + d.getFullYear(); };
const fechaLarga = s => { const d = aFecha(s); return d.getDate() + " de " + MESES[d.getMonth()] + " de " + d.getFullYear(); };
const diasEntre = (a, b) => Math.round((aFecha(b) - aFecha(a)) / 86400000);
function sumarDias(s, n) { const d = aFecha(s); d.setDate(d.getDate() + n); return iso(d); }
function finContrato(inicio, meses) {
  const d = aFecha(inicio); d.setMonth(d.getMonth() + Number(meses)); d.setDate(d.getDate() - 1); return iso(d);
}

// Días festivos oficiales (Ley Federal del Trabajo, art. 74).
const festivosCache = {};
function festivos(y) {
  if (festivosCache[y]) return festivosCache[y];
  const lunes = (m, n) => { const d = new Date(y, m, 1); d.setDate(1 + ((8 - d.getDay()) % 7) + 7 * (n - 1)); return iso(d); };
  const f = new Set([`${y}-01-01`, lunes(1, 1), lunes(2, 3), `${y}-05-01`, `${y}-09-16`, lunes(10, 3), `${y}-12-25`]);
  if ((y - 2024) % 6 === 0) f.add(`${y}-10-01`);
  return (festivosCache[y] = f);
}
function sumarHabiles(s, n) {
  let d = aFecha(s);
  while (n > 0) {
    d.setDate(d.getDate() + 1);
    const dia = d.getDay();
    if (dia !== 0 && dia !== 6 && !festivos(d.getFullYear()).has(iso(d))) n--;
  }
  return iso(d);
}

// Cantidad con letra para contratos y pagarés.
function letras(n) {
  n = Math.round(Number(n) || 0);
  const U = ["", "un", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce", "trece", "catorce", "quince",
    "dieciséis", "diecisiete", "dieciocho", "diecinueve", "veinte", "veintiún", "veintidós", "veintitrés", "veinticuatro", "veinticinco",
    "veintiséis", "veintisiete", "veintiocho", "veintinueve"];
  const D = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
  const C = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];
  const cien = x => {
    if (x === 100) return "cien";
    const c = Math.floor(x / 100), r = x % 100;
    let t = C[c];
    if (r) t += (t ? " " : "") + (r < 30 ? U[r] : D[Math.floor(r / 10)] + (r % 10 ? " y " + U[r % 10] : ""));
    return t;
  };
  if (n === 0) return "cero pesos 00/100 M.N.";
  const mill = Math.floor(n / 1e6), miles = Math.floor((n % 1e6) / 1000), resto = n % 1000;
  const p = [];
  if (mill) p.push(mill === 1 ? "un millón" : cien(mill) + " millones");
  if (miles) p.push(miles === 1 ? "mil" : cien(miles) + " mil");
  if (resto) p.push(cien(resto));
  let t = p.join(" ");
  if (mill && !miles && !resto) t += " de";
  t = t.charAt(0).toUpperCase() + t.slice(1);
  return t + (n === 1 ? " peso" : " pesos") + " 00/100 M.N.";
}

/* ================= Íconos ================= */
const ICONOS = {
  alerta: '<path d="M12 7v6M12 17h.01"/>', doc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  cal: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>', luz: '<path d="M13 2L5 14h6l-1 8 8-12h-6l1-8z"/>',
  foto: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>', buscar: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  wa: '<path d="M4 20l1.5-4A8 8 0 1 1 9 19z"/>', pdf: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/>', mas: '<path d="M12 5v14M5 12h14"/>',
  gasto: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>', banco: '<path d="M3 10l9-6 9 6M5 10v8M10 10v8M14 10v8M19 10v8M3 20h18"/>',
  respaldo: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>', plaza: '<path d="M3 9l2-5h14l2 5M3 9v11h18V9M3 9h18M9 20v-6h6v6"/>',
  ajustes: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>',
  reparar: '<path d="M14 7l3-3 3 3-3 3M17 4l-9 9M5 16l3 3-3 2-2-2z"/>', flecha: '<path d="M9 6l6 6-6 6"/>', pago: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>',
};
const ic = n => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICONOS[n]}</svg>`;

/* ================= Lógica del negocio ================= */
const plaza = id => E.plazas.find(p => p.id === id) || { nombre: "", direccion: "" };
const local = id => E.locales.find(l => l.id === id);
const contratoActivo = localId => E.contratos.find(c => c.localId === localId && !c.terminado);
const nombreLocal = l => `${plaza(l.plazaId).nombre} ${l.numero}`;

// Cargo de un mes para un contrato: fecha de pago, límite con gracia, lo pagado y el estado.
function cargo(c, mes) {
  const [y, m] = mes.split("-").map(Number);
  const ultimo = new Date(y, m, 0).getDate();
  const fecha = `${mes}-${String(Math.min(Number(c.diaPago) || 1, ultimo)).padStart(2, "0")}`;
  const limite = sumarHabiles(fecha, Number(E.ajustes.gracia) || 0);
  const pagos = E.pagos.filter(p => p.contratoId === c.id && p.mes === mes);
  const pagado = pagos.reduce((s, p) => s + Number(p.monto || 0), 0);
  const hoy = hoyISO();
  const renta = Number(c.renta) || 0;
  const tarde = (pagado < renta && hoy > limite) || pagos.some(p => p.fecha > limite);
  const recargo = tarde ? Number(E.ajustes.recargo) || 0 : 0;
  const total = renta + recargo;
  const saldo = Math.max(0, total - pagado);
  let estado = "Pendiente";
  if (pagado >= total) estado = "Pagado";
  else if (hoy > limite) estado = "Atrasado";
  else if (pagado > 0) estado = "Parcial";
  return { contrato: c, mes, fecha, limite, pagado, renta, recargo, total, saldo, estado, pagos };
}
// Meses que se cobran: desde "cobrarDesde" hasta el mes actual (sin pasar del fin del contrato).
function mesesCobro(c, hasta = mesActual()) {
  const out = [];
  const finMes = finContrato(c.inicio, c.meses).slice(0, 7);
  let m = c.cobrarDesde || c.inicio.slice(0, 7);
  const tope = hasta < finMes ? hasta : finMes;
  while (m <= tope && out.length < 240) { out.push(m); m = sumarMeses(m, 1); }
  return out;
}
const atrasos = c => mesesCobro(c).map(m => cargo(c, m)).filter(x => x.estado === "Atrasado");
const activos = () => E.contratos.filter(c => !c.terminado);

function expedienteFaltan(c) {
  return DOCS_EXPEDIENTE.filter(d => !(c.docs && c.docs[d.id] && c.docs[d.id].ok));
}
function ineVencida(c) {
  const y = new Date().getFullYear();
  return ["ineInq", "ineFia"].some(k => c.docs?.[k]?.vigencia && Number(c.docs[k].vigencia) < y);
}

// Estado del local para mostrar en listas.
function estadoLocal(l) {
  if (l.estado === "vacio") return ["Vacío", "g"];
  if (l.estado === "venta") return ["En venta/renta", "g"];
  if (l.estado === "entrega") return ["Por entregar", "g"];
  const c = contratoActivo(l.id);
  if (!c) return ["Faltan datos", "a"];
  if (atrasos(c).length) return ["Atrasado", "r"];
  const dias = diasEntre(hoyISO(), finContrato(c.inicio, c.meses));
  if (dias < 0) return ["Contrato vencido", "r"];
  if (l.licencia !== "Sí") return ["Sin licencia", "a"];
  if (dias <= E.ajustes.avisoRenovacion) return ["Renovar", "a"];
  return ["Al corriente", "v"];
}

// Todo lo que necesita atención, ordenado: rojo primero.
function alertas() {
  const A = [], sinDatos = [];
  const hoy = hoyISO();
  for (const l of E.locales) {
    const n = nombreLocal(l);
    const ir = "#/local/" + l.id;
    if (l.estado !== "rentado") continue;
    const c = contratoActivo(l.id);
    if (!c) { sinDatos.push(l.numero); continue; }
    const at = atrasos(c);
    if (at.length) A.push(["r", `Renta atrasada · ${pesos(at.reduce((s, x) => s + x.saldo, 0))}`, `${n} · ${c.inquilino.nombre} · ${at.length} ${at.length > 1 ? "meses" : "mes"}`, ir]);
    const fin = finContrato(c.inicio, c.meses), dias = diasEntre(hoy, fin);
    if (dias < 0) A.push(["r", "Contrato vencido", `${n} · venció ${fechaBonita(fin)}`, ir]);
    else if (dias <= E.ajustes.avisoRenovacion) A.push(["a", `Contrato vence en ${dias} días`, `${n} · renta sugerida ${pesos(rentaSugerida(c))}`, ir]);
    if (l.licencia !== "Sí") A.push(["r", "Sin licencia de giro", `${n} · ${c.inquilino.nombre}`, ir]);
    else if (l.licenciaVence && l.licenciaVence < hoy) A.push(["r", "Licencia de giro vencida", n, ir]);
    else if (l.licenciaVence && diasEntre(hoy, l.licenciaVence) <= 30) A.push(["a", "Licencia de giro por vencer", `${n} · ${fechaBonita(l.licenciaVence)}`, ir]);
    if (!l.luz) A.push(["a", "Luz: falta confirmar pago", n, ir]);
    else if (diasEntre(l.luz, hoy) > E.ajustes.diasLuz) A.push(["a", "Luz: revisar pago", `${n} · último ${fechaBonita(l.luz)}`, ir]);
    const f = expedienteFaltan(c);
    if (f.length) A.push(["a", "Expediente incompleto", `${n} · falta: ${f.map(d => d.nombre.replace(/ del (inquilino|fiador)/, "")).slice(0, 2).join(", ")}${f.length > 2 ? "…" : ""}`, ir]);
    if (ineVencida(c)) A.push(["r", "INE vencida", n, ir]);
  }
  for (const g of E.gastos) {
    if (g.pagado || !g.vence) continue;
    const d = diasEntre(hoy, g.vence);
    if (d < 0) A.push(["r", "Gasto vencido · " + pesos(g.monto), `${g.concepto} · ${plaza(g.plazaId).nombre}`, "#/gastos"]);
    else if (d <= 15) A.push(["a", `Gasto vence en ${d} días · ${pesos(g.monto)}`, `${g.concepto} · ${plaza(g.plazaId).nombre}`, "#/gastos"]);
  }
  for (const r of E.reparaciones) if (r.estado !== "Terminada") A.push(["a", "Reparación pendiente", `${r.titulo} · ${nombreLocal(local(r.localId))}`, "#/local/" + r.localId]);
  // Drive: avisar solo si hay cambios sin subir, o si pasó una semana (por si hubo cambios en otro aparato).
  if (driveConectado() && !driveActivo()) {
    const ultima = ls.get("ultimaSyncHora") || "";
    if ((E.guardadoEn || "") > (ls.get("ultimaSync") || "")) A.unshift(["a", "Cambios sin subir a Drive", "Toca para subirlos. Mientras, siguen guardados en tu celular", "#/drive"]);
    else if (!ultima || diasEntre(ultima.slice(0, 10), hoy) > 7) A.unshift(["a", "Revisa tu Google Drive", "Hace más de una semana que no se conecta", "#/drive"]);
  }
  else if (!driveConectado() && (!E.ultimoRespaldo || diasEntre(E.ultimoRespaldo, hoy) > 7)) A.push(["a", "Haz tu respaldo semanal", E.ultimoRespaldo ? "Último: " + fechaBonita(E.ultimoRespaldo) : "Aún no tienes respaldo", "#/respaldo"]);
  A.sort((a, b) => (a[0] === b[0] ? 0 : a[0] === "r" ? -1 : 1));
  // El aviso de Drive siempre arriba
  const i = A.findIndex(x => /Google Drive/.test(x[1]));
  if (i > 0) A.unshift(A.splice(i, 1)[0]);
  return A;
}
function iconoAlerta(t) {
  if (/licencia/i.test(t)) return "doc";
  if (/contrato/i.test(t)) return "cal";
  if (/luz/i.test(t)) return "luz";
  if (/expediente|datos/i.test(t)) return "pdf";
  if (/respaldo|drive/i.test(t)) return "respaldo";
  if (/reparaci/i.test(t)) return "reparar";
  if (/gasto/i.test(t)) return "gasto";
  return "alerta";
}
const rentaSugerida = c => Math.round((Number(c.renta) || 0) * (1 + (Number(E.ajustes.inflacion) || 0) / 100));

/* ================= Fotos ================= */
function comprimir(file, max = 1400, calidad = 0.72) {
  return new Promise((ok, mal) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement("canvas");
      cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
      cv.toBlob(b => (b ? ok(b) : mal(new Error("No se pudo leer la foto"))), "image/jpeg", calidad);
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => mal(new Error("No se pudo leer la foto"));
    img.src = URL.createObjectURL(file);
  });
}
function pedirFotos(multiple = true) {
  return new Promise(ok => {
    const i = document.createElement("input");
    i.type = "file"; i.accept = "image/*"; i.multiple = multiple;
    i.onchange = async () => {
      const ids = [];
      for (const f of i.files) { const id = "F" + uid(); await ponerFoto(id, await comprimir(f)); ids.push(id); }
      ok(ids);
    };
    i.click();
  });
}
async function pintarMiniaturas(root = document) {
  for (const im of root.querySelectorAll("img[data-foto]")) {
    const b = await leerFoto(im.dataset.foto);
    if (b) im.src = URL.createObjectURL(b);
  }
}
const miniaturas = ids => (ids || []).map(id => `<img class="mini" data-foto="${id}" onclick="verFoto('${id}')" alt="foto">`).join("");
async function verFoto(id) {
  const b = await leerFoto(id);
  if (!b) return;
  hoja(`<img src="${URL.createObjectURL(b)}" style="width:100%;border-radius:10px">
    <div class="dos"><button class="btn sec" onclick="compartirFoto('${id}')">Compartir</button>
    <button class="btn peligro" onclick="quitarFoto('${id}')">Borrar foto</button></div>`, "Foto");
}
async function compartirFoto(id) {
  const b = await leerFoto(id);
  await compartirArchivo(new File([b], "foto.jpg", { type: "image/jpeg" }), "Foto");
}
async function quitarFoto(id) {
  if (!confirm("¿Borrar esta foto?")) return;
  const quita = arr => { const i = arr.indexOf(id); if (i >= 0) arr.splice(i, 1); };
  E.locales.forEach(l => { quita(l.fotosEntrega); quita(l.fotosRecepcion); quita(l.fotosLicencia || []); });
  quita(E.ajustes.inePropietaria || []);
  E.contratos.forEach(c => Object.values(c.docs || {}).forEach(d => quita(d.fotos || [])));
  E.pagos.forEach(p => { if (p.foto === id) p.foto = ""; });
  E.reparaciones.forEach(r => quita(r.fotos || []));
  await borrarFoto(id); await guardar(); cerrarHoja(); render();
}

/* ================= Compartir, WhatsApp y PDF ================= */
const telLimpio = t => { const d = String(t || "").replace(/\D/g, ""); return d.length === 10 ? "52" + d : d; };
function whatsapp(tel, texto) {
  const t = telLimpio(tel);
  window.open(`https://wa.me/${t}?text=${encodeURIComponent(texto)}`, "_blank");
}
async function compartirArchivo(file, titulo) {
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: titulo }); return; } catch (e) { if (e.name === "AbortError") return; }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(file); a.download = file.name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function pdf(titulo, texto, nombreArchivo) {
  if (!window.jspdf) { alert("Para hacer PDF necesitas internet la primera vez."); return null; }
  const doc = new window.jspdf.jsPDF({ unit: "pt", format: "letter" });
  const M = 56, W = doc.internal.pageSize.getWidth() - 2 * M, H = doc.internal.pageSize.getHeight();
  let y = M;
  doc.setFont("helvetica", "bold"); doc.setFontSize(13);
  if (titulo) { doc.text(titulo, M, y); y += 24; }
  doc.setFont("helvetica", "normal"); doc.setFontSize(10.5);
  for (let linea of texto.split("\n")) {
    // Título de cláusula ("PRIMERA. OBJETO.") en negritas y en su propio renglón.
    const t = linea.match(/^((?:PRIMERA|SEGUNDA|TERCERA|CUARTA|QUINTA|SEXTA|SÉPTIMA|OCTAVA|NOVENA|DÉCIMA)[A-ZÁÉÍÓÚ ]*\. [A-ZÁÉÍÓÚ ]+\.)\s*(.*)$/);
    if (t) {
      if (y > H - M - 30) { doc.addPage(); y = M; }
      doc.setFont("helvetica", "bold"); doc.text(t[1], M, y); y += 15; linea = t[2];
    }
    const partes = linea.trim() === "" ? [""] : doc.splitTextToSize(linea, W);
    for (const p of partes) {
      if (y > H - M) { doc.addPage(); y = M; }
      const negrita = /^(CONTRATO DE|PAGARÉ)/.test(p);
      doc.setFont("helvetica", negrita ? "bold" : "normal");
      doc.text(p, M, y); y += 15;
    }
  }
  return new File([doc.output("blob")], nombreArchivo, { type: "application/pdf" });
}
function llenar(plantilla, datos) {
  // Lo que falta se deja en blanco para llenarlo a mano; {INTERES} es opcional.
  return plantilla.replace(/\{([A-Z_]+)\}/g, (m, k) => (datos[k] !== undefined && datos[k] !== "" ? datos[k] : k === "INTERES" ? "" : "________________"));
}
function datosContrato(c) {
  const l = local(c.localId), p = plaza(l.plazaId), a = E.ajustes;
  return {
    CIUDAD: a.ciudadFirma, FECHA: fechaLarga(c.firma || hoyISO()), ARRENDADOR: a.arrendador,
    INQUILINO: c.inquilino.nombre, INQ_DOMICILIO: c.inquilino.domicilio,
    FIADOR: c.fiador.nombre, FIA_DOMICILIO: c.fiador.domicilio,
    LOCAL: l.numero, NIVEL: (l.nivel || "").toLowerCase(), DIRECCION: p.direccion.replace(/\.\s*$/, ""), GIRO: c.giro || l.giro,
    RENTA: pesos(c.renta), RENTA_LETRA: letras(c.renta), DEPOSITO: pesos(c.deposito), DEPOSITO_LETRA: letras(c.deposito),
    DIA_PAGO: c.diaPago, GRACIA: a.gracia, MESES: c.meses, INICIO: fechaLarga(c.inicio), FIN: fechaLarga(finContrato(c.inicio, c.meses)),
  };
}
function compartirContrato(id) {
  const c = E.contratos.find(x => x.id === id);
  const f = pdf("", llenar(E.ajustes.plantillaContrato, datosContrato(c)), `Contrato ${nombreLocal(local(c.localId))}.pdf`);
  if (f) compartirArchivo(f, "Contrato");
}
function compartirPagares(id) {
  const c = E.contratos.find(x => x.id === id), d = datosContrato(c);
  const interes = E.ajustes.interesPagare ? `En caso de no pagar a su presentación, causará intereses moratorios del ${E.ajustes.interesPagare}% mensual.` : "";
  const uno = (monto, concepto) => llenar(E.ajustes.plantillaPagare, { ...d, MONTO: pesos(monto), MONTO_LETRA: letras(monto), CONCEPTO: concepto, INTERES: interes });
  const texto = uno(c.renta, "un mes de renta") + "\n\n\n- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -\n\n\n" + uno(c.deposito, "depósito");
  const f = pdf("", texto, `Pagarés ${nombreLocal(local(c.localId))}.pdf`);
  if (f) compartirArchivo(f, "Pagarés");
}
function textoRecibo(p) {
  const c = E.contratos.find(x => x.id === p.contratoId), l = local(c.localId);
  return `*Recibo de renta*\n${E.ajustes.arrendador}\n\nRecibí de ${c.inquilino.nombre} la cantidad de ${pesos(p.monto)} (${letras(p.monto)}) por la renta de ${nombreMes(p.mes)} del local ${l.numero}, ${plaza(l.plazaId).nombre}.\nFecha de pago: ${fechaBonita(p.fecha)} · ${p.forma || ""}\n\nGracias.`;
}
function reciboPDF(pid) {
  const p = E.pagos.find(x => x.id === pid);
  const f = pdf("RECIBO DE RENTA", textoRecibo(p).replace(/\*/g, "") + "\n\n\n___________________________\n" + E.ajustes.arrendador, `Recibo ${nombreMes(p.mes)}.pdf`);
  if (f) compartirArchivo(f, "Recibo");
}
function reciboWA(pid) {
  const p = E.pagos.find(x => x.id === pid), c = E.contratos.find(x => x.id === p.contratoId);
  whatsapp(c.inquilino.tel, textoRecibo(p));
}
function recordatorioWA(cid, mes) {
  const c = E.contratos.find(x => x.id === cid), x = cargo(c, mes), l = local(c.localId);
  whatsapp(c.inquilino.tel, `Hola ${c.inquilino.nombre.split(" ")[0]}, te recuerdo que la renta de ${nombreMes(mes)} del local ${l.numero} (${pesos(x.saldo)}) venció el ${fechaBonita(x.fecha)}. ¿Me confirmas tu pago, por favor? Gracias.`);
}

/* ================= Hoja (ventana de abajo) y formularios ================= */
function hoja(html, titulo) {
  $("#hoja-tit").textContent = titulo || "";
  $("#hoja-cuerpo").innerHTML = html;
  $("#velo").classList.add("on");
  pintarMiniaturas($("#hoja-cuerpo"));
}
function cerrarHoja() { $("#velo").classList.remove("on"); }

// campos: [clave, etiqueta, tipo, opciones]
function formulario(titulo, campos, valores, alGuardar) {
  const html = campos.map(([k, et, tipo = "text", ops]) => {
    const v = valores[k] ?? "";
    if (tipo === "select") return `<label>${et}<select name="${k}">${ops.map(o => { const [val, txt] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(val)}" ${val == v ? "selected" : ""}>${esc(txt)}</option>`; }).join("")}</select></label>`;
    if (tipo === "textarea") return `<label>${et}<textarea name="${k}" rows="${ops || 4}">${esc(v)}</textarea></label>`;
    const extra = tipo === "number" ? ' inputmode="decimal" step="any"' : tipo === "tel" ? ' inputmode="tel"' : "";
    return `<label>${et}<input name="${k}" type="${tipo}" value="${esc(v)}"${extra}></label>`;
  }).join("");
  hoja(`<form id="f">${html}<button class="btn">Guardar</button></form>`, titulo);
  $("#f").onsubmit = async ev => {
    ev.preventDefault();
    const datos = Object.fromEntries(new FormData(ev.target));
    for (const [k, , tipo] of campos) if (tipo === "number") datos[k] = datos[k] === "" ? "" : Number(datos[k]);
    if ((await alGuardar(datos)) === false) return;
    await guardar(); cerrarHoja(); render();
  };
}

/* ================= Pantallas ================= */
const chip = ([t, c]) => `<span class="chip c-${c}">${esc(t)}</span>`;
function pantalla(titulo, sub, cuerpo, atras) {
  $("#tit").textContent = titulo;
  $("#sub").textContent = sub || "";
  $("#atras").style.display = atras ? "" : "none";
  $("#atras").onclick = () => (atras === true ? history.back() : (location.hash = atras));
  $("#main").innerHTML = cuerpo;
  pintarMiniaturas($("#main"));
}

function vInicio() {
  const mes = mesActual();
  const cs = activos().filter(c => mesesCobro(c).includes(mes)).map(c => cargo(c, mes));
  const esperado = cs.reduce((s, x) => s + x.total, 0), cobrado = cs.reduce((s, x) => s + Math.min(x.pagado, x.total), 0);
  const pct = esperado ? Math.round((cobrado / esperado) * 100) : 0;
  const rent = E.locales.filter(l => l.estado === "rentado").length, vac = E.locales.filter(l => l.estado === "vacio").length;
  const hoy = new Date(), fechaHoy = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"][hoy.getDay()] + " " + hoy.getDate() + " de " + MESES[hoy.getMonth()];
  const A = alertas();
  pantalla("Hola, " + E.ajustes.arrendador.split(" ")[0], fechaHoy, `
    <div class="kpis">
      <a class="kpi" href="#/pagos/${mes}"><span>Cobrado en ${MESES[Number(mes.slice(5)) - 1]}</span><b>${pesos(cobrado)}</b><div class="barra"><i style="width:${pct}%"></i></div><span>de ${pesos(esperado)} · ${pct}%</span></a>
      <a class="kpi" href="#/pagos/${mes}"><span>Falta cobrar</span><b class="${esperado - cobrado ? "rojo" : ""}">${pesos(esperado - cobrado)}</b><span>este mes</span></a>
      <a class="kpi" href="#/locales"><span>Rentados</span><b>${rent} de ${E.locales.length}</b><span>${E.locales.length ? Math.round((rent / E.locales.length) * 100) : 0}% ocupado</span></a>
      <a class="kpi" href="#/vacios"><span>Vacíos</span><b>${vac}</b><span>listos para rentar</span></a>
    </div>
    <div class="dos"><a class="btn" href="#/pagos/${mes}">${ic("pago")}Registrar pago</a><a class="btn sec" href="#/vacios">${ic("mas")}Nuevo inquilino</a></div>
    ${guiaArranque()}
    <h2>Hoy hay que ver ${A.length ? "(" + A.length + ")" : ""}</h2>
    ${A.length ? A.map(([t, tit, det, ir]) => `<a class="al ${t}" href="${ir}"><span class="ic">${ic(iconoAlerta(tit))}</span><div>${esc(tit)}<em>${esc(det)}</em></div>${ic("flecha")}</a>`).join("") : '<div class="card vacio">Todo en orden</div>'}
  `);
}

// Guía para los primeros días: se oculta sola cuando todo está listo.
function guiaArranque() {
  const rentados = E.locales.filter(l => l.estado === "rentado");
  const faltan = rentados.filter(l => !contratoActivo(l.id));
  const ine = (E.ajustes.inePropietaria || []).length > 0, drv = driveConectado();
  if (!faltan.length && ine && drv) return "";
  const listos = rentados.length - faltan.length, pct = rentados.length ? Math.round((listos / rentados.length) * 100) : 100;
  const paso = (ok, texto, ir) => `<a class="guia-paso${ok ? " ok" : ""}" href="${ir}"><span class="guia-check">${ok ? '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>' : ""}</span><span>${texto}</span>${ok ? "" : ic("flecha")}</a>`;
  const sig = faltan[0];
  return `<section class="guia"><b>Para arrancar</b>
    ${paso(ine, "Sube tu INE", "#/ajustes")}
    ${paso(drv, "Conecta tu Google Drive", "#/drive")}
    ${paso(!faltan.length, `Captura a tus inquilinos · ${listos} de ${rentados.length}`, sig ? "#/rentar/" + sig.id + "?existente=1" : "#/locales")}
    <div class="barra"><i style="width:${pct}%"></i></div>
    ${sig ? `<a class="btn chico" href="#/rentar/${sig.id}?existente=1">${ic("mas")}Capturar el siguiente: ${esc(nombreLocal(sig))}</a>` : ""}
  </section>`;
}

let filtroLocales = "todos";
// Plazas desplegadas; se recuerda en este aparato.
const plazasAbiertas = new Set((() => { try { return JSON.parse(localStorage.getItem("plazasAbiertas") || "[]"); } catch (e) { return []; } })());
function plazaAbierta(id, abierta) {
  if (filtroLocales !== "todos" || location.hash.startsWith("#/vacios")) return;
  abierta ? plazasAbiertas.add(id) : plazasAbiertas.delete(id);
  try { localStorage.setItem("plazasAbiertas", JSON.stringify([...plazasAbiertas])); } catch (e) {}
}
function vLocales(soloVacios) {
  const debeL = l => { const c = contratoActivo(l.id); return !!(c && atrasos(c).length); };
  const vacioL = l => l.estado === "vacio" || l.estado === "venta";
  const pasa = l => soloVacios || filtroLocales === "vacios" ? vacioL(l) : filtroLocales === "deben" ? debeL(l) : true;
  const nDeben = E.locales.filter(debeL).length, nVac = E.locales.filter(vacioL).length;
  const grupos = E.plazas.map(p => {
    const ls = E.locales.filter(l => l.plazaId === p.id && pasa(l));
    if (!ls.length) return "";
    const r = ls.filter(l => l.estado === "rentado").length;
    const abierta = soloVacios || filtroLocales !== "todos" || plazasAbiertas.has(p.id);
    return `<details class="card plaza-d" ${abierta ? "open" : ""} ontoggle="plazaAbierta('${p.id}',this.open)"><summary class="plaza-cab"><span><b>${esc(p.nombre)}</b><small>${ls.length} ${ls.length === 1 ? "local" : "locales"}${soloVacios ? "" : " · " + r + (r === 1 ? " rentado" : " rentados")}</small></span>${ic("flecha")}</summary>
      ${ls.map(l => {
        const c = contratoActivo(l.id);
        const sub = [l.nivel, c ? c.inquilino.nombre : ""].filter(Boolean).join(" · ");
        const est = estadoLocal(l);
        if (est[0] === "Atrasado") est[0] = "Debe " + pesos(atrasos(c).reduce((s, x) => s + x.saldo, 0));
        return `<a class="fila" href="${soloVacios ? "#/rentar/" + l.id : "#/local/" + l.id}"><div><b>${esc(l.numero)}${l.giro ? " · " + esc(l.giro) : ""}</b><small>${esc(sub)}</small></div>${chip(est)}</a>`;
      }).join("")}</details>`;
  }).join("");
  pantalla(soloVacios ? "Elige el local" : "Locales", soloVacios ? "Locales disponibles" : E.plazas.length + " plazas",
    (soloVacios ? "" : `<label class="buscar">${ic("buscar")}<input placeholder="Buscar local o inquilino" aria-label="Buscar local o inquilino" oninput="filtrar(this.value)"></label>
      <div class="filtros">${[["todos", "Todos"], ["deben", `Deben (${nDeben})`], ["vacios", `Vacíos (${nVac})`]].map(([k, t]) => `<button class="${filtroLocales === k ? "on" : ""}" onclick="filtroLocales='${k}';render()">${t}</button>`).join("")}</div>`) +
    (grupos || '<div class="card vacio">Nada por aquí</div>') +
    (soloVacios ? "" : `<button class="btn sec" onclick="nuevoLocal()">${ic("mas")}Agregar local</button>`), soloVacios ? "#/inicio" : false);
}
function filtrar(q) {
  q = q.toLowerCase();
  document.querySelectorAll("#main .fila").forEach(f => (f.style.display = f.textContent.toLowerCase().includes(q) ? "" : "none"));
  // Al buscar se abren las plazas que tienen resultados
  document.querySelectorAll("#main .plaza-d").forEach(d => {
    const hay = [...d.querySelectorAll(".fila")].some(f => f.style.display !== "none");
    d.style.display = hay ? "" : "none";
    if (q) d.open = hay;
  });
}

function vLocal(id) {
  const l = local(id);
  if (!l) return (location.hash = "#/locales");
  const p = plaza(l.plazaId), c = contratoActivo(id);
  let h = `<div class="card"><div class="plaza">${esc(l.numero)}${l.giro ? " · " + esc(l.giro) : ""} ${chip(estadoLocal(l))}</div>
    <div class="dato"><span>Plaza</span>${esc(p.nombre)}</div><div class="dato"><span>Nivel</span>${esc(l.nivel || "—")}</div>
    ${l.notas ? `<div class="dato"><span>Notas</span>${esc(l.notas)}</div>` : ""}
    <button class="btn sec chico" onclick="editarLocal('${id}')">Editar local</button></div>`;

  if (!c) {
    if (l.estado === "rentado") h += `<div class="card aviso">Este local está rentado pero aún no tiene los datos del inquilino.</div><a class="btn" href="#/rentar/${id}?existente=1">Capturar inquilino actual</a>`;
    else h += `<a class="btn" href="#/rentar/${id}">Rentar este local</a>`;
    h += `<button class="btn sec" onclick="whatsappRequisitos()">Mandar requisitos por WhatsApp</button>`;
  } else {
    const fin = finContrato(c.inicio, c.meses), dias = diasEntre(hoyISO(), fin);
    const at = atrasos(c);
    const iniciales = c.inquilino.nombre.split(" ").filter(Boolean).slice(0, 2).map(x => x[0]).join("").toUpperCase();
    const debe = at.reduce((s, x) => s + x.saldo, 0);
    h += `<div class="card"><div class="persona"><span class="avatar">${esc(iniciales)}</span><div><b>${esc(c.inquilino.nombre)}</b><small><a href="tel:${esc(c.inquilino.tel)}">${esc(c.inquilino.tel)}</a>${c.fiador.nombre ? " · Fiador: " + esc(c.fiador.nombre) : ""}</small></div></div>
      <div class="cifras"><div><span>Renta</span><b>${pesos(c.renta)}</b></div><div><span>Paga el</span><b>día ${c.diaPago}</b></div><div><span>Debe</span><b class="${debe ? "rojo" : ""}">${pesos(debe)}</b></div></div>
      ${c.inquilino.correo ? `<div class="dato"><span>Correo</span>${esc(c.inquilino.correo)}</div>` : ""}
      ${c.inquilino.rfc ? `<div class="dato"><span>RFC</span>${esc(c.inquilino.rfc)} · ${esc(c.inquilino.tipo)}</div>` : ""}
      <div class="dato"><span>Contrato</span>${fechaBonita(c.inicio)} a ${fechaBonita(fin)}</div>
      <div class="dos"><button class="btn" onclick="registrarPago('${c.id}')">Registrar pago</button><button class="btn wa" onclick="whatsapp('${esc(c.inquilino.tel)}','')">${ic("wa")}WhatsApp</button></div>
      <button class="btn sec chico" onclick="editarContrato('${c.id}')">Editar datos del inquilino</button></div>`;

    // Avisos rápidos
    const luzVieja = !l.luz || diasEntre(l.luz, hoyISO()) > E.ajustes.diasLuz;
    h += `<h2>Al día</h2><div class="card">
      <div class="chk"><span><b>Licencia de giro</b><small>${l.licenciaVence ? "Vence " + fechaBonita(l.licenciaVence) : "Sin fecha de vencimiento"}</small></span>
        <div class="seg" role="group" aria-label="Licencia de giro">${[["No", "No"], ["En trámite", "Trámite"], ["Sí", "Sí"]].map(([v, t]) => `<button class="${l.licencia === v ? "on" : ""}" onclick="cambiarLocal('${id}','licencia','${v}')">${t}</button>`).join("")}</div></div>
      <div class="chk"><span>Vence licencia</span><input type="date" value="${l.licenciaVence}" onchange="cambiarLocal('${id}','licenciaVence',this.value)" aria-label="Vence licencia"></div>
      <div class="chk"><span><b>Recibo de luz</b><small class="${luzVieja ? "rojo" : ""}">${l.luz ? "Pagado el " + fechaBonita(l.luz) : "Sin confirmar"}</small></span>
        <button class="btn sec chico" style="width:auto;margin:0;padding:0 14px" onclick="cambiarLocal('${id}','luz','${hoyISO()}')">Ya pagó hoy</button></div>
      <div class="chk"><span>Otra fecha de pago de luz</span><input type="date" value="${l.luz}" onchange="cambiarLocal('${id}','luz',this.value)" aria-label="Fecha de pago de luz"></div>
      <button class="btn sec chico" onclick="docsLicencia('${c.id}')">${ic("doc")}Mandar docs para su licencia</button></div>`;

    // Expediente
    h += `<h2>Expediente · ${DOCS_EXPEDIENTE.length - expedienteFaltan(c).length} de ${DOCS_EXPEDIENTE.length}</h2><div class="card">` +
      DOCS_EXPEDIENTE.map(d => {
        const x = (c.docs && c.docs[d.id]) || {};
        let extra = "";
        if (d.vigencia && x.vigencia) extra = ` · vigencia ${x.vigencia}`;
        if (d.fecha && x.fecha) extra = ` · ${fechaBonita(x.fecha)}`;
        return `<div class="doc"><div class="chk"><span>${esc(d.nombre)}<small>${extra}</small></span><span class="acc">
          ${d.foto ? `<button class="cam" onclick="fotoDoc('${c.id}','${d.id}')" aria-label="Foto de ${esc(d.nombre)}">${ic("foto")}</button>` : ""}
          <input type="checkbox" ${x.ok ? "checked" : ""} onchange="marcarDoc('${c.id}','${d.id}',this.checked)" aria-label="Entregado"></span></div>
          ${x.fotos && x.fotos.length ? `<div class="fotos">${miniaturas(x.fotos)}</div>` : ""}</div>`;
      }).join("") + `</div>`;

    // Contrato
    h += `<h2>Contrato</h2><div class="card">
      <div class="dos"><button class="btn sec chico" onclick="compartirContrato('${c.id}')">${ic("pdf")}Contrato PDF</button><button class="btn sec chico" onclick="compartirPagares('${c.id}')">${ic("pdf")}Pagarés PDF</button></div>
      <div class="dato"><span>Renta sugerida al renovar</span><b>${pesos(rentaSugerida(c))}</b></div>
      ${dias <= E.ajustes.avisoRenovacion ? `<div class="aviso">Vence en ${dias} días</div>` : ""}
      <div class="dos"><button class="btn sec chico" onclick="renovar('${c.id}')">Renovar</button><button class="btn sec chico" onclick="terminar('${c.id}')">Terminar contrato</button></div></div>`;

    // Depósito
    h += `<h2>Depósito</h2><div class="card">
      <div class="dato"><span>Recibido</span>${pesos(c.depositoRecibido ?? c.deposito)}</div>
      ${c.depositoDescuentos ? `<div class="dato"><span>Descuentos</span>${pesos(c.depositoDescuentos)}</div>` : ""}
      <button class="btn sec chico" onclick="editarDeposito('${c.id}')">Editar depósito</button></div>`;

    // Pagos del contrato
    const meses = mesesCobro(c).reverse().slice(0, 12);
    h += `<h2>Pagos</h2><div class="card">${meses.length ? meses.map(m => {
      const x = cargo(c, m);
      return `<div class="fila" onclick="detalleCargo('${c.id}','${m}')"><div>${nombreMes(m)}<small>${x.pagado ? "Pagó " + pesos(x.pagado) : "Vence " + fechaBonita(x.fecha)}</small></div>${chip([x.estado, x.estado === "Pagado" ? "v" : x.estado === "Atrasado" ? "r" : "a"])}</div>`;
    }).join("") : '<div class="vacio">Aún no hay meses por cobrar</div>'}</div>`;
  }

  // Fotos del local
  const fl = l.fotosLicencia || [];
  h += `<h2>Fotos para licencia · ${Math.min(fl.length, 3)} de 3</h2><div class="card">
    <p class="sub" style="margin-top:4px">Frente y los dos costados, que se vean los vecinos.</p>
    <div class="fotos">${miniaturas(fl)}${fl.length < 3 ? `<button class="mas-foto" aria-label="Agregar foto para licencia" onclick="fotoLocal('${id}','fotosLicencia')">${ic("foto")}</button>` : ""}</div></div>`;
  h += `<h2>Fotos del local</h2><div class="card">
    <div class="sub">Al entregarlo</div><div class="fotos">${miniaturas(l.fotosEntrega)}<button class="mas-foto" aria-label="Agregar foto" onclick="fotoLocal('${id}','fotosEntrega')">${ic("foto")}</button></div>
    <div class="sub">Al recibirlo</div><div class="fotos">${miniaturas(l.fotosRecepcion)}<button class="mas-foto" aria-label="Agregar foto" onclick="fotoLocal('${id}','fotosRecepcion')">${ic("foto")}</button></div></div>`;

  // Reparaciones
  const reps = E.reparaciones.filter(r => r.localId === id);
  h += `<h2>Reparaciones</h2><div class="card">${reps.map(r => `<div class="fila" onclick="editarReparacion('${r.id}')"><div>${esc(r.titulo)}<small>${fechaBonita(r.fecha)} · ${esc(r.proveedor || "")} · ${pesos(r.costo)}</small></div>${chip([r.estado, r.estado === "Terminada" ? "v" : "a"])}</div>`).join("")}
    <button class="btn sec chico" onclick="editarReparacion('', '${id}')">${ic("mas")}Agregar reparación</button></div>`;

  // Historial
  const viejos = E.contratos.filter(x => x.localId === id && x.terminado);
  if (viejos.length) h += `<h2>Inquilinos anteriores</h2><div class="card">${viejos.map(x => `<div class="fila"><div>${esc(x.inquilino.nombre)}<small>${fechaBonita(x.inicio)} → ${fechaBonita(x.terminado)} · ${pesos(x.renta)}</small></div></div>`).join("")}</div>`;

  pantalla(nombreLocal(l), p.nombre, h, "#/locales");
}

let filtroPagos = "cobrar";
function vPagos(mes) {
  mes = mes || mesActual();
  const todos = activos().filter(c => mesesCobro(c, mes).includes(mes)).map(c => cargo(c, mes));
  const orden = { Atrasado: 0, Parcial: 1, Pendiente: 2, Pagado: 3 };
  todos.sort((a, b) => orden[a.estado] - orden[b.estado] || a.fecha.localeCompare(b.fecha));
  const porCobrar = todos.filter(x => x.estado !== "Pagado"), pagados = todos.filter(x => x.estado === "Pagado");
  const cs = filtroPagos === "cobrar" ? porCobrar : pagados;
  const total = todos.reduce((s, x) => s + x.total, 0), cobrado = todos.reduce((s, x) => s + Math.min(x.pagado, x.total), 0);
  const atr = todos.filter(x => x.estado === "Atrasado");
  const sinDatos = E.locales.filter(l => l.estado === "rentado" && !contratoActivo(l.id)).length;
  pantalla("Pagos", nombreMes(mes), `
    <div class="mesnav"><a href="#/pagos/${sumarMeses(mes, -1)}" aria-label="Mes anterior"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></a><b>${nombreMes(mes)}</b><a href="#/pagos/${sumarMeses(mes, 1)}" aria-label="Mes siguiente">${ic("flecha")}</a></div>
    <div class="kpi"><div class="dato" style="padding:0"><span>Cobrado</span><span>Falta</span></div><div class="dato" style="padding:0"><b style="font-size:24px">${pesos(cobrado)}</b><b class="${total - cobrado ? "rojo" : ""}" style="font-size:20px">${pesos(total - cobrado)}</b></div><div class="barra"><i style="width:${total ? Math.round((cobrado / total) * 100) : 0}%"></i></div></div>
    <div class="filtros"><button class="${filtroPagos === "cobrar" ? "on" : ""}" onclick="filtroPagos='cobrar';render()">Por cobrar (${porCobrar.length})</button><button class="${filtroPagos === "pagados" ? "on" : ""}" onclick="filtroPagos='pagados';render()">Pagados (${pagados.length})</button></div>
    ${sinDatos ? `<div class="card aviso">${sinDatos} locales rentados aún sin datos del inquilino; no aparecen aquí. <a href="#/locales">Capturarlos</a></div>` : ""}
    <div class="card">${cs.length ? cs.map(x => {
      const c = x.contrato, l = local(c.localId);
      const sub = x.estado === "Pagado" ? "Pagó " + fechaBonita(x.pagos[x.pagos.length - 1].fecha) : x.pagado ? `Pagó ${pesos(x.pagado)} de ${pesos(x.total)}` : `${pesos(x.total)} · gracia hasta ${fechaBonita(x.limite)}`;
      return `<div class="fila" onclick="detalleCargo('${c.id}','${mes}')"><div><b>${esc(c.inquilino.nombre)} · ${esc(l.numero)}</b><small>${esc(plaza(l.plazaId).nombre)} · ${sub}</small></div>${chip([x.estado, x.estado === "Pagado" ? "v" : x.estado === "Atrasado" ? "r" : "a"])}</div>`;
    }).join("") : `<div class="vacio">${filtroPagos === "cobrar" ? "Nada por cobrar" : "Aún no hay pagos"}</div>`}</div>
    ${atr.length ? `<button class="btn wa" onclick="recordarTodos('${mes}')">${ic("wa")}${atr.length === 1 ? "Recordar al atrasado" : `Recordar a los ${atr.length} atrasados`}</button>` : ""}
    <a class="btn sec" href="#/calendario">${ic("cal")}Ver calendario de locales</a>
    <a class="btn sec" href="#/banco">${ic("banco")}Revisar con estado de cuenta</a>
  `);
}
function detalleCargo(cid, mes) {
  const c = E.contratos.find(x => x.id === cid), x = cargo(c, mes), l = local(c.localId);
  hoja(`<div class="dato"><span>Local</span>${esc(nombreLocal(l))}</div>
    <div class="dato"><span>Renta</span>${pesos(x.renta)}</div>
    ${x.recargo ? `<div class="dato"><span>Recargo por atraso</span>${pesos(x.recargo)}</div>` : ""}
    <div class="dato"><span>Fecha de pago</span>${fechaBonita(x.fecha)}</div>
    <div class="dato"><span>Límite con gracia</span>${fechaBonita(x.limite)}</div>
    <div class="dato"><span>Pagado</span>${pesos(x.pagado)}</div>
    <div class="dato"><span>Saldo</span><b>${pesos(x.saldo)}</b></div>
    ${x.pagos.map(p => `<div class="card pago"><div class="dato"><span>${fechaBonita(p.fecha)} · ${esc(p.forma)}</span>${pesos(p.monto)}</div>
      ${p.foto ? miniaturas([p.foto]) : ""}
      <div class="tres"><button class="btn wa chico" onclick="reciboWA('${p.id}')">Recibo WhatsApp</button><button class="btn sec chico" onclick="reciboPDF('${p.id}')">Recibo PDF</button><button class="btn peligro chico" onclick="borrarPago('${p.id}')">Borrar</button></div></div>`).join("")}
    ${x.saldo > 0 ? `<button class="btn" onclick="registrarPago('${cid}','${mes}')">Registrar pago</button>` : ""}
    ${x.estado === "Atrasado" ? `<button class="btn wa" onclick="recordatorioWA('${cid}','${mes}')">Recordarle por WhatsApp</button>` : ""}`, c.inquilino.nombre + " · " + nombreMes(mes));
}
function registrarPago(cid, mes) {
  const c = E.contratos.find(x => x.id === cid);
  if (!mes) { // el mes más viejo con saldo; si no hay, el actual
    const deuda = mesesCobro(c).map(m => cargo(c, m)).find(x => x.saldo > 0);
    mes = deuda ? deuda.mes : mesActual();
  }
  const x = cargo(c, mes);
  let foto = "";
  hoja(`<form id="f">
    <div class="dato"><span>${esc(c.inquilino.nombre)}</span>${esc(nombreLocal(local(c.localId)))}</div>
    <label>Mes que paga<input name="mes" type="month" value="${mes}"></label>
    <label>Monto<input name="monto" type="number" inputmode="decimal" step="any" value="${x.saldo || c.renta}" required></label>
    <label>Fecha en que pagó<input name="fecha" type="date" value="${hoyISO()}" required></label>
    <label>Forma de pago<select name="forma"><option>Transferencia</option><option>Efectivo</option><option>Depósito</option><option>Cheque</option></select></label>
    <label>Nota<input name="nota"></label>
    <button type="button" class="btn sec" id="bfoto">${ic("foto")}Foto del comprobante</button><div id="vfoto" class="fotos"></div>
    <button class="btn">Guardar pago</button></form>`, "Registrar pago");
  $("#bfoto").onclick = async () => { const [id] = await pedirFotos(false); if (id) { foto = id; $("#vfoto").innerHTML = miniaturas([id]); pintarMiniaturas($("#vfoto")); } };
  $("#f").onsubmit = async ev => {
    ev.preventDefault();
    const d = Object.fromEntries(new FormData(ev.target));
    const p = { id: "P" + uid(), contratoId: cid, mes: d.mes, monto: Number(d.monto), fecha: d.fecha, forma: d.forma, nota: d.nota, foto };
    E.pagos.push(p);
    await guardar();
    hoja(`<div class="ok">✅ Pago guardado: ${pesos(p.monto)}</div>
      <button class="btn wa" onclick="reciboWA('${p.id}')">Mandar recibo por WhatsApp</button>
      <button class="btn sec" onclick="reciboPDF('${p.id}')">Recibo en PDF</button>
      <button class="btn sec" onclick="cerrarHoja()">Listo</button>`, "Pago guardado");
    render();
  };
}
async function borrarPago(pid) {
  if (!confirm("¿Borrar este pago?")) return;
  E.pagos = E.pagos.filter(p => p.id !== pid);
  await guardar(); cerrarHoja(); render();
}
function recordarTodos(mes) {
  const cs = activos().map(c => cargo(c, mes)).filter(x => x.estado === "Atrasado");
  hoja(`<p class="sub">Toca cada uno para abrir WhatsApp con el mensaje listo.</p>` + cs.map(x => {
    const c = x.contrato;
    return `<button class="btn wa" onclick="recordatorioWA('${c.id}','${mes}');this.classList.add('hecho')">${esc(c.inquilino.nombre)} · ${pesos(x.saldo)}</button>`;
  }).join(""), "Recordar atrasados");
}

/* ===== Rentar un local (nuevo inquilino o capturar el actual) ===== */
let borrador = null;
function vRentar(id, existente) {
  const l = local(id);
  if (!borrador || borrador.localId !== id) {
    borrador = {
      id: "C" + uid(), localId: id, existente, giro: l.giro, docs: {},
      inquilino: { nombre: "", tel: "", correo: "", domicilio: "", curp: "", rfc: "", tipo: "Persona física" },
      fiador: { nombre: "", tel: "", domicilio: "", curp: "" },
      renta: "", deposito: "", diaPago: 1, inicio: hoyISO(), meses: E.ajustes.mesesContrato, cobrarDesde: mesActual(),
    };
  }
  const b = borrador;
  const fotoBtn = (k, et) => {
    const fotos = b.docs[k]?.fotos || [];
    return `<div class="doc"><div class="chk"><span>${et}</span><span>${fotos.length ? "✅" : ""}</span></div>
      <div class="fotos">${miniaturas(fotos)}<button class="mas-foto" aria-label="Agregar foto" onclick="fotoBorrador('${k}')">${ic("foto")}</button></div></div>`;
  };
  pantalla(existente ? "Capturar inquilino" : "Nuevo inquilino", nombreLocal(l) + (l.nivel ? " · " + l.nivel : ""), `
    <div class="pasos"><i class="on"></i><i class="${Object.keys(b.docs).length ? "on" : ""}"></i><i class="${b.inquilino.nombre ? "on" : ""}"></i><i></i></div>
    ${existente ? "" : `<div class="paso"><div class="n">1</div><div><b>Manda los requisitos</b><p>Por WhatsApp, con la lista de documentos.</p></div></div>
    <button class="btn wa" onclick="whatsappRequisitos()">${ic("wa")}Mandar requisitos por WhatsApp</button>`}
    <div class="paso"><div class="n">${existente ? 1 : 2}</div><div><b>Sube las fotos de sus documentos</b><p>Toma foto o elige de tu galería. Puedes hacerlo después.</p></div></div>
    <div class="card">${fotoBtn("ineInq", "INE del inquilino (frente y vuelta)")}${fotoBtn("compInq", "Comprobante de domicilio del inquilino")}
    ${fotoBtn("ineFia", "INE del fiador (frente y vuelta)")}${fotoBtn("compFia", "Comprobante de domicilio del fiador")}
    <button class="btn sec" onclick="leerINEs()">${ic("buscar")}Leer datos de las INE</button><p class="sub" id="ocr"></p></div>
    <div class="paso"><div class="n">${existente ? 2 : 3}</div><div><b>Revisa los datos</b><p>Corrige lo que haga falta.</p></div></div>
    <form id="fr" class="card">
      <div class="sub">Inquilino</div>
      <label>Nombre completo<input name="i_nombre" value="${esc(b.inquilino.nombre)}" required></label>
      <label>Teléfono (10 dígitos)<input name="i_tel" type="tel" inputmode="tel" value="${esc(b.inquilino.tel)}"></label>
      <label>Correo<input name="i_correo" type="email" value="${esc(b.inquilino.correo)}"></label>
      <label>Domicilio<input name="i_domicilio" value="${esc(b.inquilino.domicilio)}"></label>
      <label>CURP<input name="i_curp" value="${esc(b.inquilino.curp)}"></label>
      <label>RFC (si pide factura)<input name="i_rfc" value="${esc(b.inquilino.rfc)}"></label>
      <label>Tipo<select name="i_tipo">${["Persona física", "Empresa (persona moral)"].map(o => `<option ${o === b.inquilino.tipo ? "selected" : ""}>${o}</option>`).join("")}</select></label>
      <label>Giro del negocio<input name="giro" value="${esc(b.giro)}"></label>
      <div class="sub">Fiador solidario</div>
      <label>Nombre completo<input name="f_nombre" value="${esc(b.fiador.nombre)}"></label>
      <label>Teléfono<input name="f_tel" type="tel" inputmode="tel" value="${esc(b.fiador.tel)}"></label>
      <label>Domicilio<input name="f_domicilio" value="${esc(b.fiador.domicilio)}"></label>
      <label>CURP<input name="f_curp" value="${esc(b.fiador.curp)}"></label>
      <div class="sub">Condiciones</div>
      <label>Renta mensual<input name="renta" type="number" inputmode="decimal" step="any" value="${b.renta}" required></label>
      <label>Depósito<input name="deposito" type="number" inputmode="decimal" step="any" value="${b.deposito}" placeholder="Igual a la renta"></label>
      <label>Día de pago (1 a 31)<input name="diaPago" type="number" inputmode="numeric" min="1" max="31" value="${b.diaPago}" required></label>
      <label>Inicio del contrato<input name="inicio" type="date" value="${b.inicio}" required></label>
      <label>Duración (meses)<input name="meses" type="number" inputmode="numeric" min="1" value="${b.meses}" required></label>
      <label>Empezar a cobrar en la app desde<input name="cobrarDesde" type="month" value="${b.cobrarDesde}" required></label>
      <button class="btn">${existente ? "Guardar inquilino" : "Guardar y hacer contrato"}</button>
    </form>`, "#/local/" + id);
  $("#fr").oninput = () => leerBorrador();
  $("#fr").onsubmit = async ev => {
    ev.preventDefault();
    leerBorrador();
    if (!b.deposito) b.deposito = b.renta;
    b.depositoRecibido = b.deposito;
    b.firma = hoyISO();
    const { existente: _, ...c } = b;
    E.contratos.push(c);
    const l2 = local(id); l2.estado = "rentado"; l2.giro = b.giro;
    await guardar();
    borrador = null;
    location.hash = "#/local/" + id;
    if (!existente) setTimeout(() => hoja(`<div class="ok">✅ Inquilino guardado</div>
      <div class="paso"><div class="n">4</div><div><b>Contrato y pagarés</b><p>Se llenan solos. Compártelos o imprímelos para firmar.</p></div></div>
      <button class="btn" onclick="compartirContrato('${c.id}')">${ic("pdf")}Contrato PDF</button>
      <button class="btn" onclick="compartirPagares('${c.id}')">${ic("pdf")}Pagarés PDF</button>
      <div class="paso"><div class="n">5</div><div><b>Documentos para su licencia de giro</b></div></div>
      <button class="btn wa" onclick="docsLicencia('${c.id}')">Mandar docs de licencia</button>`, "Siguiente paso"), 200);
  };
}
function leerBorrador() {
  const d = Object.fromEntries(new FormData($("#fr")));
  const b = borrador;
  for (const k of ["nombre", "tel", "correo", "domicilio", "curp", "rfc", "tipo"]) if (d["i_" + k] !== undefined) b.inquilino[k] = d["i_" + k].trim();
  for (const k of ["nombre", "tel", "domicilio", "curp"]) b.fiador[k] = (d["f_" + k] || "").trim();
  Object.assign(b, { giro: d.giro, renta: Number(d.renta) || "", deposito: Number(d.deposito) || "", diaPago: Number(d.diaPago) || 1, inicio: d.inicio, meses: Number(d.meses) || 12, cobrarDesde: d.cobrarDesde });
}
async function fotoBorrador(k) {
  if ($("#fr")) leerBorrador();
  const ids = await pedirFotos();
  if (!ids.length) return;
  const d = (borrador.docs[k] = borrador.docs[k] || { ok: false, fotos: [] });
  d.fotos.push(...ids); d.ok = true;
  render();
}

/* ===== Lectura de INE (OCR en el celular) ===== */
let ocrListo = null;
function cargarOCR() {
  if (window.Tesseract) return Promise.resolve();
  if (ocrListo) return ocrListo;
  return (ocrListo = new Promise((ok, mal) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
    s.integrity = "sha384-GJqSu7vueQ9qN0E9yLPb3Wtpd7OrgK8KmYzC8T1IysG1bcvxvIO4qtYR/D3A991F";
    s.crossOrigin = "anonymous";
    s.onload = ok; s.onerror = () => { ocrListo = null; mal(new Error("Sin internet")); };
    document.head.appendChild(s);
  }));
}
function interpretarINE(texto) {
  const t = texto.toUpperCase().replace(/[|]/g, "");
  const lineas = t.split("\n").map(x => x.trim()).filter(Boolean);
  const r = {};
  const curp = t.match(/[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d/);
  if (curp) r.curp = curp[0];
  const vig = t.match(/VIGENCIA\s*(\d{4})(?:\s*-\s*(\d{4}))?/);
  if (vig) r.vigencia = vig[2] || vig[1];
  const iN = lineas.findIndex(x => /NOMBRE/.test(x)), iD = lineas.findIndex(x => /DOMICILIO/.test(x));
  const corte = x => /DOMICILIO|SEXO|CLAVE|CURP|FECHA|SECCI|AÑO|ANO DE|VIGENCIA|ELECTOR|ESTADO|MUNICIPIO|LOCALIDAD|EMISI/.test(x);
  if (iN >= 0) {
    const n = [];
    for (let i = iN + 1; i < lineas.length && n.length < 3 && !corte(lineas[i]); i++) n.push(lineas[i].replace(/[^A-ZÁÉÍÓÚÑ ]/g, "").trim());
    // En la INE va: apellido paterno, materno, nombre(s). Se guarda nombre primero.
    const limpio = n.filter(Boolean);
    if (limpio.length >= 2) r.nombre = [limpio.slice(2).join(" "), limpio[0], limpio[1]].filter(Boolean).join(" ");
  }
  if (iD >= 0) {
    const d = [];
    for (let i = iD + 1; i < lineas.length && d.length < 3 && !/CLAVE|CURP|AÑO|FECHA|SECCI/.test(lineas[i]); i++) d.push(lineas[i]);
    if (d.length) r.domicilio = d.join(", ");
  }
  return r;
}
const titulo = s => s.toLowerCase().replace(/(^|\s)\S/g, m => m.toUpperCase());
async function leerINEs() {
  if ($("#fr")) leerBorrador();
  const msg = m => { const o = $("#ocr"); if (o) o.textContent = m; };
  try {
    msg("Preparando lector… (la primera vez necesita internet)");
    await cargarOCR();
    const pares = [["ineInq", "inquilino"], ["ineFia", "fiador"]];
    let algo = false;
    for (const [k, quien] of pares) {
      const fotos = borrador.docs[k]?.fotos || [];
      if (!fotos.length) continue;
      let texto = "";
      for (const f of fotos) {
        msg(`Leyendo INE del ${quien}…`);
        const { data } = await Tesseract.recognize(await leerFoto(f), "spa");
        texto += "\n" + data.text;
      }
      const r = interpretarINE(texto);
      const destino = k === "ineInq" ? borrador.inquilino : borrador.fiador;
      if (r.nombre && !destino.nombre) destino.nombre = titulo(r.nombre);
      if (r.domicilio && !destino.domicilio) destino.domicilio = titulo(r.domicilio);
      if (r.curp && !destino.curp) destino.curp = r.curp;
      if (r.vigencia) borrador.docs[k].vigencia = r.vigencia;
      algo = algo || !!(r.nombre || r.curp || r.domicilio);
    }
    render();
    msg(algo ? "✅ Datos leídos. Revísalos abajo." : "No pude leer datos. Sube fotos más claras o escríbelos a mano.");
  } catch (e) {
    msg("No se pudo leer: " + e.message + ". Escribe los datos a mano.");
  }
}

/* ===== Acciones de local y contrato ===== */
async function cambiarLocal(id, campo, valor) { local(id)[campo] = valor; await guardar(); render(); }
function editarLocal(id) {
  const l = local(id);
  formulario("Editar local", [
    ["numero", "Número de local"], ["nivel", "Nivel", "select", ["", "Planta baja", "1er nivel", "2do nivel", "3er nivel"]],
    ["giro", "Giro"], ["estado", "Estado", "select", [["rentado", "Rentado"], ["vacio", "Vacío"], ["venta", "En venta/renta"], ["entrega", "Por entregar"]]], ["notas", "Notas", "textarea", 3],
  ], l, d => {
    if (d.estado !== "rentado" && contratoActivo(id)) { alert("Primero termina el contrato del inquilino."); return false; }
    Object.assign(l, d);
  });
}
function nuevoLocal() {
  formulario("Agregar local", [["plaza", "Plaza", "select", E.plazas.map(p => p.nombre)], ["numero", "Número de local"],
    ["nivel", "Nivel", "select", ["", "Planta baja", "1er nivel", "2do nivel", "3er nivel"]], ["giro", "Giro"]], {}, d => {
    const p = E.plazas.find(x => x.nombre === d.plaza);
    E.locales.push({ id: "L" + uid(), plazaId: p.id, numero: d.numero, nivel: d.nivel, giro: d.giro, estado: "vacio", licencia: "No", licenciaVence: "", luz: "", notas: "", fotosEntrega: [], fotosRecepcion: [] });
  });
}
function editarContrato(cid) {
  const c = E.contratos.find(x => x.id === cid);
  const v = { ...Object.fromEntries(Object.entries(c.inquilino).map(([k, x]) => ["i_" + k, x])), ...Object.fromEntries(Object.entries(c.fiador).map(([k, x]) => ["f_" + k, x])), ...c };
  formulario("Editar datos", [
    ["i_nombre", "Inquilino"], ["i_tel", "Teléfono", "tel"], ["i_correo", "Correo", "email"], ["i_domicilio", "Domicilio"], ["i_curp", "CURP"], ["i_rfc", "RFC"],
    ["i_tipo", "Tipo", "select", ["Persona física", "Empresa (persona moral)"]], ["giro", "Giro"],
    ["f_nombre", "Fiador"], ["f_tel", "Tel. fiador", "tel"], ["f_domicilio", "Domicilio fiador"], ["f_curp", "CURP fiador"],
    ["renta", "Renta mensual", "number"], ["deposito", "Depósito", "number"], ["diaPago", "Día de pago", "number"],
    ["inicio", "Inicio del contrato", "date"], ["meses", "Duración (meses)", "number"], ["cobrarDesde", "Cobrar desde", "month"],
  ], v, d => {
    for (const [k, x] of Object.entries(d)) {
      if (k.startsWith("i_")) c.inquilino[k.slice(2)] = x;
      else if (k.startsWith("f_")) c.fiador[k.slice(2)] = x;
      else c[k] = x;
    }
  });
}
function editarDeposito(cid) {
  const c = E.contratos.find(x => x.id === cid);
  formulario("Depósito", [["depositoRecibido", "Recibido", "number"], ["depositoDescuentos", "Descuentos por daños o adeudos", "number"], ["depositoNota", "Nota", "textarea", 2]],
    { depositoRecibido: c.depositoRecibido ?? c.deposito, depositoDescuentos: c.depositoDescuentos || "", depositoNota: c.depositoNota || "" }, d => Object.assign(c, d));
}
async function marcarDoc(cid, did, ok) {
  const c = E.contratos.find(x => x.id === cid);
  c.docs = c.docs || {};
  c.docs[did] = c.docs[did] || { fotos: [] };
  c.docs[did].ok = ok;
  const def = DOCS_EXPEDIENTE.find(d => d.id === did);
  if (ok && def.fecha && !c.docs[did].fecha) {
    const f = prompt("Fecha del comprobante (AAAA-MM-DD):", hoyISO());
    if (f && /^\d{4}-\d{2}-\d{2}$/.test(f)) {
      c.docs[did].fecha = f;
      if (diasEntre(f, hoyISO()) > 92) alert("⚠️ Ese comprobante tiene más de 3 meses.");
    }
  }
  if (ok && def.vigencia && !c.docs[did].vigencia) {
    const y = prompt("Año de vigencia de la INE (ej. 2031):", "");
    if (y && /^\d{4}$/.test(y)) { c.docs[did].vigencia = y; if (Number(y) < new Date().getFullYear()) alert("⚠️ Esa INE está vencida."); }
  }
  await guardar(); render();
}
async function fotoDoc(cid, did) {
  const ids = await pedirFotos();
  if (!ids.length) return;
  const c = E.contratos.find(x => x.id === cid);
  c.docs = c.docs || {};
  const d = (c.docs[did] = c.docs[did] || { fotos: [] });
  d.fotos = [...(d.fotos || []), ...ids];
  await guardar();
  if (!d.ok) await marcarDoc(cid, did, true); else render();
}
async function fotoLocal(id, campo) {
  const ids = await pedirFotos();
  if (!ids.length) return;
  const l = local(id);
  (l[campo] = l[campo] || []).push(...ids);
  await guardar(); render();
}
function renovar(cid) {
  const c = E.contratos.find(x => x.id === cid);
  const fin = finContrato(c.inicio, c.meses);
  formulario("Renovar contrato", [["renta", "Renta nueva", "number"], ["inicio", "Inicio del nuevo contrato", "date"], ["meses", "Duración (meses)", "number"]],
    { renta: rentaSugerida(c), inicio: sumarDias(fin, 1), meses: c.meses }, d => {
      c.terminado = sumarDias(d.inicio, -1);
      const n = { ...structuredClone(c), id: "C" + uid(), terminado: undefined, renta: d.renta, deposito: c.deposito, inicio: d.inicio, meses: d.meses, cobrarDesde: d.inicio.slice(0, 7), firma: hoyISO() };
      // Documentos de identidad siguen; contrato y pagarés se firman de nuevo.
      n.docs = n.docs || {};
      for (const k of ["pagRenta", "pagDep", "contrato"]) delete n.docs[k];
      E.contratos.push(n);
      setTimeout(() => alert("Contrato renovado. Genera el contrato y pagarés nuevos para firmar."), 300);
    });
}
async function terminar(cid) {
  const c = E.contratos.find(x => x.id === cid);
  const debe = atrasos(c).reduce((s, x) => s + x.saldo, 0);
  if (!confirm(`¿Terminar el contrato de ${c.inquilino.nombre}?${debe ? "\n⚠️ Debe " + pesos(debe) : ""}\nEl local quedará vacío y el inquilino pasa al historial.`)) return;
  c.terminado = hoyISO();
  local(c.localId).estado = "vacio";
  await guardar();
  alert("Recuerda tomar fotos del local al recibirlo y registrar la devolución del depósito.");
  render();
}
function whatsappRequisitos() {
  const tel = prompt("Teléfono del interesado (10 dígitos). Déjalo vacío para elegir el contacto en WhatsApp:", "");
  if (tel === null) return;
  whatsapp(tel, E.ajustes.textoRequisitos);
}
const envio = {};
const municipioDe = l => E.ajustes.municipios.find(m => m.nombre === plaza(l.plazaId).municipio);
function docsLicencia(cid) {
  const c = E.contratos.find(x => x.id === cid), l = local(c.localId), p = plaza(l.plazaId), m = municipioDe(l);
  const fl = l.fotosLicencia || [], ine = E.ajustes.inePropietaria || [];
  const ineInq = c.docs?.ineInq?.fotos || [], compInq = c.docs?.compInq?.fotos || [];
  const listo = (ok, texto, accion) => `<div class="chk"><span>${ok ? "✓ " : ""}${texto}</span>${ok ? "" : accion || '<span class="chip c-a">Falta</span>'}</div>`;
  envio.tel = c.inquilino.tel;
  envio.texto = `Hola ${c.inquilino.nombre.split(" ")[0]}, para tu licencia de giro del local ${l.numero}:\n\n*Datos del inmueble*\n${p.direccion}\nLocal ${l.numero}${l.nivel ? ", " + l.nivel : ""}\n${p.predial ? "Cuenta predial: " + p.predial + "\n" : ""}\n*Documentos que te comparto*\n${E.ajustes.docsLicencia.split("\n").map(x => "• " + x).join("\n")}` +
    (m ? `\n\n*${m.oficina} de ${m.nombre}*\nTel. ${m.telefono}\nPágina: ${m.pagina}\nFormato de pago: ${m.formato}` : "") + `\n\nAvísame cuando tengas tu licencia para registrarla. Gracias.`;
  envio.cid = cid;
  hoja(`<div class="card">
      ${listo(true, "Contrato de arrendamiento (se hace solo)")}
      ${listo(ine.length, "INE de la propietaria", `<a class="chip c-a" href="#/ajustes">Subir</a>`)}
      ${listo(ineInq.length, "INE del inquilino")}
      ${listo(compInq.length, "Comprobante de domicilio del inquilino")}
      ${listo(fl.length >= 3, `3 fotos del local (${Math.min(fl.length, 3)} de 3)`)}
      ${listo(!!m, m ? "Datos de " + m.nombre : "Municipio de la plaza", `<a class="chip c-a" href="#/plazas">Elegir</a>`)}
    </div>
    ${m ? `<div class="card"><b>${esc(m.nombre)} · Padrón y Licencias</b><p class="sub" style="font-weight:400">${esc(m.oficina)}</p>
      <div class="dato"><span>Teléfono</span><a href="tel:${esc(m.telefono.replace(/\(.*\)/, "").replace(/\s/g, ""))}">${esc(m.telefono)}</a></div>
      <div class="dato"><span>Página</span><a href="${esc(m.pagina)}" target="_blank" rel="noopener">Abrir</a></div>
      <div class="dato"><span>Formato de pago</span><a href="${esc(m.formato)}" target="_blank" rel="noopener">Abrir</a></div></div>` : ""}
    <p class="sub">1. Manda el mensaje. 2. Comparte los archivos en el mismo chat.</p>
    <button class="btn wa" onclick="whatsapp(envio.tel, envio.texto)">${ic("wa")}Mandar mensaje por WhatsApp</button>
    <button class="btn" onclick="compartirPaqueteLicencia(envio.cid)">${ic("pdf")}Compartir contrato, INE y fotos</button>
    <button class="btn sec" onclick="marcarDoc('${cid}','licencia',true);cerrarHoja()">Marcar como entregados</button>`, "Docs para licencia");
}
// Junta contrato en PDF y fotos en un solo envío (WhatsApp, correo, Drive…).
async function compartirPaqueteLicencia(cid) {
  const c = E.contratos.find(x => x.id === cid), l = local(c.localId);
  const archivos = [];
  const contrato = pdf("", llenar(E.ajustes.plantillaContrato, datosContrato(c)), `Contrato ${nombreLocal(l)}.pdf`);
  if (contrato) archivos.push(contrato);
  const grupos = [["INE propietaria", E.ajustes.inePropietaria], ["INE inquilino", c.docs?.ineInq?.fotos], ["Comprobante inquilino", c.docs?.compInq?.fotos], ["Foto local", l.fotosLicencia]];
  for (const [nombre, ids] of grupos) {
    let n = 1;
    for (const id of ids || []) {
      const b = await leerFoto(id);
      if (b) archivos.push(new File([b], `${nombre} ${n++}.jpg`, { type: "image/jpeg" }));
    }
  }
  if (navigator.canShare && navigator.canShare({ files: archivos })) {
    try { await navigator.share({ files: archivos, title: "Docs para licencia" }); return; } catch (e) { if (e.name === "AbortError") return; }
  }
  for (const f of archivos) await compartirArchivo(f, f.name);
}
function editarReparacion(rid, localId) {
  const r = E.reparaciones.find(x => x.id === rid) || { id: "R" + uid(), localId, titulo: "", proveedor: "", costo: "", estado: "Pendiente", fecha: hoyISO(), fotos: [], nuevo: true };
  formulario(r.nuevo ? "Nueva reparación" : "Reparación", [["titulo", "¿Qué se repara?"], ["proveedor", "Proveedor / técnico"], ["costo", "Costo", "number"],
    ["fecha", "Fecha", "date"], ["estado", "Estado", "select", ["Pendiente", "En proceso", "Terminada"]], ["quienPaga", "¿Quién paga?", "select", ["Sandra", "Inquilino"]]], r, d => {
    Object.assign(r, d);
    if (r.nuevo) { delete r.nuevo; E.reparaciones.push(r); }
  });
}

/* ===== Gastos ===== */
function vGastos() {
  const y = new Date().getFullYear();
  const gs = [...E.gastos].sort((a, b) => (a.pagado === b.pagado ? (b.vence || b.fecha || "").localeCompare(a.vence || a.fecha || "") : a.pagado ? 1 : -1));
  const delAño = E.gastos.filter(g => g.pagado && (g.fecha || "").startsWith(y)).reduce((s, g) => s + Number(g.monto || 0), 0)
    + E.reparaciones.filter(r => r.quienPaga !== "Inquilino" && (r.fecha || "").startsWith(y)).reduce((s, r) => s + Number(r.costo || 0), 0);
  pantalla("Gastos", String(y), `
    <div class="kpi"><span>Gastado en ${y} (incluye reparaciones)</span><b>${pesos(delAño)}</b></div>
    <button class="btn" onclick="editarGasto('')">${ic("mas")}Agregar gasto</button>
    <div class="card">${gs.length ? gs.map(g => `<div class="fila" onclick="editarGasto('${g.id}')"><div>${esc(g.concepto)}<small>${esc(plaza(g.plazaId).nombre)} · ${g.pagado ? "pagado " + fechaBonita(g.fecha) : "vence " + fechaBonita(g.vence)}</small></div><span>${pesos(g.monto)} ${g.pagado ? "" : chip(["Por pagar", "a"])}</span></div>`).join("") : '<div class="vacio">Sin gastos. Agrega predial, agua, mantenimiento…</div>'}</div>`, "#/mas");
}
function editarGasto(gid) {
  const g = E.gastos.find(x => x.id === gid) || { id: "G" + uid(), concepto: "", categoria: "Predial", plazaId: E.plazas[0].id, monto: "", vence: "", fecha: "", pagado: false, nuevo: true };
  const v = { ...g, plaza: plaza(g.plazaId).nombre, pagadoTxt: g.pagado ? "Sí" : "No" };
  formulario(g.nuevo ? "Nuevo gasto" : "Gasto", [["concepto", "Concepto"], ["categoria", "Tipo", "select", ["Predial", "Agua", "Luz áreas comunes", "Mantenimiento", "Seguro", "Impuestos", "Otro"]],
    ["plaza", "Plaza", "select", E.plazas.map(p => p.nombre)], ["monto", "Monto", "number"], ["vence", "Fecha límite (para recordarte)", "date"],
    ["pagadoTxt", "¿Ya se pagó?", "select", ["No", "Sí"]], ["fecha", "Fecha en que se pagó", "date"]], v, d => {
    g.plazaId = E.plazas.find(p => p.nombre === d.plaza).id;
    g.pagado = d.pagadoTxt === "Sí";
    if (g.pagado && !d.fecha) d.fecha = hoyISO();
    delete d.plaza; delete d.pagadoTxt;
    Object.assign(g, d);
    if (g.nuevo) { delete g.nuevo; E.gastos.push(g); }
  });
}

/* ===== Reporte para el contador ===== */
function vReporte(y) {
  y = Number(y) || new Date().getFullYear();
  const pagosA = E.pagos.filter(p => p.fecha.startsWith(y));
  const gastosA = E.gastos.filter(g => g.pagado && (g.fecha || "").startsWith(y));
  const repA = E.reparaciones.filter(r => r.quienPaga !== "Inquilino" && (r.fecha || "").startsWith(y));
  const filas = MESES.map((m, i) => {
    const mm = `${y}-${String(i + 1).padStart(2, "0")}`;
    const ing = pagosA.filter(p => p.fecha.startsWith(mm)).reduce((s, p) => s + p.monto, 0);
    const gas = gastosA.filter(g => g.fecha.startsWith(mm)).reduce((s, g) => s + Number(g.monto), 0) + repA.filter(r => r.fecha.startsWith(mm)).reduce((s, r) => s + Number(r.costo || 0), 0);
    return [m, ing, gas];
  });
  const tI = filas.reduce((s, f) => s + f[1], 0), tG = filas.reduce((s, f) => s + f[2], 0);
  const porPlaza = E.plazas.map(p => [p.nombre, pagosA.filter(x => { const c = E.contratos.find(c => c.id === x.contratoId); return c && local(c.localId).plazaId === p.id; }).reduce((s, x) => s + x.monto, 0)]);
  const morales = E.contratos.filter(c => /moral/.test(c.inquilino.tipo) && pagosA.some(p => p.contratoId === c.id));
  pantalla("Reporte", String(y), `
    <div class="mesnav"><a href="#/reporte/${y - 1}" aria-label="Año anterior"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></a><b>${y}</b><a href="#/reporte/${y + 1}" aria-label="Año siguiente">${ic("flecha")}</a></div>
    <div class="kpis"><div class="kpi"><span>Cobrado</span><b>${pesos(tI)}</b></div><div class="kpi"><span>Ganancia</span><b>${pesos(tI - tG)}</b></div></div>
    <div class="card"><table class="tabla"><tr><th>Mes</th><th>Cobrado</th><th>Gastos</th></tr>${filas.map(f => `<tr><td>${f[0].slice(0, 3)}</td><td>${pesos(f[1])}</td><td>${pesos(f[2])}</td></tr>`).join("")}
    <tr><th>Total</th><th>${pesos(tI)}</th><th>${pesos(tG)}</th></tr></table></div>
    <h2>Por plaza</h2><div class="card">${porPlaza.map(([n, v]) => `<div class="dato"><span>${esc(n)}</span>${pesos(v)}</div>`).join("")}</div>
    ${morales.length ? `<div class="card aviso">${morales.length} inquilino(s) son empresa: deben retenerte impuestos. Pásale este reporte a tu contador.</div>` : ""}
    <button class="btn" onclick="exportarExcel(${y})">Descargar para el contador (Excel)</button>`, "#/mas");
}
function csv(filas) { return "﻿" + filas.map(f => f.map(x => `"${String(x ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n"); }
function exportarExcel(y) {
  const filas = [["Fecha", "Mes de renta", "Plaza", "Local", "Inquilino", "RFC", "Tipo", "Monto", "Forma de pago"]];
  for (const p of E.pagos.filter(p => p.fecha.startsWith(y)).sort((a, b) => a.fecha.localeCompare(b.fecha))) {
    const c = E.contratos.find(c => c.id === p.contratoId), l = local(c.localId);
    filas.push([p.fecha, p.mes, plaza(l.plazaId).nombre, l.numero, c.inquilino.nombre, c.inquilino.rfc, c.inquilino.tipo, p.monto, p.forma]);
  }
  filas.push([], ["GASTOS"], ["Fecha", "Concepto", "Tipo", "Plaza", "Monto"]);
  for (const g of E.gastos.filter(g => g.pagado && (g.fecha || "").startsWith(y))) filas.push([g.fecha, g.concepto, g.categoria, plaza(g.plazaId).nombre, g.monto]);
  for (const r of E.reparaciones.filter(r => r.quienPaga !== "Inquilino" && (r.fecha || "").startsWith(y))) filas.push([r.fecha, r.titulo, "Reparación", plaza(local(r.localId).plazaId).nombre, r.costo]);
  compartirArchivo(new File([csv(filas)], `Rentas ${y}.csv`, { type: "text/csv" }), "Reporte " + y);
}

/* ===== Conciliar con el banco ===== */
function vBanco() {
  pantalla("Revisar con el banco", "Estado de cuenta", `
    <div class="card"><p>1. Descarga de tu banco los movimientos en <b>CSV o Excel (.csv)</b>.<br>2. Súbelo aquí.<br>3. La app busca qué depósitos coinciden con las rentas pendientes y tú confirmas.</p>
    <button class="btn" onclick="subirBanco()">Subir estado de cuenta</button></div><div id="res"></div>`, "#/pagos");
}
function leerCSV(txt) {
  const sep = (txt.split("\n")[0].match(/;/g) || []).length > (txt.split("\n")[0].match(/,/g) || []).length ? ";" : ",";
  return txt.split(/\r?\n/).filter(x => x.trim()).map(linea => {
    const out = []; let cur = "", q = false;
    for (const ch of linea) {
      if (ch === '"') q = !q; else if (ch === sep && !q) { out.push(cur.trim()); cur = ""; } else cur += ch;
    }
    out.push(cur.trim()); return out;
  });
}
function aNumero(s) {
  s = String(s || "").replace(/[$\s]/g, "");
  if (/,\d{2}$/.test(s) && !/\.\d{2}$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  return Number(s.replace(/,/g, "")) || 0;
}
function aISO(s) {
  s = String(s || "").trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (m) { const y = m[3].length === 2 ? "20" + m[3] : m[3]; return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`; }
  return "";
}
let movimientos = [];
function subirBanco() {
  const i = document.createElement("input");
  i.type = "file"; i.accept = ".csv,text/csv";
  i.onchange = async () => {
    const filas = leerCSV(await i.files[0].text());
    const enc = filas[0].map(x => x.toLowerCase());
    const col = re => enc.findIndex(x => re.test(x));
    let cF = col(/fecha|date/), cD = col(/concepto|descrip|referencia|detalle/), cA = col(/abono|dep[oó]sito|cr[eé]dito|ingreso/), cM = col(/importe|monto|cantidad|amount/);
    if (cF < 0) cF = 0;
    movimientos = filas.slice(1).map(f => ({ fecha: aISO(f[cF]), desc: cD >= 0 ? f[cD] : f.join(" "), monto: cA >= 0 ? aNumero(f[cA]) : aNumero(f[cM]) }))
      .filter(m => m.monto > 0 && m.fecha);
    const pend = [];
    for (const c of activos()) for (const m of mesesCobro(c, sumarMeses(mesActual(), 1))) { const x = cargo(c, m); if (x.saldo > 0) pend.push(x); }
    const usados = new Set();
    const sug = movimientos.map((mv, i) => {
      const nombre = mv.desc.toUpperCase();
      const cand = pend.filter(x => !usados.has(x) && Math.abs(x.saldo - mv.monto) < 1);
      const porNombre = cand.find(x => x.contrato.inquilino.nombre.toUpperCase().split(" ").some(p => p.length > 3 && nombre.includes(p)));
      const x = porNombre || (cand.length === 1 ? cand[0] : null);
      if (x) usados.add(x);
      return { i, mv, x };
    }).filter(s => s.x);
    $("#res").innerHTML = `<h2>${sug.length} coincidencias de ${movimientos.length} depósitos</h2>` + (sug.length ? sug.map(s => `
      <div class="card"><div class="dato"><span>${fechaBonita(s.mv.fecha)} · ${esc(s.mv.desc.slice(0, 40))}</span><b>${pesos(s.mv.monto)}</b></div>
      <div class="sub">→ ${esc(s.x.contrato.inquilino.nombre)} · ${esc(nombreLocal(local(s.x.contrato.localId)))} · ${nombreMes(s.x.mes)}</div>
      <button class="btn chico" onclick="confirmarBanco(this,'${s.x.contrato.id}','${s.x.mes}',${s.mv.monto},'${s.mv.fecha}')">Confirmar pago</button></div>`).join("")
      : '<div class="card vacio">No encontré depósitos que coincidan con rentas pendientes.</div>');
  };
  i.click();
}
async function confirmarBanco(btn, cid, mes, monto, fecha) {
  E.pagos.push({ id: "P" + uid(), contratoId: cid, mes, monto, fecha, forma: "Transferencia", nota: "Del estado de cuenta", foto: "" });
  await guardar();
  btn.textContent = "✅ Registrado"; btn.disabled = true;
}

/* ===== Calendario, respaldo y ajustes ===== */
function exportarCalendario() {
  const fmt = s => s.replace(/-/g, "");
  const ev = [];
  const add = (fecha, titulo, rrule) => ev.push(["BEGIN:VEVENT", `UID:${uid()}@rentas`, `DTSTAMP:${fmt(hoyISO())}T000000Z`, `DTSTART;VALUE=DATE:${fmt(fecha)}`, `SUMMARY:${titulo}`,
    rrule ? `RRULE:${rrule}` : "", "BEGIN:VALARM", "TRIGGER:-PT0M", "ACTION:DISPLAY", `DESCRIPTION:${titulo}`, "END:VALARM", "END:VEVENT"].filter(Boolean).join("\r\n"));
  for (const c of activos()) {
    const l = local(c.localId), n = nombreLocal(l), fin = finContrato(c.inicio, c.meses);
    const primera = cargo(c, mesActual());
    add(primera.limite, `Revisar renta ${n} (${c.inquilino.nombre})`, `FREQ=MONTHLY;UNTIL=${fmt(fin)}`);
    add(sumarDias(fin, -E.ajustes.avisoRenovacion), `Renovar contrato ${n}`);
    if (l.licenciaVence) add(sumarDias(l.licenciaVence, -30), `Licencia de giro por vencer ${n}`);
  }
  for (const g of E.gastos) if (!g.pagado && g.vence) add(sumarDias(g.vence, -7), `Pagar ${g.concepto} (${plaza(g.plazaId).nombre})`);
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Rentas Sandra//ES", ...ev, "END:VCALENDAR"].join("\r\n");
  compartirArchivo(new File([ics], "recordatorios-rentas.ics", { type: "text/calendar" }), "Recordatorios");
}
async function hacerRespaldo() {
  const fotos = {};
  const ids = await tx("fotos", "readonly", s => s.getAllKeys());
  for (const id of ids) {
    const b = await leerFoto(id);
    fotos[id] = await new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(b); });
  }
  E.ultimoRespaldo = hoyISO();
  await guardar();
  const archivo = new File([JSON.stringify({ app: "rentas-sandra", fecha: hoyISO(), estado: E, fotos })], `respaldo-rentas-${hoyISO()}.json`, { type: "application/json" });
  await compartirArchivo(archivo, "Respaldo rentas");
  render();
}
function restaurar() {
  const i = document.createElement("input");
  i.type = "file"; i.accept = ".json,application/json";
  i.onchange = async () => {
    try {
      const r = JSON.parse(await i.files[0].text());
      if (r.app !== "rentas-sandra" || !r.estado || !Array.isArray(r.estado.locales) || !Array.isArray(r.estado.contratos) || !Array.isArray(r.estado.pagos) || !r.estado.ajustes)
        throw new Error("Ese archivo no es un respaldo válido de esta app");
      if (!confirm(`¿Reemplazar todo con el respaldo del ${fechaBonita(r.fecha)}?`)) return;
      await tx("fotos", "readwrite", s => s.clear());
      for (const [id, url] of Object.entries(r.fotos || {})) await ponerFoto(id, await (await fetch(url)).blob());
      E = migrar(r.estado); await guardar();
      alert("✅ Respaldo cargado"); location.hash = "#/inicio"; render();
    } catch (e) { alert("No se pudo cargar: " + e.message); }
  };
  i.click();
}
function vRespaldo() {
  pantalla("Respaldo", "Tus datos viven en este celular", `
    <div class="card"><p>Todo se guarda <b>solo en este celular</b>. Si lo pierdes o borras el navegador, se pierde. Haz un respaldo cada semana y guárdalo en tu Drive o mándatelo por WhatsApp.</p>
    <div class="dato"><span>Último respaldo</span>${E.ultimoRespaldo ? fechaBonita(E.ultimoRespaldo) : "Nunca"}</div></div>
    <button class="btn" onclick="hacerRespaldo()">Hacer respaldo ahora</button>
    <button class="btn sec" onclick="restaurar()">Cargar un respaldo</button>
    <p class="sub">Para usar la app en otro celular: haz respaldo aquí y cárgalo allá.</p>`, "#/mas");
}
function vMas() {
  pantalla("Más", "", `<div class="card menu">
    <a class="fila" href="#/gastos"><div>${ic("gasto")}Gastos<small>Predial, agua, mantenimiento</small></div>${ic("flecha")}</a>
    <a class="fila" href="#/reporte"><div>${ic("gasto")}Reporte para el contador<small>Ingresos, gastos y ganancia</small></div>${ic("flecha")}</a>
    <a class="fila" href="#/calendario"><div>${ic("cal")}Calendario de locales<small>Quién paga y cuándo, por mes</small></div>${ic("flecha")}</a>
    <a class="fila" href="#/banco"><div>${ic("banco")}Revisar con el banco<small>Sube tu estado de cuenta</small></div>${ic("flecha")}</a>
    <a class="fila" onclick="exportarCalendario()"><div>${ic("cal")}Recordatorios en mi calendario<small>Rentas, renovaciones y licencias</small></div>${ic("flecha")}</a>
    <a class="fila" href="#/drive"><div>${ic("respaldo")}Google Drive<small>${driveActivo() ? "Conectado: se guarda solo" : "Respaldo automático y usar en varios aparatos"}</small></div>${ic("flecha")}</a>
    <a class="fila" href="#/respaldo"><div>${ic("respaldo")}Respaldo<small>${E.ultimoRespaldo ? "Último: " + fechaBonita(E.ultimoRespaldo) : "Aún no tienes"}</small></div>${ic("flecha")}</a>
    <a class="fila" href="#/plazas"><div>${ic("plaza")}Plazas<small>Direcciones y predial</small></div>${ic("flecha")}</a>
    <a class="fila" href="#/ajustes"><div>${ic("ajustes")}Ajustes<small>Gracia, recargos, contrato modelo</small></div>${ic("flecha")}</a></div>`);
}
function vPlazas() {
  pantalla("Plazas", "", `<div class="card">${E.plazas.map(p => `<div class="fila" onclick="editarPlaza('${p.id}')"><div><b>${esc(p.nombre)}</b><small>${esc(p.municipio || "Sin municipio")} · ${esc(p.direccion)}</small></div>${ic("flecha")}</div>`).join("")}</div>
    <button class="btn sec" onclick="editarPlaza('')">${ic("mas")}Agregar plaza</button>
    <h2>Padrón y Licencias por municipio</h2><div class="card">${E.ajustes.municipios.map((m, i) => `<div class="fila" onclick="editarMunicipio(${i})"><div><b>${esc(m.nombre)}</b><small>${esc(m.telefono)}</small></div>${ic("flecha")}</div>`).join("")}</div>
    <button class="btn sec" onclick="editarMunicipio(-1)">${ic("mas")}Agregar municipio</button>
    <p class="sub" style="font-weight:400">Datos públicos de cada municipio (octubre 2026). Confirma por teléfono antes de ir.</p>`, "#/mas");
}
function editarPlaza(id) {
  const p = E.plazas.find(x => x.id === id) || { id: "P" + uid(), nombre: "", direccion: "", predial: "", nuevo: true };
  formulario(p.nuevo ? "Nueva plaza" : "Plaza", [["nombre", "Nombre"], ["direccion", "Dirección completa", "textarea", 2], ["predial", "Cuenta predial"],
    ["municipio", "Municipio (para la licencia)", "select", ["", ...E.ajustes.municipios.map(m => m.nombre)]]], p, d => {
    Object.assign(p, d);
    if (p.nuevo) { delete p.nuevo; E.plazas.push(p); }
  });
}
function editarMunicipio(i) {
  const m = E.ajustes.municipios[i] || { nombre: "", oficina: "Dirección de Padrón y Licencias", telefono: "", pagina: "", formato: "" };
  formulario(i < 0 ? "Nuevo municipio" : m.nombre, [["nombre", "Municipio"], ["oficina", "Oficina y dirección", "textarea", 2], ["telefono", "Teléfono"],
    ["pagina", "Página para el trámite", "url"], ["formato", "Formato de pago (link)", "url"]], m, d => {
    Object.assign(m, d);
    if (i < 0) E.ajustes.municipios.push(m);
  });
}
async function fotoPropietaria() {
  const ids = await pedirFotos();
  if (!ids.length) return;
  E.ajustes.inePropietaria.push(...ids);
  await guardar(); render();
}
function vAjustes() {
  const a = E.ajustes;
  pantalla("Ajustes", "", `<div class="card"><b>INE de la propietaria</b><p class="sub" style="font-weight:400">Se usa en los documentos para la licencia de giro de tus inquilinos.</p>
    <div class="fotos">${miniaturas(a.inePropietaria)}<button class="mas-foto" aria-label="Agregar foto de tu INE" onclick="fotoPropietaria()">${ic("foto")}</button></div></div>
    <form id="fa" class="card">
    <label>Nombre de la arrendadora<input name="arrendador" value="${esc(a.arrendador)}"></label>
    <label>Ciudad donde se firman contratos<input name="ciudadFirma" value="${esc(a.ciudadFirma)}"></label>
    <label>Días de gracia (hábiles)<input name="gracia" type="number" inputmode="numeric" value="${esc(a.gracia)}"></label>
    <label>Recargo por pago tardío ($, 0 = sin recargo)<input name="recargo" type="number" inputmode="decimal" value="${esc(a.recargo)}"></label>
    <label>Avisar renovación con (días antes)<input name="avisoRenovacion" type="number" inputmode="numeric" value="${esc(a.avisoRenovacion)}"></label>
    <label>Revisar luz si no hay pago en (días)<input name="diasLuz" type="number" inputmode="numeric" value="${esc(a.diasLuz)}"></label>
    <label>Inflación anual para aumento (%, dato de INEGI)<input name="inflacion" type="number" inputmode="decimal" step="any" value="${esc(a.inflacion)}"></label>
    <label>Duración normal del contrato (meses)<input name="mesesContrato" type="number" inputmode="numeric" value="${esc(a.mesesContrato)}"></label>
    <label>Interés moratorio en pagarés (% mensual, vacío = sin interés)<input name="interesPagare" type="number" inputmode="decimal" step="any" value="${esc(a.interesPagare)}"></label>
    <label>Mensaje de requisitos (WhatsApp)<textarea name="textoRequisitos" rows="6">${esc(a.textoRequisitos)}</textarea></label>
    <label>Documentos para licencia de giro (uno por renglón)<textarea name="docsLicencia" rows="5">${esc(a.docsLicencia)}</textarea></label>
    <label>Contrato modelo <small>Campos: {INQUILINO} {FIADOR} {LOCAL} {DIRECCION} {GIRO} {RENTA} {RENTA_LETRA} {DEPOSITO} {DIA_PAGO} {INICIO} {FIN} {MESES}…</small><textarea name="plantillaContrato" rows="10">${esc(a.plantillaContrato)}</textarea></label>
    <label>Pagaré modelo<textarea name="plantillaPagare" rows="8">${esc(a.plantillaPagare)}</textarea></label>
    <button class="btn">Guardar ajustes</button></form>`, "#/mas");
  $("#fa").onsubmit = async ev => {
    ev.preventDefault();
    const d = Object.fromEntries(new FormData(ev.target));
    for (const k of ["gracia", "recargo", "avisoRenovacion", "diasLuz", "inflacion", "mesesContrato"]) d[k] = Number(d[k]) || 0;
    Object.assign(E.ajustes, d); await guardar();
    alert("✅ Guardado"); location.hash = "#/mas";
  };
}

/* ================= Google Drive: respaldo automático y mismos datos en varios aparatos ================= */
// Todo queda en una carpeta del Drive de quien conecta; la app solo ve los archivos que ella misma creó.
// Carpetas que la app crea en el Drive de quien conecta. Con el permiso "drive.file" la app solo ve
// lo que ella misma creó: no puede leer, cambiar ni borrar ningún otro archivo del Drive. Nunca borra nada.
const CARPETA_DRIVE = "Rentas Sandra";
const SUB = { respaldo: "0 Respaldo de la app", locales: "1 Locales", pagos: "2 Pagos", propietaria: "3 Propietaria", otras: "9 Otras fotos" };
const drive = { token: "", vence: 0, carpetas: {}, timer: 0, ocupado: false, error: "" };
const ls = {
  get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} },
};
const driveListo = () => !!GOOGLE_CLIENT_ID;
const driveConectado = () => ls.get("driveOn") === "1";
const driveActivo = () => drive.token && Date.now() < drive.vence;

function cargarGoogle() {
  if (window.google && google.accounts) return Promise.resolve();
  return new Promise((ok, mal) => {
    const sc = document.createElement("script");
    sc.src = "https://accounts.google.com/gsi/client";
    sc.onload = ok; sc.onerror = () => mal(new Error("Sin internet"));
    document.head.appendChild(sc);
  });
}
// Pide permiso a Google (necesita un toque de la persona). Después sincroniza.
async function conectarDrive() {
  if (!driveListo()) return alert("Falta configurar Google Drive (se hace una sola vez).");
  try { await cargarGoogle(); } catch (e) { return alert("Necesitas internet para conectar Drive."); }
  const cliente = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: "https://www.googleapis.com/auth/drive.file",
    callback: async r => {
      if (r.error) { drive.error = "Google no dio permiso"; return render(); }
      drive.token = r.access_token;
      drive.vence = Date.now() + (Number(r.expires_in) || 3600) * 1000 - 60000;
      ls.set("driveOn", "1");
      await sincronizar(true);
    },
  });
  cliente.requestAccessToken({ prompt: driveConectado() ? "" : "consent" });
}
async function driveFetch(url, opciones = {}) {
  const r = await fetch(url, { ...opciones, headers: { ...(opciones.headers || {}), Authorization: "Bearer " + drive.token } });
  if (r.status === 401) { drive.token = ""; throw new Error("La sesión de Google expiró"); }
  if (!r.ok) throw new Error("Drive respondió " + r.status);
  return r;
}
const comillas = t => String(t).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
const limpiarNombre = t => String(t || "").replace(/[\/\\]/g, "-").trim() || "Sin nombre";
async function driveBuscar(nombre, padre, carpeta) {
  const q = encodeURIComponent(`name='${comillas(nombre)}' and '${padre || "root"}' in parents and trashed=false` + (carpeta ? " and mimeType='application/vnd.google-apps.folder'" : ""));
  const r = await (await driveFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)&spaces=drive`)).json();
  return r.files && r.files.length ? r.files[0].id : "";
}
// Busca o crea la carpeta "Rentas Sandra/parte1/parte2…" y regresa su id.
async function driveRuta(partes) {
  let padre = "", ruta = "";
  for (const parte of [CARPETA_DRIVE, ...partes.map(limpiarNombre)]) {
    ruta += "/" + parte;
    if (!drive.carpetas[ruta]) {
      let id = await driveBuscar(parte, padre, true);
      if (!id) {
        id = (await (await driveFetch("https://www.googleapis.com/drive/v3/files?fields=id", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: parte, mimeType: "application/vnd.google-apps.folder", ...(padre ? { parents: [padre] } : {}) }),
        })).json()).id;
      }
      drive.carpetas[ruta] = id;
    }
    padre = drive.carpetas[ruta];
  }
  return padre;
}
async function driveCrear(carpeta, nombre, blob) {
  const cuerpo = new FormData();
  cuerpo.append("metadata", new Blob([JSON.stringify({ name: nombre, parents: [carpeta] })], { type: "application/json" }));
  cuerpo.append("file", blob);
  return (await (await driveFetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", { method: "POST", body: cuerpo })).json()).id;
}
// Dónde va cada foto dentro de "Rentas Sandra", con un nombre que se entienda.
function ubicacionFoto(id) {
  const lugar = l => `${plaza(l.plazaId).nombre} ${l.numero}`;
  for (const c of E.contratos) for (const [k, d] of Object.entries(c.docs || {})) {
    const i = (d.fotos || []).indexOf(id);
    if (i >= 0) {
      const doc = (DOCS_EXPEDIENTE.find(x => x.id === k) || { nombre: k }).nombre;
      return [[SUB.locales, lugar(local(c.localId)), "Expediente " + c.inquilino.nombre], `${doc} ${i + 1}.jpg`];
    }
  }
  for (const l of E.locales) for (const [campo, tipo] of [["fotosLicencia", "Para licencia"], ["fotosEntrega", "Al entregar"], ["fotosRecepcion", "Al recibir"]]) {
    const i = (l[campo] || []).indexOf(id);
    if (i >= 0) return [[SUB.locales, lugar(l), "Fotos del local"], `${tipo} ${i + 1}.jpg`];
  }
  const p = E.pagos.find(x => x.foto === id);
  if (p) { const c = E.contratos.find(x => x.id === p.contratoId); return [[SUB.pagos, p.mes], `${c ? c.inquilino.nombre + " " + local(c.localId).numero : "Pago"} ${p.fecha}.jpg`]; }
  const i = (E.ajustes.inePropietaria || []).indexOf(id);
  if (i >= 0) return [[SUB.propietaria], `INE ${i + 1}.jpg`];
  return [[SUB.otras], id + ".jpg"];
}
function programarSync() {
  if (!driveActivo()) return;
  clearTimeout(drive.timer);
  drive.timer = setTimeout(() => sincronizar(false), 4000);
}
// Junta los datos de este aparato con los de Drive. Gana el más nuevo; si los dos cambiaron, pregunta.
async function sincronizar(avisar) {
  if (!driveActivo() || drive.ocupado) return;
  drive.ocupado = true; drive.error = "";
  try {
    const carpetaRespaldo = await driveRuta([SUB.respaldo]);
    const idDatos = await driveBuscar("datos.json", carpetaRespaldo, false);
    const ultima = ls.get("ultimaSync") || "";
    let subirDatos = !idDatos;
    if (idDatos) {
      const remoto = await (await driveFetch(`https://www.googleapis.com/drive/v3/files/${idDatos}?alt=media`)).json();
      const cambioRemoto = (remoto.guardadoEn || "") > ultima, cambioLocal = (E.guardadoEn || "") > ultima;
      let usarRemoto = cambioRemoto && remoto.guardadoEn !== E.guardadoEn;
      if (usarRemoto && cambioLocal)
        usarRemoto = confirm("Hay cambios en otro aparato y también en este.\n\nAceptar: usar los de Drive (otro aparato).\nCancelar: quedarme con los de este aparato.");
      if (usarRemoto) { const mapa = { ...(E.driveFotos || {}) }; E = migrar(remoto); E.driveFotos = { ...mapa, ...E.driveFotos }; }
      else subirDatos = cambioLocal || remoto.guardadoEn !== E.guardadoEn;
    }
    // Fotos de este aparato que aún no están en Drive
    E.driveFotos = E.driveFotos || {};
    const ids = await tx("fotos", "readonly", st => st.getAllKeys());
    for (const id of ids) {
      if (E.driveFotos[id]) continue;
      const [ruta, nombre] = ubicacionFoto(id);
      E.driveFotos[id] = await driveCrear(await driveRuta(ruta), nombre, await leerFotoLocal(id));
      subirDatos = true;
    }
    E.ultimoRespaldo = hoyISO();
    if (subirDatos) {
      E.guardadoEn = new Date().toISOString();
      const blob = new Blob([JSON.stringify(E)], { type: "application/json" });
      if (idDatos) await driveFetch(`https://www.googleapis.com/upload/drive/v3/files/${idDatos}?uploadType=media`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: blob });
      else await driveCrear(carpetaRespaldo, "datos.json", blob);
    }
    await guardarLocal();
    ls.set("ultimaSync", E.guardadoEn || "");
    ls.set("ultimaSyncHora", new Date().toISOString());
    if (avisar) setTimeout(() => alert("✅ Sincronizado con Google Drive"), 50);
  } catch (e) {
    drive.error = e.message;
  } finally {
    drive.ocupado = false;
    render();
  }
}
function vDrive() {
  const hora = ls.get("ultimaSyncHora");
  const estado = !driveListo() ? "Falta configurar (lo hace Sergio una vez)" : driveActivo() ? "Conectado" : driveConectado() ? "Toca el botón para volver a conectar" : "No conectado";
  pantalla("Google Drive", "Respaldo automático", `
    <div class="card"><p>Con Drive conectado, <b>cada cambio se guarda solo</b> en tu Google Drive, y puedes usar la app en <b>otro aparato</b> (celular o laptop) con los mismos datos: abre el link ahí y conecta la misma cuenta de Google.</p>
    <div class="dato"><span>Estado</span><b>${esc(estado)}</b></div>
    <div class="dato"><span>Última vez</span>${hora ? fechaBonita(iso(new Date(hora))) + " " + new Date(hora).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) : "Nunca"}</div>
    ${drive.error ? `<div class="aviso">${esc(drive.error)}</div>` : ""}</div>
    <button class="btn" onclick="${driveActivo() ? "sincronizar(true)" : "conectarDrive()"}" ${driveListo() ? "" : "disabled"}>${ic("respaldo")}${driveActivo() ? "Sincronizar ahora" : "Conectar con Google Drive"}</button>
    <div class="card"><b>Tu carpeta en Drive: «${CARPETA_DRIVE}»</b>
      <p class="sub" style="font-weight:400">${SUB.respaldo} · ${SUB.locales} (expediente y fotos de cada local) · ${SUB.pagos} (comprobantes por mes) · ${SUB.propietaria} (tu INE)</p>
      <b>Seguridad</b>
      <p class="sub" style="font-weight:400">Google te pedirá permiso para que la app use <b>solo los archivos que ella crea</b>. No puede ver, cambiar ni borrar ningún otro archivo de tu Drive, y nunca borra nada. Puedes quitarle el permiso cuando quieras en myaccount.google.com/permissions.</p></div>
    <p class="sub" style="font-weight:400">Si hay cambios sin subir, Inicio te avisa y con un toque se suben. Si no lo tocas, todo sigue guardado en tu celular.</p>
    <a class="btn sec" href="#/respaldo">Respaldo manual en archivo</a>`, "#/mas");
}

/* ================= Calendario por locales (estilo multi-calendario) ================= */
let filtroCal = "todas";
// Contrato que cubre un mes (de la primera renta a su último mes).
function contratoDeMes(l, m) {
  return E.contratos.find(c => c.localId === l.id && m >= (c.cobrarDesde || c.inicio.slice(0, 7)) && m <= finContrato(c.inicio, c.meses).slice(0, 7));
}
function vCalendario(arg) {
  const base = /^\d{4}-\d{2}$/.test(arg || "") ? arg : sumarMeses(mesActual(), -2);
  const meses = Array.from({ length: 12 }, (_, i) => sumarMeses(base, i));
  const hoyMes = mesActual();
  const celda = (l, m) => {
    const c = contratoDeMes(l, m);
    // Celda libre: tocarla lleva a rentar el local (vacío) o a capturar al inquilino actual (rentado sin datos).
    if (!c) {
      if (l.estado === "vacio" || l.estado === "venta")
        return `<td class="cal-vac"><a class="cal-add" href="#/rentar/${l.id}" aria-label="Rentar ${esc(nombreLocal(l))}">${m === hoyMes ? "+ Rentar" : l.estado === "venta" ? "En venta" : "Vacío"}</a></td>`;
      if (l.estado === "rentado")
        return `<td class="cal-sin"><a class="cal-add" href="#/rentar/${l.id}?existente=1" aria-label="Capturar inquilino de ${esc(nombreLocal(l))}">${m === hoyMes ? "+ Capturar" : ""}</a></td>`;
      return `<td></td>`;
    }
    const x = cargo(c, m);
    const tono = { Pagado: "ok", Atrasado: "mal", Parcial: "ojo", Pendiente: "pend" }[x.estado];
    const etiqueta = { Pagado: "Pagó", Atrasado: "Debe", Parcial: "Parcial", Pendiente: "Pendiente" }[x.estado];
    const ini = m === (c.cobrarDesde || c.inicio.slice(0, 7)) ? " ini" : "";
    const fin = m === finContrato(c.inicio, c.meses).slice(0, 7) ? " fin" : "";
    return `<td class="cal-c"><span class="bar ${tono}${ini}${fin}" role="button" tabindex="0" onclick="detalleCargo('${c.id}','${m}')" title="${esc(c.inquilino.nombre)} · ${esc(etiqueta)}">${etiqueta}</span></td>`;
  };
  const filas = E.plazas.filter(p => filtroCal === "todas" || p.id === filtroCal).map(p => {
    const ls = E.locales.filter(l => l.plazaId === p.id);
    if (!ls.length) return "";
    return `<tr class="grupo"><th colspan="${meses.length + 1}"><span>${esc(p.nombre)}</span></th></tr>` + ls.map(l => {
      const c = contratoActivo(l.id);
      const sub = c ? c.inquilino.nombre : estadoLocal(l)[0];
      return `<tr><th><a href="#/local/${l.id}"><b>${esc(l.numero)}</b><small>${esc(sub)}</small></a></th>${meses.map(m => celda(l, m)).join("")}</tr>`;
    }).join("");
  }).join("");
  const mesNombre = m => MESES[Number(m.slice(5)) - 1].slice(0, 3) + " " + m.slice(2, 4);
  pantalla("Calendario", nombreMes(meses[0]) + " a " + nombreMes(meses[11]), `
    <div class="mesnav"><a href="#/calendario/${sumarMeses(base, -1)}" aria-label="Mes anterior"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></a><a href="#/calendario" style="width:auto;padding:0 14px;font-size:14px;font-weight:700">Hoy</a><a href="#/calendario/${sumarMeses(base, 1)}" aria-label="Mes siguiente">${ic("flecha")}</a></div>
    <label class="cal-filtro">Plaza<select onchange="filtroCal=this.value;render()">${[["todas", "Todas las plazas"], ...E.plazas.map(p => [p.id, p.nombre])].map(([k, t]) => `<option value="${esc(k)}" ${filtroCal === k ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label>
    <div class="cal-leyenda"><span class="bar ok">Pagó</span><span class="bar ojo">Parcial</span><span class="bar pend">Pendiente</span><span class="bar mal">Debe</span><span class="cal-vac">Vacío</span><span class="cal-sin">Sin datos</span></div>
    <div class="calwrap"><table class="cal">
      <thead><tr><th>Local</th>${meses.map(m => `<th class="${m === hoyMes ? "hoy" : ""}">${mesNombre(m)}</th>`).join("")}</tr></thead>
      <tbody>${filas || '<tr><td class="vacio">Nada que mostrar</td></tr>'}</tbody>
    </table></div>
    <p class="sub" style="font-weight:400">Toca una barra para ver el pago de ese mes. En un local vacío, toca «+ Rentar» para darlo de alta; en uno sin datos, «+ Capturar».</p>`, "#/mas");
  // Abre mostrando el mes actual junto a la columna de locales
  const caja = $(".calwrap"), hoyTh = caja && caja.querySelector("th.hoy");
  if (hoyTh) caja.scrollLeft += hoyTh.getBoundingClientRect().left - caja.querySelector("th").getBoundingClientRect().right;
}

/* ================= Rutas ================= */
function render() {
  const [ruta, arg] = location.hash.replace(/^#\/?/, "").split("?")[0].split("/");
  const q = new URLSearchParams(location.hash.split("?")[1] || "");
  const vistas = {
    inicio: vInicio, locales: () => vLocales(false), vacios: () => vLocales(true), local: () => vLocal(arg),
    pagos: () => vPagos(arg), rentar: () => vRentar(arg, q.has("existente")), gastos: vGastos, reporte: () => vReporte(arg),
    banco: vBanco, respaldo: vRespaldo, drive: vDrive, calendario: () => vCalendario(arg), mas: vMas, ajustes: vAjustes, plazas: vPlazas,
  };
  (vistas[ruta] || vInicio)();
  const tab = { local: "locales", vacios: "inicio", rentar: "locales", gastos: "mas", reporte: "mas", banco: "mas", respaldo: "mas", drive: "mas", calendario: "pagos", ajustes: "mas", plazas: "mas" }[ruta] || ruta || "inicio";
  document.querySelectorAll("nav a").forEach(a => a.classList.toggle("on", a.dataset.t === tab));
}
let rutaAnterior = "";
window.addEventListener("hashchange", () => {
  const ruta = location.hash.split("/")[1];
  if (ruta !== "rentar") borrador = null;
  cerrarHoja(); render();
  if (rutaAnterior !== location.hash.split("?")[0]) window.scrollTo(0, 0);
  rutaAnterior = location.hash.split("?")[0];
});

(async () => {
  db = await abrirDB();
  E = await tx("estado", "readonly", s => s.get("principal"));
  // Sin fecha de cambio: un aparato nuevo toma los datos de Drive sin preguntar.
  if (!E) { E = estadoInicial(); await guardarLocal(); } else migrar(E);
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
  render();
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js");
})();
