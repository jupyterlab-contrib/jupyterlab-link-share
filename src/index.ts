import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
} from '@jupyterlab/application';

import {
  Clipboard,
  Dialog,
  ICommandPalette,
  showDialog,
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
  activate: async (
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
        const isRunningUnderJupyterHub = PageConfig.getOption('hubUser') !== '';
        if (isRunningUnderJupyterHub) {
          // We are running on a JupyterHub, so let's just use the token set in PageConfig.
          // Any extra servers running on the server will still need to use this token anyway,
          // as all traffic (including any to jupyter-server-proxy) needs this token.
          results = [{ token: PageConfig.getToken() }];
        } else {
          results = await requestAPI<any>('servers');
        }

        const links = results.map((server) => {
          let url: URL;
          if (retroShell) {
            // On retrolab, take current URL and set ?token to it
            url = new URL(location.href);
          } else {
            // On JupyterLab, let PageConfig.getUrl do its magic.
            // Handles workspaces, single document mode, etc
            url = new URL(
              URLExt.normalize(
                `${PageConfig.getUrl({
                  workspace: PageConfig.defaultWorkspace,
                })}`
              )
            );
          }
          let tokenURL = new URL(url.toString());
          if (server.token) {
            // add token to URL
            tokenURL.searchParams.set('token', server.token);
          }
          return {
            noToken: url.toString(),
            withToken: tokenURL.toString(),
          };
        });

        const dialogBody = document.createElement('div');
        const entries = document.createElement('div');
        dialogBody.appendChild(entries);
        links.map((link) => {
          const p = document.createElement('p');
          const text: HTMLInputElement = document.createElement('input');
          text.dataset.noToken = link.noToken;
          text.dataset.withToken = link.withToken;
          text.readOnly = true;
          text.value = link.noToken;
          text.addEventListener('click', (e) => {
            (e.target as HTMLInputElement).select();
          });
          text.style.width = '100%';
          p.appendChild(text);
          entries.appendChild(p);
        });

        // Warn users of the security implications of using this link
        // FIXME: There *must* be a better way to create HTML
        const tokenWarning = document.createElement('div');

        const warningHeader = document.createElement('h3');
        warningHeader.innerText = trans.__('Security warning!');
        tokenWarning.appendChild(warningHeader);

        const tokenMessages: Array<string> = [];

        tokenMessages.push(
          'Anyone with this link has full access to your notebook server, including all your files!',
          'Please be careful who you share it with.'
        );
        if (isRunningUnderJupyterHub) {
          tokenMessages.push(
            // You can restart the server to revoke the token in a JupyterHub
            'They will be able to access this server AS YOU.'
          );
          tokenMessages.push(
            // You can restart the server to revoke the token in a JupyterHub
            'To revoke access, go to File -> Hub Control Panel, and restart your server'
          );
        } else {
          tokenMessages.push(
            // Elsewhere, you *must* shut down your server - no way to revoke it
            'Currently, there is no way to revoke access other than shutting down your server'
          );
        }

        const noTokenMessage = document.createElement('div');
        const noTokenMessages: Array<string> = [];
        if (isRunningUnderJupyterHub) {
          noTokenMessages.push(
            'Only users with `access:servers` permissions for this server will be able to use this link.'
          );
        } else {
          noTokenMessages.push(
            'Only authenticated users will be able to use this link.'
          );
        }

        tokenMessages.map((m) => {
          tokenWarning.appendChild(document.createTextNode(trans.__(m)));
          tokenWarning.appendChild(document.createElement('br'));
        });
        noTokenMessages.map((m) => {
          noTokenMessage.appendChild(document.createTextNode(trans.__(m)));
          noTokenMessage.appendChild(document.createElement('br'));
        });
        const messages = {
          noToken: noTokenMessage,
          withToken: tokenWarning,
        };

        const message = document.createElement('div');
        message.appendChild(messages.noToken);

        // whether there's any token to be used in URLs
        // if none, no point in adding a checkbox
        const hasToken =
          results.filter(
            (server) => server.token !== undefined && server.token !== ''
          ).length > 0;

        let includeTokenCheckbox: HTMLInputElement | undefined = undefined;
        if (hasToken) {
          // add checkbox to include token _if_ there's a token to include
          const includeTokenCheckbox = document.createElement('input');
          includeTokenCheckbox.type = 'checkbox';
          const tokenLabel = document.createElement('label');
          tokenLabel.appendChild(includeTokenCheckbox)
          tokenLabel.appendChild(document.createTextNode(trans.__('Include token in URL')));
          dialogBody.appendChild(tokenLabel);

          // when checkbox changes, toggle URL and message
          includeTokenCheckbox.addEventListener('change', (e) => {
            const isChecked: boolean = (e.target as HTMLInputElement).checked;
            const key = isChecked ? 'withToken' : 'noToken';

            // add or remove the token to the URL inputs
            const inputElements = entries.getElementsByTagName('input');
            [...inputElements].map((input) => {
              input.value = input.dataset[key] as string;
            });

            // swap out the warning message
            message.removeChild(message.children[0]);
            message.appendChild(messages[key]);
          });
        }

        dialogBody.appendChild(message);

        const result = await showDialog({
          title: trans.__('Share Jupyter Server Link'),
          body: new Widget({ node: dialogBody }),
          buttons: [
            Dialog.cancelButton({ label: trans.__('Cancel') }),
            Dialog.okButton({
              label: trans.__('Copy Link'),
              caption: trans.__('Copy the link to the Jupyter Server'),
            }),
          ],
        });
        if (result.button.accept) {
          const key =
            includeTokenCheckbox && includeTokenCheckbox.checked
              ? 'withToken'
              : 'noToken';
          Clipboard.copyToSystem(links[0][key]);
        }
      },
    });

    if (palette) {
      palette.addItem({
        command: CommandIDs.share,
        category: trans.__('Server'),
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
  },
};

const plugins: JupyterFrontEndPlugin<any>[] = [plugin];
export default plugins;
