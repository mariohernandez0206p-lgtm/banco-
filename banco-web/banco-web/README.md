# Banamex — página web (frontend)

Sitio en HTML + CSS + JavaScript puro (sin instalar nada) que consume la **API Banco Simulado**
según la *Guía de integración* del equipo API.

## Cómo correrlo

1. Levanta la API (guía, sección 2): `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
2. En **esta carpeta** sirve el sitio **en el puerto 3000** (la API solo permite ese puerto en CORS):

   ```
   python -m http.server 3000
   ```
   o, si tienes Node: `npx serve -l 3000 .`
3. Abre http://localhost:3000

> No abras `index.html` con doble clic (`file://`): el navegador bloquearía las peticiones por CORS.
> Si usas otro puerto, pídele al equipo API que lo agregue en `CORS_ORIGINS` del `.env`.
> Si la API corre en otra computadora, usa **Configurar API** en el pie de página y escribe
> `http://<IP-DEL-SERVIDOR>:8000/api/v1`.

## Usuarios de prueba (contraseña `Demo1234!`)

| Rol | Correo |
|---|---|
| Cliente sin solicitudes | cliente11@demo-banco.test … cliente15@demo-banco.test |
| Cliente con solicitud en un estado distinto | cliente1 … cliente10 @demo-banco.test |
| Analista | analista1@demo-banco.test |
| Valuador | valuador1@demo-banco.test |
| Admin | admin@demo-banco.test |

En la pantalla de login hay botones que rellenan estos datos.

## Estructura

```
index.html            esqueleto: barra, contenedor #view y pie
css/styles.css        estilos
js/core.js            api(), sesión, formato, formularios, diálogos, router y menú por rol
js/views-public.js    inicio, producto, simulador, login, registro
js/views-client.js    mi banca, cuentas/movimientos, solicitudes, solicitar, trámite completo, perfil
js/views-staff.js     avalúos, estadísticas, usuarios y productos (admin)
```

## Pantallas por rol

- **Público:** productos, detalle, simulador de préstamo/hipoteca con tabla de pagos, login, registro.
- **Cliente:** cuentas y movimientos (filtros + paginación), crear solicitud con estimado en vivo,
  trámite completo (datos, documentos, casa, avalúo, análisis con reglas, oferta, formalizar,
  tabla de pagos, historial, cancelar), perfil y cambio de contraseña.
- **Analista:** bandeja con filtros, revisión de documentos (validar/rechazar), ajuste de resolución, avalúos.
- **Valuador:** avalúos asignados y ajuste del resultado.
- **Admin:** estadísticas, usuarios (crear/activar/desactivar), productos (crear/editar/desactivar), cuentas.

## Cómo está resuelto lo que pide la guía

- Un solo `api()` en `core.js`: pone el token, devuelve siempre `{ok, data, error}` y, ante un 401
  (salvo en el login), borra la sesión y manda a `#/login`.
- Los errores 422 marcan en rojo cada campo de `error.details`; el resto muestra `error.message`.
- La página no calcula nada de negocio: mensualidades, enganche y reglas vienen de la API. El
  porcentaje de avance y el texto "¿Qué sigue?" salen de `progreso`.
- Toda pantalla con cifras muestra la leyenda demo que manda la API o un aviso fijo.
- El token se guarda en `localStorage`, como sugiere la guía (uso académico, datos ficticios).

## Pendientes / cosas por confirmar con el equipo API

- La guía no dice cómo un **cliente** obtiene el `id` de su avalúo (`/avaluos` es solo de personal),
  así que la tarjeta del avalúo se muestra con la respuesta de `POST /avaluo` de esa sesión y, para
  analista/valuador, se busca en `GET /avaluos`.
- No hay endpoint para subir archivos reales: los documentos solo registran el nombre del archivo.
