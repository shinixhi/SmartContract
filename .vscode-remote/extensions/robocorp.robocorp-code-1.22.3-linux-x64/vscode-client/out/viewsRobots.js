"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RobotsTreeDataProvider = void 0;
const vscode = require("vscode");
const channel_1 = require("./channel");
const files_1 = require("./files");
const roboCommands = require("./robocorpCommands");
const viewsCommon_1 = require("./viewsCommon");
const common_1 = require("./common");
let _globalSentMetric = false;
function empty(array) {
    return array === undefined || array.length === 0;
}
function getRobotLabel(robotInfo) {
    let label = undefined;
    if (robotInfo.yamlContents) {
        label = robotInfo.yamlContents["name"];
    }
    if (!label) {
        if (robotInfo.directory) {
            label = (0, viewsCommon_1.basename)(robotInfo.directory);
        }
    }
    if (!label) {
        label = "";
    }
    return label;
}
class RobotsTreeDataProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this._onForceSelectionFromTreeData = new vscode.EventEmitter();
        this.onForceSelectionFromTreeData = this._onForceSelectionFromTreeData.event;
        this.lastRoot = undefined;
    }
    fireRootChange() {
        this._onDidChangeTreeData.fire(null);
    }
    /**
     * Note that we make sure to only return valid entries here (i.e.: no entries
     * where RobotEntry.type === RobotEntryType.Error).
     */
    async getValidCachedOrComputeChildren(element) {
        if (element === undefined) {
            if (this.lastRoot !== undefined) {
                let ret = this.lastRoot.filter((e) => {
                    return e.type !== viewsCommon_1.RobotEntryType.Error;
                });
                if (ret.length > 0) {
                    // We need to check whether entries still exist.
                    let foundAll = true;
                    for (const entry of ret) {
                        if (!(await (0, files_1.uriExists)(entry.uri))) {
                            foundAll = false;
                            break;
                        }
                    }
                    if (foundAll) {
                        return ret;
                    }
                }
            }
        }
        let ret = await this.getChildren(element);
        // Remove any "error" entries
        return ret.filter((e) => {
            return e.type !== viewsCommon_1.RobotEntryType.Error;
        });
    }
    /**
     * This function will compute the children and store the `lastRoot`
     * cache (if element === undefined).
     */
    async getChildren(element) {
        let ret = await this.computeChildren(element);
        if (element === undefined) {
            // i.e.: this is the root entry, so, we've
            // collected the actual robots here.
            let notifySelection = false;
            if (empty(this.lastRoot) && empty(ret)) {
                // Don't notify of anything, nothing changed...
            }
            else if (empty(this.lastRoot)) {
                // We had nothing and now we have something, notify.
                if (!empty(ret)) {
                    notifySelection = true;
                }
            }
            else {
                // lastRoot is valid
                // We had something and now we have nothing, notify.
                if (empty(ret)) {
                    notifySelection = true;
                }
            }
            if (!empty(ret) && !notifySelection) {
                // Verify if the last selection is still valid (if it's not we need
                // to notify).
                let currentSelectedRobot = (0, viewsCommon_1.getSelectedRobot)();
                let found = false;
                for (const entry of ret) {
                    if (currentSelectedRobot == entry) {
                        found = true;
                    }
                }
                if (!found) {
                    notifySelection = true;
                }
            }
            this.lastRoot = ret;
            if (notifySelection) {
                setTimeout(() => {
                    this._onForceSelectionFromTreeData.fire(this.lastRoot);
                }, 50);
            }
            if (ret.length === 0) {
                // No robot was actually found, so, we'll return a dummy entry
                // giving more instructions to the user.
                let added = false;
                for (const label of [
                    "No Task nor Action Package found.",
                    "A few ways to get started:",
                    "➔ Run the “Robocorp: Create Task Package”",
                    "➔ Run the “Robocorp: Create Action Package”",
                    "➔ Open a Task Package folder (with a “robot.yaml” file)",
                    "➔ Open an Action Package folder (with a “package.yaml” file)",
                    "➔ Open a parent folder (with multiple Task or Action packages)",
                ]) {
                    ret.push({
                        "label": label,
                        "uri": undefined,
                        "robot": undefined,
                        "taskName": undefined,
                        "iconPath": added ? "" : "error",
                        "type": viewsCommon_1.RobotEntryType.Error,
                        "parent": element,
                    });
                    added = true;
                }
            }
        }
        return ret;
    }
    async getParent(element) {
        return element.parent;
    }
    async computeChildren(element) {
        if (element) {
            // Get child elements.
            if (element.type === viewsCommon_1.RobotEntryType.Task) {
                return [
                    {
                        "label": "Run Task",
                        "uri": element.uri,
                        "robot": element.robot,
                        "taskName": element.taskName,
                        "iconPath": "run",
                        "type": viewsCommon_1.RobotEntryType.Run,
                        "parent": element,
                    },
                    {
                        "label": "Debug Task",
                        "uri": element.uri,
                        "robot": element.robot,
                        "taskName": element.taskName,
                        "iconPath": "debug",
                        "type": viewsCommon_1.RobotEntryType.Debug,
                        "parent": element,
                    },
                ];
            }
            else if (element.type === viewsCommon_1.RobotEntryType.Action) {
                return [
                    {
                        "label": "Run Action",
                        "uri": element.uri,
                        "robot": element.robot,
                        "actionName": element.actionName,
                        "iconPath": "run",
                        "type": viewsCommon_1.RobotEntryType.RunAction,
                        "parent": element,
                    },
                    {
                        "label": "Debug Action",
                        "uri": element.uri,
                        "robot": element.robot,
                        "actionName": element.actionName,
                        "iconPath": "debug",
                        "type": viewsCommon_1.RobotEntryType.DebugAction,
                        "parent": element,
                    },
                ];
            }
            else if (element.type === viewsCommon_1.RobotEntryType.ActionPackage) {
                // TODO: We need a way to get the actions for the action package.
                let children = [];
                try {
                    let result = await vscode.commands.executeCommand(roboCommands.ROBOCORP_LIST_ACTIONS_INTERNAL, {
                        "action_package": element.uri.toString(),
                    });
                    if (result.success) {
                        let actions = result.result;
                        for (const action of actions) {
                            const uri = vscode.Uri.parse(action.uri);
                            children.push({
                                "label": action.name,
                                "actionName": action.name,
                                "robot": element.robot,
                                "uri": uri,
                                "action_package_uri": element.uri,
                                "iconPath": "circle",
                                "type": viewsCommon_1.RobotEntryType.Action,
                                "parent": element,
                                "range": action.range,
                            });
                        }
                    }
                }
                catch (error) {
                    (0, channel_1.logError)("Error collecting actions.", error, "ACT_COLLECT_ACTIONS");
                }
                children.push({
                    "label": "Activities",
                    "uri": element.uri,
                    "robot": element.robot,
                    "iconPath": "tools",
                    "type": viewsCommon_1.RobotEntryType.ActionsInActionPackage,
                    "parent": element,
                });
                return children;
            }
            else if (element.type === viewsCommon_1.RobotEntryType.ActionsInActionPackage) {
                return [
                    {
                        "label": "Start Action Server",
                        "uri": element.uri,
                        "robot": element.robot,
                        "iconPath": "tools",
                        "type": viewsCommon_1.RobotEntryType.StartActionServer,
                        "parent": element,
                        "tooltip": "Start the Action Server for the actions in the action package",
                    },
                    {
                        "label": "Configure Action Package (package.yaml)",
                        "uri": element.uri,
                        "robot": element.robot,
                        "iconPath": "go-to-file",
                        "type": viewsCommon_1.RobotEntryType.OpenPackageYaml,
                        "parent": element,
                    },
                    {
                        "label": "Rebuild Package Environment",
                        "uri": element.uri,
                        "robot": element.robot,
                        "iconPath": "sync",
                        "type": viewsCommon_1.RobotEntryType.PackageRebuildEnvironment,
                        "parent": element,
                        "tooltip": "Rebuilds the current Python package environment",
                    },
                ];
            }
            else if (element.type === viewsCommon_1.RobotEntryType.Robot) {
                let yamlContents = element.robot.yamlContents;
                let robotChildren = [];
                if (yamlContents) {
                    let tasks = yamlContents["tasks"];
                    if (tasks) {
                        const robotInfo = element.robot;
                        robotChildren = Object.keys(tasks).map((task) => ({
                            "label": task,
                            "uri": vscode.Uri.file(robotInfo.filePath),
                            "robot": robotInfo,
                            "taskName": task,
                            "iconPath": "debug-alt-small",
                            "type": viewsCommon_1.RobotEntryType.Task,
                            "parent": element,
                        }));
                    }
                }
                robotChildren.push({
                    "label": "Activities",
                    "uri": element.uri,
                    "robot": element.robot,
                    "iconPath": "tools",
                    "type": viewsCommon_1.RobotEntryType.ActionsInRobot,
                    "parent": element,
                });
                return robotChildren;
            }
            else if (element.type === viewsCommon_1.RobotEntryType.ActionsInRobot) {
                return [
                    {
                        "label": "Upload Task Package to Control Room",
                        "uri": element.uri,
                        "robot": element.robot,
                        "iconPath": "cloud-upload",
                        "type": viewsCommon_1.RobotEntryType.UploadRobot,
                        "parent": element,
                    },
                    {
                        "label": "Open Task Package Terminal",
                        "uri": element.uri,
                        "robot": element.robot,
                        "iconPath": "terminal",
                        "type": viewsCommon_1.RobotEntryType.RobotTerminal,
                        "parent": element,
                    },
                    {
                        "label": "Configure Tasks (robot.yaml)",
                        "uri": element.uri,
                        "robot": element.robot,
                        "iconPath": "go-to-file",
                        "type": viewsCommon_1.RobotEntryType.OpenRobotYaml,
                        "parent": element,
                    },
                    {
                        "label": "Configure Dependencies (conda.yaml)",
                        "uri": element.uri,
                        "robot": element.robot,
                        "iconPath": "list-tree",
                        "type": viewsCommon_1.RobotEntryType.OpenRobotCondaYaml,
                        "parent": element,
                    },
                    {
                        "label": "Open Flow Explorer",
                        "uri": element.uri,
                        "robot": element.robot,
                        "iconPath": "type-hierarchy-sub",
                        "type": viewsCommon_1.RobotEntryType.OpenFlowExplorer,
                        "parent": element,
                    },
                ];
            }
            else if (element.type === viewsCommon_1.RobotEntryType.Error) {
                return [];
            }
            channel_1.OUTPUT_CHANNEL.appendLine("Unhandled in viewsRobots.ts: " + element.type);
            return [];
        }
        if (!_globalSentMetric) {
            _globalSentMetric = true;
            vscode.commands.executeCommand(roboCommands.ROBOCORP_SEND_METRIC, {
                "name": "vscode.treeview.used",
                "value": "1",
            });
        }
        // Get root elements.
        let actionResult = await vscode.commands.executeCommand(roboCommands.ROBOCORP_LOCAL_LIST_ROBOTS_INTERNAL);
        if (!actionResult.success) {
            channel_1.OUTPUT_CHANNEL.appendLine(actionResult.message);
            return [];
        }
        let robotsInfo = actionResult.result;
        if (empty(robotsInfo)) {
            return [];
        }
        const collapsed = robotsInfo.length > 1;
        return robotsInfo.map((robotInfo) => ({
            "label": getRobotLabel(robotInfo),
            "uri": vscode.Uri.file(robotInfo.filePath),
            "robot": robotInfo,
            "iconPath": "package",
            "type": (0, common_1.isActionPackage)(robotInfo) ? viewsCommon_1.RobotEntryType.ActionPackage : viewsCommon_1.RobotEntryType.Robot,
            "parent": element,
            "collapsed": collapsed,
        }));
    }
    getTreeItem(element) {
        const treeItem = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.Collapsed);
        if (element.type === viewsCommon_1.RobotEntryType.Run) {
            treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
            treeItem.contextValue = "taskItemRun";
            treeItem.command = {
                "title": "Run",
                "command": roboCommands.ROBOCORP_ROBOTS_VIEW_TASK_RUN,
                "arguments": [element],
            };
        }
        else if (element.type === viewsCommon_1.RobotEntryType.Debug) {
            treeItem.command = {
                "title": "Debug",
                "command": roboCommands.ROBOCORP_ROBOTS_VIEW_TASK_DEBUG,
                "arguments": [element],
            };
            treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
            treeItem.contextValue = "taskItemDebug";
        }
        else if (element.type === viewsCommon_1.RobotEntryType.RunAction) {
            treeItem.command = {
                "title": "Run Action",
                "command": roboCommands.ROBOCORP_ROBOTS_VIEW_ACTION_RUN,
                "arguments": [element],
            };
            treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
            treeItem.contextValue = "actionItemRun";
        }
        else if (element.type === viewsCommon_1.RobotEntryType.DebugAction) {
            treeItem.command = {
                "title": "Debug Action",
                "command": roboCommands.ROBOCORP_ROBOTS_VIEW_ACTION_DEBUG,
                "arguments": [element],
            };
            treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
            treeItem.contextValue = "actionItemDebug";
        }
        else if (element.type === viewsCommon_1.RobotEntryType.ActionsInRobot) {
            treeItem.contextValue = "actionsInRobotItem";
            treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        }
        else if (element.type === viewsCommon_1.RobotEntryType.OpenRobotYaml) {
            treeItem.command = {
                "title": "Configure Robot (robot.yaml)",
                "command": roboCommands.ROBOCORP_OPEN_ROBOT_TREE_SELECTION,
                "arguments": [element],
            };
            treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
        }
        else if (element.type === viewsCommon_1.RobotEntryType.OpenRobotCondaYaml) {
            treeItem.command = {
                "title": "Configure Dependencies (conda.yaml)",
                "command": roboCommands.ROBOCORP_OPEN_ROBOT_CONDA_TREE_SELECTION,
                "arguments": [element],
            };
            treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
        }
        else if (element.type === viewsCommon_1.RobotEntryType.OpenPackageYaml) {
            treeItem.command = {
                "title": "Configure Action Package (package.yaml)",
                "command": roboCommands.ROBOCORP_OPEN_PACKAGE_YAML_TREE_SELECTION,
                "arguments": [element],
            };
            treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
        }
        else if (element.type === viewsCommon_1.RobotEntryType.RobotTerminal) {
            treeItem.command = {
                "title": "Open Robot Terminal",
                "command": roboCommands.ROBOCORP_CREATE_RCC_TERMINAL_TREE_SELECTION,
                "arguments": [element],
            };
            treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
        }
        else if (element.type === viewsCommon_1.RobotEntryType.OpenFlowExplorer) {
            treeItem.command = {
                "title": "Open Flow Explorer",
                "command": "robot.openFlowExplorer",
                "arguments": [vscode.Uri.file(element.robot.directory).toString()],
            };
            treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
        }
        else if (element.type === viewsCommon_1.RobotEntryType.UploadRobot) {
            treeItem.command = {
                "title": "Upload Robot to Control Room",
                "command": roboCommands.ROBOCORP_CLOUD_UPLOAD_ROBOT_TREE_SELECTION,
                "arguments": [element],
            };
            treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
        }
        else if (element.type === viewsCommon_1.RobotEntryType.Robot) {
            treeItem.contextValue = "robotItem";
            treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        }
        else if (element.type === viewsCommon_1.RobotEntryType.Task) {
            treeItem.contextValue = "taskItem";
            treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        }
        else if (element.type === viewsCommon_1.RobotEntryType.Action) {
            treeItem.contextValue = "actionItem";
            treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        }
        else if (element.type === viewsCommon_1.RobotEntryType.Error) {
            treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
        }
        else if (element.type === viewsCommon_1.RobotEntryType.StartActionServer) {
            treeItem.command = {
                "title": "Start Action Server",
                "command": roboCommands.ROBOCORP_START_ACTION_SERVER,
                "arguments": [vscode.Uri.file(element.robot.directory)],
            };
            treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
        }
        else if (element.type === viewsCommon_1.RobotEntryType.PackageRebuildEnvironment) {
            treeItem.command = {
                "title": "Rebuild Package Environment",
                "command": roboCommands.ROBOCORP_PACKAGE_ENVIRONMENT_REBUILD,
            };
            treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
        }
        if (element.tooltip) {
            treeItem.tooltip = element.tooltip;
        }
        if (element.iconPath) {
            treeItem.iconPath = new vscode.ThemeIcon(element.iconPath);
        }
        if (element.collapsed !== undefined) {
            treeItem.collapsibleState = element.collapsed
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.Expanded;
        }
        return treeItem;
    }
}
exports.RobotsTreeDataProvider = RobotsTreeDataProvider;
//# sourceMappingURL=viewsRobots.js.map