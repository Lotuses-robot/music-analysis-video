import type { MusicAnalysisVideoProject } from "../../../src/types/project";

/**
 * 预览用：统一为黑白灰成片（不依赖彩色主题）。
 * @param project 原始项目数据
 * @returns 样式被修改为黑白风格的项目数据
 */
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
