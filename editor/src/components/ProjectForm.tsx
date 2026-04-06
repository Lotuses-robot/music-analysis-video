import type { FC } from "react";
import type { MusicAnalysisVideoProject, SyncExtrapolation } from "../../../src/types/project";

type Props = {
  project: MusicAnalysisVideoProject;
  onChange: (next: MusicAnalysisVideoProject) => void;
  currentBeat: number;
  currentTime: number;
};

export const ProjectForm: FC<Props> = ({ project, onChange, currentBeat, currentTime }) => {
  const setMeta = (patch: Partial<MusicAnalysisVideoProject["meta"]>) => {
    onChange({ ...project, meta: { ...project.meta, ...patch } });
  };

  const setSync = (patch: Partial<MusicAnalysisVideoProject["sync"]>) => {
    onChange({ ...project, sync: { ...project.sync, ...patch } });
  };

  const setTs = (patch: Partial<MusicAnalysisVideoProject["timeSignature"]["default"]>) => {
    onChange({
      ...project,
      timeSignature: { ...project.timeSignature, default: { ...project.timeSignature.default, ...patch } },
    });
  };

  const setKeyDefault = (key: string) => {
    onChange({ ...project, key: { ...project.key, default: key } });
  };

  const setStyle = (patch: Partial<NonNullable<MusicAnalysisVideoProject["style"]>>) => {
    onChange({ ...project, style: { ...(project.style ?? {}), ...patch } });
  };

  const setExport = (patch: Partial<NonNullable<MusicAnalysisVideoProject["export"]>>) => {
    onChange({ ...project, export: { ...(project.export ?? {}), ...patch } });
  };

  return (
    <div>
      <h2>元信息</h2>
      <div className="field">
        <label htmlFor="schemaVersion">schemaVersion</label>
        <input
          id="schemaVersion"
          value={project.schemaVersion}
          onChange={(e) => onChange({ ...project, schemaVersion: e.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor="title">标题</label>
        <input id="title" value={project.meta.title} onChange={(e) => setMeta({ title: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="artist">艺人</label>
        <input id="artist" value={project.meta.artist ?? ""} onChange={(e) => setMeta({ artist: e.target.value || undefined })} />
      </div>
      <div className="field">
        <label htmlFor="audioPath">音频路径（public 下）</label>
        <input id="audioPath" value={project.meta.audioPath} onChange={(e) => setMeta({ audioPath: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="audioStart">片头裁剪（秒）</label>
        <input
          id="audioStart"
          type="number"
          min={0}
          step={0.01}
          value={project.meta.audioStartOffsetSec ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            setMeta({ audioStartOffsetSec: v === "" ? undefined : Number(v) });
          }}
        />
      </div>
      <div className="field">
        <label htmlFor="bpmHint">BPM 提示（仅展示）</label>
        <input
          id="bpmHint"
          type="number"
          min={1}
          value={project.meta.bpmDisplayHint ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            setMeta({ bpmDisplayHint: v === "" ? undefined : Number(v) });
          }}
        />
      </div>

      <h2>拍号 / 调号</h2>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <div className="field" style={{ flex: 1 }}>
          <label>默认拍号</label>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <input
              type="number"
              min={1}
              value={project.timeSignature.default.upper}
              onChange={(e) => setTs({ upper: Number(e.target.value) || 4 })}
            />
            <span>/</span>
            <input
              type="number"
              min={1}
              value={project.timeSignature.default.lower}
              onChange={(e) => setTs({ lower: Number(e.target.value) || 4 })}
            />
          </div>
        </div>
        <div className="field" style={{ flex: 2 }}>
          <label htmlFor="keydef">默认调号</label>
          <input id="keydef" value={project.key.default} onChange={(e) => setKeyDefault(e.target.value)} />
        </div>
      </div>

      <h3>拍号变更 (Changes)</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>beat</th>
              <th>signature</th>
              <th className="row-actions" />
            </tr>
          </thead>
          <tbody>
            {(project.timeSignature.changes ?? []).map((ch, i) => (
              <tr key={`ts-${i}`}>
                <td>
                  <div style={{ display: "flex", gap: 4 }}>
                    <input
                      type="number"
                      step={0.01}
                      value={ch.beat}
                      onChange={(e) => {
                        const next = [...(project.timeSignature.changes ?? [])];
                        next[i] = { ...ch, beat: Number(e.target.value) };
                        onChange({ ...project, timeSignature: { ...project.timeSignature, changes: next } });
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn--ghost"
                      title="捕获当前拍子"
                      onClick={() => {
                        const next = [...(project.timeSignature.changes ?? [])];
                        next[i] = { ...ch, beat: currentBeat };
                        onChange({ ...project, timeSignature: { ...project.timeSignature, changes: next } });
                      }}
                    >
                      📍
                    </button>
                  </div>
                </td>
                <td>
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <input
                      type="number"
                      min={1}
                      value={ch.upper}
                      onChange={(e) => {
                        const next = [...(project.timeSignature.changes ?? [])];
                        next[i] = { ...ch, upper: Number(e.target.value) || 4 };
                        onChange({ ...project, timeSignature: { ...project.timeSignature, changes: next } });
                      }}
                    />
                    <span>/</span>
                    <input
                      type="number"
                      min={1}
                      value={ch.lower}
                      onChange={(e) => {
                        const next = [...(project.timeSignature.changes ?? [])];
                        next[i] = { ...ch, lower: Number(e.target.value) || 4 };
                        onChange({ ...project, timeSignature: { ...project.timeSignature, changes: next } });
                      }}
                    />
                  </div>
                </td>
                <td className="row-actions">
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => {
                      const next = (project.timeSignature.changes ?? []).filter((_, j) => j !== i);
                      onChange({ ...project, timeSignature: { ...project.timeSignature, changes: next } });
                    }}
                  >
                    删
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        className="btn"
        onClick={() => {
          const next = [...(project.timeSignature.changes ?? []), { beat: currentBeat, upper: 4, lower: 4 }];
          onChange({ ...project, timeSignature: { ...project.timeSignature, changes: next } });
        }}
      >
        添加拍号变更
      </button>

      <h3>调号变更 (Changes)</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>beat</th>
              <th>key</th>
              <th className="row-actions" />
            </tr>
          </thead>
          <tbody>
            {(project.key.changes ?? []).map((ch, i) => (
              <tr key={`key-${i}`}>
                <td>
                  <div style={{ display: "flex", gap: 4 }}>
                    <input
                      type="number"
                      step={0.01}
                      value={ch.beat}
                      onChange={(e) => {
                        const next = [...(project.key.changes ?? [])];
                        next[i] = { ...ch, beat: Number(e.target.value) };
                        onChange({ ...project, key: { ...project.key, changes: next } });
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn--ghost"
                      title="捕获当前拍子"
                      onClick={() => {
                        const next = [...(project.key.changes ?? [])];
                        next[i] = { ...ch, beat: currentBeat };
                        onChange({ ...project, key: { ...project.key, changes: next } });
                      }}
                    >
                      📍
                    </button>
                  </div>
                </td>
                <td>
                  <input
                    value={ch.key}
                    onChange={(e) => {
                      const next = [...(project.key.changes ?? [])];
                      next[i] = { ...ch, key: e.target.value };
                      onChange({ ...project, key: { ...project.key, changes: next } });
                    }}
                  />
                </td>
                <td className="row-actions">
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => {
                      const next = (project.key.changes ?? []).filter((_, j) => j !== i);
                      onChange({ ...project, key: { ...project.key, changes: next } });
                    }}
                  >
                    删
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        className="btn"
        onClick={() => {
          const next = [...(project.key.changes ?? []), { beat: currentBeat, key: "C major" }];
          onChange({ ...project, key: { ...project.key, changes: next } });
        }}
      >
        添加调号变更
      </button>

      <h2>同步锚点</h2>
      <p className="hint">beat → timeSec，中间线性插值。</p>
      <div className="field">
        <label htmlFor="extrap">外推</label>
        <select
          id="extrap"
          value={project.sync.extrapolation ?? "clamp"}
          onChange={(e) => setSync({ extrapolation: e.target.value as SyncExtrapolation })}
        >
          <option value="clamp">clamp（首尾钳制）</option>
          <option value="extend">extend（延伸斜率）</option>
        </select>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>beat</th>
              <th>timeSec</th>
              <th className="row-actions" />
            </tr>
          </thead>
          <tbody>
            {project.sync.anchors.map((row, i) => (
              <tr key={`a-${i}`}>
                <td>
                  <div style={{ display: "flex", gap: 4 }}>
                    <input
                      type="number"
                      step={0.01}
                      value={row.beat}
                      onChange={(e) => {
                        const next = [...project.sync.anchors];
                        next[i] = { ...row, beat: Number(e.target.value) };
                        onChange({ ...project, sync: { ...project.sync, anchors: next } });
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn--ghost"
                      title="捕获当前拍子"
                      onClick={() => {
                        const next = [...project.sync.anchors];
                        next[i] = { ...row, beat: currentBeat };
                        onChange({ ...project, sync: { ...project.sync, anchors: next } });
                      }}
                    >
                      📍
                    </button>
                  </div>
                </td>
                <td>
                  <div style={{ display: "flex", gap: 4 }}>
                    <input
                      type="number"
                      step={0.01}
                      min={0}
                      value={row.timeSec}
                      onChange={(e) => {
                        const next = [...project.sync.anchors];
                        next[i] = { ...row, timeSec: Number(e.target.value) };
                        onChange({ ...project, sync: { ...project.sync, anchors: next } });
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn--ghost"
                      title="捕获当前时间"
                      onClick={() => {
                        const next = [...project.sync.anchors];
                        next[i] = { ...row, timeSec: currentTime };
                        onChange({ ...project, sync: { ...project.sync, anchors: next } });
                      }}
                    >
                      🕒
                    </button>
                  </div>
                </td>
                <td className="row-actions">
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => {
                      const next = project.sync.anchors.filter((_, j) => j !== i);
                      onChange({
                        ...project,
                        sync: {
                          ...project.sync,
                          anchors: next.length ? next : [{ beat: 0, timeSec: 0 }],
                        },
                      });
                    }}
                  >
                    删
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        className="btn"
        style={{ marginTop: 6 }}
        onClick={() =>
          onChange({
            ...project,
            sync: {
              ...project.sync,
              anchors: [...project.sync.anchors, { beat: currentBeat, timeSec: currentTime }],
            },
          })
        }
      >
        添加同步锚点 (当前)
      </button>

      <h2>和弦</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>beat</th>
              <th>symbol</th>
              <th className="row-actions" />
            </tr>
          </thead>
          <tbody>
            {project.chords.map((row, i) => (
              <tr key={`c-${i}`}>
                <td>
                  <div style={{ display: "flex", gap: 4 }}>
                    <input
                      type="number"
                      step={0.01}
                      value={row.beat}
                      onChange={(e) => {
                        const next = [...project.chords];
                        next[i] = { ...row, beat: Number(e.target.value) };
                        onChange({ ...project, chords: next });
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn--ghost"
                      title="捕获当前拍子"
                      onClick={() => {
                        const next = [...project.chords];
                        next[i] = { ...row, beat: currentBeat };
                        onChange({ ...project, chords: next });
                      }}
                    >
                      📍
                    </button>
                  </div>
                </td>
                <td>
                  <input
                    value={row.symbol}
                    onChange={(e) => {
                      const next = [...project.chords];
                      next[i] = { ...row, symbol: e.target.value };
                      onChange({ ...project, chords: next });
                    }}
                  />
                </td>
                <td className="row-actions">
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => onChange({ ...project, chords: project.chords.filter((_, j) => j !== i) })}
                  >
                    删
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        className="btn"
        style={{ marginTop: 6 }}
        onClick={() => onChange({ ...project, chords: [...project.chords, { beat: currentBeat, symbol: "?" }] })}
      >
        在当前拍添加和弦
      </button>

      <h2>段落</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>id</th>
              <th>label</th>
              <th>start</th>
              <th>end</th>
              <th>评语</th>
              <th className="row-actions" />
            </tr>
          </thead>
          <tbody>
            {project.sections.map((row, i) => (
              <tr key={`s-${row.id}-${i}`}>
                <td>
                  <input
                    value={row.id}
                    onChange={(e) => {
                      const next = [...project.sections];
                      next[i] = { ...row, id: e.target.value };
                      onChange({ ...project, sections: next });
                    }}
                  />
                </td>
                <td>
                  <input
                    value={row.label}
                    onChange={(e) => {
                      const next = [...project.sections];
                      next[i] = { ...row, label: e.target.value };
                      onChange({ ...project, sections: next });
                    }}
                  />
                </td>
                <td>
                  <div style={{ display: "flex", gap: 4 }}>
                    <input
                      type="number"
                      step={0.01}
                      value={row.startBeat}
                      onChange={(e) => {
                        const next = [...project.sections];
                        next[i] = { ...row, startBeat: Number(e.target.value) };
                        onChange({ ...project, sections: next });
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn--ghost"
                      title="捕获当前拍子"
                      onClick={() => {
                        const next = [...project.sections];
                        next[i] = { ...row, startBeat: currentBeat };
                        onChange({ ...project, sections: next });
                      }}
                    >
                      📍
                    </button>
                  </div>
                </td>
                <td>
                  <div style={{ display: "flex", gap: 4 }}>
                    <input
                      type="number"
                      step={0.01}
                      value={row.endBeat ?? ""}
                      placeholder="—"
                      onChange={(e) => {
                        const v = e.target.value;
                        const next = [...project.sections];
                        next[i] = { ...row, endBeat: v === "" ? undefined : Number(v) };
                        onChange({ ...project, sections: next });
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn--ghost"
                      title="捕获当前拍子"
                      onClick={() => {
                        const next = [...project.sections];
                        next[i] = { ...row, endBeat: currentBeat };
                        onChange({ ...project, sections: next });
                      }}
                    >
                      📍
                    </button>
                  </div>
                </td>
                <td>
                  <input
                    value={row.comment ?? ""}
                    onChange={(e) => {
                      const next = [...project.sections];
                      next[i] = { ...row, comment: e.target.value || undefined };
                      onChange({ ...project, sections: next });
                    }}
                  />
                </td>
                <td className="row-actions">
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => onChange({ ...project, sections: project.sections.filter((_, j) => j !== i) })}
                  >
                    删
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        className="btn"
        style={{ marginTop: 6 }}
        onClick={() =>
          onChange({
            ...project,
            sections: [
              ...project.sections,
              { id: `sec-${Date.now()}`, label: "新段落", startBeat: currentBeat, comment: "" },
            ],
          })
        }
      >
        在当前拍添加段落
      </button>

      <h2>旋律点</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>beat</th>
              <th>midi</th>
              <th className="row-actions" />
            </tr>
          </thead>
          <tbody>
            {project.melody.map((row, i) => (
              <tr key={`m-${i}`}>
                <td>
                  <input
                    type="number"
                    step={0.01}
                    value={row.beat}
                    onChange={(e) => {
                      const next = [...project.melody];
                      next[i] = { ...row, beat: Number(e.target.value) };
                      onChange({ ...project, melody: next });
                    }}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    max={127}
                    value={row.midi}
                    onChange={(e) => {
                      const next = [...project.melody];
                      next[i] = { ...row, midi: Number(e.target.value) };
                      onChange({ ...project, melody: next });
                    }}
                  />
                </td>
                <td className="row-actions">
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => onChange({ ...project, melody: project.melody.filter((_, j) => j !== i) })}
                  >
                    删
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        className="btn"
        style={{ marginTop: 6 }}
        onClick={() => onChange({ ...project, melody: [...project.melody, { beat: 0, midi: 60 }] })}
      >
        添加旋律点
      </button>

      <h2>样式 / 导出</h2>
      <div className="field">
        <label htmlFor="themeId">主题</label>
        <select
          id="themeId"
          value={project.style?.themeId ?? "minimal-dark"}
          onChange={(e) => setStyle({ themeId: e.target.value })}
        >
          <option value="minimal-dark">Minimal Dark (默认)</option>
          <option value="paper-light">Paper Light</option>
          <option value="midnight-blue">Midnight Blue</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="primaryColor">主色 (Primary)</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="color"
            value={project.style?.primaryColor ?? "#E8E8EF"}
            onChange={(e) => setStyle({ primaryColor: e.target.value })}
          />
          <input
            type="text"
            value={project.style?.primaryColor ?? ""}
            placeholder="#E8E8EF"
            onChange={(e) => setStyle({ primaryColor: e.target.value })}
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor="secondaryColor">强调色 (Accent)</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="color"
            value={project.style?.secondaryColor ?? "#7AE7C7"}
            onChange={(e) => setStyle({ secondaryColor: e.target.value })}
          />
          <input
            type="text"
            value={project.style?.secondaryColor ?? ""}
            placeholder="#7AE7C7"
            onChange={(e) => setStyle({ secondaryColor: e.target.value })}
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor="footer">页脚</label>
        <input
          id="footer"
          value={project.style?.footerText ?? ""}
          onChange={(e) => setStyle({ footerText: e.target.value || undefined })}
        />
      </div>
      <div className="field">
        <label htmlFor="fps">导出 fps</label>
        <select
          id="fps"
          value={String(project.export?.fps ?? 30)}
          onChange={(e) => setExport({ fps: Number(e.target.value) as 24 | 25 | 30 | 60 })}
        >
          <option value="24">24</option>
          <option value="25">25</option>
          <option value="30">30</option>
          <option value="60">60</option>
        </select>
      </div>

      <div className="field">
        <label htmlFor="outputName">输出文件名 (不含后缀)</label>
        <input
          id="outputName"
          placeholder="analysis-video"
          value={project.export?.outputName ?? ""}
          onChange={(e) => setExport({ outputName: e.target.value || undefined })}
        />
      </div>

      <div className="field">
        <label htmlFor="crf">质量 (CRF, 0-51)</label>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            id="crf"
            type="range"
            min={0}
            max={51}
            value={project.export?.crf ?? 23}
            onChange={(e) => setExport({ crf: Number(e.target.value) })}
          />
          <span style={{ minWidth: "1.5rem" }}>{project.export?.crf ?? 23}</span>
          <span className="hint" style={{ margin: 0 }}>（0=无损，51=极低质量）</span>
        </div>
      </div>

      <div className="field">
        <label htmlFor="audioBitrate">音频比特率 (kbps)</label>
        <select
          id="audioBitrate"
          value={String(project.export?.audioBitrate ?? 192)}
          onChange={(e) => setExport({ audioBitrate: Number(e.target.value) })}
        >
          <option value="128">128</option>
          <option value="192">192 (标准)</option>
          <option value="256">256 (高质)</option>
          <option value="320">320 (极高)</option>
        </select>
      </div>

      <div className="field">
        <label htmlFor="pixelFormat">像素格式</label>
        <select
          id="pixelFormat"
          value={project.export?.pixelFormat ?? "yuv420p"}
          onChange={(e) => setExport({ pixelFormat: e.target.value as any })}
        >
          <option value="yuv420p">yuv420p (兼容性最好)</option>
          <option value="yuv422p">yuv422p</option>
          <option value="yuv444p">yuv444p</option>
        </select>
      </div>
    </div>
  );
};
