import json

from jupyter_server.base.handlers import APIHandler
from jupyter_server.serverapp import list_running_servers as list_jupyter_servers
from jupyter_server.utils import url_path_join
from notebook.notebookapp import list_running_servers as list_notebook_servers
import tornado

class RouteHandler(APIHandler):
    @tornado.web.authenticated
    def get(self):
        servers = list(list_notebook_servers()) + list(list_jupyter_servers())
        servers.sort(key=lambda x: x["port"])
        self.finish(json.dumps(servers))


def setup_handlers(web_app):
    host_pattern = ".*$"

    base_url = web_app.settings["base_url"]
    route_pattern = url_path_join(base_url, "jupyterlab_link_share", "servers")
    handlers = [(route_pattern, RouteHandler)]
    web_app.add_handlers(host_pattern, handlers)
