import { useState, useEffect } from "react";

/**
 * 缓存已解码的音频数据，避免在不同组件间重复加载和解码。
 * 注意：由于 AudioBuffer 可能很大，在大型项目中应考虑更精细的内存管理。
 */
const audioBufferCache = new Map<string, AudioBuffer>();

/**
 * 自定义 Hook：加载并解码音频文件。
 * @param audioPath 音频路径 (可以是相对路径、HTTP URL 或 Blob URL)
 * @returns audioBuffer 解码后的音频数据
 */
export function useAudioBuffer(audioPath: string | undefined) {
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!audioPath) {
      setAudioBuffer(null);
      return;
    }

    // 处理路径前缀
    const url = audioPath.startsWith("blob:") || audioPath.startsWith("http")
      ? audioPath
      : `/${audioPath}`;

    // 检查缓存
    if (audioBufferCache.has(url)) {
      setAudioBuffer(audioBufferCache.get(url)!);
      return;
    }

    setIsLoading(true);
    setError(null);

    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`Failed to fetch audio: ${res.statusText}`);
        return res.arrayBuffer();
      })
      .then(async buffer => {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        try {
          const decodedBuffer = await ctx.decodeAudioData(buffer);
          audioBufferCache.set(url, decodedBuffer);
          setAudioBuffer(decodedBuffer);
        } finally {
          await ctx.close();
        }
      })
      .catch(err => {
        console.error("Audio decoding error:", err);
        setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [audioPath]);

  return { audioBuffer, isLoading, error };
}
