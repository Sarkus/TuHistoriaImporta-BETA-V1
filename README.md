# Tu historia importa, no la cierres – the game
Truco con gatitos y Modo UNO para la campaña de salud mental de la UNM (Grupo Estrés Gráfico).
Esta carpeta funciona **fuera de Claude** y trae su propio multijugador.

## Modos de juego
- **Truco con gatitos:** 1 contra 1 (contra el Gatobot o un amigo).
- **Modo UNO:** salas de 2, 3, 4 u 8 personas. Se juega solo con Gatobots o se crea una sala online: el link y el QR de la sala se comparten, y al empezar los lugares libres los juegan Gatobots. UNO es una marca de Mattel: para una difusión pública conviene darle un nombre propio al modo.

- **Emotes:** el botón 😺 de abajo a la derecha abre una rueda con 5 emotes que ven los demás jugadores.
- **Apilado en UNO:** +2 sobre +2 y +4 sobre +4.

## Qué hay adentro
- `index.html`: el juego completo (cartas, música, efectos, Atún).
- `server.js`: servidor sin dependencias. Sirve el juego, conecta a los jugadores (WebSocket) y, opcionalmente, conecta a Atún con la IA.
- `package.json`: para que los servicios de hosting sepan cómo arrancarlo.

## Probarlo en tu compu (2 minutos)
1. Instalá Node.js 18 o más nuevo (https://nodejs.org).
2. En esta carpeta: `node server.js`
3. Abrí http://localhost:3000, tocá **Invitar a un amigo** y abrí el link en otra pestaña (o en otro celu de la misma red wifi usando la IP de tu compu, por ejemplo `http://192.168.1.20:3000`).

## Atún con IA (opcional)
Creá una clave en https://console.anthropic.com y arrancá así:
- Mac/Linux: `ANTHROPIC_API_KEY=tu_clave node server.js`
- Windows (PowerShell): `$env:ANTHROPIC_API_KEY="tu_clave"; node server.js`
Sin clave, Atún sigue dando consejos de juego con reglas fijas, pero no responde preguntas libres.
La clave queda solo en el servidor (nunca llega al navegador). El servidor limita a 12 preguntas por minuto por persona.
Variable opcional: `ATUN_MODEL` (por defecto `claude-haiku-5-5`).

## Publicarlo en internet para que lo juegue cualquiera
Necesitás un hosting que ejecute Node.js (no sirve GitHub Pages ni itch.io, porque el multijugador necesita el servidor).
Opciones simples: Render, Railway, Fly.io o un VPS.
1. Subí esta carpeta a un repositorio de GitHub.
2. En el servicio elegido creá un "Web Service" desde ese repositorio.
3. Comando de inicio: `node server.js` (no hace falta instalar nada).
4. Si querés Atún con IA, cargá la variable de entorno `ANTHROPIC_API_KEY`.
5. El servicio te da una dirección https. Esa es la que compartís: el botón **Invitar a un amigo** arma solo el link y el QR de cada mesa.

## Notas
- Las mesas viven en la memoria del servidor: si se reinicia, las partidas en curso se pierden.
- Las cartas de cada jugador viajan dentro de los datos de la partida, así que alguien con conocimientos técnicos podría espiarlas. Para jugar entre amigos y en actividades alcanza.
- Colores: desde «Editar estética» se cambian también los colores de las manos y de su trazo.
- Música: «First Boot (Intro)» de Tomodachi Life: Living the Dream es un tema de Nintendo. Para una difusión pública conviene reemplazarla por una música con licencia libre (es una cadena de texto `music` dentro de `index.html`).
- Los números de ayuda y el QR de la pantalla final deben coincidir con los canales oficiales de la campaña.
