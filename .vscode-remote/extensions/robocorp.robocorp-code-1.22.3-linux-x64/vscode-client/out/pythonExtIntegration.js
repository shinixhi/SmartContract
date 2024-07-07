"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPythonExecutable = exports.setPythonInterpreterForPythonExtension = exports.disablePythonTerminalActivateEnvironment = exports.installWorkspaceWatcher = exports.autoUpdateInterpreter = exports.isPythonFile = exports.isEnvironmentFile = void 0;
const vscode_1 = require("vscode");
const activities_1 = require("./activities");
const channel_1 = require("./channel");
const progress_1 = require("./progress");
const robocorpSettings_1 = require("./robocorpSettings");
const robocorpViews_1 = require("./robocorpViews");
const viewsCommon_1 = require("./viewsCommon");
const dirtyWorkspaceFiles = new Set();
function isEnvironmentFile(fsPath) {
    return (fsPath.endsWith("conda.yaml") ||
        fsPath.endsWith("action-server.yaml") ||
        fsPath.endsWith("package.yaml") ||
        fsPath.endsWith("robot.yaml"));
}
exports.isEnvironmentFile = isEnvironmentFile;
function isPythonFile(fsPath) {
    return fsPath.endsWith(".py");
}
exports.isPythonFile = isPythonFile;
async function autoUpdateInterpreter(docUri) {
    if (!(0, robocorpSettings_1.getAutosetpythonextensioninterpreter)()) {
        return false;
    }
    let result = await (0, activities_1.resolveInterpreter)(docUri.fsPath);
    if (!result.success) {
        return false;
    }
    let interpreter = result.result;
    if (!interpreter || !interpreter.pythonExe) {
        return false;
    }
    // Now, set the interpreter.
    let pythonExecutable = await getPythonExecutable(docUri, true, false);
    if (pythonExecutable != interpreter.pythonExe) {
        setPythonInterpreterForPythonExtension(interpreter.pythonExe, docUri);
    }
    const additional = interpreter.additionalPythonpathEntries;
    if (additional && additional.length > 0) {
        vscode_1.workspace.getConfiguration("python", docUri).update("analysis.extraPaths", additional.map((el) => {
            return el.replaceAll("\\", "/");
        }), vscode_1.ConfigurationTarget.WorkspaceFolder);
    }
    return true;
}
exports.autoUpdateInterpreter = autoUpdateInterpreter;
async function installWorkspaceWatcher(context) {
    // listen to editor change/switch (this should cause environment switching as well)
    const checkEditorSwitch = vscode_1.window.onDidChangeActiveTextEditor(async (event) => {
        try {
            // Whenever the active editor changes we update the Python interpreter used (if needed).
            let docURI = event?.document?.uri;
            if (docURI) {
                await autoUpdateInterpreter(docURI);
            }
        }
        catch (error) {
            (0, channel_1.logError)("Error auto-updating Python interpreter.", error, "PYTHON_SET_INTERPRETER");
        }
    });
    // listen for document changes and mark targeted files as dirty
    const checkIfFilesHaveChanged = vscode_1.workspace.onDidChangeTextDocument(async (event) => {
        let docURI = event.document.uri;
        if (event.document.isDirty && (isEnvironmentFile(docURI.fsPath) || isPythonFile(docURI.fsPath))) {
            dirtyWorkspaceFiles.add(docURI.fsPath);
        }
    });
    // listen for when documents are saved and check if the files of interest have changed
    const checkIfFilesWillBeSaved = vscode_1.workspace.onDidSaveTextDocument(async (document) => {
        try {
            let docURI = document.uri;
            if (docURI &&
                dirtyWorkspaceFiles.has(docURI.fsPath) &&
                (isEnvironmentFile(docURI.fsPath) || isPythonFile(docURI.fsPath))) {
                // let's refresh the view each time we get a hit on the files that might impact the workspace
                (0, viewsCommon_1.refreshTreeView)(robocorpViews_1.TREE_VIEW_ROBOCORP_TASK_PACKAGES_TREE);
                dirtyWorkspaceFiles.delete(docURI.fsPath);
                // if environment file has changed, let's ask the user if he wants to update the env
                if (isEnvironmentFile(docURI.fsPath)) {
                    vscode_1.window
                        .showInformationMessage("Changes were detected in the package configuration. Would you like to rebuild the environment?", "Yes", "No")
                        .then(async (selection) => {
                        if (selection === "Yes") {
                            const result = await autoUpdateInterpreter(docURI);
                            if (result) {
                                vscode_1.window.showInformationMessage(`Environment built & cached. Python interpreter loaded.`);
                            }
                            else {
                                vscode_1.window.showErrorMessage(`Failed to Auto Update the Python Interpreter`);
                            }
                        }
                    });
                }
            }
        }
        catch (error) {
            (0, channel_1.logError)("Error auto-updating Python interpreter.", error, "PYTHON_SET_INTERPRETER");
        }
    });
    // create the appropriate subscriptions
    context.subscriptions.push(checkEditorSwitch, checkIfFilesHaveChanged, checkIfFilesWillBeSaved);
    // update the interpreter at start time
    try {
        let docURI = vscode_1.window.activeTextEditor?.document?.uri;
        if (docURI) {
            await autoUpdateInterpreter(docURI);
        }
    }
    catch (error) {
        (0, channel_1.logError)("Error on initial Python interpreter auto-update.", error, "PYTHON_INITIAL_SET_INTERPRETER");
    }
}
exports.installWorkspaceWatcher = installWorkspaceWatcher;
async function disablePythonTerminalActivateEnvironment() {
    try {
        const extension = vscode_1.extensions.getExtension("ms-python.python");
        if (!extension) {
            return;
        }
        let configurationTarget = vscode_1.ConfigurationTarget.Workspace;
        let config = vscode_1.workspace.getConfiguration("python");
        await config.update("terminal.activateEnvironment", false, configurationTarget);
    }
    catch (error) {
        (0, channel_1.logError)("Error disabling python terminal activate environment.", error, "PYTHON_DISABLE_TERMINAL_ACTIVATE_ENVIRONMENT");
    }
}
exports.disablePythonTerminalActivateEnvironment = disablePythonTerminalActivateEnvironment;
async function setPythonInterpreterForPythonExtension(pythonExe, uri) {
    const extension = vscode_1.extensions.getExtension("ms-python.python");
    if (!extension) {
        return;
    }
    // Note: always set it in the workspace!
    let configurationTarget = vscode_1.ConfigurationTarget.Workspace;
    channel_1.OUTPUT_CHANNEL.appendLine("Setting the python executable path for vscode-python to be:\n" + pythonExe);
    if (extension?.exports?.environment?.setActiveEnvironment !== undefined) {
        await extension.exports.environment.setActiveEnvironment(pythonExe, uri);
        // OUTPUT_CHANNEL.appendLine("Is: " + (await extension.exports.environment.getActiveInterpreterPath(uri)));
    }
    else {
        if (extension?.exports?.environment?.setActiveInterpreter !== undefined) {
            await extension.exports.environment.setActiveInterpreter(pythonExe, uri);
            // OUTPUT_CHANNEL.appendLine("Is: " + (await extension.exports.environment.getActiveInterpreterPath(uri)));
        }
        else {
            let config = vscode_1.workspace.getConfiguration("python");
            await config.update("defaultInterpreterPath", pythonExe, configurationTarget);
            try {
                await vscode_1.commands.executeCommand("python.clearWorkspaceInterpreter");
            }
            catch (err) {
                (0, channel_1.logError)("Error calling python.clearWorkspaceInterpreter", err, "ACT_CLEAR_PYTHON_WORKSPACE_INTERPRETER");
            }
        }
    }
}
exports.setPythonInterpreterForPythonExtension = setPythonInterpreterForPythonExtension;
async function getPythonExecutable(resource = null, forceLoadFromConfig = false, showInOutput = true) {
    try {
        const extension = vscode_1.extensions.getExtension("ms-python.python");
        if (!extension) {
            channel_1.OUTPUT_CHANNEL.appendLine("Unable to get python executable from vscode-python. ms-python.python extension not found.");
            return undefined;
        }
        const usingNewInterpreterStorage = extension.packageJSON?.featureFlags?.usingNewInterpreterStorage;
        if (usingNewInterpreterStorage) {
            // Note: just this in not enough to know if the user is actually using the new API
            // (i.e.: he may not be in the experiment).
            if (!extension.isActive) {
                const id = "activate-vscode-python-" + Date.now();
                (0, progress_1.handleProgressMessage)({
                    kind: "begin",
                    id: id,
                    title: "Waiting for vscode-python activation...",
                });
                try {
                    await extension.activate();
                }
                finally {
                    (0, progress_1.handleProgressMessage)({
                        kind: "end",
                        id: id,
                    });
                }
            }
            let execCommand = extension.exports.settings.getExecutionDetails(resource).execCommand;
            if (showInOutput) {
                channel_1.OUTPUT_CHANNEL.appendLine("vscode-python execution details: " + execCommand);
            }
            if (!execCommand) {
                channel_1.OUTPUT_CHANNEL.appendLine("vscode-python did not return proper execution details.");
                return undefined;
            }
            if (execCommand instanceof Array) {
                // It could be some composite command such as conda activate, but that's ok, we don't want to consider those
                // a match for our use-case.
                return execCommand.join(" ");
            }
            return execCommand;
        }
        else {
            // Not using new interpreter storage (so, it should be queried from the settings).
            if (!forceLoadFromConfig) {
                return "config";
            }
            let config = vscode_1.workspace.getConfiguration("python");
            return await config.get("defaultInterpreterPath");
        }
    }
    catch (error) {
        (0, channel_1.logError)("Error when querying about python executable path from vscode-python.", error, "PYTHON_EXT_NO_PYTHON_EXECUTABLE");
        return undefined;
    }
}
exports.getPythonExecutable = getPythonExecutable;
//# sourceMappingURL=pythonExtIntegration.js.map