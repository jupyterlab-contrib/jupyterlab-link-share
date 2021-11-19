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

import { IRetroShell } from '@retrolab/application';

import { PageConfig, URLExt } from '@jupyterlab/coreutils';

import { IMainMenu } from '@jupyterlab/mainmenu';

import { ITranslator, nullTranslator } from '@jupyterlab/translation';

import { Menu, Widget } from '@lumino/widgets';

import { requestAPI } from './handler';

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
  optional: [ICommandPalette, IMainMenu, ITranslator, IRetroShell],
  activate: (
    app: JupyterFrontEnd,
    palette: ICommandPalette | null,
    menu: IMainMenu | null,
    translator: ITranslator | null,
    retroShell: IRetroShell | null
  ) => {
    const { commands } = app;
    const trans = (translator ?? nullTranslator).load('jupyterlab');

    commands.addCommand(CommandIDs.share, {
      label: trans.__('Share Jupyter Server Link'),
      execute: async () => {
        let results: { token: string }[];
        const isRunningUnderJupyterhub = PageConfig.getOption('hubUser') !== '';
        if (isRunningUnderJupyterhub) {
          // We are running on a JupyterHub, so let's just use the token set in PageConfig.
          // Any extra servers running on the server will still need to use this token anyway,
          // as all traffic (including any to jupyter-server-proxy) needs this token.
          results = [{ token: PageConfig.getToken() }];
        } else {
          results = await requestAPI<any>('servers');
        }

        const links = results.map(server => {
          if (retroShell !== null) {
            // On retrolab, take current URL and set ?token to it
            const url = new URL(location.href);
            url.searchParams.set('token', server.token);
            return url.toString();
          } else {
            // On JupyterLab, let PageConfig.getUrl do its magic.
            // Handles workspaces, single document mode, etc
            return URLExt.normalize(
              `${PageConfig.getUrl({
                workspace: PageConfig.defaultWorkspace
              })}?token=${server.token}`
            );
          }
        });

        const entries = document.createElement('div');
        links.map(link => {
          const p = document.createElement('p');
          const text: HTMLInputElement = document.createElement('input');
          text.readOnly = true;
          text.value = link;
          text.addEventListener('click', e => {
            (e.target as HTMLInputElement).select();
          });
          text.style.width = '100%';
          p.appendChild(text);
          entries.appendChild(p);
        });

        // Warn users of the security implications of using this link
        // FIXME: There *must* be a better way to create HTML
        const warning = document.createElement('div');

        const warningHeader = document.createElement('h3');
        warningHeader.innerText = trans.__('Security warning!');
        warning.appendChild(warningHeader);

        const messages = [
          'Anyone with this link has full access to your notebook server, including all your files!',
          'Please be careful who you share it with.'
        ];
        if (isRunningUnderJupyterhub) {
          messages.push(
            // You can restart the server to revoke the token in a JupyterHub
            'To revoke access, go to File -> Hub Control Panel, and restart your server'
          );
        } else {
          messages.push(
            // Elsewhere, you *must* shut down your server - no way to revoke it
            'Currently, there is no way to revoke access other than shutting down your server'
          );
        }
        messages.map(m => {
          warning.appendChild(document.createTextNode(trans.__(m)));
          warning.appendChild(document.createElement('br'));
        });

        entries.appendChild(warning);

        const result = await showDialog({
          title: trans.__('Share Jupyter Server Link'),
          body: new Widget({ node: entries }),
          buttons: [
            Dialog.cancelButton({ label: trans.__('Cancel') }),
            Dialog.okButton({
              label: trans.__('Copy Link'),
              caption: trans.__('Copy the link to the Jupyter Server')
            })
          ]
        });
        if (result.button.accept) {
          Clipboard.copyToSystem(links[0]);
        }
      }
    });

    if (palette) {
      palette.addItem({
        command: CommandIDs.share,
        category: trans.__('Server')
      });
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
