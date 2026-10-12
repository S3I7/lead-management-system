import time
from collections import defaultdict, deque
from fastapi import HTTPException, Request
from app.core.config import settings

# shortcut: in-memory, per process; with several workers/instances move this to Redis or the reverse proxy
_hits: dict[str, deque] = defaultdict(deque)


def rate_limit(request: Request) -> None:
    """FastAPI dependency: at most RATE_LIMIT_PER_MINUTE calls per client IP per route per minute."""
    limit = settings.RATE_LIMIT_PER_MINUTE
    if limit <= 0:
        return
    key = f"{request.client.host if request.client else '?'}:{request.scope.get('route').path if request.scope.get('route') else request.url.path}"
    now = time.monotonic()
    q = _hits[key]
    while q and now - q[0] > 60:
        q.popleft()
    if len(q) >= limit:
        raise HTTPException(status_code=429, detail="Too many requests. Please wait a minute and try again.")
    q.append(now)
