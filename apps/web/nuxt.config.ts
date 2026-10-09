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
  },
  app: {
    head: {
      htmlAttrs: { lang: 'fr' },
      title: 'AutoPedia — collectionnez les voitures',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Ouvrez des boosters et collectionnez toutes les voitures de l’histoire automobile.' },
        { name: 'theme-color', content: '#0b0f17' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
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
