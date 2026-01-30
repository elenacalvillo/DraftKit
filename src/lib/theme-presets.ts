// Theme preset definitions for creator profile customization

export type ThemePresetId = 'default' | 'ocean' | 'sunset' | 'forest' | 'midnight' | 'monochrome';

export interface ThemePreset {
  id: ThemePresetId;
  name: string;
  description: string;
  colors: {
    primary: string; // HSL format for start color
    secondary: string; // HSL format for end color
    accent: string; // Accent for interactive elements
    glow: string; // HSL for profile ring glow
  };
  angle: number; // Gradient angle in degrees
  isPro: boolean; // Whether this preset requires Pro subscription
}

export interface CustomTheme {
  type: 'linear' | 'radial' | 'mesh';
  colors: string[]; // Hex codes
  angle: number;
}

export interface ProfileTheme {
  preset?: ThemePresetId;
  custom?: CustomTheme;
}

// Curated gradient presets with professional aesthetics
export const THEME_PRESETS: Record<ThemePresetId, ThemePreset> = {
  default: {
    id: 'default',
    name: 'DraftKit Coral',
    description: 'Our signature warm coral gradient',
    colors: {
      primary: '12 76% 61%', // Coral
      secondary: '16 65% 45%', // Terracotta
      accent: '12 76% 61%',
      glow: '12 76% 61%',
    },
    angle: 135,
    isPro: false, // Available to all users
  },
  ocean: {
    id: 'ocean',
    name: 'Ocean Depths',
    description: 'Cool, professional deep blue',
    colors: {
      primary: '210 80% 50%', // Deep Blue
      secondary: '175 65% 45%', // Teal
      accent: '210 80% 50%',
      glow: '175 65% 55%',
    },
    angle: 135,
    isPro: true,
  },
  sunset: {
    id: 'sunset',
    name: 'Sunset Warmth',
    description: 'Warm creative energy',
    colors: {
      primary: '35 90% 55%', // Orange
      secondary: '330 70% 60%', // Pink
      accent: '35 90% 55%',
      glow: '35 90% 55%',
    },
    angle: 135,
    isPro: true,
  },
  forest: {
    id: 'forest',
    name: 'Forest Calm',
    description: 'Natural, balanced green',
    colors: {
      primary: '150 60% 40%', // Emerald
      secondary: '120 30% 55%', // Sage
      accent: '150 60% 40%',
      glow: '150 60% 50%',
    },
    angle: 135,
    isPro: true,
  },
  midnight: {
    id: 'midnight',
    name: 'Midnight Pro',
    description: 'Dark, sophisticated purple',
    colors: {
      primary: '270 60% 50%', // Purple
      secondary: '240 70% 40%', // Indigo
      accent: '270 60% 50%',
      glow: '270 60% 60%',
    },
    angle: 135,
    isPro: true,
  },
  monochrome: {
    id: 'monochrome',
    name: 'Clean Slate',
    description: 'Minimal, neutral gray',
    colors: {
      primary: '220 10% 50%', // Gray
      secondary: '220 15% 35%', // Slate
      accent: '220 10% 50%',
      glow: '220 10% 60%',
    },
    angle: 135,
    isPro: true,
  },
};

// Get all preset IDs as an array
export const PRESET_IDS = Object.keys(THEME_PRESETS) as ThemePresetId[];

// Parse theme from database JSONB
export function parseProfileTheme(themeData: unknown): ProfileTheme {
  if (!themeData || typeof themeData !== 'object') {
    return { preset: 'default' };
  }
  
  const theme = themeData as Record<string, unknown>;
  
  if (theme.preset && typeof theme.preset === 'string') {
    const presetId = theme.preset as ThemePresetId;
    if (THEME_PRESETS[presetId]) {
      return { preset: presetId };
    }
  }
  
  if (theme.type && theme.colors && Array.isArray(theme.colors)) {
    return {
      custom: {
        type: theme.type as 'linear' | 'radial' | 'mesh',
        colors: theme.colors as string[],
        angle: typeof theme.angle === 'number' ? theme.angle : 135,
      },
    };
  }
  
  return { preset: 'default' };
}

// Convert hex to HSL string for CSS variables
function hexToHsl(hex: string): string {
  // Remove # if present
  hex = hex.replace(/^#/, '');
  
  // Parse hex
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

// Generate CSS styles for a theme
export function getThemeStyles(theme: ProfileTheme): React.CSSProperties {
  if (theme.custom) {
    const { colors, angle, type } = theme.custom;
    const startHsl = hexToHsl(colors[0] || '#F56B2A');
    const endHsl = hexToHsl(colors[1] || '#D4501F');
    
    if (type === 'radial') {
      return {
        '--theme-gradient': `radial-gradient(circle at center, hsl(${startHsl}), hsl(${endHsl}))`,
        '--theme-primary': startHsl,
        '--theme-secondary': endHsl,
        '--theme-glow': startHsl,
      } as React.CSSProperties;
    }
    
    return {
      '--theme-gradient': `linear-gradient(${angle}deg, hsl(${startHsl}), hsl(${endHsl}))`,
      '--theme-primary': startHsl,
      '--theme-secondary': endHsl,
      '--theme-glow': startHsl,
    } as React.CSSProperties;
  }
  
  const presetId = theme.preset || 'default';
  const preset = THEME_PRESETS[presetId] || THEME_PRESETS.default;
  
  return {
    '--theme-gradient': `linear-gradient(${preset.angle}deg, hsl(${preset.colors.primary}), hsl(${preset.colors.secondary}))`,
    '--theme-primary': preset.colors.primary,
    '--theme-secondary': preset.colors.secondary,
    '--theme-glow': preset.colors.glow,
  } as React.CSSProperties;
}

// Generate a preview gradient CSS string
export function getPreviewGradient(theme: ProfileTheme): string {
  if (theme.custom) {
    const { colors, angle, type } = theme.custom;
    if (type === 'radial') {
      return `radial-gradient(circle, ${colors[0] || '#F56B2A'}, ${colors[1] || '#D4501F'})`;
    }
    return `linear-gradient(${angle}deg, ${colors[0] || '#F56B2A'}, ${colors[1] || '#D4501F'})`;
  }
  
  const presetId = theme.preset || 'default';
  const preset = THEME_PRESETS[presetId] || THEME_PRESETS.default;
  
  return `linear-gradient(${preset.angle}deg, hsl(${preset.colors.primary}), hsl(${preset.colors.secondary}))`;
}

// Serialize theme for database storage
export function serializeTheme(theme: ProfileTheme): object {
  if (theme.custom) {
    return {
      type: theme.custom.type,
      colors: theme.custom.colors,
      angle: theme.custom.angle,
    };
  }
  
  return { preset: theme.preset || 'default' };
}
