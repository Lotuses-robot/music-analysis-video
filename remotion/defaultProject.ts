import exampleJson from "../examples/example.project.json" with { type: "json" };
import type { MusicAnalysisVideoProject } from "../src/types/project";

export const defaultProject = exampleJson as MusicAnalysisVideoProject;
