/**
 * Dynamic Theme Colors System
 * 8 beautiful theme colors that users can choose from in their profile settings
 */

export interface ThemeColor {
  name: string;
  primary: string;
  primaryHover: string;
  primaryLight: string;
  primaryDark: string;
  gradient: string;
  accent: string;
  ring: string;
}

export const themeColors: ThemeColor[] = [
  {
    name: 'Ocean Blue',
    primary: '#3b82f6',
    primaryHover: '#2563eb',
    primaryLight: '#dbeafe',
    primaryDark: '#1d4ed8',
    gradient: 'from-blue-500 to-cyan-500',
    accent: '#0ea5e9',
    ring: 'ring-blue-500'
  },
  {
    name: 'Royal Purple',
    primary: '#8b5cf6',
    primaryHover: '#7c3aed',
    primaryLight: '#ede9fe',
    primaryDark: '#6d28d9',
    gradient: 'from-purple-500 to-pink-500',
    accent: '#a855f7',
    ring: 'ring-purple-500'
  },
  {
    name: 'Emerald Green',
    primary: '#10b981',
    primaryHover: '#059669',
    primaryLight: '#d1fae5',
    primaryDark: '#047857',
    gradient: 'from-emerald-500 to-teal-500',
    accent: '#14b8a6',
    ring: 'ring-emerald-500'
  },
  {
    name: 'Sunset Orange',
    primary: '#f97316',
    primaryHover: '#ea580c',
    primaryLight: '#ffedd5',
    primaryDark: '#c2410c',
    gradient: 'from-orange-500 to-amber-500',
    accent: '#f59e0b',
    ring: 'ring-orange-500'
  },
  {
    name: 'Rose Pink',
    primary: '#ec4899',
    primaryHover: '#db2777',
    primaryLight: '#fce7f3',
    primaryDark: '#be185d',
    gradient: 'from-pink-500 to-rose-500',
    accent: '#f43f5e',
    ring: 'ring-pink-500'
  },
  {
    name: 'Crimson Red',
    primary: '#ef4444',
    primaryHover: '#dc2626',
    primaryLight: '#fee2e2',
    primaryDark: '#b91c1c',
    gradient: 'from-red-500 to-orange-500',
    accent: '#f97316',
    ring: 'ring-red-500'
  },
  {
    name: 'Indigo Night',
    primary: '#6366f1',
    primaryHover: '#4f46e5',
    primaryLight: '#e0e7ff',
    primaryDark: '#4338ca',
    gradient: 'from-indigo-500 to-purple-500',
    accent: '#8b5cf6',
    ring: 'ring-indigo-500'
  },
  {
    name: 'Teal Wave',
    primary: '#14b8a6',
    primaryHover: '#0d9488',
    primaryLight: '#ccfbf1',
    primaryDark: '#0f766e',
    gradient: 'from-teal-500 to-cyan-500',
    accent: '#06b6d4',
    ring: 'ring-teal-500'
  }
];

// Get a random theme color
export const getRandomTheme = (): ThemeColor => {
  const randomIndex = Math.floor(Math.random() * themeColors.length);
  return themeColors[randomIndex];
};

// Get theme by name
export const getThemeByName = (name: string): ThemeColor | undefined => {
  return themeColors.find(t => t.name === name);
};

// Save theme to localStorage
export const saveTheme = (theme: ThemeColor): void => {
  localStorage.setItem('appTheme', JSON.stringify(theme));
  applyTheme(theme);
};

// Load theme from localStorage
export const loadTheme = (): ThemeColor => {
  try {
    const saved = localStorage.getItem('appTheme');
    if (saved) {
      const theme = JSON.parse(saved);
      applyTheme(theme);
      return theme;
    }
  } catch (e) {
    console.error('Error loading theme:', e);
  }
  // Return default theme if none saved
  return themeColors[0];
};

// Apply theme to CSS custom properties
export const applyTheme = (theme: ThemeColor): void => {
  const root = document.documentElement;
  root.style.setProperty('--theme-primary', theme.primary);
  root.style.setProperty('--theme-primary-hover', theme.primaryHover);
  root.style.setProperty('--theme-primary-light', theme.primaryLight);
  root.style.setProperty('--theme-primary-dark', theme.primaryDark);
  root.style.setProperty('--theme-accent', theme.accent);
  
  // Store gradient class for components to use
  root.setAttribute('data-theme-gradient', theme.gradient);
  root.setAttribute('data-theme-ring', theme.ring);
  root.setAttribute('data-theme-name', theme.name);
};

// Initialize theme on app load
export const initializeTheme = (): ThemeColor => {
  return loadTheme();
};

export default {
  themeColors,
  getRandomTheme,
  getThemeByName,
  saveTheme,
  loadTheme,
  applyTheme,
  initializeTheme
};
