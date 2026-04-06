# 目录结构速查

```
music-analysis-video/
├── docs/wiki/              # 本 Wiki
├── examples/               # 示例工程 JSON
├── public/audio/           # 静态音频（对应 meta.audioPath）
├── remotion/               # Remotion 入口、成片组件、主题、版式
│   ├── index.ts
│   ├── Root.tsx
│   ├── AnalysisVideo.tsx
│   ├── metadata.ts
│   ├── defaultProject.ts
│   ├── analysis/
│   │   └── buildFrameAnalysis.ts
│   ├── layout/
│   │   └── ThemedAnalysisLayout.tsx
│   └── theme/
│       ├── types.ts
│       ├── registry.ts
│       ├── resolveTheme.ts
│       └── themes/
├── schemas/
│   └── project.schema.json
├── scripts/
│   └── write-silent-wav.mjs
└── src/
    ├── analysis/           # 时长、与 Remotion 无关的纯逻辑
    │   ├── duration.ts
    │   └── selectors.ts
    ├── sync/
    │   └── beatTime.ts
    └── types/
        └── project.ts
```

- **可复用、无 React 的逻辑** 尽量放在 `src/`（便于以后做独立编辑器或测试）。
- **仅服务成片** 的组装放在 `remotion/`。
