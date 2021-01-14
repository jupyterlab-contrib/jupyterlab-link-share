import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

/**
 * Initialization data for the jupyterlab-link-share extension.
 */
const extension: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab-link-share:plugin',
  autoStart: true,
  activate: (app: JupyterFrontEnd) => {
    console.log('JupyterLab extension jupyterlab-link-share is activated!');
  }
};

export default extension;
