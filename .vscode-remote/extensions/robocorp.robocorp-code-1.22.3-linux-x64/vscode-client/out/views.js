"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerViews = exports.runSelectedAction = exports.openAction = exports.runSelectedRobot = exports.createRccTerminalTreeSelection = exports.cloudUploadRobotTreeSelection = exports.openLocatorsJsonTreeSelection = exports.openPackageTreeSelection = exports.openRobotCondaTreeSelection = exports.openRobotTreeSelection = exports.editInput = void 0;
const robocorpViews_1 = require("./robocorpViews");
const vscode = require("vscode");
const activities_1 = require("./activities");
const rccTerminal_1 = require("./rccTerminal");
const viewsRobotContent_1 = require("./viewsRobotContent");
const viewsCommon_1 = require("./viewsCommon");
const viewsRobocorp_1 = require("./viewsRobocorp");
const viewsRobots_1 = require("./viewsRobots");
const viewsResources_1 = require("./viewsResources");
const path = require("path");
const files_1 = require("./files");
const actionPackage_1 = require("./robo/actionPackage");
function empty(array) {
    return array === undefined || array.length === 0;
}
async function editInput(actionRobotEntry) {
    if (!actionRobotEntry) {
        vscode.window.showErrorMessage("Unable to edit input: no target action entry defined for action.");
        return;
    }
    const targetInput = await (0, actionPackage_1.getTargetInputJson)(actionRobotEntry.actionName, actionRobotEntry.robot.directory);
    const inputUri = vscode.Uri.file(targetInput);
    if (!(await (0, files_1.fileExists)(targetInput))) {
        await (0, actionPackage_1.createDefaultInputJson)(inputUri);
    }
    await vscode.window.showTextDocument(inputUri);
}
exports.editInput = editInput;
async function openRobotTreeSelection(robot) {
    if (!robot) {
        robot = (0, viewsCommon_1.getSelectedRobot)();
    }
    if (robot) {
        vscode.window.showTextDocument(robot.uri);
    }
}
exports.openRobotTreeSelection = openRobotTreeSelection;
async function openRobotCondaTreeSelection(robot) {
    if (!robot) {
        robot = (0, viewsCommon_1.getSelectedRobot)();
    }
    if (robot) {
        const yamlContents = robot.robot.yamlContents;
        if (yamlContents) {
            const condaConfigFile = yamlContents["condaConfigFile"];
            if (condaConfigFile) {
                vscode.window.showTextDocument(vscode.Uri.file(path.join(robot.robot.directory, condaConfigFile)));
                return;
            }
        }
        // It didn't return: let's just check for a conda.yaml.
        const condaYamlPath = path.join(robot.robot.directory, "conda.yaml");
        const condaYamlUri = vscode.Uri.file(condaYamlPath);
        if (await (0, files_1.uriExists)(condaYamlUri)) {
            vscode.window.showTextDocument(condaYamlUri);
            return;
        }
    }
}
exports.openRobotCondaTreeSelection = openRobotCondaTreeSelection;
async function openPackageTreeSelection(robot) {
    if (!robot) {
        robot = (0, viewsCommon_1.getSelectedRobot)();
    }
    if (robot) {
        const packageYamlPath = path.join(robot.robot.directory, "package.yaml");
        const packageYamlUri = vscode.Uri.file(packageYamlPath);
        if (await (0, files_1.uriExists)(packageYamlUri)) {
            vscode.window.showTextDocument(packageYamlUri);
            return;
        }
    }
}
exports.openPackageTreeSelection = openPackageTreeSelection;
async function openLocatorsJsonTreeSelection() {
    // Json
    const robot = (0, viewsCommon_1.getSelectedRobot)();
    if (robot) {
        let locatorJson = path.join(robot.robot.directory, "locators.json");
        if ((0, files_1.verifyFileExists)(locatorJson, false)) {
            vscode.window.showTextDocument(vscode.Uri.file(locatorJson));
        }
    }
}
exports.openLocatorsJsonTreeSelection = openLocatorsJsonTreeSelection;
async function cloudUploadRobotTreeSelection(robot) {
    if (!robot) {
        robot = (0, viewsCommon_1.getSelectedRobot)();
    }
    if (robot) {
        (0, activities_1.uploadRobot)(robot.robot);
    }
}
exports.cloudUploadRobotTreeSelection = cloudUploadRobotTreeSelection;
async function createRccTerminalTreeSelection(robot) {
    if (!robot) {
        robot = (0, viewsCommon_1.getSelectedRobot)();
    }
    if (robot) {
        (0, rccTerminal_1.createRccTerminal)(robot.robot);
    }
}
exports.createRccTerminalTreeSelection = createRccTerminalTreeSelection;
async function runSelectedRobot(noDebug, taskRobotEntry) {
    if (!taskRobotEntry) {
        taskRobotEntry = await (0, viewsCommon_1.getSelectedRobot)({
            noSelectionMessage: "Unable to make launch (Task not selected in Packages Tree).",
            moreThanOneSelectionMessage: "Unable to make launch -- only 1 task must be selected.",
        });
    }
    (0, activities_1.runRobotRCC)(noDebug, taskRobotEntry.robot.filePath, taskRobotEntry.taskName);
}
exports.runSelectedRobot = runSelectedRobot;
async function openAction(actionRobotEntry) {
    const range = actionRobotEntry.range;
    if (range) {
        const selection = new vscode.Range(new vscode.Position(range.start.line - 1, range.start.character), new vscode.Position(range.end.line - 1, range.end.character));
        await vscode.window.showTextDocument(actionRobotEntry.uri, { selection: selection });
    }
    else {
        await vscode.window.showTextDocument(actionRobotEntry.uri);
    }
}
exports.openAction = openAction;
async function runSelectedAction(noDebug, actionRobotEntry) {
    if (!actionRobotEntry) {
        actionRobotEntry = await (0, viewsCommon_1.getSelectedRobot)({
            noSelectionMessage: "Unable to make launch (Action not selected in Packages Tree).",
            moreThanOneSelectionMessage: "Unable to make launch -- only 1 action must be selected.",
        });
        if (!actionRobotEntry) {
            return;
        }
    }
    if (!actionRobotEntry.actionName) {
        vscode.window.showErrorMessage("actionName not available in entry to launch.");
        return;
    }
    await (0, actionPackage_1.runActionFromActionPackage)(noDebug, actionRobotEntry.actionName, actionRobotEntry.robot.directory, actionRobotEntry.robot.filePath, actionRobotEntry.uri);
}
exports.runSelectedAction = runSelectedAction;
async function onChangedRobotSelection(robotsTree, treeDataProvider, selection) {
    if (selection === undefined) {
        selection = [];
    }
    // Remove error nodes from the selection.
    selection = selection.filter((e) => {
        return e.type != viewsCommon_1.RobotEntryType.Error;
    });
    if (empty(selection)) {
        let rootChildren = await treeDataProvider.getValidCachedOrComputeChildren(undefined);
        if (empty(rootChildren)) {
            // i.e.: there's nothing to reselect, so, just notify as usual.
            (0, viewsCommon_1.setSelectedRobot)(undefined);
            return;
        }
        // Automatically update selection / reselect some item.
        (0, viewsCommon_1.setSelectedRobot)(rootChildren[0]);
        robotsTree.reveal(rootChildren[0], { "select": true });
        return;
    }
    if (!empty(selection)) {
        (0, viewsCommon_1.setSelectedRobot)(selection[0]);
        return;
    }
    let rootChildren = await treeDataProvider.getValidCachedOrComputeChildren(undefined);
    if (empty(rootChildren)) {
        // i.e.: there's nothing to reselect, so, just notify as usual.
        (0, viewsCommon_1.setSelectedRobot)(undefined);
        return;
    }
    // // Automatically update selection / reselect some item.
    (0, viewsCommon_1.setSelectedRobot)(rootChildren[0]);
    robotsTree.reveal(rootChildren[0], { "select": true });
}
function registerViews(context) {
    // Cloud data
    let cloudTreeDataProvider = new viewsRobocorp_1.CloudTreeDataProvider();
    let viewsCloudTree = vscode.window.createTreeView(robocorpViews_1.TREE_VIEW_ROBOCORP_CLOUD_TREE, {
        "treeDataProvider": cloudTreeDataProvider,
    });
    viewsCommon_1.treeViewIdToTreeView.set(robocorpViews_1.TREE_VIEW_ROBOCORP_CLOUD_TREE, viewsCloudTree);
    viewsCommon_1.treeViewIdToTreeDataProvider.set(robocorpViews_1.TREE_VIEW_ROBOCORP_CLOUD_TREE, cloudTreeDataProvider);
    // Robots (i.e.: list of robots, not its contents)
    let robotsTreeDataProvider = new viewsRobots_1.RobotsTreeDataProvider();
    let robotsTree = vscode.window.createTreeView(robocorpViews_1.TREE_VIEW_ROBOCORP_TASK_PACKAGES_TREE, {
        "treeDataProvider": robotsTreeDataProvider,
    });
    viewsCommon_1.treeViewIdToTreeView.set(robocorpViews_1.TREE_VIEW_ROBOCORP_TASK_PACKAGES_TREE, robotsTree);
    viewsCommon_1.treeViewIdToTreeDataProvider.set(robocorpViews_1.TREE_VIEW_ROBOCORP_TASK_PACKAGES_TREE, robotsTreeDataProvider);
    context.subscriptions.push(robotsTree.onDidChangeSelection(async (e) => await onChangedRobotSelection(robotsTree, robotsTreeDataProvider, e.selection)));
    context.subscriptions.push(robotsTreeDataProvider.onForceSelectionFromTreeData(async (e) => await onChangedRobotSelection(robotsTree, robotsTreeDataProvider, robotsTree.selection)));
    // Update contexts when the current robot changes.
    context.subscriptions.push((0, viewsCommon_1.onSelectedRobotChanged)(async (robotEntry) => {
        if (!robotEntry) {
            vscode.commands.executeCommand("setContext", "robocorp-code:single-task-selected", false);
            vscode.commands.executeCommand("setContext", "robocorp-code:single-robot-selected", false);
            return;
        }
        vscode.commands.executeCommand("setContext", "robocorp-code:single-task-selected", robotEntry.type == viewsCommon_1.RobotEntryType.Task);
        vscode.commands.executeCommand("setContext", "robocorp-code:single-robot-selected", true);
    }));
    // The contents of a single robot (the one selected in the Robots tree).
    let robotContentTreeDataProvider = new viewsRobotContent_1.RobotContentTreeDataProvider();
    let robotContentTree = vscode.window.createTreeView(robocorpViews_1.TREE_VIEW_ROBOCORP_PACKAGE_CONTENT_TREE, {
        "treeDataProvider": robotContentTreeDataProvider,
    });
    viewsCommon_1.treeViewIdToTreeView.set(robocorpViews_1.TREE_VIEW_ROBOCORP_PACKAGE_CONTENT_TREE, robotContentTree);
    viewsCommon_1.treeViewIdToTreeDataProvider.set(robocorpViews_1.TREE_VIEW_ROBOCORP_PACKAGE_CONTENT_TREE, robotContentTreeDataProvider);
    context.subscriptions.push((0, viewsCommon_1.onSelectedRobotChanged)((e) => robotContentTreeDataProvider.onRobotsTreeSelectionChanged(e)));
    context.subscriptions.push(robotContentTreeDataProvider.onForceSelectionFromTreeData(async (e) => await onChangedRobotSelection(robotsTree, robotsTreeDataProvider, robotsTree.selection)));
    // Resources
    let resourcesDataProvider = new viewsResources_1.ResourcesTreeDataProvider();
    let resourcesTree = vscode.window.createTreeView(robocorpViews_1.TREE_VIEW_ROBOCORP_PACKAGE_RESOURCES_TREE, {
        "treeDataProvider": resourcesDataProvider,
        "canSelectMany": true,
    });
    viewsCommon_1.treeViewIdToTreeView.set(robocorpViews_1.TREE_VIEW_ROBOCORP_PACKAGE_RESOURCES_TREE, resourcesTree);
    viewsCommon_1.treeViewIdToTreeDataProvider.set(robocorpViews_1.TREE_VIEW_ROBOCORP_PACKAGE_RESOURCES_TREE, resourcesDataProvider);
    context.subscriptions.push((0, viewsCommon_1.onSelectedRobotChanged)((e) => resourcesDataProvider.onRobotsTreeSelectionChanged(e)));
    let robotsWatcher = vscode.workspace.createFileSystemWatcher("**/robot.yaml");
    let onChangeRobotsYaml = (0, viewsCommon_1.debounce)(() => {
        // Note: this doesn't currently work if the parent folder is renamed or removed.
        // (https://github.com/microsoft/vscode/pull/110858)
        (0, viewsCommon_1.refreshTreeView)(robocorpViews_1.TREE_VIEW_ROBOCORP_TASK_PACKAGES_TREE);
    }, 300);
    robotsWatcher.onDidChange(onChangeRobotsYaml);
    robotsWatcher.onDidCreate(onChangeRobotsYaml);
    robotsWatcher.onDidDelete(onChangeRobotsYaml);
    let locatorsWatcher = vscode.workspace.createFileSystemWatcher("**/locators.json");
    let onChangeLocatorsJson = (0, viewsCommon_1.debounce)(() => {
        // Note: this doesn't currently work if the parent folder is renamed or removed.
        // (https://github.com/microsoft/vscode/pull/110858)
        (0, viewsCommon_1.refreshTreeView)(robocorpViews_1.TREE_VIEW_ROBOCORP_PACKAGE_RESOURCES_TREE);
    }, 300);
    locatorsWatcher.onDidChange(onChangeLocatorsJson);
    locatorsWatcher.onDidCreate(onChangeLocatorsJson);
    locatorsWatcher.onDidDelete(onChangeLocatorsJson);
    context.subscriptions.push(robotsTree);
    context.subscriptions.push(resourcesTree);
    context.subscriptions.push(robotsWatcher);
    context.subscriptions.push(locatorsWatcher);
}
exports.registerViews = registerViews;
//# sourceMappingURL=views.js.map