import type { FC } from "react";
import type { MusicAnalysisVideoProject, SyncExtrapolation } from "../../../src/types/project";

type Props = {
  project: MusicAnalysisVideoProject;
  onChange: (next: MusicAnalysisVideoProject) => void;
};

export const ProjectForm: FC<Props> = ({ project, onChange }) => {
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
          <label>拍号</label>
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
          <label htmlFor="keydef">调号</label>
          <input id="keydef" value={project.key.default} onChange={(e) => setKeyDefault(e.target.value)} />
        </div>
      </div>

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
                </td>
                <td>
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
              anchors: [...project.sync.anchors, { beat: 0, timeSec: 0 }],
            },
          })
        }
      >
        添加锚点
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
        onClick={() => onChange({ ...project, chords: [...project.chords, { beat: 0, symbol: "?" }] })}
      >
        添加和弦
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
                </td>
                <td>
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
              { id: `sec-${Date.now()}`, label: "新段落", startBeat: 0, comment: "" },
            ],
          })
        }
      >
        添加段落
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
    </div>
  );
};
