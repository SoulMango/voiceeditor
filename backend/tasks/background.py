import asyncio
import uuid
from dataclasses import dataclass, field
from enum import Enum
from concurrent.futures import ThreadPoolExecutor


class TaskStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class Task:
    id: str
    status: TaskStatus = TaskStatus.PENDING
    progress: float = 0.0
    result: dict = field(default_factory=dict)
    error: str | None = None


class TaskManager:
    def __init__(self):
        self._tasks: dict[str, Task] = {}
        self._executor = ThreadPoolExecutor(max_workers=3)

    def create_task(self) -> Task:
        task = Task(id=str(uuid.uuid4()))
        self._tasks[task.id] = task
        return task

    def get_task(self, task_id: str) -> Task | None:
        return self._tasks.get(task_id)

    def run_in_background(self, task: Task, coro):
        asyncio.create_task(self._run(task, coro))

    async def _run(self, task: Task, coro):
        task.status = TaskStatus.RUNNING
        try:
            task.result = await coro
            task.status = TaskStatus.COMPLETED
            task.progress = 1.0
        except Exception as e:
            task.status = TaskStatus.FAILED
            task.error = str(e)

    async def run_in_thread(self, func, *args):
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(self._executor, func, *args)


task_manager = TaskManager()
