'use strict';
/* =========================================================
   Servidor local para probar Salto Estelar en el móvil.
   No necesita instalar nada: usa solo Node.js.

   Uso:   node servidor.js            (puerto 8080)
          node servidor.js 3000       (otro puerto)
   ========================================================= */

const http = require('http');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const RAIZ   = __dirname;
const PUERTO = Number(process.argv[2] || 8080);

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.md':   'text/markdown; charset=utf-8',
  '.txt':  'text/plain; charset=utf-8',
};

const servidor = http.createServer((peticion, respuesta) => {
  let ruta = decodeURIComponent(peticion.url.split('?')[0]);
  if (ruta === '/' || ruta === '') ruta = '/index.html';

  const relativo = path.normalize(ruta).replace(/^([/\\])+/, '');
  const archivo  = path.join(RAIZ, relativo);

  // Nadie sale de la carpeta del juego
  if (!archivo.startsWith(RAIZ)) {
    respuesta.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    respuesta.end('Prohibido');
    return;
  }

  fs.readFile(archivo, (error, datos) => {
    if (error) {
      respuesta.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      respuesta.end('No encontrado: ' + ruta);
      return;
    }
    respuesta.writeHead(200, {
      'Content-Type': TIPOS[path.extname(archivo).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    respuesta.end(datos);
  });
});

servidor.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error('\n  El puerto ' + PUERTO + ' ya está ocupado. Prueba:  node servidor.js ' + (PUERTO + 1) + '\n');
  } else {
    console.error('\n  Error: ' + error.message + '\n');
  }
  process.exit(1);
});

servidor.listen(PUERTO, '0.0.0.0', () => {
  console.log('\n  ⭐ Salto Estelar — servidor local');
  console.log('  ------------------------------------------------');
  console.log('  En este ordenador:   http://localhost:' + PUERTO + '/');

  let hayRed = false;
  for (const [nombre, redes] of Object.entries(os.networkInterfaces())) {
    for (const red of redes || []) {
      if (red.family === 'IPv4' && !red.internal) {
        console.log('  En el móvil:         http://' + red.address + ':' + PUERTO + '/   (' + nombre + ')');
        hayRed = true;
      }
    }
  }
  if (!hayRed) console.log('  (No se ha detectado red WiFi: revisa que estés conectado.)');

  console.log('  ------------------------------------------------');
  console.log('  El móvil debe estar en la MISMA red WiFi que este ordenador.');
  console.log('  Si Windows pregunta por el firewall, dale a "Permitir".');
  console.log('  Para parar el servidor: Ctrl + C\n');
});
