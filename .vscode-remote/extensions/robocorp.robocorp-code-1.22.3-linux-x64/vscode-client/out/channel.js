"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logError = exports.showErrorAndStackOnOutput = exports.buildErrorStr = exports.OUTPUT_CHANNEL = exports.OUTPUT_CHANNEL_NAME = void 0;
const vscode_1 = require("vscode");
const rcc_1 = require("./rcc");
exports.OUTPUT_CHANNEL_NAME = "Robocorp Code";
exports.OUTPUT_CHANNEL = vscode_1.window.createOutputChannel(exports.OUTPUT_CHANNEL_NAME);
function buildErrorStr(err) {
    let ret = "";
    if (err !== undefined) {
        let indent = "    ";
        if (err.message) {
            ret += indent + err.message;
        }
        if (err.stack) {
            let stack = "" + err.stack;
            ret += stack.replace(/^/gm, indent);
        }
    }
    else {
        ret = "<Error is undefined>";
    }
    return ret;
}
exports.buildErrorStr = buildErrorStr;
function showErrorAndStackOnOutput(err) {
    if (err !== undefined) {
        let indent = "    ";
        if (err.message) {
            exports.OUTPUT_CHANNEL.appendLine(indent + err.message);
        }
        if (err.stack) {
            let stack = "" + err.stack;
            exports.OUTPUT_CHANNEL.appendLine(stack.replace(/^/gm, indent));
        }
    }
}
exports.showErrorAndStackOnOutput = showErrorAndStackOnOutput;
function logError(msg, err, errorCode) {
    (0, rcc_1.feedbackRobocorpCodeError)(errorCode); // async, but don't wait for it
    exports.OUTPUT_CHANNEL.appendLine(msg);
    showErrorAndStackOnOutput(err);
}
exports.logError = logError;
//# sourceMappingURL=channel.js.map