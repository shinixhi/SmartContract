"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createActionPackage = exports.runActionFromActionPackage = exports.getTargetInputJson = exports.askAndRunRobocorpActionFromActionPackage = exports.createDefaultInputJson = void 0;
const vscode_1 = require("vscode");
const vscode = require("vscode");
const path_1 = require("path");
const roboCommands = require("../robocorpCommands");
const common_1 = require("../common");
const slugify_1 = require("../slugify");
const files_1 = require("../files");
const ask_1 = require("../ask");
const path = require("path");
const channel_1 = require("../channel");
const actionServer_1 = require("../actionServer");
const rcc_1 = require("../rcc");
const subprocess_1 = require("../subprocess");
async function createDefaultInputJson(inputUri) {
    await vscode.workspace.fs.writeFile(inputUri, Buffer.from(`{
    "paramName": "paramValue"
}`));
}
exports.createDefaultInputJson = createDefaultInputJson;
async function askAndRunRobocorpActionFromActionPackage(noDebug) {
    let textEditor = vscode_1.window.activeTextEditor;
    let fileName = undefined;
    if (textEditor) {
        fileName = textEditor.document.fileName;
    }
    const RUN_ACTION_FROM_ACTION_PACKAGE_LRU_CACHE = "RUN_ACTION_FROM_ACTION_PACKAGE_LRU_CACHE";
    let runLRU = await vscode_1.commands.executeCommand(roboCommands.ROBOCORP_LOAD_FROM_DISK_LRU, {
        "name": RUN_ACTION_FROM_ACTION_PACKAGE_LRU_CACHE,
    });
    let actionResult = await vscode_1.commands.executeCommand(roboCommands.ROBOCORP_LOCAL_LIST_ROBOTS_INTERNAL);
    if (!actionResult.success) {
        vscode_1.window.showErrorMessage("Error listing Action Packages: " + actionResult.message);
        return;
    }
    let robotsInfo = actionResult.result;
    if (robotsInfo) {
        // Only use action packages.
        robotsInfo = robotsInfo.filter((r) => {
            return (0, common_1.isActionPackage)(r);
        });
    }
    if (!robotsInfo || robotsInfo.length == 0) {
        vscode_1.window.showInformationMessage("Unable to run Action Package (no Action Packages detected in the Workspace).");
        return;
    }
    let items = new Array();
    for (let robotInfo of robotsInfo) {
        try {
            const actionPackageUri = vscode.Uri.file(robotInfo.filePath);
            let result = await vscode.commands.executeCommand(roboCommands.ROBOCORP_LIST_ACTIONS_INTERNAL, {
                "action_package": actionPackageUri.toString(),
            });
            if (result.success) {
                let actions = result.result;
                for (const action of actions) {
                    const keyInLRU = `${robotInfo.name}: ${action.name}`;
                    const uri = vscode.Uri.parse(action.uri);
                    const item = {
                        "label": keyInLRU,
                        "actionName": action.name,
                        "actionFileUri": uri,
                        "actionPackageYamlDirectory": robotInfo.directory,
                        "actionPackageUri": actionPackageUri,
                        "packageYaml": robotInfo.filePath,
                        "keyInLRU": action.name,
                    };
                    if (runLRU && runLRU.length > 0 && keyInLRU == runLRU[0]) {
                        // Note that although we have an LRU we just consider the last one for now.
                        items.splice(0, 0, item);
                    }
                    else {
                        items.push(item);
                    }
                }
            }
        }
        catch (error) {
            (0, channel_1.logError)("Error collecting actions.", error, "ACT_COLLECT_ACTIONS");
        }
    }
    if (!items) {
        vscode_1.window.showInformationMessage("Unable to run Action Package (no Action Package detected in the Workspace).");
        return;
    }
    let selectedItem;
    if (items.length == 1) {
        selectedItem = items[0];
    }
    else {
        selectedItem = await vscode_1.window.showQuickPick(items, {
            "canPickMany": false,
            "placeHolder": "Please select the Action Package and Action to run.",
            "ignoreFocusOut": true,
        });
    }
    if (!selectedItem) {
        return;
    }
    await vscode_1.commands.executeCommand(roboCommands.ROBOCORP_SAVE_IN_DISK_LRU, {
        "name": RUN_ACTION_FROM_ACTION_PACKAGE_LRU_CACHE,
        "entry": selectedItem.keyInLRU,
        "lru_size": 3,
    });
    const actionName = selectedItem.actionName;
    const actionPackageYamlDirectory = selectedItem.actionPackageYamlDirectory;
    const packageYaml = selectedItem.actionPackageUri.fsPath;
    const actionFileUri = selectedItem.actionFileUri;
    await runActionFromActionPackage(noDebug, actionName, actionPackageYamlDirectory, packageYaml, actionFileUri);
}
exports.askAndRunRobocorpActionFromActionPackage = askAndRunRobocorpActionFromActionPackage;
async function getTargetInputJson(actionName, actionPackageYamlDirectory) {
    const nameSlugified = (0, slugify_1.slugify)(actionName);
    const dir = actionPackageYamlDirectory;
    const devDataDir = path.join(dir, "devdata");
    await (0, files_1.makeDirs)(devDataDir);
    const targetInput = path.join(devDataDir, `input_${nameSlugified}.json`);
    return targetInput;
}
exports.getTargetInputJson = getTargetInputJson;
async function runActionFromActionPackage(noDebug, actionName, actionPackageYamlDirectory, packageYaml, actionFileUri) {
    // The input must be asked when running actions in this case and it should be
    // saved in 'devdata/input_xxx.json'
    const nameSlugified = (0, slugify_1.slugify)(actionName);
    const targetInput = await getTargetInputJson(actionName, actionPackageYamlDirectory);
    if (!(await (0, files_1.fileExists)(targetInput))) {
        let items = new Array();
        items.push({
            "label": `Create "devdata/input_${nameSlugified}.json" to customize action input`,
            "action": "create",
            "detail": "Note: Please relaunch after the customization is completed",
        });
        items.push({
            "label": `Cancel`,
            "action": "cancel",
        });
        let selectedItem = await (0, ask_1.showSelectOneQuickPick)(items, "Input for the action not defined. How to proceed?", `Customize input for the ${actionName} action`);
        if (!selectedItem) {
            return;
        }
        if (selectedItem.action === "create") {
            // Create the file and ask the user to fill it and rerun the action
            // after he finished doing that.
            const inputUri = vscode.Uri.file(targetInput);
            await createDefaultInputJson(inputUri);
            await vscode.window.showTextDocument(inputUri);
        }
        // In any case, don't proceed if it wasn't previously created
        // (so that the user can customize it).
        return;
    }
    // Ok, input available. Let's create the launch and run it.
    let debugConfiguration = {
        "name": "Config",
        "type": "robocorp-code",
        "request": "launch",
        "package": packageYaml,
        "uri": actionFileUri.toString(),
        "jsonInput": targetInput,
        "actionName": actionName,
        "args": [],
        "noDebug": noDebug,
    };
    let debugSessionOptions = {};
    vscode.debug.startDebugging(undefined, debugConfiguration, debugSessionOptions);
}
exports.runActionFromActionPackage = runActionFromActionPackage;
async function createActionPackage() {
    const robotsInWorkspacePromise = (0, common_1.areThereRobotsInWorkspace)();
    const actionServerLocation = await (0, actionServer_1.downloadOrGetActionServerLocation)();
    if (!actionServerLocation) {
        return;
    }
    let ws = await (0, ask_1.askForWs)();
    if (!ws) {
        // Operation cancelled.
        return;
    }
    const actionServerVersionPromise = (0, actionServer_1.getActionServerVersion)(actionServerLocation);
    if (await (0, common_1.isDirectoryAPackageDirectory)(ws.uri)) {
        return;
    }
    const robotsInWorkspace = await robotsInWorkspacePromise;
    let useWorkspaceFolder;
    if (robotsInWorkspace) {
        // i.e.: if we already have robots, this is a multi-Robot workspace.
        useWorkspaceFolder = false;
    }
    else {
        const USE_WORKSPACE_FOLDER_LABEL = "Use workspace folder (recommended)";
        let target = await vscode_1.window.showQuickPick([
            {
                "label": USE_WORKSPACE_FOLDER_LABEL,
                "detail": "The workspace will only have a single Action Package.",
            },
            {
                "label": "Use child folder in workspace (advanced)",
                "detail": "Multiple Action Packages can be created in this workspace.",
            },
        ], {
            "placeHolder": "Where do you want to create the Action Package?",
            "ignoreFocusOut": true,
        });
        if (!target) {
            // Operation cancelled.
            return;
        }
        useWorkspaceFolder = target["label"] == USE_WORKSPACE_FOLDER_LABEL;
    }
    let targetDir = ws.uri.fsPath;
    if (!useWorkspaceFolder) {
        let name = await vscode_1.window.showInputBox({
            "value": "Example",
            "prompt": "Please provide the name for the Action Package folder name.",
            "ignoreFocusOut": true,
        });
        if (!name) {
            // Operation cancelled.
            return;
        }
        targetDir = (0, path_1.join)(targetDir, name);
    }
    // Now, let's validate if we can indeed create an Action Package in the given folder.
    const op = await (0, common_1.verifyIfPathOkToCreatePackage)(targetDir);
    let force;
    switch (op) {
        case "force":
            force = true;
            break;
        case "empty":
            force = false;
            break;
        case "cancel":
            return;
        default:
            throw Error("Unexpected result: " + op);
    }
    const robocorpHome = await (0, rcc_1.getRobocorpHome)();
    const env = (0, rcc_1.createEnvWithRobocorpHome)(robocorpHome);
    await (0, files_1.makeDirs)(targetDir);
    try {
        const actionServerVersion = await actionServerVersionPromise;
        if (actionServerVersion === undefined) {
            const msg = "Cannot do `new` command (it was not possible to get the action server version).";
            channel_1.OUTPUT_CHANNEL.appendLine(msg);
            vscode_1.window.showErrorMessage(msg);
            return;
        }
        let cmdline = ["new", "--name", ".", "--template", "minimal"];
        const compare = (0, common_1.compareVersions)("0.10.0", actionServerVersion);
        if (compare > 0) {
            // old version installed (no --template available).
            cmdline = ["new", "--name", "."];
        }
        await (0, subprocess_1.execFilePromise)(actionServerLocation, cmdline, { "env": env, "cwd": targetDir });
        try {
            vscode_1.commands.executeCommand("workbench.files.action.refreshFilesExplorer");
        }
        catch (error) {
            (0, channel_1.logError)("Error refreshing file explorer.", error, "ACT_REFRESH_FILE_EXPLORER");
        }
        vscode_1.window.showInformationMessage("Action Package successfully created in:\n" + targetDir);
    }
    catch (err) {
        const errorMsg = "Error creating Action Package at: " + targetDir;
        (0, channel_1.logError)(errorMsg, err, "ERR_CREATE_ACTION_PACKAGE");
        channel_1.OUTPUT_CHANNEL.appendLine(errorMsg);
        vscode_1.window.showErrorMessage(errorMsg + " (see `OUTPUT > Robocorp Code` for more details).");
    }
}
exports.createActionPackage = createActionPackage;
//# sourceMappingURL=actionPackage.js.map