
import json
from pathlib import Path

from .handlers import setup_handlers
from ._version import __version__

HERE = Path(__file__).parent.resolve()

with (HERE / "labextension" / "package.json").open() as fid:
    data = json.load(fid)


def _jupyter_labextension_paths():
    return [{
        "src": "labextension",
        "dest": data["name"]
    }]


def _jupyter_server_extension_points():
    return [{
        "module": "jupyterlab_link_share"
    }]


def _load_jupyter_server_extension(server_app):
    setup_handlers(server_app.web_app)
    server_app.log.info("Registered JupyterLab Link Share extension at URL path /jupyterlab_link_share")

load_jupyter_server_extension = _load_jupyter_server_extension
