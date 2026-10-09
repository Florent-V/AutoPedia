// Charge le fichier .env en développement (en production, les variables viennent de Docker).
try {
  process.loadEnvFile();
} catch {
  /* pas de fichier .env */
}
