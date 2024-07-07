/*
Original work Copyright (c) Microsoft Corporation (MIT)
See ThirdPartyNotices.txt in the project root for license information.
All modifications Copyright (c) Robocorp Technologies Inc.
All rights reserved.

Licensed under the Apache License, Version 2.0 (the "License")
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http: // www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLanguageServerPythonInfo = exports.deactivate = exports.doActivate = exports.activate = exports.GLOBAL_STATE = exports.globalCachedPythonInfo = exports.langServer = void 0;
const net = require("net");
const path = require("path");
const vscode = require("vscode");
const cp = require("child_process");
const vscode_1 = require("vscode");
const vscode_languageclient_1 = require("vscode-languageclient");
const node_1 = require("vscode-languageclient/node");
const playwright = require("./playwright");
const locators_1 = require("./locators");
const views = require("./views");
const roboConfig = require("./robocorpSettings");
const channel_1 = require("./channel");
const files_1 = require("./files");
const rcc_1 = require("./rcc");
const time_1 = require("./time");
const activities_1 = require("./activities");
const progress_1 = require("./progress");
const robocorpViews_1 = require("./robocorpViews");
const rccTerminal_1 = require("./rccTerminal");
const viewsRobotContent_1 = require("./viewsRobotContent");
const viewsWorkItems_1 = require("./viewsWorkItems");
const viewsCommon_1 = require("./viewsCommon");
const robocorpCommands_1 = require("./robocorpCommands");
const pythonExtIntegration_1 = require("./pythonExtIntegration");
const viewsRobocorp_1 = require("./viewsRobocorp");
const vault_1 = require("./vault");
const extensionCreateEnv_1 = require("./extensionCreateEnv");
const debugger_1 = require("./debugger");
const clear_1 = require("./clear");
const mutex_1 = require("./mutex");
const subprocess_1 = require("./subprocess");
const rcc_2 = require("./rcc");
const submitIssue_1 = require("./submitIssue");
const conversionView_1 = require("./conversionView");
const profiles_1 = require("./profiles");
const linkProvider_1 = require("./robo/linkProvider");
const runRobocorpTasks_1 = require("./robo/runRobocorpTasks");
const outView_1 = require("./output/outView");
const outViewRunIntegration_1 = require("./output/outViewRunIntegration");
const inspectorView_1 = require("./inspector/inspectorView");
const protocols_1 = require("./inspector/protocols");
const actionServer_1 = require("./actionServer");
const actionPackage_1 = require("./robo/actionPackage");
const ask_1 = require("./ask");
const clientOptions = {
    documentSelector: [
        { language: "json", pattern: "**/locators.json" },
        { language: "yaml", pattern: "**/conda.yaml" },
        { language: "yaml", pattern: "**/action-server.yaml" },
        { language: "yaml", pattern: "**/robot.yaml" },
        { language: "yaml", pattern: "**/package.yaml" },
        // Needed to detect tasks decorated with @task (from robocorp.tasks).
        // Needed to detect actions decorated with @action (from robocorp.actions).
        { language: "python", pattern: "**/*.py" },
    ],
    synchronize: {
        configurationSection: "robocorp",
    },
    outputChannel: channel_1.OUTPUT_CHANNEL,
};
const serverOptions = async function () {
    let executableAndEnv;
    function onNoPython() {
        channel_1.OUTPUT_CHANNEL.appendLine("Unable to activate Robocorp Code extension because python executable from RCC environment was not provided.\n" +
            " -- Most common reason is that the environment couldn't be created due to network connectivity issues.\n" +
            " -- Please fix the error and restart VSCode.");
        C.useErrorStubs = true;
        notifyOfInitializationErrorShowOutputTab();
    }
    try {
        // Note: we need to get it even in the case where we connect through a socket
        // as the debugger needs it afterwards to do other launches.
        executableAndEnv = await getLanguageServerPythonInfo();
        if (!executableAndEnv) {
            throw new Error("Unable to get language server python info.");
        }
    }
    catch (error) {
        onNoPython();
        (0, channel_1.logError)("Error getting Python", error, "INIT_PYTHON_ERR");
        throw error;
    }
    channel_1.OUTPUT_CHANNEL.appendLine("Using python executable: " + executableAndEnv.pythonExe);
    let port = roboConfig.getLanguageServerTcpPort();
    if (port) {
        // For TCP server needs to be started seperately
        channel_1.OUTPUT_CHANNEL.appendLine("Connecting to language server in port: " + port);
        return new Promise((resolve, reject) => {
            var client = new net.Socket();
            client.setTimeout(2000, reject);
            try {
                client.connect(port, "127.0.0.1", function () {
                    resolve({
                        reader: client,
                        writer: client,
                    });
                });
            }
            catch (error) {
                reject(error);
            }
        });
    }
    else {
        let targetFile = (0, files_1.getExtensionRelativeFile)("../../src/robocorp_code/__main__.py");
        if (!targetFile) {
            channel_1.OUTPUT_CHANNEL.appendLine("Error resolving ../../src/robocorp_code/__main__.py");
            C.useErrorStubs = true;
            notifyOfInitializationErrorShowOutputTab();
            (0, rcc_1.feedbackRobocorpCodeError)("INIT_MAIN_NOT_FOUND");
            return;
        }
        let args = ["-u", targetFile];
        let lsArgs = roboConfig.getLanguageServerArgs();
        if (lsArgs && lsArgs.length >= 1) {
            args = args.concat(lsArgs);
        }
        else {
            // Default is using simple verbose mode (shows critical/info but not debug).
            args = args.concat(["-v"]);
        }
        channel_1.OUTPUT_CHANNEL.appendLine("Starting Robocorp Code with args: " + executableAndEnv.pythonExe + " " + args.join(" "));
        let src = path.resolve(__dirname, "../../src");
        let executableAndEnvEnviron = {};
        if (executableAndEnv.environ) {
            executableAndEnvEnviron = executableAndEnv.environ;
        }
        let finalEnv = (0, subprocess_1.mergeEnviron)({ ...executableAndEnvEnviron, PYTHONPATH: src });
        const serverProcess = cp.spawn(executableAndEnv.pythonExe, args, {
            env: finalEnv,
            cwd: path.dirname(executableAndEnv.pythonExe),
        });
        if (!serverProcess || !serverProcess.pid) {
            throw new Error(`Launching server using command ${executableAndEnv.pythonExe} with args: ${args} failed.`);
        }
        return serverProcess;
    }
};
async function notifyOfInitializationErrorShowOutputTab(msg) {
    channel_1.OUTPUT_CHANNEL.show();
    if (!msg) {
        msg = "Unable to activate Robocorp Code extension. Please see: Output > Robocorp Code for more details.";
    }
    vscode_1.window.showErrorMessage(msg);
    const selection = await vscode_1.window.showErrorMessage(msg, "Show Output > Robocorp Code");
    if (selection) {
        channel_1.OUTPUT_CHANNEL.show();
    }
}
class CommandRegistry {
    constructor(context) {
        this.registerErrorStubs = false;
        this.useErrorStubs = false;
        this.errorMessage = undefined;
        this.context = context;
    }
    registerWithoutStub(command, callback, thisArg) {
        this.context.subscriptions.push(vscode_1.commands.registerCommand(command, callback));
    }
    /**
     * Registers with a stub so that an error may be shown if the initialization didn't work.
     */
    register(command, callback, thisArg) {
        const that = this;
        async function redirect() {
            if (that.useErrorStubs) {
                notifyOfInitializationErrorShowOutputTab(that.errorMessage);
            }
            else {
                return await callback.apply(thisArg, arguments);
            }
        }
        this.context.subscriptions.push(vscode_1.commands.registerCommand(command, redirect));
    }
}
async function verifyRobotFrameworkInstalled() {
    // No longer tries to check whether RFLS is installed (not required for Python).
    // if (!roboConfig.getVerifylsp()) {
    //     return;
    // }
    // const ROBOT_EXTENSION_ID = "robocorp.robotframework-lsp";
    // let found = true;
    // try {
    //     let extension = extensions.getExtension(ROBOT_EXTENSION_ID);
    //     if (!extension) {
    //         found = false;
    //     }
    // } catch (error) {
    //     found = false;
    // }
    // if (!found) {
    //     // It seems it's not installed, install?
    //     let install = "Install";
    //     let dontAsk = "Don't ask again";
    //     let chosen = await window.showInformationMessage(
    //         "It seems that the Robot Framework Language Server extension is not installed to work with .robot Files.",
    //         install,
    //         dontAsk
    //     );
    //     if (chosen == install) {
    //         await commands.executeCommand("workbench.extensions.search", ROBOT_EXTENSION_ID);
    //     } else if (chosen == dontAsk) {
    //         roboConfig.setVerifylsp(false);
    //     }
    // }
}
async function cloudLoginShowConfirmationAndRefresh() {
    let loggedIn = await (0, activities_1.cloudLogin)();
    if (loggedIn) {
        vscode_1.window.showInformationMessage("Successfully logged in Control Room.");
    }
    (0, viewsRobocorp_1.refreshCloudTreeView)();
}
async function cloudLogoutAndRefresh() {
    await (0, activities_1.cloudLogout)();
    (0, viewsRobocorp_1.refreshCloudTreeView)();
}
function registerRobocorpCodeCommands(C, context) {
    C.register(robocorpCommands_1.ROBOCORP_START_ACTION_SERVER, actionServer_1.startActionServer);
    C.register(robocorpCommands_1.ROBOCORP_GET_LANGUAGE_SERVER_PYTHON, () => getLanguageServerPython());
    C.register(robocorpCommands_1.ROBOCORP_GET_LANGUAGE_SERVER_PYTHON_INFO, () => getLanguageServerPythonInfo());
    C.register(robocorpCommands_1.ROBOCORP_CREATE_ROBOT, () => (0, activities_1.createRobot)());
    C.register(robocorpCommands_1.ROBOCORP_CREATE_ACTION_PACKAGE, () => (0, actionPackage_1.createActionPackage)());
    C.register(robocorpCommands_1.ROBOCORP_CREATE_TASK_OR_ACTION_PACKAGE, async () => {
        const TASK_PACKAGE = "Task Package (Robot)";
        const ACTION_PACKAGE = "Action Package";
        const packageType = await (0, ask_1.showSelectOneStrQuickPick)([TASK_PACKAGE, ACTION_PACKAGE], "Which kind of Package would you like to create?");
        if (packageType) {
            if (packageType === TASK_PACKAGE) {
                (0, activities_1.createRobot)();
            }
            else if (packageType === ACTION_PACKAGE) {
                (0, actionPackage_1.createActionPackage)();
            }
        }
    });
    C.register(robocorpCommands_1.ROBOCORP_DOWNLOAD_ACTION_SERVER, async () => {
        try {
            const location = await (0, actionServer_1.downloadLatestActionServer)();
            vscode_1.window.showInformationMessage(`The latest action server was downloaded to: ${location}`);
        }
        catch (error) {
            (0, channel_1.logError)("Error downloading latest action server", error, "ERR_DOWNLOAD_ACTION_SERVER");
            vscode_1.window.showErrorMessage("There was an error downloading the action server. See `OUTPUT > Robocorp Code` for more information.");
        }
    });
    C.register(robocorpCommands_1.ROBOCORP_UPLOAD_ROBOT_TO_CLOUD, () => (0, activities_1.uploadRobot)());
    C.register(robocorpCommands_1.ROBOCORP_CONFIGURATION_DIAGNOSTICS, () => (0, activities_1.rccConfigurationDiagnostics)());
    C.register(robocorpCommands_1.ROBOCORP_RUN_ROBOT_RCC, () => (0, activities_1.askAndRunRobotRCC)(true));
    C.register(robocorpCommands_1.ROBOCORP_DEBUG_ROBOT_RCC, () => (0, activities_1.askAndRunRobotRCC)(false));
    C.register(robocorpCommands_1.ROBOCORP_RUN_ACTION_FROM_ACTION_PACKAGE, () => (0, actionPackage_1.askAndRunRobocorpActionFromActionPackage)(true));
    C.register(robocorpCommands_1.ROBOCORP_DEBUG_ACTION_FROM_ACTION_PACKAGE, () => (0, actionPackage_1.askAndRunRobocorpActionFromActionPackage)(false));
    C.register(robocorpCommands_1.ROBOCORP_SET_PYTHON_INTERPRETER, () => (0, activities_1.setPythonInterpreterFromRobotYaml)());
    C.register(robocorpCommands_1.ROBOCORP_REFRESH_ROBOTS_VIEW, () => (0, viewsCommon_1.refreshTreeView)(robocorpViews_1.TREE_VIEW_ROBOCORP_TASK_PACKAGES_TREE));
    C.register(robocorpCommands_1.ROBOCORP_REFRESH_CLOUD_VIEW, () => (0, viewsRobocorp_1.refreshCloudTreeView)());
    C.register(robocorpCommands_1.ROBOCORP_ROBOTS_VIEW_TASK_RUN, (entry) => views.runSelectedRobot(true, entry));
    C.register(robocorpCommands_1.ROBOCORP_ROBOTS_VIEW_TASK_DEBUG, (entry) => views.runSelectedRobot(false, entry));
    C.register(robocorpCommands_1.ROBOCORP_ROBOTS_VIEW_ACTION_RUN, (entry) => views.runSelectedAction(true, entry));
    C.register(robocorpCommands_1.ROBOCORP_ROBOTS_VIEW_ACTION_DEBUG, (entry) => views.runSelectedAction(false, entry));
    C.register(robocorpCommands_1.ROBOCORP_ROBOTS_VIEW_ACTION_EDIT_INPUT, (entry) => views.editInput(entry));
    C.register(robocorpCommands_1.ROBOCORP_ROBOTS_VIEW_ACTION_OPEN, (entry) => views.openAction(entry));
    C.register(robocorpCommands_1.ROBOCORP_RUN_ROBOCORPS_PYTHON_TASK, (args) => (0, runRobocorpTasks_1.runRobocorpTasks)(true, args));
    C.register(robocorpCommands_1.ROBOCORP_DEBUG_ROBOCORPS_PYTHON_TASK, (args) => (0, runRobocorpTasks_1.runRobocorpTasks)(false, args));
    C.register(robocorpCommands_1.ROBOCORP_EDIT_ROBOCORP_INSPECTOR_LOCATOR, (locator) => {
        return (0, inspectorView_1.showInspectorUI)(context, protocols_1.IAppRoutes.LOCATORS_MANAGER);
    });
    C.register(robocorpCommands_1.ROBOCORP_OPEN_PLAYWRIGHT_RECORDER, (useTreeSelected = false) => playwright.openPlaywrightRecorder(useTreeSelected));
    C.register(robocorpCommands_1.ROBOCORP_COPY_LOCATOR_TO_CLIPBOARD_INTERNAL, (locator) => (0, locators_1.copySelectedToClipboard)(locator));
    C.register(robocorpCommands_1.ROBOCORP_REMOVE_LOCATOR_FROM_JSON, (locator) => (0, locators_1.removeLocator)(locator));
    C.register(robocorpCommands_1.ROBOCORP_OPEN_ROBOT_TREE_SELECTION, (robot) => views.openRobotTreeSelection(robot));
    C.register(robocorpCommands_1.ROBOCORP_OPEN_ROBOT_CONDA_TREE_SELECTION, (robot) => views.openRobotCondaTreeSelection(robot));
    C.register(robocorpCommands_1.ROBOCORP_OPEN_PACKAGE_YAML_TREE_SELECTION, (robot) => views.openPackageTreeSelection(robot));
    C.register(robocorpCommands_1.ROBOCORP_OPEN_LOCATORS_JSON, (locatorRoot) => views.openLocatorsJsonTreeSelection());
    C.register(robocorpCommands_1.ROBOCORP_CLOUD_UPLOAD_ROBOT_TREE_SELECTION, (robot) => views.cloudUploadRobotTreeSelection(robot));
    C.register(robocorpCommands_1.ROBOCORP_OPEN_FLOW_EXPLORER_TREE_SELECTION, (robot) => vscode_1.commands.executeCommand("robot.openFlowExplorer", vscode_1.Uri.file(robot.robot.directory).toString()));
    C.register(robocorpCommands_1.ROBOCORP_CONVERT_PROJECT, async () => await (0, conversionView_1.showConvertUI)(context));
    C.register(robocorpCommands_1.ROBOCORP_CREATE_RCC_TERMINAL_TREE_SELECTION, (robot) => views.createRccTerminalTreeSelection(robot));
    C.register(robocorpCommands_1.ROBOCORP_RCC_TERMINAL_NEW, () => (0, rccTerminal_1.askAndCreateRccTerminal)());
    C.register(robocorpCommands_1.ROBOCORP_REFRESH_ROBOT_CONTENT_VIEW, () => (0, viewsCommon_1.refreshTreeView)(robocorpViews_1.TREE_VIEW_ROBOCORP_PACKAGE_CONTENT_TREE));
    C.register(robocorpCommands_1.ROBOCORP_NEW_FILE_IN_ROBOT_CONTENT_VIEW, viewsRobotContent_1.newFileInRobotContentTree);
    C.register(robocorpCommands_1.ROBOCORP_NEW_FOLDER_IN_ROBOT_CONTENT_VIEW, viewsRobotContent_1.newFolderInRobotContentTree);
    C.register(robocorpCommands_1.ROBOCORP_DELETE_RESOURCE_IN_ROBOT_CONTENT_VIEW, viewsRobotContent_1.deleteResourceInRobotContentTree);
    C.register(robocorpCommands_1.ROBOCORP_RENAME_RESOURCE_IN_ROBOT_CONTENT_VIEW, viewsRobotContent_1.renameResourceInRobotContentTree);
    C.register(robocorpCommands_1.ROBOCORP_UPDATE_LAUNCH_ENV, activities_1.updateLaunchEnvironment);
    C.register(robocorpCommands_1.ROBOCORP_CONNECT_WORKSPACE, vault_1.connectWorkspace);
    C.register(robocorpCommands_1.ROBOCORP_DISCONNECT_WORKSPACE, vault_1.disconnectWorkspace);
    C.register(robocorpCommands_1.ROBOCORP_OPEN_CLOUD_HOME, async () => {
        const cloudBaseUrl = await (0, rcc_1.getEndpointUrl)("cloud-ui");
        vscode_1.commands.executeCommand("vscode.open", vscode_1.Uri.parse(cloudBaseUrl + "home"));
    });
    C.register(robocorpCommands_1.ROBOCORP_OPEN_VAULT_HELP, async () => {
        const cloudBaseUrl = await (0, rcc_1.getEndpointUrl)("docs");
        vscode_1.commands.executeCommand("vscode.open", vscode_1.Uri.parse(cloudBaseUrl + "development-guide/variables-and-secrets/vault"));
    });
    C.register(robocorpCommands_1.ROBOCORP_OPEN_EXTERNALLY, async (item) => {
        if (item.filePath) {
            if (await (0, files_1.fileExists)(item.filePath)) {
                vscode_1.env.openExternal(vscode_1.Uri.file(item.filePath));
                return;
            }
        }
        vscode_1.window.showErrorMessage("Unable to open: " + item.filePath + " (file does not exist).");
    });
    C.register(robocorpCommands_1.ROBOCORP_OPEN_IN_VS_CODE, async (item) => {
        if (item.filePath) {
            if (await (0, files_1.fileExists)(item.filePath)) {
                vscode_1.commands.executeCommand("vscode.open", vscode_1.Uri.file(item.filePath));
                return;
            }
        }
        vscode_1.window.showErrorMessage("Unable to open: " + item.filePath + " (file does not exist).");
    });
    C.register(robocorpCommands_1.ROBOCORP_REVEAL_IN_EXPLORER, async (item) => {
        if (item.filePath) {
            if (await (0, files_1.fileExists)(item.filePath)) {
                vscode_1.commands.executeCommand("revealFileInOS", vscode_1.Uri.file(item.filePath));
                return;
            }
        }
        vscode_1.window.showErrorMessage("Unable to reveal in explorer: " + item.filePath + " (file does not exist).");
    });
    C.register(robocorpCommands_1.ROBOCORP_REVEAL_ROBOT_IN_EXPLORER, async (item) => {
        if (item.uri) {
            if (await (0, files_1.uriExists)(item.uri)) {
                vscode_1.commands.executeCommand("revealFileInOS", item.uri);
                return;
            }
        }
        vscode_1.window.showErrorMessage("Unable to reveal in explorer: " + item.uri + " (Robot does not exist).");
    });
    C.register(robocorpCommands_1.ROBOCORP_CONVERT_OUTPUT_WORK_ITEM_TO_INPUT, viewsWorkItems_1.convertOutputWorkItemToInput);
    C.register(robocorpCommands_1.ROBOCORP_CLOUD_LOGIN, () => cloudLoginShowConfirmationAndRefresh());
    C.register(robocorpCommands_1.ROBOCORP_CLOUD_LOGOUT, () => cloudLogoutAndRefresh());
    C.register(robocorpCommands_1.ROBOCORP_NEW_WORK_ITEM_IN_WORK_ITEMS_VIEW, viewsWorkItems_1.newWorkItemInWorkItemsTree);
    C.register(robocorpCommands_1.ROBOCORP_DELETE_WORK_ITEM_IN_WORK_ITEMS_VIEW, viewsWorkItems_1.deleteWorkItemInWorkItemsTree);
    C.register(robocorpCommands_1.ROBOCORP_HELP_WORK_ITEMS, viewsWorkItems_1.openWorkItemHelp);
    C.register(robocorpCommands_1.ROBOCORP_PROFILE_IMPORT, async () => await (0, profiles_1.profileImport)());
    C.register(robocorpCommands_1.ROBOCORP_PROFILE_SWITCH, async () => await (0, profiles_1.profileSwitch)());
}
async function clearEnvAndRestart() {
    await vscode_1.window.withProgress({
        location: vscode.ProgressLocation.Window,
        title: "Clearing environments and restarting Robocorp Code.",
        cancellable: false,
    }, clearEnvsAndRestart);
}
async function clearEnvsAndRestart(progress) {
    let allOk = true;
    let okToRestartRFLS = false;
    try {
        await langServerMutex.dispatch(async () => {
            let result = await clearEnvsLocked(progress);
            if (!result) {
                // Something didn't work out...
                return;
            }
            okToRestartRFLS = result["okToRestartRFLS"];
        });
        const timing = new time_1.Timing();
        progress.report({
            "message": `Waiting for Robocorp Code to be ready.`,
        });
        await exports.langServer.onReady();
        let msg = "Restarted Robocorp Code. Took: " + timing.getTotalElapsedAsStr();
        progress.report({
            "message": msg,
        });
        channel_1.OUTPUT_CHANNEL.appendLine(msg);
    }
    catch (err) {
        allOk = false;
        const msg = "Error restarting Robocorp Code";
        notifyOfInitializationErrorShowOutputTab(msg);
        (0, channel_1.logError)(msg, err, "INIT_RESTART_ROBOCORP_CODE");
    }
    finally {
        if (allOk) {
            vscode_1.window.showInformationMessage("RCC Environments cleared and Robocorp Code restarted.");
            C.useErrorStubs = false;
        }
        else {
            C.useErrorStubs = true;
        }
        if (okToRestartRFLS) {
            progress.report({
                "message": `Starting Robot Framework Language Server.`,
            });
            await vscode_1.commands.executeCommand("robot.clearCachesAndRestartProcesses.finish.internal");
        }
    }
}
async function clearEnvsLocked(progress) {
    const rccLocation = await (0, rcc_1.getRccLocation)();
    if (!rccLocation) {
        let msg = "Unable to clear caches because RCC is not available.";
        channel_1.OUTPUT_CHANNEL.appendLine(msg);
        vscode_1.window.showErrorMessage(msg);
        return undefined;
    }
    const robocorpHome = await (0, rcc_1.getRobocorpHome)();
    progress.report({
        "message": `Computing environments to collect.`,
    });
    const envsToLoCollect = await (0, clear_1.computeEnvsToCollect)(rccLocation, robocorpHome);
    // Clear our cache since we're killing that environment...
    exports.globalCachedPythonInfo = undefined;
    C.useErrorStubs = true; // Prevent any calls while restarting...
    C.errorMessage = "Unable to use Robocorp Code actions while clearing environments.";
    let okToRestartRFLS = false;
    try {
        let timing = new time_1.Timing();
        const extension = vscode_1.extensions.getExtension("robocorp.robotframework-lsp");
        if (extension) {
            progress.report({
                "message": `Stopping Robot Framework Language Server.`,
            });
            // In this case we also need to stop the language server.
            okToRestartRFLS = await vscode_1.commands.executeCommand("robot.clearCachesAndRestartProcesses.start.internal");
            channel_1.OUTPUT_CHANNEL.appendLine("Stopped Robot Framework Language Server. Took: " + timing.getTotalElapsedAsStr());
        }
        let timingStop = new time_1.Timing();
        progress.report({
            "message": `Stopping Robocorp Code.`,
        });
        await exports.langServer.stop();
        channel_1.OUTPUT_CHANNEL.appendLine("Stopped Robocorp Code. Took: " + timingStop.getTotalElapsedAsStr());
        if (envsToLoCollect) {
            await (0, clear_1.clearRCCEnvironments)(rccLocation, robocorpHome, envsToLoCollect, progress);
        }
        try {
            progress.report({
                "message": `Clearing Robocorp Code caches.`,
            });
            await (0, clear_1.clearRobocorpCodeCaches)(robocorpHome);
        }
        catch (error) {
            let msg = "Error clearing Robocorp Code caches.";
            (0, channel_1.logError)(msg, error, "RCC_CLEAR_ENV");
        }
        progress.report({
            "message": `Starting Robocorp Code.`,
        });
        exports.langServer.start();
    }
    finally {
        C.errorMessage = undefined;
    }
    return { "okToRestartRFLS": okToRestartRFLS };
}
let C;
const langServerMutex = new mutex_1.Mutex();
exports.GLOBAL_STATE = undefined;
async function activate(context) {
    exports.GLOBAL_STATE = context.globalState;
    let timing = new time_1.Timing();
    channel_1.OUTPUT_CHANNEL.appendLine("Activating Robocorp Code extension.");
    (0, linkProvider_1.registerLinkProviders)(context);
    C = new CommandRegistry(context);
    try {
        return await langServerMutex.dispatch(async () => {
            let ret = await doActivate(context, C);
            channel_1.OUTPUT_CHANNEL.appendLine("Robocorp Code initialization finished. Took: " + timing.getTotalElapsedAsStr());
            return ret;
        });
    }
    catch (error) {
        (0, channel_1.logError)("Error initializing Robocorp Code extension", error, "INIT_ROBOCORP_CODE_ERROR");
        C.useErrorStubs = true;
        notifyOfInitializationErrorShowOutputTab();
    }
}
exports.activate = activate;
async function doActivate(context, C) {
    // Note: register the submit issue actions early on so that we can later actually
    // report startup errors.
    C.registerWithoutStub(robocorpCommands_1.ROBOCORP_SUBMIT_ISSUE, async () => {
        await (0, submitIssue_1.showSubmitIssueUI)(context);
    });
    // register Inspector applications
    C.registerWithoutStub(robocorpCommands_1.ROBOCORP_INSPECTOR, async () => {
        await (0, inspectorView_1.showInspectorUI)(context, protocols_1.IAppRoutes.LOCATORS_MANAGER);
    });
    C.registerWithoutStub(robocorpCommands_1.ROBOCORP_INSPECTOR_DUPLICATE, async () => {
        await (0, inspectorView_1.showInspectorUI)(context, protocols_1.IAppRoutes.LOCATORS_MANAGER);
    });
    C.register(robocorpCommands_1.ROBOCORP_NEW_ROBOCORP_INSPECTOR_BROWSER, async () => await (0, inspectorView_1.showInspectorUI)(context, protocols_1.IAppRoutes.WEB_INSPECTOR));
    C.register(robocorpCommands_1.ROBOCORP_NEW_ROBOCORP_INSPECTOR_WINDOWS, async () => await (0, inspectorView_1.showInspectorUI)(context, protocols_1.IAppRoutes.WINDOWS_INSPECTOR));
    C.register(robocorpCommands_1.ROBOCORP_NEW_ROBOCORP_INSPECTOR_IMAGE, async () => await (0, inspectorView_1.showInspectorUI)(context, protocols_1.IAppRoutes.IMAGE_INSPECTOR));
    C.register(robocorpCommands_1.ROBOCORP_NEW_ROBOCORP_INSPECTOR_JAVA, async () => await (0, inspectorView_1.showInspectorUI)(context, protocols_1.IAppRoutes.JAVA_INSPECTOR));
    // i.e.: allow other extensions to also use our submit issue api.
    C.registerWithoutStub(robocorpCommands_1.ROBOCORP_SUBMIT_ISSUE_INTERNAL, (dialogMessage, email, errorName, errorCode, errorMessage, files) => (0, rcc_1.submitIssue)(dialogMessage, email, errorName, errorCode, errorMessage, files));
    C.registerWithoutStub(robocorpCommands_1.ROBOCORP_SHOW_OUTPUT, () => channel_1.OUTPUT_CHANNEL.show());
    C.registerWithoutStub(robocorpCommands_1.ROBOCORP_SHOW_INTERPRETER_ENV_ERROR, async (params) => {
        const fileWithError = params.fileWithError;
        vscode.window.showTextDocument(vscode_1.Uri.file(fileWithError));
    });
    // i.e.: allow other extensions to also use our error feedback api.
    C.registerWithoutStub(robocorpCommands_1.ROBOCORP_ERROR_FEEDBACK_INTERNAL, (errorSource, errorCode) => (0, rcc_1.feedbackAnyError)(errorSource, errorCode));
    // i.e.: allow other extensions to also use our feedback api.
    C.registerWithoutStub(robocorpCommands_1.ROBOCORP_FEEDBACK_INTERNAL, (name, value) => (0, rcc_2.feedback)(name, value));
    C.register(robocorpCommands_1.ROBOCORP_PACKAGE_ENVIRONMENT_REBUILD, async () => {
        const selected = await (0, activities_1.listAndAskRobotSelection)("Please select the Task/Action Package for which you'd like to rebuild the environment", "Unable to continue because no Action Package was found in the workspace.", { showActionPackages: true, showTaskPackages: false });
        const result = await (0, activities_1.resolveInterpreter)(selected.filePath);
        if (result.success) {
            vscode.window.showInformationMessage(`Environment built & cached. Python interpreter loaded.`);
        }
        else {
            vscode.window.showErrorMessage(`Error resolving interpreter: ${result.message}`);
        }
    });
    C.registerWithoutStub(robocorpCommands_1.ROBOCORP_CLEAR_ENV_AND_RESTART, clearEnvAndRestart);
    // Register other commands (which will have an error message shown depending on whether
    // the extension was activated properly).
    registerRobocorpCodeCommands(C, context);
    const outputProvider = new outView_1.RobotOutputViewProvider(context);
    const options = { webviewOptions: { retainContextWhenHidden: true } };
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(outView_1.RobotOutputViewProvider.viewType, outputProvider, options));
    await (0, outViewRunIntegration_1.setupDebugSessionOutViewIntegration)(context);
    const extension = vscode_1.extensions.getExtension("robocorp.robotframework-lsp");
    if (extension) {
        // If the Robot Framework Language server is present, make sure it is compatible with this
        // version.
        try {
            const version = extension.packageJSON.version;
            const splitted = version.split(".");
            const major = parseInt(splitted[0]);
            const minor = parseInt(splitted[1]);
            const micro = parseInt(splitted[2]);
            if (major < 1 || (major == 1 && (minor < 7 || (minor == 7 && micro < 0)))) {
                const msg = "Unable to initialize the Robocorp Code extension because the Robot Framework Language Server version (" +
                    version +
                    ") is not compatible with this version of Robocorp Code. Robot Framework Language Server 1.7.0 or newer is required. Please update to proceed. ";
                channel_1.OUTPUT_CHANNEL.appendLine(msg);
                C.useErrorStubs = true;
                notifyOfInitializationErrorShowOutputTab(msg);
                return;
            }
        }
        catch (err) {
            (0, channel_1.logError)("Error verifying Robot Framework Language Server version.", err, "INIT_RF_TOO_OLD");
        }
    }
    vscode_1.workspace.onDidChangeConfiguration((event) => {
        for (let s of [
            roboConfig.ROBOCORP_LANGUAGE_SERVER_ARGS,
            roboConfig.ROBOCORP_LANGUAGE_SERVER_PYTHON,
            roboConfig.ROBOCORP_LANGUAGE_SERVER_TCP_PORT,
        ]) {
            if (event.affectsConfiguration(s)) {
                vscode_1.window
                    .showWarningMessage('Please use the "Reload Window" action for changes in ' + s + " to take effect.", ...["Reload Window"])
                    .then((selection) => {
                    if (selection === "Reload Window") {
                        vscode_1.commands.executeCommand("workbench.action.reloadWindow");
                    }
                });
                return;
            }
        }
    });
    let startLsTiming = new time_1.Timing();
    exports.langServer = new node_1.LanguageClient("Robocorp Code", serverOptions, clientOptions);
    context.subscriptions.push(exports.langServer.onDidChangeState((event) => {
        if (event.newState == vscode_languageclient_1.State.Running) {
            // i.e.: We need to register the customProgress as soon as it's running (we can't wait for onReady)
            // because at that point if there are open documents, lots of things may've happened already, in
            // which case the progress won't be shown on some cases where it should be shown.
            context.subscriptions.push(exports.langServer.onNotification("$/customProgress", (args) => {
                // OUTPUT_CHANNEL.appendLine(args.id + " - " + args.kind + " - " + args.title + " - " + args.message + " - " + args.increment);
                let progressReporter = (0, progress_1.handleProgressMessage)(args);
                if (progressReporter) {
                    if (args.kind == "begin") {
                        const progressId = args.id;
                        progressReporter.token.onCancellationRequested(() => {
                            exports.langServer.sendNotification("cancelProgress", { progressId: progressId });
                        });
                    }
                }
            }));
            context.subscriptions.push(exports.langServer.onNotification("$/linkedAccountChanged", () => {
                (0, viewsRobocorp_1.refreshCloudTreeView)();
            }));
            context.subscriptions.push(exports.langServer.onRequest("$/executeWorkspaceCommand", async (args) => {
                // OUTPUT_CHANNEL.appendLine(args.command + " - " + args.arguments);
                let ret;
                try {
                    ret = await vscode_1.commands.executeCommand(args.command, args.arguments);
                }
                catch (err) {
                    if (!(err.message && err.message.endsWith("not found"))) {
                        // Log if the error wasn't that the command wasn't found
                        (0, channel_1.logError)("Error executing workspace command.", err, "EXT_EXECUTE_WS_COMMAND");
                    }
                }
                return ret;
            }));
        }
    }));
    views.registerViews(context);
    (0, debugger_1.registerDebugger)();
    try {
        let disposable = exports.langServer.start();
        context.subscriptions.push(disposable);
        // i.e.: if we return before it's ready, the language server commands
        // may not be available.
        channel_1.OUTPUT_CHANNEL.appendLine("Waiting for Robocorp Code (python) language server to finish activating...");
        await exports.langServer.onReady();
        // If it started properly, mark that it worked.
        exports.GLOBAL_STATE.update(extensionCreateEnv_1.CACHE_KEY_LAST_WORKED, true);
        channel_1.OUTPUT_CHANNEL.appendLine("Took: " + startLsTiming.getTotalElapsedAsStr() + " to initialize Robocorp Code Language Server.");
    }
    catch (error) {
        (0, channel_1.logError)("Error initializing Robocorp code.", error, "ERROR_INITIALIZING_ROBOCORP_CODE_LANG_SERVER");
    }
    // Note: start the async ones below but don't await on them (the extension should be considered initialized
    // regardless of it -- as it may call robot.resolveInterpreter, it may need to activate the language
    // server extension, which in turn requires robocorp code to be activated already).
    (0, pythonExtIntegration_1.installWorkspaceWatcher)(context);
    verifyRobotFrameworkInstalled();
}
exports.doActivate = doActivate;
function deactivate() {
    if (!exports.langServer) {
        return undefined;
    }
    return exports.langServer.stop();
}
exports.deactivate = deactivate;
async function getLanguageServerPython() {
    let info = await getLanguageServerPythonInfo();
    if (!info) {
        return undefined;
    }
    return info.pythonExe;
}
// Helper to avoid 2 asyncs starting up the process to get the pyhon info.
let globalGetLanguageServerPythonInfoUncachedPromise;
async function getLanguageServerPythonInfo() {
    if (exports.globalCachedPythonInfo) {
        return exports.globalCachedPythonInfo;
    }
    if (globalGetLanguageServerPythonInfoUncachedPromise !== undefined) {
        return await globalGetLanguageServerPythonInfoUncachedPromise;
    }
    try {
        globalGetLanguageServerPythonInfoUncachedPromise = (0, extensionCreateEnv_1.getLanguageServerPythonInfoUncached)();
        let cachedPythonInfo;
        cachedPythonInfo = await globalGetLanguageServerPythonInfoUncachedPromise;
        if (!cachedPythonInfo) {
            return undefined; // Unable to get it.
        }
        // Ok, we got it (cache that info).
        exports.globalCachedPythonInfo = cachedPythonInfo;
    }
    finally {
        globalGetLanguageServerPythonInfoUncachedPromise = undefined;
    }
    return exports.globalCachedPythonInfo;
}
exports.getLanguageServerPythonInfo = getLanguageServerPythonInfo;
//# sourceMappingURL=extension.js.map