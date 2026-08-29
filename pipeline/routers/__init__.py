"""
routers/
--------
api.py's routes, split one file per resource - same pattern as the Node
side's server/routes/*.js. Each module exports a plain `router:
APIRouter`; api.py imports every one and mounts it twice (bare, and under
/pyapi - see api.py's own docstring for why).
"""
