async function cargarDatos() {
  const respuesta = await fetch('data/data.json');
  return respuesta.json();
}

function formatNumero(valor) {
  if (valor === null || valor === undefined) return 'Sin dato';
  return valor.toLocaleString('es-AR');
}

function formatPeso(valor) {
  if (valor === null || valor === undefined) return 'Sin dato';
  return `${valor.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`;
}

function formatFecha(valor) {
  return valor || 'Sin dato';
}

function estadoInformacion(campo) {
  if (campo.stockIngreso === 0 && campo.stockActual === null && campo.fechaIngreso === null) {
    return { texto: 'Sin stock / Sin datos actuales', clase: 'alert' };
  }
  if (campo.stockActual !== null && campo.pesoEstimadoHoy !== null) {
    return { texto: 'Datos actualizados', clase: 'ok' };
  }
  return { texto: 'Datos incompletos', clase: 'warning' };
}

function buscarCampo(datos, id) {
  return datos.campos.find(c => c.id === id) || null;
}

function calcularStockTotal(campos) {
  const valores = campos.map(c => c.stockActual).filter(v => v !== null && v !== undefined);
  if (valores.length === 0) return null;
  return valores.reduce((acc, v) => acc + v, 0);
}

function calcularPesoPromedio(campos) {
  const valores = campos.map(c => c.pesoEstimadoHoy).filter(v => v !== null && v !== undefined);
  if (valores.length === 0) return null;
  return valores.reduce((acc, v) => acc + v, 0) / valores.length;
}

function obtenerNovedadesRecientes(campos) {
  return campos
    .flatMap(c => c.novedades.map(n => ({ ...n, campo: c.nombre })))
    .sort((a, b) => {
      const [dA, mA, yA] = a.fecha.split('/').map(Number);
      const [dB, mB, yB] = b.fecha.split('/').map(Number);
      return new Date(yB, mB - 1, dB) - new Date(yA, mA - 1, dA);
    });
}

function renderResumen(datos) {
  const cardsEl = document.getElementById('cards');
  if (cardsEl) {
    const stockTotal = calcularStockTotal(datos.campos);
    const pesoPromedio = calcularPesoPromedio(datos.campos);

    cardsEl.innerHTML = `
      <div class="card">
        <h3>STOCK TOTAL</h3>
        <div class="number">${formatNumero(stockTotal)}</div>
        <p>cabezas</p>
      </div>
      <div class="card">
        <h3>PESO PROMEDIO</h3>
        <div class="number">${formatPeso(pesoPromedio)}</div>
        <p>peso vivo</p>
      </div>
      <div class="card">
        <h3>CAMPOS ACTIVOS</h3>
        <div class="number">${datos.campos.length}</div>
        <p>establecimientos</p>
      </div>
    `;
  }

  const novedadesEl = document.getElementById('novedades');
  if (novedadesEl) {
    const novedades = obtenerNovedadesRecientes(datos.campos);
    novedadesEl.innerHTML = novedades.length
      ? novedades.map(n => `<p><strong>${n.campo}</strong> — ${n.texto}</p>`).join('')
      : '<p>Todavía no hay novedades cargadas</p>';
  }
}

function renderTablaCampos(datos) {
  const tablaEl = document.getElementById('tablaCampos');
  if (!tablaEl) return;

  tablaEl.innerHTML = datos.campos
    .map(c => {
      const estado = estadoInformacion(c);
      return `
        <tr>
          <td>${c.nombre}</td>
          <td>${formatNumero(c.stockActual)}</td>
          <td>${formatPeso(c.pesoEstimadoHoy)}</td>
          <td class="${estado.clase}">● ${estado.texto}</td>
        </tr>
      `;
    })
    .join('');
}

function renderGridCampos(datos) {
  const gridEl = document.getElementById('gridCampos');
  if (!gridEl) return;

  gridEl.innerHTML = datos.campos
    .map(c => {
      const estado = estadoInformacion(c);
      const ultimaPesada = c.fechaUltimaPesada
        ? `${formatFecha(c.fechaUltimaPesada)} — ${formatPeso(c.pesoUltimaPesada)}`
        : 'Sin dato';

      return `
        <a class="campo-card" href="campo.html?id=${encodeURIComponent(c.id)}">
          <h3>${c.nombre}</h3>
          <div class="dato-linea"><span>Fecha de ingreso</span><strong>${formatFecha(c.fechaIngreso)}</strong></div>
          <div class="dato-linea"><span>Stock actual</span><strong>${formatNumero(c.stockActual)}</strong></div>
          <div class="dato-linea"><span>Peso estimado actual</span><strong>${formatPeso(c.pesoEstimadoHoy)}</strong></div>
          <div class="dato-linea"><span>Última pesada</span><strong>${ultimaPesada}</strong></div>
          <div class="dato-linea"><span>Estado</span><strong class="${estado.clase}">● ${estado.texto}</strong></div>
          <span class="ver-detalle">Ver detalle →</span>
        </a>
      `;
    })
    .join('');
}

function renderFicha(datos) {
  const fichaEl = document.getElementById('fichaCampo');
  if (!fichaEl) return;

  const id = new URLSearchParams(window.location.search).get('id');
  const campo = id ? buscarCampo(datos, id) : null;

  if (!campo) {
    fichaEl.innerHTML = `
      <section class="proximamente">
        <h2>Campo no encontrado</h2>
        <p>Volvé a <a href="campos.html">Campos</a> y elegí un establecimiento de la lista.</p>
      </section>
    `;
    return;
  }

  document.title = `ADBlick Ganadería · ${campo.nombre}`;

  const novedadesOrdenadas = [...campo.novedades].sort((a, b) => {
    const [dA, mA, yA] = a.fecha.split('/').map(Number);
    const [dB, mB, yB] = b.fecha.split('/').map(Number);
    return new Date(yB, mB - 1, dB) - new Date(yA, mA - 1, dA);
  });

  fichaEl.innerHTML = `
    <h2 class="ficha-titulo">${campo.nombre}</h2>

    <section>
      <h2>Ingreso</h2>
      <div class="cards">
        <div class="card">
          <h3>FECHA DE INGRESO</h3>
          <div class="number">${formatFecha(campo.fechaIngreso)}</div>
        </div>
        <div class="card">
          <h3>STOCK INGRESO</h3>
          <div class="number">${formatNumero(campo.stockIngreso)}</div>
        </div>
        <div class="card">
          <h3>PESO INGRESO PROMEDIO</h3>
          <div class="number">${formatPeso(campo.pesoIngresoPromedio)}</div>
        </div>
      </div>
    </section>

    <section>
      <h2>Situación actual</h2>
      <div class="cards">
        <div class="card">
          <h3>MORTANDAD</h3>
          <div class="number">${formatNumero(campo.mortandad)}</div>
        </div>
        <div class="card">
          <h3>STOCK ACTUAL</h3>
          <div class="number">${formatNumero(campo.stockActual)}</div>
        </div>
        <div class="card">
          <h3>PESO ESTIMADO A HOY</h3>
          <div class="number">${formatPeso(campo.pesoEstimadoHoy)}</div>
        </div>
      </div>
    </section>

    <section>
      <h2>Última pesada</h2>
      <div class="cards">
        <div class="card">
          <h3>FECHA</h3>
          <div class="number">${formatFecha(campo.fechaUltimaPesada)}</div>
        </div>
        <div class="card">
          <h3>PESO</h3>
          <div class="number">${formatPeso(campo.pesoUltimaPesada)}</div>
        </div>
      </div>
    </section>

    <section>
      <h2>Novedades</h2>
      ${
        novedadesOrdenadas.length
          ? novedadesOrdenadas.map(n => `
              <p class="novedad-item"><strong>${formatFecha(n.fecha)}</strong> — ${n.texto}</p>
            `).join('')
          : '<p>Sin dato</p>'
      }
    </section>

    <section>
      <h2>Comentarios</h2>
      <p>${campo.comentarios || 'Sin dato'}</p>
    </section>
  `;
}

cargarDatos()
  .then(datos => {
    renderResumen(datos);
    renderTablaCampos(datos);
    renderGridCampos(datos);
    renderFicha(datos);
  })
  .catch(err => console.error('Error al cargar data/data.json', err));
