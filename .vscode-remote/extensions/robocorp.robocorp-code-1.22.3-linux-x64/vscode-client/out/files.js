"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findNextBasenameIn = exports.makeDirs = exports.writeToFile = exports.readFromFile = exports.uriExists = exports.fileExists = exports.verifyFileExists = exports.isFile = exports.getExtensionRelativeFile = void 0;
const path = require("path");
const fs = require("fs");
const vscode_1 = require("vscode");
const channel_1 = require("./channel");
const path_1 = require("path");
/**
 * @param mustExist if true, if the returned file does NOT exist, returns undefined.
 */
function getExtensionRelativeFile(relativeLocation, mustExist = true) {
    let targetFile = path.resolve(__dirname, relativeLocation);
    if (mustExist) {
        if (!verifyFileExists(targetFile)) {
            return undefined;
        }
    }
    return targetFile;
}
exports.getExtensionRelativeFile = getExtensionRelativeFile;
async function isFile(filename) {
    try {
        const stat = await fs.promises.stat(filename);
        return stat.isFile();
    }
    catch (err) {
        return false;
    }
}
exports.isFile = isFile;
function verifyFileExists(targetFile, warnUser = true) {
    if (!fs.existsSync(targetFile)) {
        let msg = "Error. Expected: " + targetFile + " to exist.";
        if (warnUser)
            vscode_1.window.showWarningMessage(msg);
        channel_1.OUTPUT_CHANNEL.appendLine(msg);
        return false;
    }
    return true;
}
exports.verifyFileExists = verifyFileExists;
async function fileExists(filename) {
    try {
        await fs.promises.stat(filename);
        return true;
    }
    catch (err) {
        return false;
    }
}
exports.fileExists = fileExists;
async function uriExists(uri) {
    try {
        await vscode_1.workspace.fs.stat(uri);
        return true;
    }
    catch (err) {
        return false;
    }
}
exports.uriExists = uriExists;
async function readFromFile(targetFile) {
    if (!(await fileExists(targetFile))) {
        return undefined;
    }
    const contents = await fs.promises.readFile(targetFile);
    return contents.toString();
}
exports.readFromFile = readFromFile;
async function writeToFile(targetFile, content, options) {
    return await fs.promises.writeFile(targetFile, content, options);
}
exports.writeToFile = writeToFile;
async function makeDirs(targetDir) {
    await fs.promises.mkdir(targetDir, { recursive: true });
}
exports.makeDirs = makeDirs;
async function findNextBasenameIn(folder, prefix) {
    const check = (0, path_1.join)(folder, prefix);
    if (!(await fileExists(check))) {
        return prefix; // Use as is directly
    }
    for (let i = 1; i < 9999; i++) {
        const basename = `${prefix}-${i}`;
        const check = (0, path_1.join)(folder, basename);
        if (!(await fileExists(check))) {
            return basename;
        }
    }
    throw new Error(`Unable to find valid name in ${folder} for prefix: ${prefix}.`);
}
exports.findNextBasenameIn = findNextBasenameIn;
//# sourceMappingURL=files.js.map