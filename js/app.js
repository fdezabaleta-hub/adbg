async function cargarDatos() {
  const respuesta = await fetch('data/data.json');
  return respuesta.json();
}

function renderResumen(datos) {
  const cardsEl = document.getElementById('cards');
  if (cardsEl) {
    cardsEl.innerHTML = `
      <div class="card">
        <h3>STOCK TOTAL</h3>
        <div class="number">${datos.resumen.stockTotal.toLocaleString('es-AR')}</div>
        <p>cabezas</p>
      </div>
      <div class="card">
        <h3>PESO PROMEDIO</h3>
        <div class="number">${datos.resumen.pesoPromedio} kg</div>
        <p>peso vivo</p>
      </div>
      <div class="card">
        <h3>CAMPOS ACTIVOS</h3>
        <div class="number">${datos.resumen.camposActivos}</div>
        <p>establecimientos</p>
      </div>
    `;
  }

  const novedadesEl = document.getElementById('novedades');
  if (novedadesEl) {
    novedadesEl.innerHTML = datos.novedades
      .map(n => `<p><strong>${n.campo}</strong> — ${n.texto}</p>`)
      .join('');
  }
}

function renderTablaCampos(idTabla, datos) {
  const tablaEl = document.getElementById(idTabla);
  if (!tablaEl) return;

  tablaEl.innerHTML = datos.campos
    .map(c => `
      <tr>
        <td>${c.nombre}</td>
        <td>${c.stock}</td>
        <td>${c.pesoPromedio} kg</td>
        <td class="${c.estado}">● ${c.estadoTexto}</td>
      </tr>
    `)
    .join('');
}

cargarDatos().then(datos => {
  renderResumen(datos);
  renderTablaCampos('tablaCampos', datos);
  renderTablaCampos('tablaCamposCompleta', datos);
});
