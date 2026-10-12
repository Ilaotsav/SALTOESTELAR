'use strict';

/* =========================================================================
   ⭐ SALTO ESTELAR ⭐
   Un endless-runner de un solo toque, hecho con HTML + CSS + JavaScript puro.
   No usa librerías, no necesita internet y funciona en el móvil.

   CÓMO SE JUEGA
     Toca la pantalla (o pulsa ESPACIO / ↑) para saltar. Vuelve a tocar en el
     aire para el doble salto. Esquiva los bichos y recoge estrellas.

   CÓMO SE EDITA
     Opción 1 (desde el móvil): botón ⚙️ dentro del juego. Los cambios se
       aplican al instante y se guardan en el teléfono.
     Opción 2 (en el ordenador): cambia los números de CONFIG aquí abajo,
       guarda el archivo y recarga la página.
   ========================================================================= */


/* =========================================================================
   1) CONFIG — EL BLOQUE QUE PUEDES TOCAR
   ========================================================================= */

const CONFIG_POR_DEFECTO = {

  /* ---- Jugador ---- */
  gravedad: 2600,            // Te tira hacia el suelo. Más = caes antes.
  fuerzaSalto: -920,         // Impulso del salto. Más negativo = saltas más alto.
  saltosMaximos: 2,          // 1 = salto simple · 2 = doble salto · 3 = triple.
  tamanoJugador: 38,         // Tamaño del cuadro, en píxeles.

  /* ---- Mundo ---- */
  velocidadInicial: 330,     // Velocidad al empezar (píxeles por segundo).
  velocidadMaxima: 1000,     // Velocidad tope.
  aceleracion: 20,           // Cuánta velocidad gana por cada segundo jugado.

  /* ---- Ritmo ---- */
  intervaloObstaculos: 1.15, // Segundos entre obstáculo y obstáculo.
  intervaloEstrellas: 1.00,  // Segundos entre estrella y estrella.
  vidas: 3,                  // Golpes que aguantas antes de perder.

  /* ---- Estilo ---- */
  colorJugador:     '#ffd166',
  colorObstaculo:   '#ff4d80',
  colorEstrella:    '#fff275',
  colorSuelo:       '#38e8c8',
  colorCieloArriba: '#080c22',
  colorCieloAbajo:  '#3a1c62',

  /* ---- Sonido ---- */
  sonido: true,              // Los sonidos se generan con código, sin archivos.
};


/* =========================================================================
   2) CONSTANTES DEL MOTOR (mejor no tocar)
   ========================================================================= */

const PASO            = 1 / 120;   // Paso de física (segundos)
const TIEMPO_COYOTE   = 0.10;      // Margen para saltar justo tras salir del suelo
const TIEMPO_BUFFER   = 0.14;      // Margen para "guardar" un toque antes de aterrizar
// (el segundo salto es un poco más flojo que el primero)
const FACTOR_AIRE     = 0.88;
const CLAVE_CONFIG    = 'saltoEstelar.config.v1';
const CLAVE_RECORD    = 'saltoEstelar.record.v1';
const CLAVE_SONIDO    = 'saltoEstelar.sonido.v1';


/* =========================================================================
   3) UTILIDADES
   ========================================================================= */

function limitar(v, min, max) { return v < min ? min : (v > max ? max : v); }
function aleatorio(min, max)   { return min + Math.random() * (max - min); }
function clonar(o)             { return JSON.parse(JSON.stringify(o)); }

// Rectángulo con esquinas redondeadas (compatible con cualquier navegador)
function rectRedondeado(c, x, y, w, h, r) {
  r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  c.beginPath();
  c.moveTo(x + r, y);
  c.lineTo(x + w - r, y);
  c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r);
  c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  c.lineTo(x + r, y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - r);
  c.lineTo(x, y + r);
  c.quadraticCurveTo(x, y, x + r, y);
  c.closePath();
}

function dibujarEstrella(c, cx, cy, radio, rot) {
  const puntas = 5, hueco = radio * 0.45;
  c.beginPath();
  for (let i = 0; i < puntas * 2; i++) {
    const r = (i % 2 === 0) ? radio : hueco;
    const a = rot + (Math.PI / puntas) * i - Math.PI / 2;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
  }
  c.closePath();
}


/* =========================================================================
   4) CONFIGURACIÓN GUARDADA
   ========================================================================= */

let CONFIG = clonar(CONFIG_POR_DEFECTO);

function cargarConfig() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE_CONFIG) || 'null');
    if (guardado && typeof guardado === 'object') {
      for (const clave in CONFIG_POR_DEFECTO) {
        if (Object.prototype.hasOwnProperty.call(guardado, clave)) {
          CONFIG[clave] = guardado[clave];
        }
      }
    }
  } catch (e) { /* si algo falla, usamos los valores por defecto */ }

  try {
    const s = localStorage.getItem(CLAVE_SONIDO);
    if (s === '0') CONFIG.sonido = false;
    if (s === '1') CONFIG.sonido = true;
  } catch (e) {}
}

function guardarConfig() {
  try { localStorage.setItem(CLAVE_CONFIG, JSON.stringify(CONFIG)); } catch (e) {}
  try { localStorage.setItem(CLAVE_SONIDO, CONFIG.sonido ? '1' : '0'); } catch (e) {}
}


/* =========================================================================
   5) CANVAS Y VISTA
   ========================================================================= */

const lienzo = document.getElementById('lienzo');
const ctx    = lienzo.getContext('2d', { alpha: false });
const sonda  = document.getElementById('sondaSegura');

let dpr = 1;
let areaSeguraArriba = 0;
let sueloY = 600;

// "vista" es la columna de juego. En pantallas muy anchas se centra.
const vista = { ancho: 400, alto: 700, offsetX: 0 };

function ajustarLienzo() {
  const anchoCss = Math.max(1, lienzo.clientWidth  || window.innerWidth);
  const altoCss  = Math.max(1, lienzo.clientHeight || window.innerHeight);

  dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  lienzo.width  = Math.round(anchoCss * dpr);
  lienzo.height = Math.round(altoCss * dpr);

  // La columna de juego nunca es más ancha que 0.8 x alto (formato móvil)
  vista.alto    = altoCss;
  vista.ancho   = Math.min(anchoCss, altoCss * 0.8);
  vista.offsetX = (anchoCss - vista.ancho) / 2;

  sueloY = vista.alto - Math.max(76, vista.alto * 0.15);

  try { areaSeguraArriba = sonda.getBoundingClientRect().height || 0; } catch (e) { areaSeguraArriba = 0; }

  // Recolocar al jugador dentro de los nuevos límites
  jugador.w = jugador.h = CONFIG.tamanoJugador;
  jugador.x = Math.round(limitar(vista.ancho * 0.22, 64, 150));
  jugador.y = Math.min(jugador.y, sueloY - jugador.h);

  crearFondoEstelar();
}


/* =========================================================================
   6) ESTADO DEL JUEGO
   ========================================================================= */

// estado: 'menu' | 'jugando' | 'pausa' | 'gameover'
let estado = 'menu';

const mundo = {
  tiempo: 0,
  tiempoEstado: 0,
  distancia: 0,
  velocidad: 330,
  tObstaculo: 1.4,
  tEstrella: 0.8,
  estrellasFondo: [],
};

const jugador = {
  x: 90, y: 400, w: 38, h: 38,
  vy: 0, rot: 0,
  enSuelo: true, saltosUsados: 0,
  coyote: 0, buffer: 0,
  invulnerable: 0,
  escalaX: 1, escalaY: 1,
};

let obstaculos   = [];
let estrellas    = [];
let particulas   = [];
let textosFlotantes = [];

let vidas = CONFIG.vidas;
let estrellasRecogidas = 0;
let puntos = 0;
let record = 0;
let temblor = 0;
let nuevoRecord = false;
let reanudarAlCerrar = false;
let ultimoGolpe = null;

try { record = parseInt(localStorage.getItem(CLAVE_RECORD) || '0', 10) || 0; } catch (e) { record = 0; }


/* =========================================================================
   7) SONIDO (generado con código, sin archivos de audio)
   ========================================================================= */

let audio = null;

function iniciarAudio() {
  try {
    if (!audio) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audio = new AC();
    }
    if (audio.state === 'suspended') audio.resume();
  } catch (e) { audio = null; }
}

function pitido(f1, f2, dur, tipo, vol) {
  if (!CONFIG.sonido || !audio) return;
  try {
    const t = audio.currentTime;
    const osc = audio.createOscillator();
    const gan = audio.createGain();
    osc.type = tipo || 'square';
    osc.frequency.setValueAtTime(f1, t);
    if (f2 && f2 !== f1) osc.frequency.exponentialRampToValueAtTime(Math.max(30, f2), t + dur);
    gan.gain.setValueAtTime(0.0001, t);
    gan.gain.exponentialRampToValueAtTime(vol || 0.06, t + 0.012);
    gan.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gan); gan.connect(audio.destination);
    osc.start(t); osc.stop(t + dur + 0.02);
  } catch (e) {}
}

const sonidoSalto    = () => pitido(480, 780, 0.11, 'square',   0.05);
const sonidoDoble    = () => pitido(680, 1020, 0.12, 'square',  0.05);
const sonidoEstrella = () => { pitido(920, 940, 0.07, 'triangle', 0.08); setTimeout(() => pitido(1380, 1400, 0.09, 'triangle', 0.06), 55); };
const sonidoGolpe    = () => pitido(260, 60, 0.32, 'sawtooth', 0.09);
const sonidoFin      = () => { pitido(420, 300, 0.16, 'triangle', 0.08); setTimeout(() => pitido(300, 180, 0.22, 'triangle', 0.08), 150); setTimeout(() => pitido(200, 90, 0.4, 'triangle', 0.08), 330); };


/* =========================================================================
   8) PARTÍCULAS Y TEXTOS
   ========================================================================= */

function crearParticulas(x, y, cantidad, color, rapidez) {
  for (let i = 0; i < cantidad; i++) {
    const a = aleatorio(0, Math.PI * 2);
    const v = aleatorio(0.3, 1) * (rapidez || 140);
    particulas.push({
      x, y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - 40,
      vida: aleatorio(0.3, 0.75),
      vidaMax: 0.75,
      tam: aleatorio(2, 5),
      color,
    });
  }
}

function crearTexto(x, y, texto, color) {
  textosFlotantes.push({ x, y, texto, color, vida: 0.9, vidaMax: 0.9 });
}


/* =========================================================================
   9) FONDO ESTELAR
   ========================================================================= */

function crearFondoEstelar() {
  mundo.estrellasFondo = [];
  const cantidad = Math.round((vista.ancho * sueloY) / 9000);
  for (let i = 0; i < cantidad; i++) {
    mundo.estrellasFondo.push({
      x: aleatorio(0, vista.ancho),
      y: aleatorio(0, sueloY * 0.92),
      r: aleatorio(0.6, 2.1),
      vel: aleatorio(0.05, 0.3),
      fase: aleatorio(0, Math.PI * 2),
    });
  }
}


/* =========================================================================
   10) FLUJO DEL JUEGO
   ========================================================================= */

function empezar() {
  mundo.tiempo = 0;
  mundo.tiempoEstado = 0;
  mundo.distancia = 0;
  mundo.velocidad = CONFIG.velocidadInicial;
  mundo.tObstaculo = 1.4;
  mundo.tEstrella = 0.9;

  obstaculos = [];
  estrellas = [];
  particulas = [];
  textosFlotantes = [];

  vidas = Math.max(1, CONFIG.vidas | 0);
  estrellasRecogidas = 0;
  puntos = 0;
  nuevoRecord = false;
  temblor = 0;

  jugador.w = jugador.h = CONFIG.tamanoJugador;
  jugador.x = Math.round(limitar(vista.ancho * 0.22, 64, 150));
  jugador.y = sueloY - jugador.h;
  jugador.vy = 0;
  jugador.rot = 0;
  jugador.enSuelo = true;
  jugador.saltosUsados = 0;
  jugador.coyote = TIEMPO_COYOTE;
  jugador.buffer = 0;
  jugador.invulnerable = 0;
  jugador.escalaX = 1;
  jugador.escalaY = 1;

  estado = 'jugando';
  pedirPantallaEncendida();
}

function irAlMenu() {
  estado = 'menu';
  mundo.tiempoEstado = 0;
  obstaculos = [];
  estrellas = [];
  particulas = [];
  textosFlotantes = [];
  jugador.y = sueloY - jugador.h;
  jugador.vy = 0;
  jugador.rot = 0;
  jugador.enSuelo = true;
}

function pausar() {
  if (estado !== 'jugando') return;
  estado = 'pausa';
  mundo.tiempoEstado = 0;
}

function reanudar() {
  if (estado !== 'pausa') return;
  estado = 'jugando';
}

function terminar() {
  estado = 'gameover';
  mundo.tiempoEstado = 0;
  temblor = 1.4;
  soltarPantallaEncendida();
  sonidoFin();
  if (puntos > record) {
    record = puntos;
    nuevoRecord = true;
    try { localStorage.setItem(CLAVE_RECORD, String(record)); } catch (e) {}
  }
}

// Mantener la pantalla encendida mientras se juega (si el navegador lo permite)
let bloqueoPantalla = null;
async function pedirPantallaEncendida() {
  try {
    if ('wakeLock' in navigator && !bloqueoPantalla) {
      bloqueoPantalla = await navigator.wakeLock.request('screen');
      bloqueoPantalla.addEventListener('release', () => { bloqueoPantalla = null; });
    }
  } catch (e) { bloqueoPantalla = null; }
}
function soltarPantallaEncendida() {
  try { if (bloqueoPantalla) { bloqueoPantalla.release(); bloqueoPantalla = null; } } catch (e) {}
}


/* =========================================================================
   11) ENTRADA (toques, clics y teclado)
   ========================================================================= */

const panel = document.getElementById('panel');

function panelAbierto() { return !panel.classList.contains('oculto'); }

function toque() {
  if (panelAbierto()) return;
  iniciarAudio();

  if (estado === 'menu')     { empezar(); return; }
  if (estado === 'gameover') { if (mundo.tiempoEstado > 0.7) empezar(); return; }
  if (estado === 'pausa')    { reanudar(); return; }
  if (estado === 'jugando')  { jugador.buffer = TIEMPO_BUFFER; }
}

lienzo.addEventListener('pointerdown', (e) => { e.preventDefault(); toque(); }, { passive: false });
lienzo.addEventListener('touchstart',  (e) => { e.preventDefault(); }, { passive: false });
lienzo.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Enter') {
    e.preventDefault();
    toque();
  } else if (e.code === 'KeyP') {
    if (estado === 'jugando') pausar(); else if (estado === 'pausa') reanudar();
  } else if (e.code === 'Escape' && panelAbierto()) {
    cerrarPanel();
  }
});

// iOS: bloquea el gesto de pellizcar para hacer zoom
document.addEventListener('gesturestart', (e) => e.preventDefault());

// Si el jugador cambia de pestaña o app, se pausa solo
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (estado === 'jugando') pausar();
    soltarPantallaEncendida();
  }
});

window.addEventListener('resize', ajustarLienzo);
window.addEventListener('orientationchange', () => setTimeout(ajustarLienzo, 120));


/* =========================================================================
   12) APARICIÓN DE OBSTÁCULOS Y ESTRELLAS
   ========================================================================= */

function crearObstaculo() {
  const azar = Math.random();
  let w, h, tipo;

  if (azar < 0.55) {                      // bajito y ancho: salto corto
    tipo = 'bajo';
    w = aleatorio(26, 54);
    h = aleatorio(36, 70);
  } else if (azar < 0.86) {               // alto y estrecho: salto con fuerza
    tipo = 'alto';
    w = aleatorio(26, 44);
    h = aleatorio(78, 118);
  } else {                                // muy ancho: hay que mantener el salto
    tipo = 'largo';
    w = aleatorio(72, 112);
    h = aleatorio(30, 50);
  }

  obstaculos.push({
    x: vista.ancho + 40,
    y: sueloY - h,
    w, h, tipo,
    fase: aleatorio(0, Math.PI * 2),
  });
}

function crearEstrella() {
  const y = sueloY - aleatorio(74, 232);

  if (Math.random() < 0.38) {
    // Arco de 3 estrellas: premia el salto largo
    const n = 3;
    for (let i = 0; i < n; i++) {
      const t = i - 1;
      estrellas.push({
        x: vista.ancho + 40 + i * 42,
        y: sueloY - aleatorio(120, 190) - (i === 1 ? 40 : 0),
        r: 11, rot: aleatorio(0, 6), recogida: false,
      });
    }
    return;
  }

  estrellas.push({ x: vista.ancho + 40, y, r: 12, rot: aleatorio(0, 6), recogida: false });
}

function actualizarApariciones(dt) {
  // --- Obstáculos ---
  mundo.tObstaculo -= dt;
  if (mundo.tObstaculo <= 0) {
    const ultimo = obstaculos[obstaculos.length - 1];
    // Hueco de seguridad para que dos obstáculos no salgan pegados
    const hueco = ultimo ? vista.ancho - (ultimo.x + ultimo.w) : Infinity;
    const huecoMinimo = Math.max(110, mundo.velocidad * 0.3);

    if (hueco >= huecoMinimo) {
      crearObstaculo();
      // El ritmo se mide en SEGUNDOS, porque el tiempo que aguantas en el aire
      // también se mide en segundos. Así el juego se acelera sin volverse injusto.
      const factor = Math.sqrt(CONFIG.velocidadInicial / Math.max(1, mundo.velocidad));
      const base = CONFIG.intervaloObstaculos * factor;
      // Nunca menos de casi un salto completo entre obstáculo y obstáculo
      const tiempoDeVuelo = 2 * Math.abs(CONFIG.fuerzaSalto) / Math.max(1, CONFIG.gravedad);
      const minimo = Math.max(0.5, tiempoDeVuelo * 0.85);
      mundo.tObstaculo = Math.max(minimo, base * aleatorio(0.9, 1.25));
    } else {
      mundo.tObstaculo = 0.1;
    }
  }

  // --- Estrellas ---
  mundo.tEstrella -= dt;
  if (mundo.tEstrella <= 0) {
    crearEstrella();
    mundo.tEstrella = Math.max(0.35, CONFIG.intervaloEstrellas) * aleatorio(0.7, 1.5);
  }
}


/* =========================================================================
   13) FÍSICA Y COLISIONES
   ========================================================================= */

function saltar() {
  const enPiso = jugador.enSuelo || jugador.coyote > 0;

  if (enPiso) {
    jugador.vy = CONFIG.fuerzaSalto;
    jugador.enSuelo = false;
    jugador.coyote = 0;
    jugador.saltosUsados = 1;
    jugador.buffer = 0;
    jugador.escalaX = 0.78; jugador.escalaY = 1.24;
    crearParticulas(jugador.x + jugador.w / 2, sueloY - 2, 7, CONFIG.colorSuelo, 130);
    sonidoSalto();
  } else if (jugador.saltosUsados < Math.max(1, CONFIG.saltosMaximos | 0)) {
    jugador.vy = CONFIG.fuerzaSalto * FACTOR_AIRE;
    jugador.saltosUsados++;
    jugador.buffer = 0;
    jugador.escalaX = 0.8; jugador.escalaY = 1.22;
    crearParticulas(jugador.x + jugador.w / 2, jugador.y + jugador.h / 2, 9, CONFIG.colorJugador, 170);
    sonidoDoble();
  }
}

function actualizarJugador(dt) {
  // Suavizados que se aplican siempre
  jugador.escalaX += (1 - jugador.escalaX) * Math.min(1, 14 * dt);
  jugador.escalaY += (1 - jugador.escalaY) * Math.min(1, 14 * dt);
  if (jugador.invulnerable > 0) jugador.invulnerable -= dt;

  if (estado !== 'jugando') return;

  // Toque guardado (buffer) y salto
  if (jugador.buffer > 0) {
    jugador.buffer -= dt;
    if (jugador.enSuelo || jugador.coyote > 0 || jugador.saltosUsados < Math.max(1, CONFIG.saltosMaximos | 0)) {
      saltar();
    }
  }

  // Gravedad
  jugador.vy += CONFIG.gravedad * dt;
  jugador.y  += jugador.vy * dt;

  const techoSuelo = sueloY - jugador.h;
  if (jugador.y >= techoSuelo) {
    if (!jugador.enSuelo) {
      // Aterrizaje
      jugador.escalaX = 1.26; jugador.escalaY = 0.76;
      crearParticulas(jugador.x + jugador.w / 2, sueloY - 2, 6, '#ffffff', 110);
    }
    jugador.y = techoSuelo;
    jugador.vy = 0;
    jugador.enSuelo = true;
    jugador.saltosUsados = 0;
    jugador.coyote = TIEMPO_COYOTE;
  } else {
    jugador.enSuelo = false;
    if (jugador.coyote > 0) jugador.coyote -= dt;
  }

  // Giro en el aire y frenado al tocar el suelo
  if (!jugador.enSuelo) {
    jugador.rot += 7 * dt;
  } else {
    const objetivo = Math.round(jugador.rot / (Math.PI * 2)) * Math.PI * 2;
    jugador.rot += (objetivo - jugador.rot) * Math.min(1, 12 * dt);
  }
}

function actualizarObstaculos(dt) {
  const v = mundo.velocidad;

  for (let i = obstaculos.length - 1; i >= 0; i--) {
    const o = obstaculos[i];
    o.x -= v * dt;
    o.fase += dt * 4;

    if (o.x + o.w < -50) { obstaculos.splice(i, 1); continue; }

    // Colisión (un poco indulgente con el jugador)
    const margen = 5;
    const jx = jugador.x + margen, jy = jugador.y + margen;
    const jw = jugador.w - margen * 2, jh = jugador.h - margen * 2;

    if (jx < o.x + o.w && jx + jw > o.x && jy < o.y + o.h && jy + jh > o.y) {
      golpe(o, i);
    }
  }
}

function golpe(o, indice) {
  if (jugador.invulnerable > 0 || estado !== 'jugando') return;

  // Se guarda para poder depurar: SALTO_ESTELAR.mirar().ultimoGolpe
  ultimoGolpe = {
    segundo: +mundo.tiempo.toFixed(1),
    velocidad: Math.round(mundo.velocidad),
    tipo: o.tipo,
    ancho: Math.round(o.w),
    alto: Math.round(o.h),
    enSuelo: jugador.enSuelo,
    saltosUsados: jugador.saltosUsados,
    alturaJugador: Math.round(sueloY - (jugador.y + jugador.h)),
  };

  obstaculos.splice(indice, 1);
  vidas--;
  jugador.invulnerable = 1.6;
  temblor = 1.1;
  crearParticulas(o.x + o.w / 2, o.y + o.h / 2, 18, CONFIG.colorObstaculo, 240);
  sonidoGolpe();

  if (vidas <= 0) terminar();
}

function actualizarEstrellas(dt) {
  const v = mundo.velocidad;
  const cx = jugador.x + jugador.w / 2;
  const cy = jugador.y + jugador.h / 2;

  for (let i = estrellas.length - 1; i >= 0; i--) {
    const s = estrellas[i];
    s.x -= v * dt;
    s.rot += dt * 2.2;

    if (s.x < -40) { estrellas.splice(i, 1); continue; }

    const dx = cx - s.x, dy = cy - s.y;
    if (dx * dx + dy * dy < (s.r + jugador.w * 0.62) * (s.r + jugador.w * 0.62)) {
      estrellas.splice(i, 1);
      estrellasRecogidas++;
      crearParticulas(s.x, s.y, 12, CONFIG.colorEstrella, 190);
      crearTexto(s.x, s.y - 12, '+10', CONFIG.colorEstrella);
      sonidoEstrella();
    }
  }
}

function actualizarParticulas(dt) {
  for (let i = particulas.length - 1; i >= 0; i--) {
    const p = particulas[i];
    p.vida -= dt;
    if (p.vida <= 0) { particulas.splice(i, 1); continue; }
    p.vy += 900 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
}

function actualizarTextos(dt) {
  for (let i = textosFlotantes.length - 1; i >= 0; i--) {
    const t = textosFlotantes[i];
    t.vida -= dt;
    if (t.vida <= 0) { textosFlotantes.splice(i, 1); continue; }
    t.y -= 46 * dt;
  }
}

function actualizarFondo(dt) {
  for (const e of mundo.estrellasFondo) {
    e.x -= (25 * e.vel + (estado === 'jugando' ? mundo.velocidad * e.vel * 0.25 : 0)) * dt;
    if (e.x < -4) { e.x = vista.ancho + 4; e.y = aleatorio(0, sueloY * 0.92); }
    e.fase += dt * 3;
  }
}


/* =========================================================================
   14) BUCLE PRINCIPAL
   ========================================================================= */

function actualizar(dt) {
  mundo.tiempoEstado += dt;
  if (temblor > 0) temblor = Math.max(0, temblor - dt * 3.4);

  if (estado === 'jugando') {
    mundo.tiempo += dt;
    mundo.velocidad = Math.min(CONFIG.velocidadMaxima, CONFIG.velocidadInicial + mundo.tiempo * CONFIG.aceleracion);
    mundo.distancia += mundo.velocidad * dt;

    actualizarJugador(dt);
    actualizarApariciones(dt);
    actualizarObstaculos(dt);
    actualizarEstrellas(dt);

    puntos = Math.floor(mundo.distancia / 10) + estrellasRecogidas * 10;

  } else if (estado === 'menu') {
    mundo.distancia += 55 * dt;
    actualizarJugador(dt);
    jugador.y = sueloY - jugador.h - Math.abs(Math.sin(mundo.tiempoEstado * 2)) * 7;
    jugador.enSuelo = true;

  } else {
    actualizarJugador(dt);
  }

  actualizarParticulas(dt);
  actualizarTextos(dt);
  actualizarFondo(dt);
}


/* =========================================================================
   15) DIBUJO
   ========================================================================= */

function dibujarCielo() {
  const g = ctx.createLinearGradient(0, 0, 0, vista.alto);
  g.addColorStop(0, CONFIG.colorCieloArriba);
  g.addColorStop(1, CONFIG.colorCieloAbajo);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, vista.ancho, vista.alto);

  // Estrellas del fondo (parpadean y se mueven despacio)
  for (const e of mundo.estrellasFondo) {
    const brillo = 0.35 + 0.35 * Math.sin(e.fase);
    ctx.globalAlpha = limitar(brillo, 0.1, 0.85);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function dibujarColinas() {
  const capas = [
    { factor: 0.10, alto: 0.20, color: 'rgba(255,255,255,0.045)' },
    { factor: 0.26, alto: 0.13, color: 'rgba(255,255,255,0.075)' },
  ];

  for (const capa of capas) {
    const radioBase = vista.alto * capa.alto;
    const desp = (mundo.distancia * capa.factor) % (vista.ancho + 260);
    ctx.fillStyle = capa.color;
    for (let i = -1; i < 5; i++) {
      const cx = i * (vista.ancho / 2.1) - desp + 130;
      const r = radioBase * (1 + ((i % 2) ? 0.32 : 0));
      ctx.beginPath();
      ctx.arc(cx, sueloY + 8, r, Math.PI, 0);
      ctx.fill();
    }
  }
}

function dibujarSuelo() {
  ctx.fillStyle = 'rgba(2, 3, 12, 0.55)';
  ctx.fillRect(0, sueloY, vista.ancho, vista.alto - sueloY);

  // Rayas que dan sensación de velocidad
  const sep = 96;
  const desp = mundo.distancia % sep;
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 2;
  for (let x = -desp; x < vista.ancho + sep; x += sep) {
    ctx.beginPath();
    ctx.moveTo(x, sueloY + 12);
    ctx.lineTo(x - 54, vista.alto);
    ctx.stroke();
  }

  // Línea luminosa del borde
  ctx.save();
  ctx.shadowColor = CONFIG.colorSuelo;
  ctx.shadowBlur = 16;
  ctx.strokeStyle = CONFIG.colorSuelo;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, sueloY);
  ctx.lineTo(vista.ancho, sueloY);
  ctx.stroke();
  ctx.restore();
}

function dibujarObstaculos() {
  for (const o of obstaculos) {
    const flote = Math.sin(o.fase) * 1.6;
    const x = o.x, y = o.y + flote;

    ctx.save();
    ctx.shadowColor = CONFIG.colorObstaculo;
    ctx.shadowBlur = 14;
    ctx.fillStyle = CONFIG.colorObstaculo;
    rectRedondeado(ctx, x, y, o.w, o.h, Math.min(12, o.w / 2.6));
    ctx.fill();
    ctx.restore();

    // Brillo superior
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    rectRedondeado(ctx, x + 5, y + 4, Math.max(4, o.w - 10), Math.max(4, o.h * 0.16), 4);
    ctx.fill();

    // Ojitos, para que den un poco de pena al esquivarlos :)
    const rOjo = Math.max(2.4, Math.min(4.4, o.w / 8));
    const cy = y + Math.min(o.h * 0.42, 26);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(x + o.w * 0.33, cy, rOjo, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + o.w * 0.67, cy, rOjo, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#26102a';
    ctx.beginPath(); ctx.arc(x + o.w * 0.33 + rOjo * 0.3, cy, rOjo * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + o.w * 0.67 + rOjo * 0.3, cy, rOjo * 0.5, 0, Math.PI * 2); ctx.fill();
  }
}

function dibujarEstrellas() {
  for (const s of estrellas) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.rot);
    ctx.shadowColor = CONFIG.colorEstrella;
    ctx.shadowBlur = 18;
    ctx.fillStyle = CONFIG.colorEstrella;
    dibujarEstrella(ctx, 0, 0, s.r, 0);
    ctx.fill();
    ctx.restore();
  }
}

function dibujarJugador() {
  // Parpadeo mientras es invulnerable
  if (jugador.invulnerable > 0 && Math.floor(jugador.invulnerable * 12) % 2 === 0) return;

  const cx = jugador.x + jugador.w / 2;
  const cy = jugador.y + jugador.h / 2;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(jugador.rot);
  ctx.scale(jugador.escalaX, jugador.escalaY);

  ctx.shadowColor = CONFIG.colorJugador;
  ctx.shadowBlur = 18;
  ctx.fillStyle = CONFIG.colorJugador;
  const w = jugador.w, h = jugador.h;
  rectRedondeado(ctx, -w / 2, -h / 2, w, h, w * 0.28);
  ctx.fill();

  // Ojos
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#1b1330';
  const r = w * 0.09;
  ctx.beginPath(); ctx.arc(w * 0.16, -h * 0.1, r, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(w * 0.38, -h * 0.1, r, 0, Math.PI * 2); ctx.fill();

  // Sonrisa
  ctx.strokeStyle = '#1b1330';
  ctx.lineWidth = Math.max(1.4, w * 0.055);
  ctx.beginPath();
  ctx.arc(w * 0.27, h * 0.06, w * 0.16, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();

  ctx.restore();
}

function dibujarParticulas() {
  for (const p of particulas) {
    const a = limitar(p.vida / p.vidaMax, 0, 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.tam / 2, p.y - p.tam / 2, p.tam, p.tam);
  }
  ctx.globalAlpha = 1;
}

function dibujarTextos() {
  ctx.textAlign = 'center';
  ctx.font = 'bold 18px system-ui, sans-serif';
  for (const t of textosFlotantes) {
    ctx.globalAlpha = limitar(t.vida / t.vidaMax, 0, 1);
    ctx.fillStyle = t.color;
    ctx.fillText(t.texto, t.x, t.y);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

function dibujarHUD() {
  const arriba = areaSeguraArriba + 18;

  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 8;
  ctx.fillText(String(puntos), 18, arriba + 26);

  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText('RÉCORD ' + record, 18, arriba + 46);

  // Vidas (corazones)
  ctx.font = '16px system-ui, sans-serif';
  let hx = 18;
  const hy = arriba + 72;
  for (let i = 0; i < Math.max(1, CONFIG.vidas | 0); i++) {
    ctx.globalAlpha = i < vidas ? 1 : 0.22;
    ctx.fillText('❤️', hx, hy);
    hx += 22;
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

function textoCentrado(texto, y, fuente, color, sombra) {
  ctx.textAlign = 'center';
  ctx.font = fuente;
  if (sombra !== false) {
    ctx.shadowColor = 'rgba(0,0,0,0.75)';
    ctx.shadowBlur = 12;
  }
  ctx.fillStyle = color;
  ctx.fillText(texto, vista.ancho / 2, y);
  ctx.shadowBlur = 0;
  ctx.textAlign = 'left';
}

function dibujarOverlays() {
  const medio = vista.alto * 0.42;

  if (estado === 'menu') {
    ctx.fillStyle = 'rgba(4,5,16,0.35)';
    ctx.fillRect(0, 0, vista.ancho, vista.alto);

    textoCentrado('⭐', medio - 120, '54px system-ui, sans-serif', '#fff275');
    textoCentrado('SALTO', medio - 52, 'bold 52px system-ui, sans-serif', '#ffffff');
    textoCentrado('ESTELAR', medio + 4, 'bold 52px system-ui, sans-serif', CONFIG.colorJugador);

    const pulso = 0.62 + 0.38 * Math.sin(mundo.tiempoEstado * 3.4);
    ctx.globalAlpha = pulso;
    textoCentrado('TOCA PARA JUGAR', medio + 92, 'bold 24px system-ui, sans-serif', '#7ef2d8');
    ctx.globalAlpha = 1;

    textoCentrado('Toca para saltar · toca otra vez en el aire para el doble salto',
                  medio + 132, '14px system-ui, sans-serif', 'rgba(255,255,255,0.72)');
    textoCentrado('Esquiva los bichos y recoge ⭐',
                  medio + 158, '14px system-ui, sans-serif', 'rgba(255,255,255,0.55)');

    if (record > 0) textoCentrado('Tu récord: ' + record, medio + 200, 'bold 16px system-ui, sans-serif', '#ffd166');
    textoCentrado('Pulsa ⚙️ para cambiar el juego', vista.alto - 26, '13px system-ui, sans-serif', 'rgba(255,255,255,0.45)');
  }

  if (estado === 'pausa') {
    ctx.fillStyle = 'rgba(4,5,16,0.62)';
    ctx.fillRect(0, 0, vista.ancho, vista.alto);
    textoCentrado('PAUSA', medio, 'bold 46px system-ui, sans-serif', '#ffffff');
    textoCentrado('Toca para seguir jugando', medio + 44, '17px system-ui, sans-serif', '#7ef2d8');
  }

  if (estado === 'gameover') {
    ctx.fillStyle = 'rgba(4,5,16,0.68)';
    ctx.fillRect(0, 0, vista.ancho, vista.alto);

    textoCentrado(nuevoRecord ? '¡NUEVO RÉCORD!' : '¡BUEN INTENTO!', medio - 40,
                  'bold 34px system-ui, sans-serif', nuevoRecord ? '#7ef2d8' : '#ffffff');
    textoCentrado(String(puntos), medio + 30, 'bold 62px system-ui, sans-serif', CONFIG.colorJugador);
    textoCentrado('puntos · ⭐ ' + estrellasRecogidas, medio + 62, '15px system-ui, sans-serif', 'rgba(255,255,255,0.7)');
    textoCentrado('Récord: ' + record, medio + 92, 'bold 15px system-ui, sans-serif', 'rgba(255,255,255,0.6)');

    const pulso = 0.6 + 0.4 * Math.sin(mundo.tiempoEstado * 4);
    ctx.globalAlpha = pulso;
    textoCentrado('TOCA PARA REINTENTAR', medio + 150, 'bold 20px system-ui, sans-serif', '#7ef2d8');
    ctx.globalAlpha = 1;
  }
}

function dibujar() {
  const anchoCss = lienzo.clientWidth, altoCss = lienzo.clientHeight;
  if (!anchoCss || !altoCss || vista.ancho <= 0) return;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Fuera de la columna de juego
  ctx.fillStyle = '#04050e';
  ctx.fillRect(0, 0, anchoCss, altoCss);

  let sx = 0, sy = 0;
  if (temblor > 0) {
    sx = (Math.random() - 0.5) * temblor * 16;
    sy = (Math.random() - 0.5) * temblor * 16;
  }

  ctx.save();
  ctx.translate(vista.offsetX + sx, sy);
  ctx.beginPath();
  ctx.rect(0, 0, vista.ancho, vista.alto);
  ctx.clip();

  dibujarCielo();
  dibujarColinas();
  dibujarSuelo();
  dibujarEstrellas();
  dibujarObstaculos();
  dibujarJugador();
  dibujarParticulas();
  dibujarTextos();
  if (estado !== 'menu') dibujarHUD();
  dibujarOverlays();

  ctx.restore();
}


/* =========================================================================
   16) BUCLE
   ========================================================================= */

let ultimoTiempo = 0;
let acumulador = 0;

function bucle(ahora) {
  if (!ultimoTiempo) ultimoTiempo = ahora;
  let dt = (ahora - ultimoTiempo) / 1000;
  ultimoTiempo = ahora;
  if (dt > 0.25) dt = 0.25;          // si la pestaña estuvo oculta, no teletransportes

  acumulador += dt;
  let pasos = 0;
  while (acumulador >= PASO && pasos < 8) {
    actualizar(PASO);
    acumulador -= PASO;
    pasos++;
  }
  if (pasos === 8) acumulador = 0;

  dibujar();
  requestAnimationFrame(bucle);
}


/* =========================================================================
   17) PANEL DE AJUSTES (se construye solo)
   ========================================================================= */

const CAMPOS = [
  { clave: 'gravedad',             nombre: 'Gravedad',                      min: 800,  max: 5200, paso: 50 },
  { clave: 'fuerzaSalto',          nombre: 'Fuerza del salto',              min: -1700, max: -500, paso: 20 },
  { clave: 'saltosMaximos',        nombre: 'Saltos por aire',               min: 1,    max: 3,    paso: 1, entero: true },
  { clave: 'tamanoJugador',        nombre: 'Tamaño del jugador',            min: 20,   max: 70,   paso: 1, entero: true },
  { clave: 'velocidadInicial',     nombre: 'Velocidad inicial',             min: 150,  max: 800,  paso: 10 },
  { clave: 'velocidadMaxima',      nombre: 'Velocidad máxima',              min: 400,  max: 1600, paso: 20 },
  { clave: 'aceleracion',          nombre: 'Aceleración (dificultad)',      min: 0,    max: 90,   paso: 1 },
  { clave: 'intervaloObstaculos',  nombre: 'Segundos entre obstáculos',     min: 0.4,  max: 3,    paso: 0.05 },
  { clave: 'intervaloEstrellas',   nombre: 'Segundos entre estrellas',      min: 0.3,  max: 3,    paso: 0.05 },
  { clave: 'vidas',                nombre: 'Vidas',                         min: 1,    max: 9,    paso: 1, entero: true },
  { clave: 'colorJugador',         nombre: 'Color del jugador',             tipo: 'color' },
  { clave: 'colorObstaculo',       nombre: 'Color de los obstáculos',       tipo: 'color' },
  { clave: 'colorEstrella',        nombre: 'Color de las estrellas',        tipo: 'color' },
  { clave: 'colorSuelo',           nombre: 'Color del suelo',               tipo: 'color' },
  { clave: 'colorCieloArriba',     nombre: 'Cielo (arriba)',                tipo: 'color' },
  { clave: 'colorCieloAbajo',      nombre: 'Cielo (abajo)',                 tipo: 'color' },
  { clave: 'sonido',               nombre: 'Sonido',                        tipo: 'check' },
];

const camposCont = document.getElementById('campos');
const jsonArea   = document.getElementById('json');
const btnSonido  = document.getElementById('btnSonido');

function formatearValor(v, def) {
  if (def.entero) return String(Math.round(v));
  if (def.paso < 1) return Number(v).toFixed(2);
  return String(Math.round(v));
}

function construirPanel() {
  camposCont.innerHTML = '';

  for (const def of CAMPOS) {
    if (def.tipo === 'color') {
      const fila = document.createElement('div');
      fila.className = 'campo campo-color';
      const inp = document.createElement('input');
      inp.type = 'color';
      inp.value = CONFIG[def.clave];
      inp.addEventListener('input', () => { CONFIG[def.clave] = inp.value; alCambiarConfig(); });
      const lab = document.createElement('span');
      lab.className = 'campo-nombre';
      lab.textContent = def.nombre;
      fila.appendChild(inp);
      fila.appendChild(lab);
      camposCont.appendChild(fila);

    } else if (def.tipo === 'check') {
      const fila = document.createElement('label');
      fila.className = 'campo campo-check';
      const inp = document.createElement('input');
      inp.type = 'checkbox';
      inp.checked = !!CONFIG[def.clave];
      inp.addEventListener('change', () => { CONFIG[def.clave] = inp.checked; alCambiarConfig(); });
      const lab = document.createElement('span');
      lab.textContent = def.nombre;
      fila.appendChild(inp);
      fila.appendChild(lab);
      camposCont.appendChild(fila);

    } else {
      const fila = document.createElement('div');
      fila.className = 'campo';

      const cabecera = document.createElement('div');
      cabecera.className = 'campo-fila';
      const lab = document.createElement('span');
      lab.className = 'campo-nombre';
      lab.textContent = def.nombre;
      const val = document.createElement('span');
      val.className = 'campo-valor';
      val.textContent = formatearValor(CONFIG[def.clave], def);
      cabecera.appendChild(lab);
      cabecera.appendChild(val);

      const inp = document.createElement('input');
      inp.type = 'range';
      inp.min = def.min; inp.max = def.max; inp.step = def.paso;
      inp.value = CONFIG[def.clave];
      inp.addEventListener('input', () => {
        const n = def.entero ? Math.round(Number(inp.value)) : Number(inp.value);
        CONFIG[def.clave] = n;
        val.textContent = formatearValor(n, def);
        alCambiarConfig();
      });

      fila.appendChild(cabecera);
      fila.appendChild(inp);
      camposCont.appendChild(fila);
    }
  }
}

function alCambiarConfig() {
  guardarConfig();

  // Efectos inmediatos en la partida en curso
  if (jugador.w !== CONFIG.tamanoJugador) {
    jugador.w = jugador.h = CONFIG.tamanoJugador;
    jugador.y = Math.min(jugador.y, sueloY - jugador.h);
  }
  vidas = Math.max(1, CONFIG.vidas | 0);
  if (estado === 'jugando' || estado === 'menu') {
    mundo.velocidad = limitar(mundo.velocidad, CONFIG.velocidadInicial, CONFIG.velocidadMaxima);
  }

  actualizarBotonSonido();
  jsonArea.value = JSON.stringify(CONFIG, null, 2);
}

function actualizarBotonSonido() {
  btnSonido.textContent = CONFIG.sonido ? '🔊' : '🔇';
  btnSonido.classList.toggle('apagado', !CONFIG.sonido);
}

function abrirPanel() {
  panel.classList.remove('oculto');
  construirPanel();
  jsonArea.value = JSON.stringify(CONFIG, null, 2);
  reanudarAlCerrar = (estado === 'jugando');
  if (estado === 'jugando') pausar();
  soltarPantallaEncendida();
}

function cerrarPanel() {
  panel.classList.add('oculto');
  if (reanudarAlCerrar && estado === 'pausa') reanudar();
  reanudarAlCerrar = false;
}

document.getElementById('btnAjustes').addEventListener('click', abrirPanel);
document.getElementById('btnCerrar').addEventListener('click', cerrarPanel);
document.getElementById('btnPausa').addEventListener('click', () => {
  if (estado === 'jugando') pausar();
  else if (estado === 'pausa') reanudar();
  else if (estado === 'menu') empezar();
});
btnSonido.addEventListener('click', () => {
  CONFIG.sonido = !CONFIG.sonido;
  guardarConfig();
  actualizarBotonSonido();
  iniciarAudio();
  if (CONFIG.sonido) sonidoEstrella();
});
function restaurarPorDefecto() {
  // Se copian los valores en el MISMO objeto CONFIG (no se reemplaza),
  // así window.CONFIG y cualquier referencia externa siguen siendo válidas.
  for (const clave in CONFIG_POR_DEFECTO) CONFIG[clave] = CONFIG_POR_DEFECTO[clave];
}

document.getElementById('btnReiniciar').addEventListener('click', () => {
  restaurarPorDefecto();
  guardarConfig();
  construirPanel();
  actualizarBotonSonido();
  jsonArea.value = JSON.stringify(CONFIG, null, 2);
  vidas = Math.max(1, CONFIG.vidas | 0);
});
document.getElementById('btnCopiar').addEventListener('click', () => {
  const texto = JSON.stringify(CONFIG, null, 2);
  const listo = () => {
    const b = document.getElementById('btnCopiar');
    b.textContent = '¡Copiado!';
    setTimeout(() => { b.textContent = 'Copiar JSON'; }, 1400);
  };
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(listo).catch(() => { jsonArea.select(); listo(); });
    } else {
      jsonArea.select();
      document.execCommand('copy');
      listo();
    }
  } catch (e) {
    jsonArea.select();
  }
});


/* =========================================================================
   18) ARRANQUE
   ========================================================================= */

cargarConfig();
ajustarLienzo();
actualizarBotonSonido();
irAlMenu();
requestAnimationFrame(bucle);

// Para trastear desde la consola del navegador: escribe CONFIG y mira los valores
window.CONFIG = CONFIG;
window.SALTO_ESTELAR = {
  empezar, pausar, reanudar, irAlMenu, mundo, jugador,
  // Resumen del estado actual, útil para depurar: SALTO_ESTELAR.mirar()
  mirar: () => ({
    estado, vidas, puntos, record,
    velocidad: Math.round(mundo.velocidad),
    distancia: Math.round(mundo.distancia),
    obstaculos: obstaculos.length,
    estrellas: estrellas.length,
    ultimoGolpe,
  }),
  verObstaculos: () => obstaculos,
  verEstrellas: () => estrellas,
};
