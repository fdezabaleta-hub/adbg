"""
actualizar_precios.py

Descarga la tabla de precios de terneros/novillitos publicada en
entresurcosycorralesya.com y actualiza data/precios.json con el
historico de precios (una fila por fecha + categoria).

Uso:
    python actualizar_precios.py

No hace commit ni push. Solo escribe data/precios.json en el proyecto.
"""

import json
import sys
import urllib.error
import urllib.request
from datetime import date
from html.parser import HTMLParser
from pathlib import Path

URL_ORIGEN = "https://www.entresurcosycorralesya.com/ajax-modulo-ternero.php?desde=&hasta="
RUTA_PRECIOS = Path(__file__).resolve().parent / "data" / "precios.json"

CATEGORIAS_ESPERADAS = [
    "Terneros -100 Kg.",
    "Terneros 100-130 Kg.",
    "Terneros 130-160 Kg.",
    "Terneros 160-180 Kg.",
    "Terneros 180-200 Kg.",
    "Terneros 200-230 Kg.",
    "Terneros 230-260 Kg.",
    "Novillitos 260-300 Kg.",
    "Novillitos 300-330 Kg.",
    "Novillitos 330-370 Kg.",
    "Novillitos 370-400 Kg.",
    "Novillitos +400 Kg.",
    "Ternero Holando",
    "Macho entero joven",
]


class ErrorActualizacion(Exception):
    """Error esperado del proceso (conexion, estructura de la pagina, datos)."""


class ParserTablaPrecios(HTMLParser):
    """Extrae las filas del <tbody> de la tabla de precios como listas de texto."""

    def __init__(self):
        super().__init__()
        self.filas = []
        self._fila_actual = None
        self._celda_actual = None
        self._en_tbody = False

    def handle_starttag(self, tag, attrs):
        if tag == "tbody":
            self._en_tbody = True
        elif tag == "tr" and self._en_tbody:
            self._fila_actual = []
        elif tag == "td" and self._fila_actual is not None:
            self._celda_actual = []

    def handle_endtag(self, tag):
        if tag == "tbody":
            self._en_tbody = False
        elif tag == "tr" and self._fila_actual is not None:
            if self._fila_actual:
                self.filas.append(self._fila_actual)
            self._fila_actual = None
        elif tag == "td" and self._celda_actual is not None:
            texto = "".join(self._celda_actual).strip()
            self._fila_actual.append(texto)
            self._celda_actual = None

    def handle_data(self, data):
        if self._celda_actual is not None:
            self._celda_actual.append(data)


def descargar_html(url):
    peticion = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(peticion, timeout=20) as respuesta:
            estado = respuesta.status
            contenido = respuesta.read().decode("utf-8", errors="replace")
    except urllib.error.URLError as error:
        raise ErrorActualizacion(f"No se pudo conectar a la fuente de precios ({url}): {error}") from error

    if estado != 200:
        raise ErrorActualizacion(f"La fuente de precios respondio con estado HTTP {estado}")

    if "<table" not in contenido.lower():
        raise ErrorActualizacion(
            "La respuesta no contiene una tabla. Es posible que la pagina haya cambiado de estructura."
        )

    return contenido


def convertir_numero_argentino(texto):
    """Convierte numeros en formato argentino a float.

    Ejemplos: '6.424,80' -> 6424.8   |   '1.239.882' -> 1239882.0
    """
    texto = (texto or "").strip()
    if not texto:
        raise ValueError("valor vacio")
    limpio = texto.replace(".", "").replace(",", ".")
    return float(limpio)


def parsear_filas(html):
    parser = ParserTablaPrecios()
    parser.feed(html)
    if not parser.filas:
        raise ErrorActualizacion(
            "No se encontraron filas en la tabla. Es posible que la pagina haya cambiado de estructura."
        )
    return parser.filas


def construir_registros(filas, fecha_actualizacion):
    registros = []
    categorias_encontradas = set()
    errores_conversion = []

    for fila in filas:
        if len(fila) < 8:
            continue

        categoria = fila[0].strip()
        if categoria not in CATEGORIAS_ESPERADAS:
            continue

        try:
            registro = {
                "fecha": fecha_actualizacion,
                "categoria": categoria,
                "cantidad": int(convertir_numero_argentino(fila[1])),
                "kiloPromedio": convertir_numero_argentino(fila[2]),
                "kiloMaximo": convertir_numero_argentino(fila[3]),
                "kiloMinimo": convertir_numero_argentino(fila[4]),
                "bultoPromedio": convertir_numero_argentino(fila[5]),
                "bultoMaximo": convertir_numero_argentino(fila[6]),
                "bultoMinimo": convertir_numero_argentino(fila[7]),
            }
        except ValueError as error:
            errores_conversion.append(f"{categoria}: no se pudo convertir un valor ({error})")
            continue

        registros.append(registro)
        categorias_encontradas.add(categoria)

    categorias_faltantes = [c for c in CATEGORIAS_ESPERADAS if c not in categorias_encontradas]

    return registros, categorias_faltantes, errores_conversion


def cargar_historico(ruta):
    if not ruta.exists():
        return []

    contenido = ruta.read_text(encoding="utf-8").strip()
    if not contenido:
        return []

    try:
        datos = json.loads(contenido)
    except json.JSONDecodeError as error:
        raise ErrorActualizacion(f"data/precios.json existe pero no es JSON valido: {error}") from error

    if not isinstance(datos, list):
        raise ErrorActualizacion("data/precios.json existe pero no tiene el formato esperado (debe ser una lista)")

    return datos


def combinar_historico(historico, registros_nuevos):
    """Agrega registros nuevos; si ya existe fecha+categoria, la reemplaza. No borra historia previa."""
    indice = {(r["fecha"], r["categoria"]): i for i, r in enumerate(historico)}
    agregados = 0
    actualizados = 0

    for registro in registros_nuevos:
        clave = (registro["fecha"], registro["categoria"])
        if clave in indice:
            historico[indice[clave]] = registro
            actualizados += 1
        else:
            historico.append(registro)
            indice[clave] = len(historico) - 1
            agregados += 1

    return historico, agregados, actualizados


def guardar_historico(ruta, historico):
    ruta.parent.mkdir(parents=True, exist_ok=True)
    with ruta.open("w", encoding="utf-8") as archivo:
        json.dump(historico, archivo, ensure_ascii=False, indent=2)
        archivo.write("\n")


def main():
    fecha_actualizacion = date.today().strftime("%d/%m/%Y")

    print(f"Actualizacion de precios - {fecha_actualizacion}")
    print(f"Fuente: {URL_ORIGEN}")
    print("-" * 60)

    try:
        html = descargar_html(URL_ORIGEN)
        filas = parsear_filas(html)
        registros, categorias_faltantes, errores_conversion = construir_registros(filas, fecha_actualizacion)

        if not registros:
            raise ErrorActualizacion("No se pudo extraer ningun registro valido de la tabla.")

        historico = cargar_historico(RUTA_PRECIOS)
        historico, agregados, actualizados = combinar_historico(historico, registros)
        guardar_historico(RUTA_PRECIOS, historico)

    except ErrorActualizacion as error:
        print(f"ERROR: {error}")
        print("\nNo se modifico data/precios.json.")
        sys.exit(1)

    categorias_encontradas = [r["categoria"] for r in registros]

    print(f"Categorias encontradas ({len(categorias_encontradas)}/{len(CATEGORIAS_ESPERADAS)}):")
    for categoria in CATEGORIAS_ESPERADAS:
        marca = "OK" if categoria in categorias_encontradas else "--"
        print(f"  [{marca}] {categoria}")

    if categorias_faltantes:
        print("\nCategorias faltantes en la fuente:")
        for categoria in categorias_faltantes:
            print(f"  - {categoria}")

    if errores_conversion:
        print("\nValores que no se pudieron convertir (se omitieron, no se inventaron datos):")
        for error_texto in errores_conversion:
            print(f"  - {error_texto}")

    print(f"\nRegistros agregados: {agregados}")
    print(f"Registros actualizados (ya existia fecha+categoria): {actualizados}")
    print(f"Total de registros en el historico: {len(historico)}")
    print("\nListo. No se hizo commit ni push automaticamente.")


if __name__ == "__main__":
    main()
