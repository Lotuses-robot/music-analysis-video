import type { FC } from "react";
import type { MusicAnalysisVideoProject, SyncExtrapolation, ProjectMeasure } from "../../../src/types/project";

type Props = {
  project: MusicAnalysisVideoProject;
  onChange: (next: MusicAnalysisVideoProject) => void;
  onImportAudio?: () => void;
  currentBeat: number;
  currentTime: number;
};

/**
 * 项目表单组件。
 * 用于编辑项目的元数据、同步信息、调性、样式及导出设置。
 * @param props 组件属性
 * @param props.project 当前项目数据
 * @param props.onChange 项目更新回调
 * @param props.onImportAudio 导入音频回调
 * @param props.currentBeat 当前播放拍数
 * @param props.currentTime 当前播放时间（秒）
 */
export const ProjectForm: FC<Props> = ({ project, onChange, onImportAudio, currentBeat, currentTime }) => {
  const setMeta = (patch: Partial<MusicAnalysisVideoProject["meta"]>) => {
    onChange({ ...project, meta: { ...project.meta, ...patch } });
  };

  const setSync = (patch: Partial<MusicAnalysisVideoProject["sync"]>) => {
    onChange({ ...project, sync: { ...project.sync, ...patch } });
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

  const addMeasure = () => {
    const measures = project.measures || [];
    const lastMeasure = measures[measures.length - 1];
    const newMeasure: ProjectMeasure = {
      index: measures.length + 1,
      timeSignature: lastMeasure ? { ...lastMeasure.timeSignature } : { upper: 4, lower: 4 },
      events: [],
    };
    onChange({ ...project, measures: [...measures, newMeasure] });
  };

  const updateMeasure = (index: number, patch: Partial<ProjectMeasure>) => {
    const measures = project.measures || [];
    const next = [...measures];
    next[index] = { ...next[index], ...patch };
    onChange({ ...project, measures: next });
  };

  const removeMeasure = (index: number) => {
    const measures = project.measures || [];
    const next = measures.filter((_, i) => i !== index).map((m, i) => ({ ...m, index: i + 1 }));
    onChange({ ...project, measures: next });
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
            <div style={{ display: "flex", gap: 8 }}>
              <input id="audioPath" value={project.meta.audioPath} onChange={(e) => setMeta({ audioPath: e.target.value })} style={{ flex: 1 }} />
              <button className="btn btn--small" onClick={onImportAudio} title="导入本地音频文件">导入</button>
            </div>
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
          <div className="field">
            <label>默认调式</label>
            <div style={{ display: "flex", gap: 10 }}>
              <select 
                value={project.key.default.replace(/m$/, "")}
                onChange={(e) => {
                  const isMinor = project.key.default.endsWith("m");
                  setKeyDefault(e.target.value + (isMinor ? "m" : ""));
                }}
              >
                {["C", "G", "D", "A", "E", "B", "F#", "C#", "G#", "D#", "A#", "F", "Gb", "Db", "Ab", "Eb", "Bb"].map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <select 
                value={project.key.default.endsWith("m") ? "m" : ""}
                onChange={(e) => {
                  const root = project.key.default.replace(/m$/, "");
                  setKeyDefault(root + e.target.value);
                }}
              >
                <option value="">Major (大调)</option>
                <option value="m">Minor (小调)</option>
              </select>
            </div>
          </div>
        </div>
      </details>

      <details>
        <summary>调号与同步</summary>
        <div className="section-content">
          <div className="field">
            <label htmlFor="keydef">初始调号</label>
            <input id="keydef" value={project.key.default} onChange={(e) => setKeyDefault(e.target.value)} />
          </div>
          <div className="field">
            <label>外推策略</label>
            <select value={project.sync.extrapolation ?? "clamp"} onChange={(e) => setSync({ extrapolation: e.target.value as SyncExtrapolation })}>
              <option value="clamp">clamp (首尾钳制)</option>
              <option value="extend">extend (延伸斜率)</option>
            </select>
          </div>
          <h3>同步锚点</h3>
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
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 2 }}>
                        <input type="number" step={0.01} value={row.timeSec} style={{ width: 60 }} onChange={(e) => {
                          const next = [...project.sync.anchors];
                          next[i] = { ...row, timeSec: Number(e.target.value) };
                          onChange({ ...project, sync: { ...project.sync, anchors: next } });
                        }} />
                      </div>
                    </td>
                    <td>
                      <button className="btn btn--small" onClick={() => {
                        const next = project.sync.anchors.filter((_, j) => j !== i);
                        onChange({ ...project, sync: { ...project.sync, anchors: next } });
                      }}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn btn--full" style={{ marginTop: 8 }} onClick={() => {
            const next = [...project.sync.anchors, { beat: currentBeat, timeSec: currentTime }];
            onChange({ ...project, sync: { ...project.sync, anchors: next.sort((a,b) => a.beat - b.beat) } });
          }}>添加锚点</button>
        </div>
      </details>

      <details>
        <summary>小节管理 ({(project.measures || []).length})</summary>
        <div className="section-content">
          <div className="table-wrap">
            <table style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>拍号</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(project.measures || []).map((m, i) => (
                  <tr key={`m-${i}`}>
                    <td>{m.index}</td>
                    <td>
                      <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
                        <input type="number" value={m.timeSignature.upper} style={{ width: 30 }} onChange={(e) => {
                          updateMeasure(i, { timeSignature: { ...m.timeSignature, upper: Number(e.target.value) || 4 } });
                        }} />
                        <span>/</span>
                        <input type="number" value={m.timeSignature.lower} style={{ width: 30 }} onChange={(e) => {
                          updateMeasure(i, { timeSignature: { ...m.timeSignature, lower: Number(e.target.value) || 4 } });
                        }} />
                      </div>
                    </td>
                    <td>
                      <button className="btn btn--small" onClick={() => removeMeasure(i)}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn btn--full" style={{ marginTop: 8 }} onClick={addMeasure}>添加小节</button>
        </div>
      </details>

      <details>
        <summary>样式与导出</summary>
        <div className="section-content">
          <div className="field">
            <label htmlFor="themeId">主题 ID</label>
            <input id="themeId" value={project.style?.themeId ?? ""} onChange={(e) => setStyle({ themeId: e.target.value || undefined })} />
          </div>
          <div className="field">
            <label htmlFor="pColor">主色调</label>
            <input id="pColor" type="color" value={project.style?.primaryColor ?? "#000000"} onChange={(e) => setStyle({ primaryColor: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="fps">帧率 (FPS)</label>
            <select value={project.export?.fps ?? 30} onChange={(e) => setExport({ fps: Number(e.target.value) as 24 | 25 | 30 | 60 })}>
              <option value={24}>24</option>
              <option value={25}>25</option>
              <option value={30}>30</option>
              <option value={60}>60</option>
            </select>
          </div>
        </div>
      </details>
    </div>
  );
};
