"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.showSubmitIssueUI = void 0;
/**
 * Interesting docs related to webviews:
 * https://code.visualstudio.com/api/extension-guides/webview
 */
const fs_1 = require("fs");
const vscode = require("vscode");
const channel_1 = require("./channel");
const files_1 = require("./files");
const rcc_1 = require("./rcc");
const robocorpCommands_1 = require("./robocorpCommands");
async function showSubmitIssueUI(context) {
    const info = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Collecting information to submit issue...",
        cancellable: false,
    }, async () => {
        const collectedLogs = await (0, rcc_1.collectIssueLogs)(context.logUri.fsPath);
        let email = "";
        try {
            let accountInfoResult = await vscode.commands.executeCommand(robocorpCommands_1.ROBOCORP_GET_LINKED_ACCOUNT_INFO_INTERNAL);
            if (accountInfoResult.success) {
                email = accountInfoResult.result.email;
            }
        }
        catch (err) {
            (0, channel_1.logError)("Error getting default e-mail.", err, "SEND_ISSUE_ERROR_GETTING_DEFAULT_EMAIL");
        }
        return { collectedLogs, email };
    });
    const collectedLogs = info.collectedLogs;
    const email = info.email;
    const panel = vscode.window.createWebviewPanel("robocorpCodeSubmitIssue", "Submit Issue to Robocorp", vscode.ViewColumn.One, {
        enableScripts: true,
        retainContextWhenHidden: true,
    });
    panel.webview.html = getWebviewContent({ "files": collectedLogs.logFiles, "email": email });
    panel.webview.onDidReceiveMessage(async (message) => {
        switch (message.command) {
            case "onClickViewFile":
                const file = message.filename;
                vscode.commands.executeCommand("vscode.open", vscode.Uri.file(file));
                return;
            case "onClickSubmit":
                const contents = message.contents;
                try {
                    await (0, rcc_1.submitIssue)(contents.details, contents.email, "Robocorp Code", "Robocorp Code", contents.summary, contents.files);
                }
                finally {
                    panel.webview.postMessage({ command: "issueSent" });
                }
                return;
        }
    }, undefined, context.subscriptions);
}
exports.showSubmitIssueUI = showSubmitIssueUI;
function getWebviewContent(jsonData) {
    const jsonDataStr = JSON.stringify(jsonData, null, 4);
    const templateFile = (0, files_1.getExtensionRelativeFile)("../../vscode-client/templates/submit_issue.html", true);
    const data = (0, fs_1.readFileSync)(templateFile, "utf8");
    const start = '<script id="data" type="application/json">';
    const startI = data.indexOf(start) + start.length;
    const end = "</script>";
    const endI = data.indexOf(end, startI);
    const ret = data.substring(0, startI) + jsonDataStr + data.substring(endI);
    return ret;
}
//# sourceMappingURL=submitIssue.js.map