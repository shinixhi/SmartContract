"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RobotContentTreeDataProvider = exports.newFolderInRobotContentTree = exports.deleteResourceInRobotContentTree = exports.renameResourceInRobotContentTree = exports.newFileInRobotContentTree = exports.getCurrRobotTreeContentDir = void 0;
const vscode = require("vscode");
const fs = require("fs");
const channel_1 = require("./channel");
const robocorpViews_1 = require("./robocorpViews");
const viewsCommon_1 = require("./viewsCommon");
const path_1 = require("path");
const vscode_1 = require("vscode");
const viewsRobotSelectionTreeBase_1 = require("./viewsRobotSelectionTreeBase");
const fsPromises = fs.promises;
async function getCurrRobotTreeContentDir() {
    let robotContentTree = viewsCommon_1.treeViewIdToTreeView.get(robocorpViews_1.TREE_VIEW_ROBOCORP_PACKAGE_CONTENT_TREE);
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
            await vscode.window.showInformationMessage("Unable to create file in Robot (Robot not selected).");
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
exports.getCurrRobotTreeContentDir = getCurrRobotTreeContentDir;
async function newFileInRobotContentTree() {
    let currTreeDir = await getCurrRobotTreeContentDir();
    if (!currTreeDir) {
        return;
    }
    let filename = await vscode.window.showInputBox({
        "prompt": "Please provide file name. Current dir: " + currTreeDir.filePath,
        "ignoreFocusOut": true,
    });
    if (!filename) {
        return;
    }
    let targetFile = (0, path_1.join)(currTreeDir.filePath, filename);
    try {
        await vscode.workspace.fs.writeFile(vscode_1.Uri.file(targetFile), new Uint8Array());
    }
    catch (err) {
        (0, channel_1.logError)("Unable to create file.", err, "VIEWS_NEW_FILE_IN_TREE");
        vscode.window.showErrorMessage("Unable to create file. Error: " + err.message);
    }
}
exports.newFileInRobotContentTree = newFileInRobotContentTree;
async function renameResourceInRobotContentTree() {
    let robotContentTree = viewsCommon_1.treeViewIdToTreeView.get(robocorpViews_1.TREE_VIEW_ROBOCORP_PACKAGE_CONTENT_TREE);
    if (!robotContentTree) {
        return undefined;
    }
    let selection = robotContentTree.selection;
    if (!selection) {
        await vscode.window.showInformationMessage("No resources selected for rename.");
        return;
    }
    if (selection.length != 1) {
        await vscode.window.showInformationMessage("Please select a single resource for rename.");
        return;
    }
    let entry = selection[0];
    let uri = vscode_1.Uri.file(entry.filePath);
    let stat;
    try {
        stat = await vscode.workspace.fs.stat(uri);
    }
    catch (err) {
        // unable to get stat (file may have been removed in the meanwhile).
        await vscode.window.showErrorMessage("Unable to stat resource during rename.");
    }
    if (stat) {
        try {
            let newName = await vscode.window.showInputBox({
                "prompt": "Please provide new name for: " +
                    (0, path_1.basename)(entry.filePath) +
                    " (at: " +
                    (0, path_1.dirname)(entry.filePath) +
                    ")",
                "ignoreFocusOut": true,
            });
            if (!newName) {
                return;
            }
            let target = vscode_1.Uri.file((0, path_1.join)((0, path_1.dirname)(entry.filePath), newName));
            await vscode.workspace.fs.rename(uri, target, { overwrite: false });
        }
        catch (err) {
            (0, channel_1.logError)("Error renaming resource: " + entry.filePath, err, "VIEWS_RENAME_RESOURCE");
            let msg = await vscode.window.showErrorMessage("Error renaming resource: " + entry.filePath);
        }
    }
}
exports.renameResourceInRobotContentTree = renameResourceInRobotContentTree;
async function deleteResourceInRobotContentTree() {
    let robotContentTree = viewsCommon_1.treeViewIdToTreeView.get(robocorpViews_1.TREE_VIEW_ROBOCORP_PACKAGE_CONTENT_TREE);
    if (!robotContentTree) {
        return undefined;
    }
    let selection = robotContentTree.selection;
    if (!selection) {
        await vscode.window.showInformationMessage("No resources selected for deletion.");
        return;
    }
    for (const entry of selection) {
        let uri = vscode_1.Uri.file(entry.filePath);
        let stat;
        try {
            stat = await vscode.workspace.fs.stat(uri);
        }
        catch (err) {
            // unable to get stat (file may have been removed in the meanwhile).
        }
        if (stat) {
            try {
                await vscode.workspace.fs.delete(uri, { recursive: true, useTrash: true });
            }
            catch (err) {
                let msg = await vscode.window.showErrorMessage("Unable to move to trash: " + entry.filePath + ". How to proceed?", "Delete permanently", "Cancel");
                if (msg == "Delete permanently") {
                    await vscode.workspace.fs.delete(uri, { recursive: true, useTrash: false });
                }
                else {
                    return;
                }
            }
        }
    }
}
exports.deleteResourceInRobotContentTree = deleteResourceInRobotContentTree;
async function newFolderInRobotContentTree() {
    let currTreeDir = await getCurrRobotTreeContentDir();
    if (!currTreeDir) {
        return;
    }
    let directoryName = await vscode.window.showInputBox({
        "prompt": "Please provide dir name. Current dir: " + currTreeDir.filePath,
        "ignoreFocusOut": true,
    });
    if (!directoryName) {
        return;
    }
    let targetFile = (0, path_1.join)(currTreeDir.filePath, directoryName);
    try {
        await vscode.workspace.fs.createDirectory(vscode_1.Uri.file(targetFile));
    }
    catch (err) {
        (0, channel_1.logError)("Unable to create directory: " + targetFile, err, "VIEWS_NEW_FOLDER");
        vscode.window.showErrorMessage("Unable to create directory. Error: " + err.message);
    }
}
exports.newFolderInRobotContentTree = newFolderInRobotContentTree;
class RobotContentTreeDataProvider extends viewsRobotSelectionTreeBase_1.RobotSelectionTreeDataProviderBase {
    constructor() {
        super(...arguments);
        this._onForceSelectionFromTreeData = new vscode.EventEmitter();
        this.onForceSelectionFromTreeData = this._onForceSelectionFromTreeData.event;
    }
    async getChildren(element) {
        let ret = [];
        if (!element) {
            // i.e.: the contents of this tree depend on what's selected in the robots tree.
            const robotEntry = (0, viewsCommon_1.getSelectedRobot)();
            if (!robotEntry) {
                this.lastRobotEntry = undefined;
                return [
                    {
                        name: viewsCommon_1.NO_PACKAGE_FOUND_MSG,
                        isDirectory: false,
                        filePath: undefined,
                    },
                ];
            }
            this.lastRobotEntry = robotEntry;
            let robotUri = robotEntry.uri;
            try {
                let robotDir = (0, path_1.dirname)(robotUri.fsPath);
                let dirContents = await fsPromises.readdir(robotDir, { withFileTypes: true });
                sortDirContents(dirContents);
                for (const dirContent of dirContents) {
                    ret.push({
                        name: dirContent.name,
                        isDirectory: dirContent.isDirectory(),
                        filePath: (0, path_1.join)(robotDir, dirContent.name),
                    });
                }
            }
            catch (err) {
                // i.e.: this means that the selection is now invalid (directory was deleted).
                setTimeout(() => {
                    this._onForceSelectionFromTreeData.fire(undefined);
                }, 50);
            }
            return ret;
        }
        else {
            // We have a parent...
            if (!element.isDirectory) {
                return ret;
            }
            try {
                let dirContents = await fsPromises.readdir(element.filePath, { withFileTypes: true });
                sortDirContents(dirContents);
                for (const dirContent of dirContents) {
                    ret.push({
                        name: dirContent.name,
                        isDirectory: dirContent.isDirectory(),
                        filePath: (0, path_1.join)(element.filePath, dirContent.name),
                    });
                }
            }
            catch (err) {
                (0, channel_1.logError)("Error listing dir contents: " + element.filePath, err, "VIEWS_LIST_CHILDREN");
            }
            return ret;
        }
    }
}
exports.RobotContentTreeDataProvider = RobotContentTreeDataProvider;
function sortDirContents(dirContents) {
    dirContents.sort((entry1, entry2) => {
        if (entry1.isDirectory() != entry2.isDirectory()) {
            if (entry1.isDirectory()) {
                return -1;
            }
            if (entry2.isDirectory()) {
                return 1;
            }
        }
        return entry1.name.toLowerCase().localeCompare(entry2.name.toLowerCase());
    });
}
//# sourceMappingURL=viewsRobotContent.js.map