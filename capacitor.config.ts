import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.ajosave',
  appName: 'Ajosave',
  // Next.js static export output directory (run `next build` with `output: 'export'`)
  webDir: 'out',
  server: {
    // For development: point to local Next.js dev server
    // Remove this block for production builds
    url: 'http://localhost:3000',
    cleartext: true,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
  ios: {
    contentInset: 'automatic',
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
