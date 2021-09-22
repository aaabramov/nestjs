import { RunnerOptions } from 'graphile-worker';

export type GraphileWorkerConfig = Omit<
  RunnerOptions,
  'taskList' | 'taskDirectory'
>;
