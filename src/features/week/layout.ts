import type { ScheduleBlock } from '../../domain/types';

export interface LaidOutBlock {
  block: ScheduleBlock;
  lane: number;
  lanes: number;
}

/** Verteilt überlappende Blöcke nebeneinander (Spalten pro Überlappungs-Gruppe). */
export function layoutBlocks(blocks: ScheduleBlock[]): LaidOutBlock[] {
  const sorted = [...blocks].sort((a, b) => a.start - b.start || b.end - a.end);
  const result: LaidOutBlock[] = [];
  let cluster: LaidOutBlock[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -1;

  const flush = () => {
    const lanes = laneEnds.length || 1;
    for (const item of cluster) item.lanes = lanes;
    result.push(...cluster);
    cluster = [];
    laneEnds = [];
  };

  for (const block of sorted) {
    if (block.start >= clusterEnd && cluster.length) flush();
    let lane = laneEnds.findIndex((end) => end <= block.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(block.end);
    } else laneEnds[lane] = block.end;
    cluster.push({ block, lane, lanes: 1 });
    clusterEnd = Math.max(clusterEnd, block.end);
  }
  flush();
  return result;
}
