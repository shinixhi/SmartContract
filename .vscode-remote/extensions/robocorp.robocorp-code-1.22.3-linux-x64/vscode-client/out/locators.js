"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeLocator = exports.copySelectedToClipboard = void 0;
const roboCommands = require("./robocorpCommands");
const vscode_1 = require("vscode");
const activities_1 = require("./activities");
const viewsCommon_1 = require("./viewsCommon");
const channel_1 = require("./channel");
async function copySelectedToClipboard(locator) {
    let locatorSelected = locator || (await (0, viewsCommon_1.getSelectedLocator)());
    if (locatorSelected) {
        vscode_1.env.clipboard.writeText("alias:" + locatorSelected.name);
    }
}
exports.copySelectedToClipboard = copySelectedToClipboard;
async function removeLocator(locator) {
    // Confirmation dialog button texts
    const DELETE = "Delete";
    let locatorSelected = locator || (await (0, viewsCommon_1.getSelectedLocator)());
    if (!locatorSelected) {
        channel_1.OUTPUT_CHANNEL.appendLine("Warning: Trying to delete locator when there is no locator selected");
        return;
    }
    let selectedEntry = (0, viewsCommon_1.getSelectedRobot)({
        noSelectionMessage: "Please select a robot first.",
    });
    let robot = selectedEntry?.robot;
    if (!robot) {
        // Ask for the robot to be used and then show dialog with the options.
        robot = await (0, activities_1.listAndAskRobotSelection)("Please select the Task or Action Package where the locator should be removed.", "Unable to remove locator (no Task or Action Package detected in the Workspace).", { showActionPackages: true, showTaskPackages: true });
        if (!robot) {
            channel_1.OUTPUT_CHANNEL.appendLine("Warning: Trying to delete locator when there is no robot selected");
            return;
        }
    }
    const result = await vscode_1.window.showWarningMessage(`Are you sure you want to delete the locator "${locatorSelected?.name}"?`, { "modal": true }, DELETE);
    if (result === DELETE) {
        const actionResult = await vscode_1.commands.executeCommand(roboCommands.ROBOCORP_REMOVE_LOCATOR_FROM_JSON_INTERNAL, {
            robotYaml: robot.filePath,
            name: locatorSelected?.name,
        });
        if (actionResult.success) {
            channel_1.OUTPUT_CHANNEL.appendLine(`Locator "${locatorSelected?.name} removed successfully`);
        }
        else {
            channel_1.OUTPUT_CHANNEL.appendLine(`Unable to remove Locator "${locatorSelected?.name}, because of:\n${actionResult.message}`);
        }
    }
}
exports.removeLocator = removeLocator;
//# sourceMappingURL=locators.js.map