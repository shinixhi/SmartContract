"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateLaunchEnvironmentPart0 = exports.updateLaunchEnvironment = exports.createRobot = exports.runRobotRCC = exports.askAndRunRobotRCC = exports.uploadRobot = exports.rccConfigurationDiagnostics = exports.setPythonInterpreterFromRobotYaml = exports.askRobotSelection = exports.listAndAskRobotSelection = exports.resolveInterpreter = exports.cloudLogout = exports.cloudLogin = void 0;
const vscode_1 = require("vscode");
const path_1 = require("path");
const channel_1 = require("./channel");
const roboCommands = require("./robocorpCommands");
const vscode = require("vscode");
const pythonExtIntegration = require("./pythonExtIntegration");
const ask_1 = require("./ask");
const rcc_1 = require("./rcc");
const viewsRobocorp_1 = require("./viewsRobocorp");
const outViewRunIntegration_1 = require("./output/outViewRunIntegration");
const vault_1 = require("./vault");
const common_1 = require("./common");
async function cloudLogin() {
    let loggedIn;
    do {
        let credentials = await vscode_1.window.showInputBox({
            "password": true,
            "prompt": "1. Press the Enter key to open Control Room and create a new access credential. 2. Paste the access credential in the field above ",
            "ignoreFocusOut": true,
        });
        if (credentials == undefined) {
            return false;
        }
        if (!credentials) {
            const cloudBaseUrl = await (0, rcc_1.getEndpointUrl)("cloud-ui");
            vscode_1.env.openExternal(vscode_1.Uri.parse(cloudBaseUrl + "settings/access-credentials"));
            continue;
        }
        let commandResult = await vscode_1.commands.executeCommand(roboCommands.ROBOCORP_CLOUD_LOGIN_INTERNAL, {
            "credentials": credentials,
        });
        if (!commandResult) {
            loggedIn = false;
        }
        else {
            loggedIn = commandResult.success;
        }
        if (!loggedIn) {
            let retry = "Retry with new credentials";
            let selectedItem = await vscode_1.window.showWarningMessage("Unable to log in with the provided credentials.", { "modal": true }, retry);
            if (!selectedItem) {
                return false;
            }
        }
    } while (!loggedIn);
    const doConnectToWorkspace = await (0, ask_1.showSelectOneStrQuickPick)(["Yes", "No"], "Linked account. Connect to a workspace to access related Vault Secrets and Storage?");
    if (doConnectToWorkspace === "Yes") {
        const checkLogin = false; // no need to check login, we just logged in.
        await (0, vault_1.connectWorkspace)(checkLogin);
    }
    return true;
}
exports.cloudLogin = cloudLogin;
async function cloudLogout() {
    let loggedOut;
    let isLoginNeededActionResult = await vscode_1.commands.executeCommand(roboCommands.ROBOCORP_IS_LOGIN_NEEDED_INTERNAL);
    if (!isLoginNeededActionResult) {
        vscode_1.window.showInformationMessage("Error getting information if already linked in.");
        return;
    }
    if (isLoginNeededActionResult.result) {
        vscode_1.window.showInformationMessage("Unable to unlink and remove credentials from Control Room. Current Control Room credentials are not valid.");
        (0, viewsRobocorp_1.refreshCloudTreeView)();
        return;
    }
    let YES = "Unlink";
    const result = await vscode_1.window.showWarningMessage(`Are you sure you want to unlink and remove credentials from Control Room?`, { "modal": true }, YES);
    if (result !== YES) {
        return;
    }
    loggedOut = await vscode_1.commands.executeCommand(roboCommands.ROBOCORP_CLOUD_LOGOUT_INTERNAL);
    if (!loggedOut) {
        vscode_1.window.showInformationMessage("Error unlinking and removing Control Room credentials.");
        return;
    }
    if (!loggedOut.success) {
        vscode_1.window.showInformationMessage("Unable to unlink and remove Control Room credentials.");
        return;
    }
    vscode_1.window.showInformationMessage("Control Room credentials successfully unlinked and removed.");
}
exports.cloudLogout = cloudLogout;
/**
 * Note that callers need to check both whether it was successful as well as if the interpreter was resolved.
 */
async function resolveInterpreter(targetRobot) {
    // Note: this may also activate robotframework-lsp if it's still not activated
    // (so, it cannot be used during startup as there'd be a cyclic dependency).
    try {
        let interpreter = await vscode_1.commands.executeCommand("robot.resolveInterpreter", targetRobot);
        if (interpreter === null || (typeof interpreter === "string" && interpreter === "null")) {
            throw Error("Interpreter not found. Retrying call...");
        }
        return { "success": true, "message": "", "result": interpreter };
    }
    catch (error) {
        // We couldn't resolve with the robotframework language server command, fallback to the robocorp code command.
        try {
            let interpreter = await vscode_1.commands.executeCommand(roboCommands.ROBOCORP_RESOLVE_INTERPRETER, {
                "target_robot": targetRobot,
            });
            if (interpreter === null || (typeof interpreter === "string" && interpreter === "null")) {
                throw Error("Interpreter not found");
            }
            return interpreter;
        }
        catch (error) {
            (0, channel_1.logError)("Error resolving interpreter.", error, "ACT_RESOLVE_INTERPRETER");
            return { "success": false, "message": "Unable to resolve interpreter.", "result": undefined };
        }
    }
}
exports.resolveInterpreter = resolveInterpreter;
async function listAndAskRobotSelection(selectionMessage, noRobotErrorMessage, opts) {
    let actionResult = await vscode_1.commands.executeCommand(roboCommands.ROBOCORP_LOCAL_LIST_ROBOTS_INTERNAL);
    if (!actionResult.success) {
        vscode_1.window.showInformationMessage("Error listing robots: " + actionResult.message);
        return;
    }
    let robotsInfo = actionResult.result;
    if (!robotsInfo || robotsInfo.length == 0) {
        vscode_1.window.showInformationMessage(noRobotErrorMessage);
        return;
    }
    const filter = (entry) => {
        const isActionPkg = (0, common_1.isActionPackage)(entry);
        const isTaskPackage = !isActionPkg;
        if (!opts.showActionPackages && isActionPkg) {
            return false;
        }
        if (!opts.showTaskPackages && isTaskPackage) {
            return false;
        }
        return true;
    };
    robotsInfo = robotsInfo.filter(filter);
    if (!robotsInfo || robotsInfo.length == 0) {
        vscode_1.window.showInformationMessage(noRobotErrorMessage);
        return;
    }
    let robot = await askRobotSelection(robotsInfo, selectionMessage);
    if (!robot) {
        return;
    }
    return robot;
}
exports.listAndAskRobotSelection = listAndAskRobotSelection;
async function askRobotSelection(robotsInfo, message) {
    let robot;
    if (robotsInfo.length > 1) {
        let captions = new Array();
        for (let i = 0; i < robotsInfo.length; i++) {
            const element = robotsInfo[i];
            let caption = {
                "label": element.name,
                "description": element.directory,
                "action": element,
            };
            captions.push(caption);
        }
        let selectedItem = await (0, ask_1.showSelectOneQuickPick)(captions, message);
        if (!selectedItem) {
            return;
        }
        robot = selectedItem.action;
    }
    else {
        robot = robotsInfo[0];
    }
    return robot;
}
exports.askRobotSelection = askRobotSelection;
async function askAndCreateNewRobotAtWorkspace(wsInfo, directory) {
    let robotName = await vscode_1.window.showInputBox({
        "prompt": "Please provide the name for the new Robot.",
        "ignoreFocusOut": true,
    });
    if (!robotName) {
        return;
    }
    let actionResult = await vscode_1.commands.executeCommand(roboCommands.ROBOCORP_UPLOAD_TO_NEW_ROBOT_INTERNAL, {
        "workspaceId": wsInfo.workspaceId,
        "directory": directory,
        "robotName": robotName,
    });
    if (!actionResult.success) {
        let msg = "Error uploading to new Robot: " + actionResult.message;
        channel_1.OUTPUT_CHANNEL.appendLine(msg);
        vscode_1.window.showErrorMessage(msg);
    }
    else {
        vscode_1.window.showInformationMessage("Successfully submitted new Robot " + robotName + " to the Control Room.");
    }
}
async function setPythonInterpreterFromRobotYaml() {
    let actionResult = await vscode_1.commands.executeCommand(roboCommands.ROBOCORP_LOCAL_LIST_ROBOTS_INTERNAL);
    if (!actionResult.success) {
        vscode_1.window.showInformationMessage("Error listing existing packages: " + actionResult.message);
        return;
    }
    let robotsInfo = actionResult.result;
    if (!robotsInfo || robotsInfo.length == 0) {
        vscode_1.window.showInformationMessage("Unable to set Python extension interpreter (no Action nor Task Package detected in the Workspace).");
        return;
    }
    let robot = await askRobotSelection(robotsInfo, "Please select the Action or Task Package from which the python executable should be used.");
    if (!robot) {
        return;
    }
    try {
        let result = await resolveInterpreter(robot.filePath);
        if (!result.success) {
            vscode_1.window.showWarningMessage("Error resolving interpreter info: " + result.message);
            return;
        }
        let interpreter = result.result;
        if (!interpreter || !interpreter.pythonExe) {
            vscode_1.window.showWarningMessage("Unable to obtain interpreter information from: " + robot.filePath);
            return;
        }
        // Note: if we got here we have a robot in the workspace.
        await pythonExtIntegration.setPythonInterpreterForPythonExtension(interpreter.pythonExe, vscode_1.Uri.file(robot.filePath));
        let resource = vscode_1.Uri.file((0, path_1.dirname)(robot.filePath));
        let pythonExecutableConfigured = await pythonExtIntegration.getPythonExecutable(resource);
        if (pythonExecutableConfigured == "config") {
            vscode_1.window.showInformationMessage("Successfully set python executable path for vscode-python.");
        }
        else if (!pythonExecutableConfigured) {
            vscode_1.window.showInformationMessage("Unable to verify if vscode-python executable was properly set. See OUTPUT -> Robocorp Code for more info.");
        }
        else {
            if (pythonExecutableConfigured != interpreter.pythonExe) {
                let opt1 = "Copy python path to clipboard and call vscode-python command to set interpreter";
                let opt2 = "Open more info/instructions to opt-out of the pythonDeprecadePythonPath experiment";
                let selectedItem = await vscode_1.window.showQuickPick([opt1, opt2, "Cancel"], {
                    "canPickMany": false,
                    "placeHolder": "Unable to set the interpreter (due to pythonDeprecatePythonPath experiment). How to proceed?",
                    "ignoreFocusOut": true,
                });
                if (selectedItem == opt1) {
                    await vscode.env.clipboard.writeText(interpreter.pythonExe);
                    await vscode_1.commands.executeCommand("python.setInterpreter");
                }
                else if (selectedItem == opt2) {
                    vscode_1.env.openExternal(vscode_1.Uri.parse("https://github.com/microsoft/vscode-python/wiki/AB-Experiments#pythondeprecatepythonpath"));
                }
            }
            else {
                vscode_1.window.showInformationMessage("Successfully set python executable path for vscode-python.");
            }
        }
    }
    catch (error) {
        (0, channel_1.logError)("Error setting interpreter in python extension configuration.", error, "ACT_SETTING_PYTHON_PYTHONPATH");
        vscode_1.window.showWarningMessage("Error setting interpreter in python extension configuration: " + error.message);
        return;
    }
}
exports.setPythonInterpreterFromRobotYaml = setPythonInterpreterFromRobotYaml;
async function rccConfigurationDiagnostics() {
    let actionResult = await vscode_1.commands.executeCommand(roboCommands.ROBOCORP_LOCAL_LIST_ROBOTS_INTERNAL);
    if (!actionResult.success) {
        vscode_1.window.showInformationMessage("Error listing robots: " + actionResult.message);
        return;
    }
    let robotsInfo = actionResult.result;
    if (robotsInfo) {
        // Only use task packages.
        robotsInfo = robotsInfo.filter((r) => {
            return !(0, common_1.isActionPackage)(r);
        });
    }
    if (!robotsInfo || robotsInfo.length == 0) {
        vscode_1.window.showInformationMessage("No Task Package detected in the Workspace. If a robot.yaml is available, open it for more information.");
        return;
    }
    let robot = await askRobotSelection(robotsInfo, "Please select the Task Package to analyze.");
    if (!robot) {
        return;
    }
    let diagnosticsActionResult = await vscode_1.commands.executeCommand(roboCommands.ROBOCORP_CONFIGURATION_DIAGNOSTICS_INTERNAL, { "robotYaml": robot.filePath });
    if (!diagnosticsActionResult.success) {
        vscode_1.window.showErrorMessage("Error computing diagnostics for Task Package: " + diagnosticsActionResult.message);
        return;
    }
    channel_1.OUTPUT_CHANNEL.appendLine(diagnosticsActionResult.result);
    vscode_1.workspace.openTextDocument({ "content": diagnosticsActionResult.result }).then((document) => {
        vscode_1.window.showTextDocument(document);
    });
}
exports.rccConfigurationDiagnostics = rccConfigurationDiagnostics;
async function uploadRobot(robot) {
    // Start this in parallel while we ask the user for info.
    let isLoginNeededPromise = vscode_1.commands.executeCommand(roboCommands.ROBOCORP_IS_LOGIN_NEEDED_INTERNAL);
    let currentUri;
    if (vscode_1.window.activeTextEditor && vscode_1.window.activeTextEditor.document) {
        currentUri = vscode_1.window.activeTextEditor.document.uri;
    }
    let actionResult = await vscode_1.commands.executeCommand(roboCommands.ROBOCORP_LOCAL_LIST_ROBOTS_INTERNAL);
    if (!actionResult.success) {
        vscode_1.window.showInformationMessage("Error submitting Task Package (Robot) to Control Room: " + actionResult.message);
        return;
    }
    let robotsInfo = actionResult.result;
    if (robotsInfo) {
        robotsInfo = robotsInfo.filter((r) => {
            return !(0, common_1.isActionPackage)(r);
        });
    }
    if (!robotsInfo || robotsInfo.length == 0) {
        vscode_1.window.showInformationMessage("Unable to submit Task Package (Robot) to Control Room (no Task Package detected in the Workspace).");
        return;
    }
    let isLoginNeededActionResult = await isLoginNeededPromise;
    if (!isLoginNeededActionResult) {
        vscode_1.window.showInformationMessage("Error getting if login is needed.");
        return;
    }
    if (isLoginNeededActionResult.result) {
        let loggedIn = await cloudLogin();
        if (!loggedIn) {
            return;
        }
    }
    if (!robot) {
        robot = await askRobotSelection(robotsInfo, "Please select the Task Package (Robot) to upload to the Control Room.");
        if (!robot) {
            return;
        }
    }
    let refresh = false;
    SELECT_OR_REFRESH: do {
        let workspaceSelection = await (0, ask_1.selectWorkspace)("Please select a Workspace to upload ‘" + robot.name + "’ to.", refresh);
        if (workspaceSelection === undefined) {
            return;
        }
        const workspaceInfo = workspaceSelection.workspaceInfo;
        const workspaceIdFilter = workspaceSelection.selectedWorkspaceInfo.workspaceId;
        // -------------------------------------------------------
        // Select Robot/New Robot/Refresh
        // -------------------------------------------------------
        let captions = new Array();
        for (let i = 0; i < workspaceInfo.length; i++) {
            const wsInfo = workspaceInfo[i];
            if (workspaceIdFilter != wsInfo.workspaceId) {
                continue;
            }
            for (let j = 0; j < wsInfo.packages.length; j++) {
                const robotInfo = wsInfo.packages[j];
                const wsDesc = (0, ask_1.getWorkspaceDescription)(wsInfo);
                // i.e.: Show the Robots with the same name with more priority in the list.
                let sortKey = "b" + wsDesc;
                if (robotInfo.name == robot.name) {
                    sortKey = "a" + wsDesc;
                }
                let caption = {
                    "label": "$(file) " + robotInfo.name,
                    "description": "(Workspace: " + wsDesc + ")",
                    "sortKey": sortKey,
                    "action": { "existingRobotPackage": robotInfo },
                };
                captions.push(caption);
            }
            const wsDesc = (0, ask_1.getWorkspaceDescription)(wsInfo);
            let caption = {
                "label": "$(new-folder) + Create new Robot",
                "description": "(Workspace: " + wsDesc + ")",
                "sortKey": "c" + wsDesc,
                "action": { "newRobotPackageAtWorkspace": wsInfo },
            };
            captions.push(caption);
        }
        let caption = {
            "label": "$(refresh) * Refresh list",
            "description": "Expected Workspace or Robot is not appearing.",
            "sortKey": "d",
            "action": { "refresh": true },
        };
        captions.push(caption);
        (0, ask_1.sortCaptions)(captions);
        let selectedItem = await (0, ask_1.showSelectOneQuickPick)(captions, "Update an existing Robot or create a new one.");
        if (!selectedItem) {
            return;
        }
        let action = selectedItem.action;
        if (action.refresh) {
            refresh = true;
            continue SELECT_OR_REFRESH;
        }
        if (action.newRobotPackageAtWorkspace) {
            // No confirmation in this case
            let wsInfo = action.newRobotPackageAtWorkspace;
            await askAndCreateNewRobotAtWorkspace(wsInfo, robot.directory);
            return;
        }
        if (action.existingRobotPackage) {
            let yesOverride = "Yes";
            let noChooseDifferentTarget = "No";
            let cancel = "Cancel";
            let robotInfo = action.existingRobotPackage;
            let updateExistingCaptions = new Array();
            let caption = {
                "label": yesOverride,
                "detail": "Override existing Robot",
                "action": yesOverride,
            };
            updateExistingCaptions.push(caption);
            caption = {
                "label": noChooseDifferentTarget,
                "detail": "Go back to choose a different Robot to update",
                "action": noChooseDifferentTarget,
            };
            updateExistingCaptions.push(caption);
            caption = {
                "label": cancel,
                "detail": "Cancel the Robot upload",
                "action": cancel,
            };
            updateExistingCaptions.push(caption);
            let selectedItem = await (0, ask_1.showSelectOneQuickPick)(updateExistingCaptions, "This will overwrite the robot ‘" + robotInfo.name + "’ on Control Room. Are you sure? ");
            // robot.language-server.python
            if (selectedItem.action == noChooseDifferentTarget) {
                refresh = false;
                continue SELECT_OR_REFRESH;
            }
            if (selectedItem.action == cancel) {
                return;
            }
            // selectedItem == yesOverride.
            let actionResult = await vscode_1.commands.executeCommand(roboCommands.ROBOCORP_UPLOAD_TO_EXISTING_ROBOT_INTERNAL, { "workspaceId": robotInfo.workspaceId, "robotId": robotInfo.id, "directory": robot.directory });
            if (!actionResult.success) {
                let msg = "Error uploading to existing Robot: " + actionResult.message;
                channel_1.OUTPUT_CHANNEL.appendLine(msg);
                vscode_1.window.showErrorMessage(msg);
            }
            else {
                vscode_1.window.showInformationMessage("Successfully submitted Robot " + robot.name + " to the cloud.");
            }
            return;
        }
    } while (true);
}
exports.uploadRobot = uploadRobot;
async function askAndRunRobotRCC(noDebug) {
    let textEditor = vscode_1.window.activeTextEditor;
    let fileName = undefined;
    if (textEditor) {
        fileName = textEditor.document.fileName;
    }
    const RUN_IN_RCC_LRU_CACHE_NAME = "RUN_IN_RCC_LRU_CACHE";
    let runLRU = await vscode_1.commands.executeCommand(roboCommands.ROBOCORP_LOAD_FROM_DISK_LRU, {
        "name": RUN_IN_RCC_LRU_CACHE_NAME,
    });
    let actionResult = await vscode_1.commands.executeCommand(roboCommands.ROBOCORP_LOCAL_LIST_ROBOTS_INTERNAL);
    if (!actionResult.success) {
        vscode_1.window.showErrorMessage("Error listing Task Packages (Robots): " + actionResult.message);
        return;
    }
    let robotsInfo = actionResult.result;
    if (robotsInfo) {
        robotsInfo = robotsInfo.filter((r) => {
            return !(0, common_1.isActionPackage)(r);
        });
    }
    if (!robotsInfo || robotsInfo.length == 0) {
        vscode_1.window.showInformationMessage("Unable to run Task Package (Robot) (no Task Package detected in the Workspace).");
        return;
    }
    let items = new Array();
    for (let robotInfo of robotsInfo) {
        let yamlContents = robotInfo.yamlContents;
        let tasks = yamlContents["tasks"];
        if (tasks) {
            let taskNames = Object.keys(tasks);
            for (let taskName of taskNames) {
                let keyInLRU = robotInfo.name + " - " + taskName + " - " + robotInfo.filePath;
                let item = {
                    "label": "Run robot: " + robotInfo.name + "    Task: " + taskName,
                    "description": robotInfo.filePath,
                    "robotYaml": robotInfo.filePath,
                    "taskName": taskName,
                    "keyInLRU": keyInLRU,
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
    if (!items) {
        vscode_1.window.showInformationMessage("Unable to run Task Package (Robot) (no Task Package detected in the Workspace).");
        return;
    }
    let selectedItem;
    if (items.length == 1) {
        selectedItem = items[0];
    }
    else {
        selectedItem = await vscode_1.window.showQuickPick(items, {
            "canPickMany": false,
            "placeHolder": "Please select the Task Package (Robot) and Task to run.",
            "ignoreFocusOut": true,
        });
    }
    if (!selectedItem) {
        return;
    }
    await vscode_1.commands.executeCommand(roboCommands.ROBOCORP_SAVE_IN_DISK_LRU, {
        "name": RUN_IN_RCC_LRU_CACHE_NAME,
        "entry": selectedItem.keyInLRU,
        "lru_size": 3,
    });
    runRobotRCC(noDebug, selectedItem.robotYaml, selectedItem.taskName);
}
exports.askAndRunRobotRCC = askAndRunRobotRCC;
async function runRobotRCC(noDebug, robotYaml, taskName) {
    let debugConfiguration = {
        "name": "Config",
        "type": "robocorp-code",
        "request": "launch",
        "robot": robotYaml,
        "task": taskName,
        "args": [],
        "noDebug": noDebug,
    };
    let debugSessionOptions = {};
    vscode_1.debug.startDebugging(undefined, debugConfiguration, debugSessionOptions);
}
exports.runRobotRCC = runRobotRCC;
async function createRobot() {
    // Start up async calls.
    let asyncListRobotTemplates = vscode_1.commands.executeCommand(roboCommands.ROBOCORP_LIST_ROBOT_TEMPLATES_INTERNAL);
    const robotsInWorkspacePromise = (0, common_1.areThereRobotsInWorkspace)();
    let ws = await (0, ask_1.askForWs)();
    if (!ws) {
        // Operation cancelled.
        return;
    }
    if (await (0, common_1.isDirectoryAPackageDirectory)(ws.uri)) {
        return;
    }
    // Unfortunately vscode does not have a good way to request multiple inputs at once,
    // so, for now we're asking each at a separate step.
    let actionResultListRobotTemplatesInternal = await asyncListRobotTemplates;
    if (!actionResultListRobotTemplatesInternal.success) {
        (0, rcc_1.feedbackRobocorpCodeError)("ACT_LIST_ROBOT_TEMPLATE");
        vscode_1.window.showErrorMessage("Unable to list Task Package templates: " + actionResultListRobotTemplatesInternal.message);
        return;
    }
    let availableTemplates = actionResultListRobotTemplatesInternal.result;
    if (!availableTemplates) {
        (0, rcc_1.feedbackRobocorpCodeError)("ACT_NO_ROBOT_TEMPLATE");
        vscode_1.window.showErrorMessage("Unable to create Task Package (the Task Package templates could not be loaded).");
        return;
    }
    let selectedItem = await vscode_1.window.showQuickPick(availableTemplates.map((robotTemplate) => robotTemplate.description), {
        "canPickMany": false,
        "placeHolder": "Please select the template for the Task Package.",
        "ignoreFocusOut": true,
    });
    const selectedRobotTemplate = availableTemplates.find((robotTemplate) => robotTemplate.description === selectedItem);
    channel_1.OUTPUT_CHANNEL.appendLine("Selected: " + selectedRobotTemplate?.description);
    if (!selectedRobotTemplate) {
        // Operation cancelled.
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
                "detail": "The workspace will only have a single Task Package.",
            },
            {
                "label": "Use child folder in workspace (advanced)",
                "detail": "Multiple Task Packages can be created in this workspace.",
            },
        ], {
            "placeHolder": "Where do you want to create the Task Package?",
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
            "prompt": "Please provide the name for the Task Package (Robot) folder name.",
            "ignoreFocusOut": true,
        });
        if (!name) {
            // Operation cancelled.
            return;
        }
        targetDir = (0, path_1.join)(targetDir, name);
    }
    // Now, let's validate if we can indeed create a Robot in the given folder.
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
    channel_1.OUTPUT_CHANNEL.appendLine("Creating Task Package (Robot) at: " + targetDir);
    let createRobotResult = await vscode_1.commands.executeCommand(roboCommands.ROBOCORP_CREATE_ROBOT_INTERNAL, { "directory": targetDir, "template": selectedRobotTemplate.name, "force": force });
    if (createRobotResult.success) {
        try {
            vscode_1.commands.executeCommand("workbench.files.action.refreshFilesExplorer");
        }
        catch (error) {
            (0, channel_1.logError)("Error refreshing file explorer.", error, "ACT_REFRESH_FILE_EXPLORER");
        }
        vscode_1.window.showInformationMessage("Task Package (Robot) successfully created in:\n" + targetDir);
    }
    else {
        channel_1.OUTPUT_CHANNEL.appendLine("Error creating Task Package (Robot) at: " + targetDir);
        vscode_1.window.showErrorMessage(createRobotResult.message);
    }
}
exports.createRobot = createRobot;
async function updateLaunchEnvironment(args) {
    channel_1.OUTPUT_CHANNEL.appendLine(`updateLaunchEnvironment for ${args["targetRobot"]}.`);
    let newEnv;
    try {
        newEnv = await updateLaunchEnvironmentPart0(args);
    }
    catch (error) {
        let msg = "It was not possible to build the Robot launch environment for the launch.";
        if (error && error.message) {
            msg += ` (${error.message})`;
        }
        msg += "See OUTPUT > Robocorp Code for more details.";
        vscode_1.window.showErrorMessage(msg);
        (0, channel_1.logError)("Error computing launch env.", error, "ERROR_LAUNCH_ENV");
        throw error;
    }
    if (newEnv !== "cancelled") {
        try {
            // Ok, also check for pre-run scripts.
            const hasPreRunScripts = await vscode_1.commands.executeCommand(roboCommands.ROBOCORP_HAS_PRE_RUN_SCRIPTS_INTERNAL, {
                "robot": args["targetRobot"],
            });
            if (hasPreRunScripts) {
                channel_1.OUTPUT_CHANNEL.appendLine(`preRunScripts found for ${args["targetRobot"]}.`);
                const runPreRunScripts = async () => await vscode_1.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: "Running preRunScripts (see 'OUTPUT > Robocorp Code' for details).",
                    cancellable: false,
                }, async (progress, token) => {
                    let result = await vscode_1.commands.executeCommand(roboCommands.ROBOCORP_RUN_PRE_RUN_SCRIPTS_INTERNAL, {
                        "robot": args["targetRobot"],
                        "env": newEnv,
                    });
                    if (result) {
                        if (!result["success"]) {
                            channel_1.OUTPUT_CHANNEL.show();
                            vscode_1.window.showErrorMessage("There was a problem running preRunScripts. See `OUTPUT > Robocorp Code` for more details.");
                        }
                    }
                });
                await runPreRunScripts();
            }
            else {
                channel_1.OUTPUT_CHANNEL.appendLine(`preRunScripts NOT found for ${args["targetRobot"]}.`);
            }
        }
        catch (error) {
            (0, channel_1.logError)("Error checking or executing preRunScripts.", error, "ERR_PRE_RUN_SCRIPTS");
        }
    }
    return newEnv;
}
exports.updateLaunchEnvironment = updateLaunchEnvironment;
async function updateLaunchEnvironmentPart0(args) {
    let robot = args["targetRobot"];
    // Note: the 'robot' may not be the robot.yaml, it may be a .robot or a .py
    // which is about to be launched (the robot.yaml must be derived from it).
    let environment = args["env"];
    if (!robot) {
        throw new Error("robot argument is required.");
    }
    if (environment === undefined) {
        throw new Error("env argument is required.");
    }
    let condaPrefix = environment["CONDA_PREFIX"];
    if (!condaPrefix) {
        channel_1.OUTPUT_CHANNEL.appendLine("Unable to update launch environment for work items because CONDA_PREFIX is not available in the environment:\n" +
            JSON.stringify(environment));
        return environment;
    }
    // Note: we need to update the environment for:
    // - Vault
    // - Work items
    let newEnv = { ...environment };
    for (const [key, val] of outViewRunIntegration_1.envVarsForOutViewIntegration) {
        newEnv[key] = val;
    }
    let vaultInfoActionResult = await vscode_1.commands.executeCommand(roboCommands.ROBOCORP_GET_CONNECTED_VAULT_WORKSPACE_INTERNAL);
    if (vaultInfoActionResult?.success) {
        const vaultInfo = vaultInfoActionResult.result;
        if (vaultInfo?.workspaceId) {
            // The workspace vault is connected, so, we must authorize it...
            let vaultInfoEnvActionResult = await vscode_1.commands.executeCommand(roboCommands.ROBOCORP_UPDATE_LAUNCH_ENV_GET_VAULT_ENV_INTERNAL);
            if (!vaultInfoEnvActionResult.success) {
                throw new Error("It was not possible to connect to the vault while launching for: " +
                    (0, ask_1.getWorkspaceDescription)(vaultInfo) +
                    ".\nDetails: " +
                    vaultInfoEnvActionResult.message);
            }
            for (const [key, value] of Object.entries(vaultInfoEnvActionResult.result)) {
                newEnv[key] = value;
            }
        }
    }
    let workItemsActionResult = await vscode_1.commands.executeCommand(roboCommands.ROBOCORP_LIST_WORK_ITEMS_INTERNAL, { "robot": robot, "increment_output": true });
    if (!workItemsActionResult || !workItemsActionResult.success) {
        channel_1.OUTPUT_CHANNEL.appendLine(`Unable to get work items: ${JSON.stringify(workItemsActionResult)}`);
        return newEnv;
    }
    let result = workItemsActionResult.result;
    if (!result) {
        return newEnv;
    }
    // Let's verify that the library is available and has the version we expect.
    let libraryVersionInfoActionResult;
    try {
        libraryVersionInfoActionResult = await vscode_1.commands.executeCommand(roboCommands.ROBOCORP_VERIFY_LIBRARY_VERSION_INTERNAL, {
            "conda_prefix": condaPrefix,
            "libs_and_version": [
                ["rpaframework", "11.3"],
                ["robocorp-workitems", "0.0.1"], // Any version will do
            ],
        });
    }
    catch (error) {
        (0, channel_1.logError)("Error updating launch environment.", error, "ACT_UPDATE_LAUNCH_ENV");
        return newEnv;
    }
    if (!libraryVersionInfoActionResult["success"]) {
        channel_1.OUTPUT_CHANNEL.appendLine("Launch environment for work items not updated. Reason: " + libraryVersionInfoActionResult.message);
        return newEnv;
    }
    // If we have found the robot, we should have the result and thus we should always set the
    // RPA_OUTPUT_WORKITEM_PATH (even if we don't have any input, we'll set to where we want
    // to save items).
    newEnv["RPA_OUTPUT_WORKITEM_PATH"] = result.new_output_workitem_path;
    newEnv["RPA_WORKITEMS_ADAPTER"] = "RPA.Robocorp.WorkItems.FileAdapter";
    const input_work_items = result.input_work_items;
    const output_work_items = result.output_work_items;
    if (input_work_items.length > 0 || output_work_items.length > 0) {
        // If we have any input for this Robot, present it to the user.
        let items = []; // Note: just use the action as a 'data'.
        let noWorkItemLabel = "<No work item as input>";
        items.push({
            "label": "<No work item as input>",
            "action": undefined,
        });
        for (const it of input_work_items) {
            items.push({
                "label": it.name,
                "detail": "Input",
                "action": it.json_path,
            });
        }
        for (const it of output_work_items) {
            items.push({
                "label": it.name,
                "detail": "Output",
                "action": it.json_path,
            });
        }
        let selectedItem = await (0, ask_1.showSelectOneQuickPick)(items, "Please select the work item input to be used by RPA.Robocorp.WorkItems.");
        if (!selectedItem) {
            return "cancelled";
        }
        if (selectedItem.label === noWorkItemLabel) {
            return newEnv;
        }
        // No need to await.
        (0, rcc_1.feedback)("vscode.workitem.input.selected");
        newEnv["RPA_INPUT_WORKITEM_PATH"] = selectedItem.action;
    }
    return newEnv;
}
exports.updateLaunchEnvironmentPart0 = updateLaunchEnvironmentPart0;
//# sourceMappingURL=activities.js.map