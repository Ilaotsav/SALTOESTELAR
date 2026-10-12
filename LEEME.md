# ⭐ Salto Estelar

Un juego **endless runner** de un solo toque: toca la pantalla para saltar, esquiva los bichos
y recoge estrellas. Está hecho con **HTML + CSS + JavaScript puro**: sin librerías, sin internet
y sin instalar nada. Funciona en el móvil y es **editable desde el propio teléfono**.

---

## 1. Jugarlo ahora mismo

### En tu ordenador
Haz **doble clic en `index.html`**. Ya está. (Funciona incluso sin conexión a internet.)

### En tu móvil (misma red WiFi que el ordenador)
```bash
node servidor.js
```
Aparecerá algo así:

```
En el móvil:   http://192.168.1.37:8080/
```

Escribe esa dirección en el navegador del móvil. Si Windows pregunta por el firewall, dale a
**Permitir**. Si no tienes Node, también sirve Python: `python -m http.server 8080`.

**Truco:** en el móvil, abre el menú del navegador → *Añadir a pantalla de inicio*. Se queda con
su icono y se abre a pantalla completa, como una app de verdad.

---

## 2. Compartirlo con tus amigos (gratis)

Solo hay que subir **`index.html`, `style.css`, `game.js`** (los iconos y el `manifest.webmanifest`
son opcionales pero quedan bien). Nada más: no hay que compilar ni configurar nada.

| Servicio | Cómo se hace | Cuenta |
|---|---|---|
| **Netlify Drop** | Entra en `app.netlify.com/drop` y **arrastra la carpeta** del juego. Te da una URL al momento. | Gratis |
| **GitHub Pages** | Crea un repositorio, sube los archivos y en *Settings → Pages* elige la rama `main`. Queda en `https://tuusuario.github.io/turepo/` | Gratis |
| **Cloudflare Pages** | *Workers & Pages → Create → Pages → Upload assets* y arrastra la carpeta. | Gratis |
| **Vercel** | `vercel.com/new` → arrastra la carpeta o conecta el repositorio. | Gratis |
| **itch.io** | Sube un ZIP con `index.html` en la raíz y marca *"This file will be played in the browser"*. | Gratis |

Después manda el enlace por WhatsApp y listo. Cada amigo tendrá su propio récord guardado en su
teléfono (se guarda en el navegador, no en un servidor).

> Ojo: al ser `http://` (no `https://`), algunos extras como *Copiar al portapapeles* o *no apagar
> la pantalla* pueden no funcionar en el móvil. El juego funciona igual; solo son comodidades.
> Con Netlify, GitHub Pages o Cloudflare tendrás `https://` y funcionarán todos.

---

## 3. Cambiar el juego (es muy fácil)

### Desde el móvil: el botón ⚙️
Dentro del juego, pulsa el engranaje. Sale un panel con **17 controles** (gravedad, fuerza del
salto, velocidad, colores, vidas, sonido…). Los cambios **se aplican al instante** y se guardan en
el teléfono. Abajo del panel tienes *"Ver el JSON"* y un botón para copiarlo: ese texto es lo que
se pega en `game.js` si quieres dejar los cambios fijos para todos.

### Desde el ordenador: `game.js`
Abre `game.js` con cualquier editor de texto y cambia los números del bloque `CONFIG` de arriba
del todo. Guarda, recarga la página y ya está.

| Ajuste | Qué hace | Por defecto |
|---|---|---|
| `gravedad` | Fuerza que te tira al suelo. Más = caes antes y saltas menos. | `2600` |
| `fuerzaSalto` | Impulso del salto. Más negativo = saltas más alto. | `-920` |
| `saltosMaximos` | Saltos por aire: 1 = simple, 2 = doble, 3 = triple. | `2` |
| `tamanoJugador` | Tamaño del cuadro del jugador en píxeles. | `38` |
| `velocidadInicial` | Velocidad al empezar (píxeles por segundo). | `330` |
| `velocidadMaxima` | Velocidad tope. | `1000` |
| `aceleracion` | Cuánta velocidad gana por segundo jugado. | `20` |
| `intervaloObstaculos` | Segundos entre obstáculos (el juego garantiza un mínimo justo). | `1.15` |
| `intervaloEstrellas` | Segundos entre estrellas. | `1.0` |
| `vidas` | Golpes que aguantas. | `3` |
| `colorJugador` | Color del personaje. | `#ffd166` |
| `colorObstaculo` | Color de los bichos. | `#ff4d80` |
| `colorEstrella` | Color de las estrellas. | `#fff275` |
| `colorSuelo` | Color del suelo. | `#38e8c8` |
| `colorCieloArriba` / `colorCieloAbajo` | Degradado del fondo. | `#080c22` / `#3a1c62` |
| `sonido` | Sonido sí o no (los sonidos se generan con código, no hay archivos). | `true` |

**Ejemplos para probar:**
- Modo luna: `gravedad: 900` y `fuerzaSalto: -520`.
- Modo caos: `intervaloObstaculos: 0.5`, `aceleracion: 60`, `vidas: 5`.
- Modo tranquilo para enseñar: `velocidadInicial: 240`, `aceleracion: 6`.

También puedes trastear desde la consola del navegador: escribe `CONFIG` y `SALTO_ESTELAR.mirar()`
para ver el estado de la partida y los últimos golpes recibidos.

---

## 4. Qué hace cada archivo

| Archivo | Para qué sirve | ¿Hace falta publicarlo? |
|---|---|---|
| `index.html` | La página: canvas, botones y panel de ajustes. | Sí |
| `style.css` | El aspecto de la interfaz (botones, panel). | Sí |
| `game.js` | Todo el juego: física, dibujo, sonido, ajustes. | Sí |
| `manifest.webmanifest` | Para instalarlo como app en el móvil. | Opcional |
| `icono-192.png`, `icono-512.png` | El icono del juego. | Opcional |
| `servidor.js` | Servidor local para probar en el móvil. | No |

---

## 5. Ideas para ampliarlo

- **Más tipos de obstáculo:** en `crearObstaculo()` añade un caso nuevo (por ejemplo, uno que
  flote en el aire para obligarte a *no* saltar).
- **Power-ups:** copia el sistema de estrellas (`crearEstrella`) y añade un escudo temporal.
- **Paisajes:** cambia `dibujarCielo()` y `dibujarColinas()` por imágenes tuyas.
- **Dos jugadores en el mismo móvil:** divide la pantalla en dos mitades con dos jugadores.
- **Marcador global:** harías falta un servidor (por ejemplo, Supabase o Firebase, planes gratis).

---

## 6. Pruebas automáticas

El juego viene con una prueba que lo ejecuta solo (física, colisiones, panel de ajustes,
rotar el móvil, datos corruptos…):

```bash
node ../herramientas/prueba-juego.js
```

Incluye un bot que juega solo y comprueba que el juego es **superable sin depender del azar**.

---

Hecho para aprender y para presumir delante de los amigos. 🎮
