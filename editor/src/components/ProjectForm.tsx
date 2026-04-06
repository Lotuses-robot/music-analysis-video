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
    <div className="project-form-sidebar">
      <details open>
        <summary>元信息</summary>
        <div className="section-content">
          <div className="field">
            <label htmlFor="title">标题</label>
            <input id="title" value={project.meta.title} onChange={(e) => setMeta({ title: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="artist">艺人</label>
            <input id="artist" value={project.meta.artist ?? ""} onChange={(e) => setMeta({ artist: e.target.value || undefined })} />
          </div>
          <div className="field">
            <label htmlFor="audioPath">音频路径</label>
            <input id="audioPath" value={project.meta.audioPath} onChange={(e) => setMeta({ audioPath: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="audioStart">片头裁剪 (秒)</label>
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
            <label htmlFor="bpmHint">BPM 提示</label>
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
        </div>
      </details>

      <details>
        <summary>拍号 / 调号</summary>
        <div className="section-content">
          <div className="field">
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
          <div className="field">
            <label htmlFor="keydef">默认调号</label>
            <input id="keydef" value={project.key.default} onChange={(e) => setKeyDefault(e.target.value)} />
          </div>

          <h3>拍号变更</h3>
          <div className="table-wrap">
            <table>
              <tbody>
                {(project.timeSignature.changes ?? []).map((ch, i) => (
                  <tr key={`ts-${i}`}>
                    <td>
                      <div style={{ display: "flex", gap: 2 }}>
                        <input
                          type="number"
                          step={0.01}
                          value={ch.beat}
                          style={{ width: 60 }}
                          onChange={(e) => {
                            const next = [...(project.timeSignature.changes ?? [])];
                            next[i] = { ...ch, beat: Number(e.target.value) };
                            onChange({ ...project, timeSignature: { ...project.timeSignature, changes: next } });
                          }}
                        />
                        <button className="btn btn--small" onClick={() => {
                          const next = [...(project.timeSignature.changes ?? [])];
                          next[i] = { ...ch, beat: currentBeat };
                          onChange({ ...project, timeSignature: { ...project.timeSignature, changes: next } });
                        }}>📍</button>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
                        <input type="number" value={ch.upper} style={{ width: 35 }} onChange={(e) => {
                          const next = [...(project.timeSignature.changes ?? [])];
                          next[i] = { ...ch, upper: Number(e.target.value) || 4 };
                          onChange({ ...project, timeSignature: { ...project.timeSignature, changes: next } });
                        }} />
                        <span>/</span>
                        <input type="number" value={ch.lower} style={{ width: 35 }} onChange={(e) => {
                          const next = [...(project.timeSignature.changes ?? [])];
                          next[i] = { ...ch, lower: Number(e.target.value) || 4 };
                          onChange({ ...project, timeSignature: { ...project.timeSignature, changes: next } });
                        }} />
                      </div>
                    </td>
                    <td>
                      <button className="btn btn--small" onClick={() => {
                        const next = (project.timeSignature.changes ?? []).filter((_, j) => j !== i);
                        onChange({ ...project, timeSignature: { ...project.timeSignature, changes: next } });
                      }}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn btn--full" style={{ marginTop: 8 }} onClick={() => {
            const next = [...(project.timeSignature.changes ?? []), { beat: currentBeat, upper: 4, lower: 4 }];
            onChange({ ...project, timeSignature: { ...project.timeSignature, changes: next } });
          }}>添加拍号变更</button>

          <h3>调号变更</h3>
          <div className="table-wrap">
            <table>
              <tbody>
                {(project.key.changes ?? []).map((ch, i) => (
                  <tr key={`key-${i}`}>
                    <td>
                      <div style={{ display: "flex", gap: 2 }}>
                        <input type="number" step={0.01} value={ch.beat} style={{ width: 60 }} onChange={(e) => {
                          const next = [...(project.key.changes ?? [])];
                          next[i] = { ...ch, beat: Number(e.target.value) };
                          onChange({ ...project, key: { ...project.key, changes: next } });
                        }} />
                        <button className="btn btn--small" onClick={() => {
                          const next = [...(project.key.changes ?? [])];
                          next[i] = { ...ch, beat: currentBeat };
                          onChange({ ...project, key: { ...project.key, changes: next } });
                        }}>📍</button>
                      </div>
                    </td>
                    <td>
                      <input value={ch.key} onChange={(e) => {
                        const next = [...(project.key.changes ?? [])];
                        next[i] = { ...ch, key: e.target.value };
                        onChange({ ...project, key: { ...project.key, changes: next } });
                      }} />
                    </td>
                    <td>
                      <button className="btn btn--small" onClick={() => {
                        const next = (project.key.changes ?? []).filter((_, j) => j !== i);
                        onChange({ ...project, key: { ...project.key, changes: next } });
                      }}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn btn--full" style={{ marginTop: 8 }} onClick={() => {
            const next = [...(project.key.changes ?? []), { beat: currentBeat, key: "C major" }];
            onChange({ ...project, key: { ...project.key, changes: next } });
          }}>添加调号变更</button>
        </div>
      </details>

      <details>
        <summary>同步锚点</summary>
        <div className="section-content">
          <div className="field">
            <label>外推策略</label>
            <select value={project.sync.extrapolation ?? "clamp"} onChange={(e) => setSync({ extrapolation: e.target.value as SyncExtrapolation })}>
              <option value="clamp">clamp (首尾钳制)</option>
              <option value="extend">extend (延伸斜率)</option>
            </select>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Beat</th>
                  <th>Time(s)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {project.sync.anchors.map((row, i) => (
                  <tr key={`a-${i}`}>
                    <td>
                      <div style={{ display: "flex", gap: 2 }}>
                        <input type="number" step={0.01} value={row.beat} style={{ width: 60 }} onChange={(e) => {
                          const next = [...project.sync.anchors];
                          next[i] = { ...row, beat: Number(e.target.value) };
                          onChange({ ...project, sync: { ...project.sync, anchors: next } });
                        }} />
                        <button className="btn btn--small" onClick={() => {
                          const next = [...project.sync.anchors];
                          next[i] = { ...row, beat: currentBeat };
                          onChange({ ...project, sync: { ...project.sync, anchors: next } });
                        }}>📍</button>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 2 }}>
                        <input type="number" step={0.001} value={row.timeSec} style={{ width: 70 }} onChange={(e) => {
                          const next = [...project.sync.anchors];
                          next[i] = { ...row, timeSec: Number(e.target.value) };
                          onChange({ ...project, sync: { ...project.sync, anchors: next } });
                        }} />
                        <button className="btn btn--small" onClick={() => {
                          const next = [...project.sync.anchors];
                          next[i] = { ...row, timeSec: currentTime };
                          onChange({ ...project, sync: { ...project.sync, anchors: next } });
                        }}>🕒</button>
                      </div>
                    </td>
                    <td>
                      <button className="btn btn--small" onClick={() => {
                        const next = project.sync.anchors.filter((_, j) => j !== i);
                        onChange({ ...project, sync: { ...project.sync, anchors: next.length ? next : [{ beat: 0, timeSec: 0 }] } });
                      }}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn btn--full" style={{ marginTop: 8 }} onClick={() =>
            onChange({ ...project, sync: { ...project.sync, anchors: [...project.sync.anchors, { beat: currentBeat, timeSec: currentTime }] } })
          }>添加同步锚点 (当前)</button>
        </div>
      </details>

      <details open>
        <summary>和弦与结构</summary>
        <div className="section-content">
          <h3>和弦列表</h3>
          <div className="table-wrap">
            <table>
              <tbody>
                {project.chords.map((row, i) => (
                  <tr key={`c-${i}`}>
                    <td>
                      <div style={{ display: "flex", gap: 2 }}>
                        <input type="number" step={0.01} value={row.beat} style={{ width: 60 }} onChange={(e) => {
                          const next = [...project.chords];
                          next[i] = { ...row, beat: Number(e.target.value) };
                          onChange({ ...project, chords: next });
                        }} />
                        <button className="btn btn--small" onClick={() => {
                          const next = [...project.chords];
                          next[i] = { ...row, beat: currentBeat };
                          onChange({ ...project, chords: next });
                        }}>📍</button>
                      </div>
                    </td>
                    <td>
                      <input value={row.symbol} onChange={(e) => {
                        const next = [...project.chords];
                        next[i] = { ...row, symbol: e.target.value };
                        onChange({ ...project, chords: next });
                      }} />
                    </td>
                    <td>
                      <button className="btn btn--small" onClick={() => onChange({ ...project, chords: project.chords.filter((_, j) => j !== i) })}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn btn--full" style={{ marginTop: 8 }} onClick={() => onChange({ ...project, chords: [...project.chords, { beat: currentBeat, symbol: "?" }] })}>
            在当前拍添加和弦
          </button>

          <h3>段落分块</h3>
          {project.sections.map((row, i) => (
            <div key={`s-${row.id}-${i}`} className="section-item-card">
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input placeholder="Label" value={row.label} style={{ flex: 2, fontWeight: "bold" }} onChange={(e) => {
                  const next = [...project.sections];
                  next[i] = { ...row, label: e.target.value };
                  onChange({ ...project, sections: next });
                }} />
                <button className="btn btn--small btn--danger" onClick={() => onChange({ ...project, sections: project.sections.filter((_, j) => j !== i) })}>删除</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                <div className="field-inline">
                  <label>Start Beat</label>
                  <div style={{ display: "flex", gap: 2 }}>
                    <input type="number" step={0.01} value={row.startBeat} onChange={(e) => {
                      const next = [...project.sections];
                      next[i] = { ...row, startBeat: Number(e.target.value) };
                      onChange({ ...project, sections: next });
                    }} />
                    <button className="btn btn--small" onClick={() => {
                      const next = [...project.sections];
                      next[i] = { ...row, startBeat: currentBeat };
                      onChange({ ...project, sections: next });
                    }}>📍</button>
                  </div>
                </div>
                <div className="field-inline">
                  <label>End Beat</label>
                  <div style={{ display: "flex", gap: 2 }}>
                    <input type="number" step={0.01} value={row.endBeat ?? ""} placeholder="—" onChange={(e) => {
                      const v = e.target.value;
                      const next = [...project.sections];
                      next[i] = { ...row, endBeat: v === "" ? undefined : Number(v) };
                      onChange({ ...project, sections: next });
                    }} />
                    <button className="btn btn--small" onClick={() => {
                      const next = [...project.sections];
                      next[i] = { ...row, endBeat: currentBeat };
                      onChange({ ...project, sections: next });
                    }}>📍</button>
                  </div>
                </div>
              </div>
              <textarea placeholder="分析评论..." value={row.comment ?? ""} style={{ width: "100%", fontSize: 12 }} onChange={(e) => {
                const next = [...project.sections];
                next[i] = { ...row, comment: e.target.value || undefined };
                onChange({ ...project, sections: next });
              }} />
            </div>
          ))}
          <button className="btn btn--full" onClick={() =>
            onChange({ ...project, sections: [...project.sections, { id: `sec-${Date.now()}`, label: "新段落", startBeat: currentBeat, comment: "" }] })
          }>在当前拍添加段落</button>
        </div>
      </details>

      <details>
        <summary>样式与导出</summary>
        <div className="section-content">
          <div className="field">
            <label>主题</label>
            <select value={project.style?.themeId ?? "minimal-dark"} onChange={(e) => setStyle({ themeId: e.target.value })}>
              <option value="minimal-dark">Minimal Dark</option>
              <option value="paper-light">Paper Light</option>
              <option value="midnight-blue">Midnight Blue</option>
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="field">
              <label>主色</label>
              <input type="color" value={project.style?.primaryColor ?? "#E8E8EF"} onChange={(e) => setStyle({ primaryColor: e.target.value })} />
            </div>
            <div className="field">
              <label>强调色</label>
              <input type="color" value={project.style?.secondaryColor ?? "#7AE7C7"} onChange={(e) => setStyle({ secondaryColor: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label>导出文件名</label>
            <input value={project.export?.outputName ?? ""} onChange={(e) => setExport({ outputName: e.target.value || undefined })} />
          </div>
          <div className="field">
            <label>CRF 质量 ({project.export?.crf ?? 23})</label>
            <input type="range" min={0} max={51} value={project.export?.crf ?? 23} onChange={(e) => setExport({ crf: Number(e.target.value) })} />
          </div>
        </div>
      </details>
    </div>
  );
};
