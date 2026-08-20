const CATEGORIAS = [
  'Terneros -100 Kg.',
  'Terneros 100-130 Kg.',
  'Terneros 130-160 Kg.',
  'Terneros 160-180 Kg.',
  'Terneros 180-200 Kg.',
  'Terneros 200-230 Kg.',
  'Terneros 230-260 Kg.',
  'Novillitos 260-300 Kg.',
  'Novillitos 300-330 Kg.',
  'Novillitos 330-370 Kg.',
  'Novillitos 370-400 Kg.',
  'Novillitos +400 Kg.',
  'Ternero Holando',
  'Macho entero joven',
];

const CATEGORIA_DEFECTO = 'Terneros 180-200 Kg.';

const RANGOS_DIAS = { '1M': 30, '3M': 90, '6M': 180, '1A': 365, TODO: null };

const PALETA_COLORES = ['#173f35', '#d97706', '#2563eb', '#dc2626', '#7c3aed'];

async function cargarPrecios() {
  const respuesta = await fetch('data/precios.json');
  return respuesta.json();
}

function parsearFecha(fechaStr) {
  const [dia, mes, anio] = fechaStr.split('/').map(Number);
  return new Date(anio, mes - 1, dia);
}

function formatearFechaDate(fecha) {
  const dia = String(fecha.getDate()).padStart(2, '0');
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const anio = fecha.getFullYear();
  return `${dia}/${mes}/${anio}`;
}

function formatPrecioKilo(valor, conSufijo = true) {
  if (valor === null || valor === undefined) return 'Sin dato';
  const formateado = valor.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `$ ${formateado}${conSufijo ? ' /kg' : ''}`;
}

function formatCantidad(valor) {
  if (valor === null || valor === undefined) return 'Sin dato';
  return valor.toLocaleString('es-AR');
}

function formatVariacion(valor) {
  if (valor === null || valor === undefined) return 'Sin dato';
  const signo = valor > 0 ? '+' : '';
  return `${signo}${valor.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function claseVariacion(valor) {
  if (valor === null || valor === undefined || valor === 0) return '';
  return valor > 0 ? 'ok' : 'alert';
}

function agruparPorCategoria(registros) {
  const mapa = new Map();
  for (const registro of registros) {
    if (!mapa.has(registro.categoria)) mapa.set(registro.categoria, []);
    mapa.get(registro.categoria).push({ ...registro, fechaDate: parsearFecha(registro.fecha) });
  }
  for (const lista of mapa.values()) {
    lista.sort((a, b) => a.fechaDate - b.fechaDate);
  }
  return mapa;
}

function calcularVariacion(listaCategoria, diasAtras) {
  if (!listaCategoria || listaCategoria.length === 0) return null;

  const ultimo = listaCategoria[listaCategoria.length - 1];
  const fechaObjetivo = new Date(ultimo.fechaDate);
  fechaObjetivo.setDate(fechaObjetivo.getDate() - diasAtras);

  const candidatos = listaCategoria.filter(r => r.fechaDate <= fechaObjetivo);
  if (candidatos.length === 0) return null;

  const referencia = candidatos[candidatos.length - 1];
  if (referencia === ultimo || !referencia.kiloPromedio) return null;

  return ((ultimo.kiloPromedio - referencia.kiloPromedio) / referencia.kiloPromedio) * 100;
}

function filtrarPorRango(listaCategoria, rango) {
  const dias = RANGOS_DIAS[rango];
  if (!listaCategoria || !listaCategoria.length || dias === null || dias === undefined) {
    return listaCategoria || [];
  }
  const limite = new Date(listaCategoria[listaCategoria.length - 1].fechaDate);
  limite.setDate(limite.getDate() - dias);
  return listaCategoria.filter(r => r.fechaDate >= limite);
}

function construirSelector(categorias, seleccionActual) {
  const select = document.getElementById('selectorCategoria');
  if (!select) return;
  select.innerHTML = categorias
    .map(c => `<option value="${c}" ${c === seleccionActual ? 'selected' : ''}>${c}</option>`)
    .join('');
}

function renderFechaUltimoDato(registros) {
  const el = document.getElementById('fechaUltimoDato');
  if (!el) return;

  if (!registros.length) {
    el.textContent = 'Todavía no hay datos de precios cargados.';
    return;
  }

  const maxFecha = registros.reduce((max, r) => {
    const fecha = parsearFecha(r.fecha);
    return fecha > max ? fecha : max;
  }, parsearFecha(registros[0].fecha));

  el.textContent = `Último dato disponible: ${formatearFechaDate(maxFecha)}`;
}

function renderIndicadores(mapa, categoria) {
  const el = document.getElementById('indicadoresPrecios');
  if (!el) return;

  const lista = mapa.get(categoria) || [];
  const ultimo = lista.length ? lista[lista.length - 1] : null;
  const precioActual = ultimo ? ultimo.kiloPromedio : null;
  const variacion30 = calcularVariacion(lista, 30);
  const variacion12m = calcularVariacion(lista, 365);

  el.innerHTML = `
    <div class="card">
      <h3>PRECIO ACTUAL POR KG</h3>
      <div class="number">${formatPrecioKilo(precioActual)}</div>
    </div>
    <div class="card">
      <h3>VARIACIÓN 30 DÍAS</h3>
      <div class="number ${claseVariacion(variacion30)}">${formatVariacion(variacion30)}</div>
    </div>
    <div class="card">
      <h3>VARIACIÓN 12 MESES</h3>
      <div class="number ${claseVariacion(variacion12m)}">${formatVariacion(variacion12m)}</div>
    </div>
  `;
}

function renderTablaActual(mapa) {
  const tbody = document.getElementById('tablaPreciosActuales');
  if (!tbody) return;

  tbody.innerHTML = CATEGORIAS.map(categoria => {
    const lista = mapa.get(categoria) || [];
    const ultimo = lista.length ? lista[lista.length - 1] : null;

    return `
      <tr>
        <td>${categoria}</td>
        <td>${ultimo ? formatCantidad(ultimo.cantidad) : 'Sin dato'}</td>
        <td>${ultimo ? formatPrecioKilo(ultimo.kiloPromedio, false) : 'Sin dato'}</td>
        <td>${ultimo ? formatPrecioKilo(ultimo.kiloMaximo, false) : 'Sin dato'}</td>
        <td>${ultimo ? formatPrecioKilo(ultimo.kiloMinimo, false) : 'Sin dato'}</td>
        <td>${ultimo ? ultimo.fecha : 'Sin dato'}</td>
      </tr>
    `;
  }).join('');
}

let graficoInstancia = null;

// renderGrafico recibe una lista de categorías: hoy siempre se llama con una
// sola, pero ya queda lista para dibujar varias series cuando se agregue un
// selector múltiple más adelante.
function renderGrafico(mapa, categorias, rango) {
  const canvas = document.getElementById('graficoPrecios');
  if (!canvas || typeof Chart === 'undefined') return;

  const datasets = categorias.map((categoria, indice) => {
    const lista = filtrarPorRango(mapa.get(categoria) || [], rango);
    return {
      label: categoria,
      data: lista.map(r => r.kiloPromedio),
      borderColor: PALETA_COLORES[indice % PALETA_COLORES.length],
      backgroundColor: 'transparent',
      tension: 0.25,
      pointRadius: 3,
      _fechas: lista.map(r => r.fecha),
    };
  });

  const conDatos = datasets.find(d => d.data.length);
  const etiquetas = conDatos ? conDatos._fechas : [];

  if (graficoInstancia) {
    graficoInstancia.destroy();
  }

  graficoInstancia = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: { labels: etiquetas, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          ticks: { callback: valor => formatPrecioKilo(valor, false) },
        },
      },
      plugins: {
        legend: { display: categorias.length > 1 },
        tooltip: {
          callbacks: {
            label: contexto => `${contexto.dataset.label}: ${formatPrecioKilo(contexto.parsed.y, false)}`,
          },
        },
      },
    },
  });
}

async function initPrecios() {
  const selector = document.getElementById('selectorCategoria');
  if (!selector) return;

  const estado = { categoria: CATEGORIA_DEFECTO, rango: 'TODO' };

  let registros;
  try {
    registros = await cargarPrecios();
  } catch (error) {
    console.error('Error al cargar data/precios.json', error);
    const fechaEl = document.getElementById('fechaUltimoDato');
    if (fechaEl) fechaEl.textContent = 'No se pudieron cargar los datos de precios.';
    return;
  }

  const mapa = agruparPorCategoria(registros);
  estado.categoria = mapa.has(CATEGORIA_DEFECTO)
    ? CATEGORIA_DEFECTO
    : CATEGORIAS.find(c => mapa.has(c)) || CATEGORIAS[0];

  construirSelector(CATEGORIAS, estado.categoria);
  renderFechaUltimoDato(registros);
  renderIndicadores(mapa, estado.categoria);
  renderGrafico(mapa, [estado.categoria], estado.rango);
  renderTablaActual(mapa);

  selector.addEventListener('change', evento => {
    estado.categoria = evento.target.value;
    renderIndicadores(mapa, estado.categoria);
    renderGrafico(mapa, [estado.categoria], estado.rango);
  });

  document.querySelectorAll('#filtrosRango button').forEach(boton => {
    boton.addEventListener('click', () => {
      estado.rango = boton.dataset.rango;
      document.querySelectorAll('#filtrosRango button').forEach(b => b.classList.remove('activo'));
      boton.classList.add('activo');
      renderGrafico(mapa, [estado.categoria], estado.rango);
    });
  });
}

initPrecios();
