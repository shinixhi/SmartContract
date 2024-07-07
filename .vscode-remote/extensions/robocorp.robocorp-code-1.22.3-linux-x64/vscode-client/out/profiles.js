"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.profileSwitch = exports.profileImport = void 0;
/**
 * Profiles actions we're interested in:
 *
 * rcc.exe config import -f <path to profile.yaml>
 * -- the name of the profile is in the yaml, in the name field
 *    and the description in the description field.
 *
 * rcc.exe config switch -p <profile name>
 *
 * rcc.exe config switch -j
 * -- lists the current profile and the available ones.
 */
const vscode_1 = require("vscode");
const ask_1 = require("./ask");
const robocorpCommands_1 = require("./robocorpCommands");
async function selectProfileFile() {
    let uris = await vscode_1.window.showOpenDialog({
        "canSelectFolders": false,
        "canSelectFiles": true,
        "canSelectMany": false,
        "openLabel": `Select profile to import`,
    });
    if (uris && uris.length > 0) {
        return uris[0];
    }
    return undefined;
}
async function profileImport() {
    const profileUri = await selectProfileFile();
    if (profileUri !== undefined) {
        const actionResult = await vscode_1.commands.executeCommand(robocorpCommands_1.ROBOCORP_PROFILE_IMPORT_INTERNAL, {
            "profileUri": profileUri.toString(),
        });
        if (!actionResult.success) {
            await vscode_1.window.showErrorMessage(actionResult.message);
            return;
        }
        const profileName = actionResult.result["name"];
        if (profileName) {
            let accept = await vscode_1.window.showInformationMessage(`Profile imported. Do you want to switch to the imported profile (${profileName})?`, { "modal": true }, "Yes", "No");
            if (accept === "Yes") {
                await profileSwitchInternal(profileName);
            }
        }
    }
}
exports.profileImport = profileImport;
async function profileSwitchInternal(profileName) {
    const actionResult = await vscode_1.commands.executeCommand(robocorpCommands_1.ROBOCORP_PROFILE_SWITCH_INTERNAL, {
        "profileName": profileName,
    });
    if (!actionResult) {
        await vscode_1.window.showErrorMessage("Unexpected error switching profile.");
        return;
    }
    if (!actionResult.success) {
        await vscode_1.window.showErrorMessage(actionResult.message);
        return;
    }
    if (profileName === "<remove-current-back-to-defaults>") {
        profileName = "Default";
    }
    vscode_1.window.showInformationMessage(profileName + " is now the current profile.");
}
async function profileSwitch() {
    const actionResult = await vscode_1.commands.executeCommand(robocorpCommands_1.ROBOCORP_PROFILE_LIST_INTERNAL);
    if (!actionResult.success) {
        await vscode_1.window.showErrorMessage(actionResult.message);
        return;
    }
    const currentProfile = actionResult.result["current"];
    const profiles = actionResult.result["profiles"];
    const items = [];
    for (const [key, val] of Object.entries(profiles)) {
        let item = {
            "label": key,
            "description": `${val}`,
            "action": key,
        };
        items.push(item);
    }
    items.push({
        "label": "Unset current profile",
        "description": "Switch back to the 'default' profile.",
        "action": "<remove-current-back-to-defaults>",
    });
    let selected = await (0, ask_1.showSelectOneQuickPick)(items, `Select profile to switch to (current profile: ${currentProfile}).`);
    if (selected) {
        await profileSwitchInternal(selected.action);
    }
}
exports.profileSwitch = profileSwitch;
//# sourceMappingURL=profiles.js.map