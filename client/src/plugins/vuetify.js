import 'vuetify/styles';
import '@mdi/font/css/materialdesignicons.css';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';

// Modern dark theme with vibrant accents
const rummikubTheme = {
  dark: true,
  colors: {
    // Base colors - deep sophisticated dark
    background: '#0a0a0f',
    surface: '#12121a',
    'surface-variant': '#1a1a24',
    'surface-bright': '#22222e',
    
    // Primary - vibrant gradient-friendly purple/blue
    primary: '#7c3aed',
    'primary-darken-1': '#6d28d9',
    'primary-lighten-1': '#8b5cf6',
    
    // Secondary - modern teal
    secondary: '#14b8a6',
    'secondary-darken-1': '#0d9488',
    'secondary-lighten-1': '#2dd4bf',
    
    // Accent - electric cyan
    accent: '#06b6d4',
    
    // Status colors
    error: '#ef4444',
    info: '#3b82f6',
    success: '#22c55e',
    warning: '#f59e0b',
    
    // Text colors
    'on-background': '#e2e8f0',
    'on-surface': '#e2e8f0',
    
    // Rummikub tile colors - vibrant versions
    'tile-black': '#1e1e2e',
    'tile-red': '#ef4444',
    'tile-blue': '#3b82f6',
    'tile-orange': '#f97316',
  }
};

export default createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: 'rummikubTheme',
    themes: {
      rummikubTheme
    }
  },
  defaults: {
    VBtn: {
      variant: 'flat',
      color: 'primary',
      rounded: 'lg',
      class: 'text-none font-weight-medium'
    },
    VCard: {
      rounded: 'xl',
      class: 'glass-card'
    },
    VTextField: {
      variant: 'outlined',
      density: 'comfortable',
      rounded: 'lg'
    },
    VChip: {
      rounded: 'lg'
    }
  }
});
