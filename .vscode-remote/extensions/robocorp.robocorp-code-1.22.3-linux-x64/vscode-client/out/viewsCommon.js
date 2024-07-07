"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.debounce = exports.basename = exports.getSelectedLocator = exports.getSelectedRobot = exports.setSelectedRobot = exports.onSelectedRobotChanged = exports.getSingleTreeSelection = exports.refreshTreeView = exports.treeViewIdToTreeDataProvider = exports.treeViewIdToTreeView = exports.RobotEntryType = exports.NO_PACKAGE_FOUND_MSG = void 0;
const vscode = require("vscode");
const viewsResources_1 = require("./viewsResources");
exports.NO_PACKAGE_FOUND_MSG = "No package found in current folder";
var RobotEntryType;
(function (RobotEntryType) {
    RobotEntryType[RobotEntryType["ActionPackage"] = 0] = "ActionPackage";
    RobotEntryType[RobotEntryType["Action"] = 1] = "Action";
    RobotEntryType[RobotEntryType["ActionsInActionPackage"] = 2] = "ActionsInActionPackage";
    RobotEntryType[RobotEntryType["Robot"] = 3] = "Robot";
    RobotEntryType[RobotEntryType["Task"] = 4] = "Task";
    RobotEntryType[RobotEntryType["Error"] = 5] = "Error";
    RobotEntryType[RobotEntryType["Run"] = 6] = "Run";
    RobotEntryType[RobotEntryType["Debug"] = 7] = "Debug";
    RobotEntryType[RobotEntryType["RunAction"] = 8] = "RunAction";
    RobotEntryType[RobotEntryType["DebugAction"] = 9] = "DebugAction";
    RobotEntryType[RobotEntryType["ActionsInRobot"] = 10] = "ActionsInRobot";
    RobotEntryType[RobotEntryType["OpenFlowExplorer"] = 11] = "OpenFlowExplorer";
    RobotEntryType[RobotEntryType["UploadRobot"] = 12] = "UploadRobot";
    RobotEntryType[RobotEntryType["RobotTerminal"] = 13] = "RobotTerminal";
    RobotEntryType[RobotEntryType["OpenRobotYaml"] = 14] = "OpenRobotYaml";
    RobotEntryType[RobotEntryType["OpenRobotCondaYaml"] = 15] = "OpenRobotCondaYaml";
    RobotEntryType[RobotEntryType["OpenPackageYaml"] = 16] = "OpenPackageYaml";
    RobotEntryType[RobotEntryType["StartActionServer"] = 17] = "StartActionServer";
    RobotEntryType[RobotEntryType["PackageRebuildEnvironment"] = 18] = "PackageRebuildEnvironment";
})(RobotEntryType = exports.RobotEntryType || (exports.RobotEntryType = {}));
exports.treeViewIdToTreeView = new Map();
exports.treeViewIdToTreeDataProvider = new Map();
function refreshTreeView(treeViewId) {
    let dataProvider = exports.treeViewIdToTreeDataProvider.get(treeViewId);
    if (dataProvider) {
        dataProvider.fireRootChange();
    }
}
exports.refreshTreeView = refreshTreeView;
async function getSingleTreeSelection(treeId, opts) {
    const noSelectionMessage = opts?.noSelectionMessage;
    const moreThanOneSelectionMessage = opts?.moreThanOneSelectionMessage;
    const robotsTree = exports.treeViewIdToTreeView.get(treeId);
    if (!robotsTree || robotsTree.selection.length == 0) {
        if (noSelectionMessage) {
            vscode.window.showWarningMessage(noSelectionMessage);
        }
        return undefined;
    }
    if (robotsTree.selection.length > 1) {
        if (moreThanOneSelectionMessage) {
            vscode.window.showWarningMessage(moreThanOneSelectionMessage);
        }
        return undefined;
    }
    let element = robotsTree.selection[0];
    return element;
}
exports.getSingleTreeSelection = getSingleTreeSelection;
let _onSelectedRobotChanged = new vscode.EventEmitter();
exports.onSelectedRobotChanged = _onSelectedRobotChanged.event;
let lastSelectedRobot = undefined;
function setSelectedRobot(robotEntry) {
    lastSelectedRobot = robotEntry;
    _onSelectedRobotChanged.fire(robotEntry);
}
exports.setSelectedRobot = setSelectedRobot;
/**
 * Returns the selected robot or undefined if there are no robots or if more than one robot is selected.
 *
 * If the messages are passed as a parameter, a warning is shown with that message if the selection is invalid.
 */
function getSelectedRobot(opts) {
    let ret = lastSelectedRobot;
    if (!ret) {
        if (opts?.noSelectionMessage) {
            vscode.window.showWarningMessage(opts.noSelectionMessage);
        }
    }
    return ret;
}
exports.getSelectedRobot = getSelectedRobot;
async function getSelectedLocator(opts) {
    return await (0, viewsResources_1.getLocatorSingleTreeSelection)(opts);
}
exports.getSelectedLocator = getSelectedLocator;
function basename(s) {
    return s.split("\\").pop().split("/").pop();
}
exports.basename = basename;
const debounce = (func, wait) => {
    let timeout;
    return function wrapper(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};
exports.debounce = debounce;
//# sourceMappingURL=viewsCommon.js.map