import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchTaskStatus } from '../api/audio';
import type { TaskStatus } from '../types/editor';

export function useTaskPolling(taskId: string | null, intervalMs = 2000) {
  const [task, setTask] = useState<TaskStatus | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!taskId) {
      setTask(null);
      return;
    }

    const poll = async () => {
      try {
        const status = await fetchTaskStatus(taskId);
        setTask(status);
        if (status.status === 'completed' || status.status === 'failed') {
          stop();
        }
      } catch {
        stop();
      }
    };

    poll();
    timerRef.current = setInterval(poll, intervalMs);

    return stop;
  }, [taskId, intervalMs, stop]);

  return task;
}
