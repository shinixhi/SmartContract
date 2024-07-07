"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runRobocorpTasks = void 0;
const vscode_1 = require("vscode");
const channel_1 = require("../channel");
const robocorpCommands_1 = require("../robocorpCommands");
const path = require("path");
async function runRobocorpTasks(noDebug, args) {
    // Code lens should always make sure that the first arg is the .py
    // to be run.
    const targetPy = args[0];
    let debugConfiguration = {
        "name": "Python: Robocorp Tasks",
        "type": "python",
        "request": "launch",
        "module": "robocorp.tasks",
        "args": ["run"].concat(args),
        "justMyCode": true,
        "noDebug": noDebug,
        "cwd": path.dirname(targetPy),
    };
    let interpreterInfo = undefined;
    try {
        let result = await vscode_1.commands.executeCommand(robocorpCommands_1.ROBOCORP_RESOLVE_INTERPRETER, {
            "target_robot": targetPy,
        });
        if (result.success) {
            interpreterInfo = result["result"];
            debugConfiguration.env = interpreterInfo.environ;
            debugConfiguration.python = interpreterInfo.pythonExe;
        }
        else {
            (0, channel_1.logError)(result.message, undefined, "RESOLVE_INT_RUN_ROBOCORP_TASKS_1");
        }
    }
    catch (error) {
        (0, channel_1.logError)("Error resolving interpreter.", error, "RESOLVE_INT_RUN_ROBOCORP_TASKS_2");
    }
    // Overridde env variables in the launch config.
    if (interpreterInfo !== undefined) {
        try {
            let newEnv = await vscode_1.commands.executeCommand("robocorp.updateLaunchEnv", {
                "targetRobot": targetPy,
                "env": debugConfiguration.env,
            });
            if (newEnv == "cancelled") {
                channel_1.OUTPUT_CHANNEL.appendLine("Launch cancelled");
                return undefined;
            }
            debugConfiguration.env = newEnv;
        }
        catch (error) {
            // The command may not be available.
        }
    }
    let debugSessionOptions = {};
    vscode_1.debug.startDebugging(undefined, debugConfiguration, debugSessionOptions);
}
exports.runRobocorpTasks = runRobocorpTasks;
//# sourceMappingURL=runRobocorpTasks.js.map