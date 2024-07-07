"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.openPlaywrightRecorder = void 0;
const viewsCommon_1 = require("./viewsCommon");
const activities_1 = require("./activities");
const channel_1 = require("./channel");
const vscode_1 = require("vscode");
const robocorpCommands_1 = require("./robocorpCommands");
async function openPlaywrightRecorder(useTreeSelected = false) {
    let currentUri = undefined;
    if (!useTreeSelected && vscode_1.window.activeTextEditor && vscode_1.window.activeTextEditor.document) {
        currentUri = vscode_1.window.activeTextEditor.document.uri;
    }
    if (!currentUri) {
        // User doesn't have a current editor opened, get from the tree
        // selection.
        let selectedEntry = (0, viewsCommon_1.getSelectedRobot)();
        let robot = selectedEntry?.robot;
        if (robot === undefined) {
            // Ask for the robot to be used and then show dialog with the options.
            robot = await (0, activities_1.listAndAskRobotSelection)("Please select the Task or Action Package where the locators should be saved.", "Unable to open Inspector (no Task or Action Package detected in the Workspace).", { showActionPackages: true, showTaskPackages: true });
            if (!robot) {
                return;
            }
        }
        currentUri = vscode_1.Uri.file(robot.filePath);
    }
    if (!currentUri) {
        vscode_1.window.showErrorMessage("Unable to get selection for recording with playwright.");
        return;
    }
    let resolveProgress = undefined;
    vscode_1.window.withProgress({
        location: vscode_1.ProgressLocation.Notification,
        title: "Robocorp",
        cancellable: false,
    }, (progress) => {
        progress.report({ message: "Opening Playwright Recorder..." });
        return new Promise((resolve) => {
            resolveProgress = resolve;
        });
    });
    try {
        const actionResult = await vscode_1.commands.executeCommand(robocorpCommands_1.ROBOCORP_OPEN_PLAYWRIGHT_RECORDER_INTERNAL, {
            "target_robot_uri": currentUri.toString(),
        });
        if (!actionResult.success) {
            resolveProgress();
            await vscode_1.window.showErrorMessage(actionResult.message);
        }
    }
    catch (error) {
        (0, channel_1.logError)("Error resolving interpreter:", error, "ACT_RESOLVE_INTERPRETER");
    }
    finally {
        resolveProgress();
    }
}
exports.openPlaywrightRecorder = openPlaywrightRecorder;
//# sourceMappingURL=playwright.js.map