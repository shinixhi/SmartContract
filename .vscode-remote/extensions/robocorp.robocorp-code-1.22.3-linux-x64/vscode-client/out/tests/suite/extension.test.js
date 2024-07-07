"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const vscode = require("vscode");
const robocorpCommands_1 = require("../../robocorpCommands");
const testFolderLocation = "/resources/";
suite("Robocorp Code Extension Test Suite", () => {
    vscode.window.showInformationMessage("Start all tests.");
    test("Test that robots can be listed", async () => {
        // i.e.: Jus check that we're able to get the contents.
        let workspaceFolders = vscode.workspace.workspaceFolders;
        assert.strictEqual(workspaceFolders.length, 1);
        let actionResult;
        actionResult = await vscode.commands.executeCommand(robocorpCommands_1.ROBOCORP_LOCAL_LIST_ROBOTS_INTERNAL);
        assert.strictEqual(actionResult.success, true);
        let robotsInfo = actionResult.result;
        // Check that we're able to load at least one robot.
        assert.ok(robotsInfo.length >= 1);
    });
});
//# sourceMappingURL=extension.test.js.map