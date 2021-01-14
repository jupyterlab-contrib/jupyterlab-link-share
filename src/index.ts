import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import {
  Clipboard,
  Dialog,
  ICommandPalette,
  showDialog
} from '@jupyterlab/apputils';

import { PageConfig, URLExt } from '@jupyterlab/coreutils';

import { IMainMenu } from '@jupyterlab/mainmenu';

import { ITranslator, nullTranslator } from '@jupyterlab/translation';

import { Menu } from '@lumino/widgets';

/**
 * The command IDs used by the plugin.
 */
namespace CommandIDs {
  export const share = 'link-share:share';
}

/**
 * Plugin to share the URL of the running Jupyter Server
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab-link-share:plugin',
  autoStart: true,
  optional: [ICommandPalette, IMainMenu, ITranslator],
  activate: (
    app: JupyterFrontEnd,
    palette: ICommandPalette | null,
    menu: IMainMenu | null,
    translator: ITranslator | null,
  ) => {
    const { commands } = app;
    const trans = (translator ?? nullTranslator).load('jupyterlab');

    commands.addCommand(CommandIDs.share, {
      label: trans.__('Share Jupyter Server Link'),
      execute: async () => {
        const link = URLExt.normalize(
          `${PageConfig.getUrl({
            workspace: PageConfig.defaultWorkspace
          })}?token=${PageConfig.getToken()}`
        );
        const result = await showDialog({
          title: trans.__('Share Jupyter Server Link'),
          body: link,
          buttons: [
            Dialog.cancelButton({ label: trans.__('Cancel') }),
            Dialog.okButton({
              label: trans.__('Copy'),
              caption: trans.__('Copy the link to the Jupyter Server')
            })
          ]
        });
        if (result.button.accept) {
          Clipboard.copyToSystem(link);
        }
      }
    });

    if (palette) {
      palette.addItem({ command: CommandIDs.share, category: trans.__('Server') });
    }

    if (menu) {
      // Create a menu
      const shareMenu: Menu = new Menu({ commands });
      shareMenu.title.label = trans.__('Share');
      menu.addMenu(shareMenu, { rank: 10000 });

      // Add the command to the menu
      shareMenu.addItem({ command: CommandIDs.share });
    }
  }
};

const plugins: JupyterFrontEndPlugin<any>[] = [plugin];
export default plugins;
