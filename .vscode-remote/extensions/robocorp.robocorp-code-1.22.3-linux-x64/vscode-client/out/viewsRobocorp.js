"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshCloudTreeView = exports.CloudTreeDataProvider = void 0;
const vscode = require("vscode");
const roboCommands = require("./robocorpCommands");
const viewsCommon_1 = require("./viewsCommon");
const robocorpCommands_1 = require("./robocorpCommands");
const robocorpViews_1 = require("./robocorpViews");
const ask_1 = require("./ask");
const channel_1 = require("./channel");
class CloudTreeDataProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.refreshOnce = false;
    }
    fireRootChange() {
        this._onDidChangeTreeData.fire(null);
    }
    async _fillRoots(ret) {
        const accountInfoResult = await vscode.commands.executeCommand(roboCommands.ROBOCORP_GET_LINKED_ACCOUNT_INFO_INTERNAL);
        const profileListResultPromise = vscode.commands.executeCommand(roboCommands.ROBOCORP_PROFILE_LIST_INTERNAL);
        if (!accountInfoResult.success) {
            ret.push({
                "label": "Link to Control Room",
                "iconPath": "link",
                "viewItemContextValue": "cloudLoginItem",
                "command": {
                    "title": "Link to Control Room",
                    "command": roboCommands.ROBOCORP_CLOUD_LOGIN,
                },
            });
        }
        else {
            const accountInfo = accountInfoResult.result;
            ret.push({
                "label": "Linked: " + accountInfo.fullname + " (" + accountInfo.email + ")",
                "iconPath": "link",
                "viewItemContextValue": "cloudLogoutItem",
            });
            let vaultInfoResult = await vscode.commands.executeCommand(roboCommands.ROBOCORP_GET_CONNECTED_VAULT_WORKSPACE_INTERNAL);
            if (!vaultInfoResult || !vaultInfoResult.success || !vaultInfoResult.result) {
                ret.push({
                    "label": "Workspace (vault, storage): disconnected.",
                    "iconPath": "unlock",
                    "viewItemContextValue": "workspaceDisconnected",
                    "tooltip": `Connecting to a workspace enables accessing vault and storage settings in the selected workspace.`,
                });
            }
            else {
                const result = vaultInfoResult.result;
                const desc = (0, ask_1.getWorkspaceDescription)(result);
                ret.push({
                    "label": "Workspace: " + desc,
                    "iconPath": "lock",
                    "viewItemContextValue": "workspaceConnected",
                    "tooltip": `Enables access to vault and storage settings in: "${(0, ask_1.getWorkspaceDescription)(result)}"`,
                });
            }
        }
        const profileListResult = await profileListResultPromise;
        if (profileListResult?.success) {
            ret.push({
                "label": `Profile: ${profileListResult.result["current"]}`,
                "iconPath": "person",
                "viewItemContextValue": "profileItem",
            });
        }
        else {
            ret.push({
                "label": `Profile: ${profileListResult.message}`,
                "iconPath": "person",
                "viewItemContextValue": "profileItem",
            });
        }
    }
    async getChildren(element) {
        if (!element) {
            let ret = [];
            try {
                await this._fillRoots(ret);
                ret.push({
                    "label": "Documentation",
                    "iconPath": "book",
                    "command": {
                        "title": "Open https://robocorp.com/docs",
                        "command": "vscode.open",
                        "arguments": [vscode.Uri.parse("https://robocorp.com/docs")],
                    },
                });
            }
            catch (error) {
                (0, channel_1.logError)("Error getting children", error, "VIEWS_CLOUD_COMPUTE_ROOTS");
                ret.push({
                    "label": "Error initializing. Click to see Output > Robocorp Code.",
                    "iconPath": "error",
                    "command": {
                        "title": "See output",
                        "command": roboCommands.ROBOCORP_SHOW_OUTPUT,
                    },
                });
            }
            ret.push({
                "label": "Submit issue to Robocorp",
                "iconPath": "report",
                "command": {
                    "title": "Submit issue to Robocorp",
                    "command": robocorpCommands_1.ROBOCORP_SUBMIT_ISSUE,
                },
            });
            return ret;
        }
        if (element.children) {
            return element.children;
        }
        return [];
    }
    getTreeItem(element) {
        const treeItem = new vscode.TreeItem(element.label, element.children ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
        treeItem.command = element.command;
        treeItem.iconPath = new vscode.ThemeIcon(element.iconPath);
        if (element.viewItemContextValue) {
            treeItem.contextValue = element.viewItemContextValue;
        }
        if (element.tooltip) {
            treeItem.tooltip = element.tooltip;
        }
        return treeItem;
    }
}
exports.CloudTreeDataProvider = CloudTreeDataProvider;
function refreshCloudTreeView() {
    let dataProvider = (viewsCommon_1.treeViewIdToTreeDataProvider.get(robocorpViews_1.TREE_VIEW_ROBOCORP_CLOUD_TREE));
    if (dataProvider) {
        dataProvider.refreshOnce = true;
        dataProvider.fireRootChange();
    }
}
exports.refreshCloudTreeView = refreshCloudTreeView;
//# sourceMappingURL=viewsRobocorp.js.map