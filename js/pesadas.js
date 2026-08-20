function parsearFechaPesada(fechaStr) {
  const [dia, mes, anio] = fechaStr.split('/').map(Number);
  return new Date(anio, mes - 1, dia);
}

function diasEntreFechas(fechaA, fechaB) {
  const MS_POR_DIA = 1000 * 60 * 60 * 24;
  return Math.round((fechaB - fechaA) / MS_POR_DIA);
}

function calcularAmd(pesoAnterior, pesoActual, fechaAnterior, fechaActual) {
  if (pesoAnterior === null || pesoAnterior === undefined) return null;
  if (pesoActual === null || pesoActual === undefined) return null;
  if (!fechaAnterior || !fechaActual) return null;

  const dias = diasEntreFechas(fechaAnterior, fechaActual);
  if (dias <= 0) return null;

  return (pesoActual - pesoAnterior) / dias;
}

function formatAmd(valor) {
  if (valor === null || valor === undefined) return 'Sin dato';
  return `${valor.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg/día`;
}

// Pesadas ordenadas de mas antigua a mas reciente, con la fecha ya parseada
// como Date (se necesita para calcular dias transcurridos y armar el grafico).
function obtenerSeriePesadas(campo) {
  return [...(campo.pesadas || [])]
    .map(p => ({ ...p, fechaDate: parsearFechaPesada(p.fecha) }))
    .sort((a, b) => a.fechaDate - b.fechaDate);
}

function calcularIndicadoresPesadas(campo) {
  const serie = obtenerSeriePesadas(campo);
  const ultima = serie.length ? serie[serie.length - 1] : null;

  const fechaIngreso = campo.fechaIngreso ? parsearFechaPesada(campo.fechaIngreso) : null;
  const pesoIngreso = campo.pesoIngresoPromedio;

  const amdDesdeIngreso = ultima
    ? calcularAmd(pesoIngreso, ultima.pesoPromedio, fechaIngreso, ultima.fechaDate)
    : null;

  const tieneReferenciaIngreso = pesoIngreso !== null && pesoIngreso !== undefined;
  const kgGanados = (ultima && tieneReferenciaIngreso) ? ultima.pesoPromedio - pesoIngreso : null;

  return { ultima, kgGanados, amdDesdeIngreso };
}

function renderTabPesadas(campo) {
  const indicadores = calcularIndicadoresPesadas(campo);
  const { ultima } = indicadores;

  return `
    <section>
      <div class="cards">
        <div class="card">
          <h3>ÚLTIMA PESADA</h3>
          <div class="number">${ultima ? formatPeso(ultima.pesoPromedio) : 'Sin dato'}</div>
          <span class="etiqueta-dato etiqueta-medido">Medido</span>
        </div>
        <div class="card">
          <h3>FECHA ÚLTIMA PESADA</h3>
          <div class="number">${ultima ? formatFecha(ultima.fecha) : 'Sin dato'}</div>
        </div>
        <div class="card">
          <h3>PESO PROMEDIO ACTUAL</h3>
          <div class="number">${formatPeso(campo.pesoEstimadoHoy)}</div>
          <span class="etiqueta-dato etiqueta-estimado">Estimado</span>
        </div>
        <div class="card">
          <h3>KG GANADOS DESDE INGRESO</h3>
          <div class="number">${indicadores.kgGanados !== null ? formatPeso(indicadores.kgGanados) : 'Sin dato'}</div>
        </div>
        <div class="card">
          <h3>AMD / ADPV DESDE INGRESO</h3>
          <div class="number">${formatAmd(indicadores.amdDesdeIngreso)}</div>
        </div>
      </div>
    </section>

    <section>
      <h2>Evolución de peso</h2>
      <div class="grafico-container">
        <canvas id="graficoPesadas"></canvas>
      </div>
    </section>

    <section>
      <h2>Historial de pesadas</h2>
      <table>
        <tr>
          <th>Fecha</th>
          <th>Cabezas</th>
          <th>Peso promedio</th>
          <th>AMD</th>
          <th>Archivo</th>
        </tr>
        <tbody>${renderFilasPesadas(campo)}</tbody>
      </table>
    </section>
  `;
}

function renderFilasPesadas(campo) {
  const serie = obtenerSeriePesadas(campo);
  if (serie.length === 0) {
    return '<tr><td colspan="5">Todavía no hay pesadas cargadas</td></tr>';
  }

  const fechaIngreso = campo.fechaIngreso ? parsearFechaPesada(campo.fechaIngreso) : null;
  const pesoIngreso = campo.pesoIngresoPromedio;

  // El AMD de cada fila se calcula contra la pesada anterior; para la
  // primera pesada de la serie, la referencia es la fecha/peso de ingreso.
  const filas = serie.map((p, indice) => {
    const anterior = indice === 0
      ? { pesoPromedio: pesoIngreso, fechaDate: fechaIngreso }
      : serie[indice - 1];

    return {
      fecha: p.fecha,
      cabezas: p.cabezas,
      pesoPromedio: p.pesoPromedio,
      archivo: p.archivo,
      amd: calcularAmd(anterior.pesoPromedio, p.pesoPromedio, anterior.fechaDate, p.fechaDate),
    };
  });

  return filas
    .slice()
    .reverse() // mas reciente primero
    .map(f => `
      <tr>
        <td>${formatFecha(f.fecha)}</td>
        <td>${formatNumero(f.cabezas)}</td>
        <td>${formatPeso(f.pesoPromedio)}</td>
        <td>${formatAmd(f.amd)}</td>
        <td>${f.archivo ? `<a class="link-descarga" href="${f.archivo}">Descargar</a>` : '<span class="sin-archivo">—</span>'}</td>
      </tr>
    `)
    .join('');
}

let graficoPesadasInstancia = null;

function inicializarGraficoPesadas(campo) {
  const canvas = document.getElementById('graficoPesadas');
  if (!canvas || typeof Chart === 'undefined') return;

  const puntos = [];

  if (campo.fechaIngreso && campo.pesoIngresoPromedio !== null && campo.pesoIngresoPromedio !== undefined) {
    puntos.push({ fecha: campo.fechaIngreso, peso: campo.pesoIngresoPromedio });
  }
  obtenerSeriePesadas(campo).forEach(p => puntos.push({ fecha: p.fecha, peso: p.pesoPromedio }));

  if (graficoPesadasInstancia) {
    graficoPesadasInstancia.destroy();
    graficoPesadasInstancia = null;
  }

  if (puntos.length === 0) return;

  graficoPesadasInstancia = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: puntos.map(p => p.fecha),
      datasets: [{
        label: 'Peso promedio (kg/cabeza)',
        data: puntos.map(p => p.peso),
        borderColor: '#173f35',
        backgroundColor: 'transparent',
        tension: 0.25,
        pointRadius: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          ticks: { callback: valor => `${valor} kg` },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: contexto => `${contexto.parsed.y.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`,
          },
        },
      },
    },
  });
}
