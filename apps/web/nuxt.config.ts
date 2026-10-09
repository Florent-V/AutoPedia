// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-01-01',
  // Application de jeu : rendu côté client, le serveur Nitro sert les fichiers et proxifie /api vers NestJS.
  ssr: false,
  devtools: { enabled: false },
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    // Surchargé par NUXT_API_BASE (ex. http://api:3001 dans Docker)
    apiBase: 'http://localhost:3001',
    // NUXT_TRUST_PROXY=true si un reverse proxy (Caddy, Traefik, Nginx…) est placé devant le front
    trustProxy: false,
  },
  app: {
    head: {
      htmlAttrs: { lang: 'fr' },
      title: 'Garage — collectionnez les voitures',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'apple-mobile-web-app-title', content: 'Garage' },
        { name: 'description', content: 'Ouvrez des boosters et collectionnez toutes les voitures de l’histoire automobile.' },
        { name: 'theme-color', content: '#0b0f17' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Russo+One&display=swap',
        },
      ],
    },
  },
  typescript: { strict: true },
});
