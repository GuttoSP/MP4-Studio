import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { renameSync, rmSync } from 'node:fs';
import type { RenderCommand } from './ffmpegCommands';
import { RenderRepository } from './renderRepository';

export function parseProgressChunk(chunk: string): { processedSeconds: number; ended: boolean } {
  const microseconds = /out_time_(?:us|ms)=(\d+)/.exec(chunk)?.[1];
  return {
    processedSeconds: microseconds ? Number(microseconds) / 1_000_000 : 0,
    ended: /(?:^|\n)progress=end(?:\n|$)/.test(chunk)
  };
}

export class RenderQueue {
  private readonly active = new Map<string, ChildProcessWithoutNullStreams>();

  constructor(private readonly repository: RenderRepository) {}

  enqueue(jobId: string, command: RenderCommand, finalPath: string, outputName: string) {
    void this.run(jobId, command, finalPath, outputName);
  }

  cancel(jobId: string): boolean {
    const job = this.repository.get(jobId);
    if (!job || !['queued', 'running'].includes(job.status)) return false;
    this.repository.cancel(jobId);
    this.active.get(jobId)?.kill();
    return true;
  }

  private async run(jobId: string, command: RenderCommand, finalPath: string, outputName: string) {
    this.repository.markRunning(jobId);
    await new Promise<void>((resolveRun) => {
      const child = spawn(command.executable, command.args, { shell: false, windowsHide: true });
      this.active.set(jobId, child);
      let buffer = '';
      let errorText = '';
      child.stderr.on('data', (data) => {
        const text = String(data);
        errorText = `${errorText}${text}`.slice(-8_000);
        buffer += text;
        const blocks = buffer.split(/progress=(?:continue|end)\r?\n/);
        buffer = blocks.pop() ?? '';
        for (const block of blocks) {
          const progress = parseProgressChunk(`${block}progress=continue\n`);
          if (progress.processedSeconds) this.repository.updateProgress(jobId, progress.processedSeconds, command.duration);
        }
      });
      child.once('error', (error) => {
        if (this.repository.get(jobId)?.status !== 'cancelled') this.repository.fail(jobId, error.message);
        rmSync(command.outputPath, { force: true });
        this.active.delete(jobId);
        resolveRun();
      });
      child.once('exit', (code) => {
        const status = this.repository.get(jobId)?.status;
        if (code === 0 && status !== 'cancelled') {
          renameSync(command.outputPath, finalPath);
          this.repository.complete(jobId, outputName);
        } else {
          rmSync(command.outputPath, { force: true });
          if (status !== 'cancelled') this.repository.fail(jobId, errorText.trim() || `FFmpeg encerrou com código ${code}.`);
        }
        this.active.delete(jobId);
        resolveRun();
      });
    });
  }
}
