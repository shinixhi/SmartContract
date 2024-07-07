"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RobotSelectionTreeDataProviderBase = exports.getCurrRobotDir = void 0;
const vscode = require("vscode");
const path_1 = require("path");
const viewsCommon_1 = require("./viewsCommon");
const robocorpViews_1 = require("./robocorpViews");
async function getCurrRobotDir() {
    let robotContentTree = viewsCommon_1.treeViewIdToTreeView.get(robocorpViews_1.TREE_VIEW_ROBOCORP_TASK_PACKAGES_TREE);
    if (!robotContentTree) {
        return undefined;
    }
    let parentEntry = undefined;
    let selection = robotContentTree.selection;
    if (selection.length > 0) {
        parentEntry = selection[0];
        if (!parentEntry.filePath) {
            parentEntry = undefined;
        }
    }
    if (!parentEntry) {
        let robot = (0, viewsCommon_1.getSelectedRobot)();
        if (!robot) {
            return undefined;
        }
        parentEntry = {
            filePath: (0, path_1.dirname)(robot.uri.fsPath),
            isDirectory: true,
            name: (0, path_1.basename)(robot.uri.fsPath),
        };
    }
    if (!parentEntry.isDirectory) {
        parentEntry = {
            filePath: (0, path_1.dirname)(parentEntry.filePath),
            isDirectory: true,
            name: (0, path_1.basename)(parentEntry.filePath),
        };
    }
    return parentEntry;
}
exports.getCurrRobotDir = getCurrRobotDir;
class RobotSelectionTreeDataProviderBase {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.lastRobotEntry = undefined;
        this.lastWatcher = undefined;
        this.PATTERN_TO_LISTEN = "**";
    }
    fireRootChange() {
        this._onDidChangeTreeData.fire(null);
    }
    robotSelectionChanged(robotEntry) {
        // When the robot selection changes, we need to start tracking file-changes at the proper place.
        if (this.lastWatcher) {
            this.lastWatcher.dispose();
            this.lastWatcher = undefined;
        }
        this.fireRootChange();
        if (robotEntry) {
            let robotDirUri = vscode.Uri.file((0, path_1.dirname)(robotEntry.uri.fsPath));
            let watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(robotDirUri, this.PATTERN_TO_LISTEN), false, true, false);
            this.lastWatcher = watcher;
            let onChangedSomething = (0, viewsCommon_1.debounce)(() => {
                // Note: this doesn't currently work if the parent folder is renamed or removed.
                // (https://github.com/microsoft/vscode/pull/110858)
                this.fireRootChange();
            }, 100);
            watcher.onDidCreate(onChangedSomething);
            watcher.onDidDelete(onChangedSomething);
        }
    }
    async onRobotsTreeSelectionChanged(robotEntry) {
        if (!this.lastRobotEntry && !robotEntry) {
            // nothing changed
            return;
        }
        if (!this.lastRobotEntry && robotEntry) {
            // i.e.: we didn't have a selection previously: refresh.
            this.robotSelectionChanged(robotEntry);
            return;
        }
        if (!robotEntry && this.lastRobotEntry) {
            this.robotSelectionChanged(robotEntry);
            return;
        }
        if (robotEntry.robot.filePath != this.lastRobotEntry.robot.filePath) {
            // i.e.: the selection changed: refresh.
            this.robotSelectionChanged(robotEntry);
            return;
        }
    }
    async getChildren(element) {
        throw new Error("Not implemented");
    }
    getTreeItem(element) {
        const treeItem = new vscode.TreeItem(element.name);
        if (element.isDirectory) {
            treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        }
        else {
            treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
        }
        if (element.filePath === undefined) {
            // https://microsoft.github.io/vscode-codicons/dist/codicon.html
            treeItem.iconPath = new vscode.ThemeIcon("error");
        }
        else if (element.isDirectory) {
            treeItem.iconPath = vscode.ThemeIcon.Folder;
            treeItem.resourceUri = vscode.Uri.file(element.filePath);
            treeItem.contextValue = "directoryItem";
        }
        else {
            treeItem.iconPath = vscode.ThemeIcon.File;
            treeItem.resourceUri = vscode.Uri.file(element.filePath);
            treeItem.contextValue = "fileItem";
            let uri = treeItem.resourceUri;
            if (element.filePath) {
                if (element.filePath.endsWith(".html")) {
                    treeItem.command = {
                        "title": "Open in external browser",
                        "command": "robocorp.openExternally",
                        arguments: [element],
                    };
                }
                else {
                    treeItem.command = {
                        "title": "Open in VSCode",
                        "command": "vscode.open",
                        arguments: [uri],
                    };
                }
            }
        }
        return treeItem;
    }
}
exports.RobotSelectionTreeDataProviderBase = RobotSelectionTreeDataProviderBase;
//# sourceMappingURL=viewsRobotSelectionTreeBase.js.map