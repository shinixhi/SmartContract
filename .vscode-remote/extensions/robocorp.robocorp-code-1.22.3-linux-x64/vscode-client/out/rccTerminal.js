"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRccTerminal = exports.askAndCreateRccTerminal = void 0;
const vscode_1 = require("vscode");
const channel_1 = require("./channel");
const pathModule = require("path");
const activities_1 = require("./activities");
const rcc_1 = require("./rcc");
const subprocess_1 = require("./subprocess");
const robocorpSettings_1 = require("./robocorpSettings");
const pythonExtIntegration_1 = require("./pythonExtIntegration");
const fsModule = require("fs");
async function askAndCreateRccTerminal() {
    let robot = await (0, activities_1.listAndAskRobotSelection)("Please select the target Task Package for the terminal.", "Unable to create terminal (no Task Package detected in the Workspace).", { showActionPackages: true, showTaskPackages: true });
    if (robot) {
        await createRccTerminal(robot);
    }
}
exports.askAndCreateRccTerminal = askAndCreateRccTerminal;
async function createRccTerminal(robotInfo) {
    if (robotInfo) {
        async function startShell(progress) {
            const rccLocation = await (0, rcc_1.getRccLocation)();
            if (!rccLocation) {
                channel_1.OUTPUT_CHANNEL.appendLine("Unable to collect environment to create terminal with RCC:" +
                    rccLocation +
                    " for Package: " +
                    robotInfo.name);
                vscode_1.window.showErrorMessage("Unable to find RCC.");
                return;
            }
            let result = await (0, activities_1.resolveInterpreter)(robotInfo.filePath);
            if (!result.success) {
                vscode_1.window.showWarningMessage("Error resolving interpreter info: " + result.message);
                return;
            }
            let interpreter = result.result;
            if (!interpreter || !interpreter.pythonExe) {
                vscode_1.window.showWarningMessage("Unable to obtain interpreter information from: " + robotInfo.filePath);
                return;
            }
            channel_1.OUTPUT_CHANNEL.appendLine("Retrieved Python interpreter: " + interpreter.pythonExe);
            // If vscode-python is installed, we need to disable the terminal activation as it
            // conflicts with the robot environment.
            if ((0, robocorpSettings_1.getAutosetpythonextensiondisableactivateterminal)()) {
                await (0, pythonExtIntegration_1.disablePythonTerminalActivateEnvironment)();
            }
            let env = (0, subprocess_1.mergeEnviron)();
            // Update env to contain rcc location.
            if (interpreter.environ) {
                for (let key of Object.keys(interpreter.environ)) {
                    let value = interpreter.environ[key];
                    let isPath = false;
                    if (process.platform == "win32") {
                        key = key.toUpperCase();
                        if (key == "PATH") {
                            isPath = true;
                        }
                    }
                    else {
                        if (key == "PATH") {
                            isPath = true;
                        }
                    }
                    if (isPath) {
                        value = pathModule.dirname(rccLocation) + pathModule.delimiter + value;
                    }
                    env[key] = value;
                }
            }
            channel_1.OUTPUT_CHANNEL.appendLine("Retrieved environment: " + JSON.stringify(env, null, 2));
            channel_1.OUTPUT_CHANNEL.appendLine("Create terminal with RCC: " + rccLocation + " for Package: " + robotInfo.filePath);
            // We need to activate the RCC python environment after the terminal has spawned
            // This way we avoid the environment being overwritten by shell startup scripts
            // The Terminal env injection works if no overwrites happen
            if (process.platform.toString() === "win32") {
                // Making sure we create a CMD prompt in Windows as it can default to PowerShell
                // and the Python Environment activation fails
                const terminal = vscode_1.window.createTerminal({
                    name: robotInfo.name + " Package environment",
                    env: env,
                    cwd: pathModule.dirname(robotInfo.filePath),
                    message: "Robocorp Code Package Activated Interpreter (Python Environment)",
                    shellPath: "C:\\Windows\\System32\\cmd.exe",
                });
                const varsFilePath = pathModule.join(env.RCC_HOLOTREE_SPACE_ROOT, "environment_vars.bat");
                const envVarsContent = Object.keys(env)
                    .reduce((acc, key) => {
                    return `${acc}SET ${key}=${env[key]}\n`;
                }, "")
                    .trim();
                channel_1.OUTPUT_CHANNEL.appendLine("Create terminal with RCC: " + envVarsContent);
                fsModule.writeFileSync(varsFilePath, envVarsContent);
                terminal.sendText(`call ${varsFilePath}\n`);
                terminal.show();
            }
            else {
                // The shell in UNIX doesn't matter that much as the syntax to set the Python Environment is common
                const terminal = vscode_1.window.createTerminal({
                    name: robotInfo.name + " Package environment",
                    env: env,
                    cwd: pathModule.dirname(robotInfo.filePath),
                    message: "Robocorp Code Package Activated Interpreter (Python Environment)",
                });
                const varsFilePath = pathModule.join(env.RCC_HOLOTREE_SPACE_ROOT, "environment_vars.sh");
                const envVarsContent = Object.keys(env)
                    .reduce((acc, key) => {
                    return `${acc}export ${key}=${env[key]}\n`;
                }, "")
                    .trim();
                channel_1.OUTPUT_CHANNEL.appendLine("Create terminal with RCC: " + envVarsContent);
                fsModule.writeFileSync(varsFilePath, envVarsContent);
                terminal.sendText(`source ${varsFilePath}\n`);
                terminal.show();
            }
            channel_1.OUTPUT_CHANNEL.appendLine("Terminal created!");
            return undefined;
        }
        await vscode_1.window.withProgress({
            location: vscode_1.ProgressLocation.Notification,
            title: "Start RCC shell for: " + robotInfo.name,
            cancellable: false,
        }, startShell);
    }
}
exports.createRccTerminal = createRccTerminal;
//# sourceMappingURL=rccTerminal.js.map