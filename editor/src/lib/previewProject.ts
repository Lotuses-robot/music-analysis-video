import type { MusicAnalysisVideoProject } from "../../../src/types/project";

/** 预览用：统一为黑白灰成片（不依赖彩色主题）。 */
export function toMonochromePreviewProject(project: MusicAnalysisVideoProject): MusicAnalysisVideoProject {
  return {
    ...project,
    style: {
      ...project.style,
      themeId: "minimal-dark",
      primaryColor: "#f5f5f5",
      secondaryColor: "#9ca3af",
    },
  };
}
