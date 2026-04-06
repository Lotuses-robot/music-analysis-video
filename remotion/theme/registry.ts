import type { ThemeDefinition } from "./types";
import { minimalDarkTheme } from "./themes/minimalDark";
import { paperLightTheme } from "./themes/paperLight";

export const themeRegistry: Record<string, ThemeDefinition> = {
  [minimalDarkTheme.id]: minimalDarkTheme,
  [paperLightTheme.id]: paperLightTheme,
};

export const defaultThemeId = minimalDarkTheme.id;
