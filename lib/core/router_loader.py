from importlib import import_module
from pathlib import Path


def include_all_routes(app):
    routes_dir = Path(__file__).resolve().parents[1] / "routes"
    for file in routes_dir.glob("*.py"):
        if file.name.startswith("__"):
            continue
        module_name = f"lib.routes.{file.stem}"
        module = import_module(module_name)
        router = getattr(module, "router", None)
        if router is not None:
            app.include_router(router)
