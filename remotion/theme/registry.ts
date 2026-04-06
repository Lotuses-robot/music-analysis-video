import type { ThemeDefinition } from "./types";
import { minimalDarkTheme } from "./themes/minimalDark";
import { paperLightTheme } from "./themes/paperLight";
import { midnightBlueTheme } from "./themes/midnightBlue";

export const themeRegistry: Record<string, ThemeDefinition> = {
  [minimalDarkTheme.id]: minimalDarkTheme,
  [paperLightTheme.id]: paperLightTheme,
  [midnightBlueTheme.id]: midnightBlueTheme,
};

export const defaultThemeId = minimalDarkTheme.id;
