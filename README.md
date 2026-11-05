# Effetto Lab — Rediseño web

Prototipo estático responsive para Effetto Lab, construido en HTML, CSS y JavaScript sin dependencias de frameworks ni servicios de formularios externos.

## Cómo abrirlo

1. Descomprime el paquete.
2. Abre `index.html` en un navegador moderno.
3. Para probarlo localmente con un servidor: `python -m http.server 8000` y visita `http://localhost:8000`.

## Funciones incluidas

- Navegación adaptable con menú móvil.
- Secciones de servicios, promoción, trabajos, video, historia, equipo (Yeison Valdez, Climber Berroa y Nando Espinal), cifras y contacto.
- Galería con filtros y visor ampliado.
- Formulario que genera un mensaje y abre WhatsApp al número que aparece en el sitio original.
- Enlaces de WhatsApp con textos predefinidos.
- Mapa de Google Maps, Instagram y Facebook.

## Notas para la publicación

- El formulario no guarda datos en un servidor: abre WhatsApp con el mensaje preparado.
- El video y el mapa se cargan desde servicios externos.
- Los datos de contacto, la dirección, el horario y los perfiles sociales se conservaron del `index.html` original.
- Las cifras "100%", "150+" y "5+ años" provienen del contenido original de la web; conviene confirmarlas antes de publicar.
- Las fotografías se optimizaron a WebP para reducir el peso. La tarjeta de Nando Espinal incluye el retrato proporcionado y el cargo «Marketing Digital». El logo actualizado usa el SVG proporcionado por Effetto y un PNG transparente de respaldo, ambos incluidos en `assets/images/`.
- El pie de página incluye el crédito «Diseño y estrategia de marketing por: Nando Espinal», enlazado al perfil de Instagram indicado.
- Los enlaces sociales muestran iconos gráficos de Instagram y Facebook.
