"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.askForWs = exports.selectWorkspace = exports.getWorkspaceDescription = exports.showSelectOneStrQuickPick = exports.showSelectOneQuickPick = exports.sortCaptions = void 0;
const roboCommands = require("./robocorpCommands");
const vscode_1 = require("vscode");
function sortCaptions(captions) {
    captions.sort(function (a, b) {
        if (a.sortKey < b.sortKey) {
            return -1;
        }
        if (a.sortKey > b.sortKey) {
            return 1;
        }
        if (a.label < b.label) {
            return -1;
        }
        if (a.label > b.label) {
            return 1;
        }
        return 0;
    });
}
exports.sortCaptions = sortCaptions;
async function showSelectOneQuickPick(items, message, title) {
    let selectedItem = await vscode_1.window.showQuickPick(items, {
        "canPickMany": false,
        "placeHolder": message,
        "ignoreFocusOut": true,
        "title": title,
    });
    return selectedItem;
}
exports.showSelectOneQuickPick = showSelectOneQuickPick;
async function showSelectOneStrQuickPick(items, message, title) {
    let selectedItem = await vscode_1.window.showQuickPick(items, {
        "canPickMany": false,
        "placeHolder": message,
        "ignoreFocusOut": true,
        "title": title,
    });
    return selectedItem;
}
exports.showSelectOneStrQuickPick = showSelectOneStrQuickPick;
function getWorkspaceDescription(wsInfo) {
    return wsInfo.organizationName + ": " + wsInfo.workspaceName;
}
exports.getWorkspaceDescription = getWorkspaceDescription;
async function selectWorkspace(title, refresh) {
    SELECT_OR_REFRESH: do {
        // We ask for the information on the existing workspaces information.
        // Note that this may be cached from the last time it was asked,
        // so, we have an option to refresh it (and ask again).
        let actionResult = await vscode_1.commands.executeCommand(roboCommands.ROBOCORP_CLOUD_LIST_WORKSPACES_INTERNAL, { "refresh": refresh });
        if (!actionResult.success) {
            vscode_1.window.showErrorMessage("Error listing Control Room workspaces: " + actionResult.message);
            return undefined;
        }
        let workspaceInfo = actionResult.result;
        if (!workspaceInfo || workspaceInfo.length == 0) {
            vscode_1.window.showErrorMessage("A Control Room Workspace must be created to submit a Robot to the Control Room.");
            return undefined;
        }
        // Now, if there are only a few items or a single workspace,
        // just show it all, otherwise do a pre-selectedItem with the workspace.
        let workspaceIdFilter = undefined;
        if (workspaceInfo.length > 1) {
            // Ok, there are many workspaces, let's provide a pre-filter for it.
            let captions = new Array();
            for (let i = 0; i < workspaceInfo.length; i++) {
                const wsInfo = workspaceInfo[i];
                let caption = {
                    "label": "$(folder) " + getWorkspaceDescription(wsInfo),
                    "action": { "filterWorkspaceId": wsInfo.workspaceId, "wsInfo": wsInfo },
                };
                captions.push(caption);
            }
            sortCaptions(captions);
            let caption = {
                "label": "$(refresh) * Refresh list",
                "description": "Expected Workspace is not appearing.",
                "sortKey": "09999",
                "action": { "refresh": true },
            };
            captions.push(caption);
            let selectedItem = await showSelectOneQuickPick(captions, title);
            if (!selectedItem) {
                return undefined;
            }
            if (selectedItem.action.refresh) {
                refresh = true;
                continue SELECT_OR_REFRESH;
            }
            else {
                workspaceIdFilter = selectedItem.action.filterWorkspaceId;
                return {
                    "workspaceInfo": workspaceInfo,
                    "selectedWorkspaceInfo": selectedItem.action.wsInfo,
                };
            }
        }
        else {
            // Only 1
            return {
                "workspaceInfo": workspaceInfo,
                selectedWorkspaceInfo: workspaceInfo[0],
            };
        }
    } while (true);
}
exports.selectWorkspace = selectWorkspace;
const askForWs = async () => {
    let wsFolders = vscode_1.workspace.workspaceFolders;
    if (!wsFolders) {
        vscode_1.window.showErrorMessage("Unable to do operation (no workspace folder is currently opened).");
        return undefined;
    }
    let ws;
    if (wsFolders.length == 1) {
        ws = wsFolders[0];
    }
    else {
        ws = await vscode_1.window.showWorkspaceFolderPick({
            "placeHolder": "Please select the workspace folder for the operation.",
            "ignoreFocusOut": true,
        });
    }
    if (!ws) {
        // Operation cancelled.
        return undefined;
    }
    return ws;
};
exports.askForWs = askForWs;
//# sourceMappingURL=ask.js.map