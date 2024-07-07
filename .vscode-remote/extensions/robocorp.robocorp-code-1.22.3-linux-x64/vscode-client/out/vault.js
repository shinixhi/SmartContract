"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.disconnectWorkspace = exports.connectWorkspace = void 0;
const roboCommands = require("./robocorpCommands");
const vscode = require("vscode");
const activities_1 = require("./activities");
const ask_1 = require("./ask");
const rcc_1 = require("./rcc");
async function connectWorkspace(checkLogin = true) {
    if (checkLogin) {
        let isLoginNeededActionResult = await vscode.commands.executeCommand(roboCommands.ROBOCORP_IS_LOGIN_NEEDED_INTERNAL);
        if (!isLoginNeededActionResult) {
            vscode.window.showInformationMessage("Error getting if login is needed.");
            return;
        }
        if (isLoginNeededActionResult.result) {
            let loggedIn = await (0, activities_1.cloudLogin)();
            if (!loggedIn) {
                return;
            }
        }
    }
    const workspaceSelection = await (0, ask_1.selectWorkspace)("Please select Workspace to enable access the related vault secrets and storage", false);
    if (workspaceSelection === undefined) {
        return;
    }
    let setWorkspaceResult = await vscode.commands.executeCommand(roboCommands.ROBOCORP_SET_CONNECTED_VAULT_WORKSPACE_INTERNAL, {
        "workspaceId": workspaceSelection.selectedWorkspaceInfo.workspaceId,
        "organizationName": workspaceSelection.selectedWorkspaceInfo.organizationName,
        "workspaceName": workspaceSelection.selectedWorkspaceInfo.workspaceName,
    });
    if (!setWorkspaceResult) {
        vscode.window.showInformationMessage("Error connecting to workspace.");
        return;
    }
    if (!setWorkspaceResult.success) {
        vscode.window.showInformationMessage("Error connecting to workspace: " + setWorkspaceResult.message);
        return;
    }
    (0, rcc_1.feedback)("vscode.vault", "connected");
    vscode.window.showInformationMessage("Connected to workspace.");
}
exports.connectWorkspace = connectWorkspace;
async function disconnectWorkspace() {
    let setWorkspaceResult = await vscode.commands.executeCommand(roboCommands.ROBOCORP_SET_CONNECTED_VAULT_WORKSPACE_INTERNAL, {
        "workspaceId": null,
    });
    if (!setWorkspaceResult) {
        vscode.window.showInformationMessage("Error disconnecting from workspace.");
        return;
    }
    if (!setWorkspaceResult.success) {
        vscode.window.showInformationMessage("Error disconnecting from workspace: " + setWorkspaceResult.message);
        return;
    }
    (0, rcc_1.feedback)("vscode.vault", "disconnected");
    vscode.window.showInformationMessage("Disconnected from workspace.");
}
exports.disconnectWorkspace = disconnectWorkspace;
//# sourceMappingURL=vault.js.map