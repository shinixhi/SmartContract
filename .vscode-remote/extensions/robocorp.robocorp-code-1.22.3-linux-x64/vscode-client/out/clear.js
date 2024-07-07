"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeEnvsToCollect = exports.clearRobocorpCodeCaches = exports.clearRCCEnvironments = void 0;
const channel_1 = require("./channel");
const rcc_1 = require("./rcc");
const subprocess_1 = require("./subprocess");
const path = require("path");
const fs = require("fs");
async function clearRCCEnvironments(rccLocation, robocorpHome, envsToCollect, progress) {
    const env = (0, rcc_1.createEnvWithRobocorpHome)(robocorpHome);
    let i = 0;
    for (const envToCollect of envsToCollect) {
        i += 1;
        try {
            const envId = envToCollect["id"];
            progress.report({
                "message": `Deleting env: ${envId} (${i} of ${envsToCollect.length})`,
            });
            let execFileReturn = await (0, subprocess_1.execFilePromise)(rccLocation, ["holotree", "delete", envId, "--controller", "RobocorpCode"], { "env": env }, { "showOutputInteractively": true });
        }
        catch (error) {
            let msg = "Error collecting RCC environment: " + envToCollect.id + " at: " + envToCollect.path;
            (0, channel_1.logError)(msg, error, "RCC_CLEAR_ENV");
        }
    }
}
exports.clearRCCEnvironments = clearRCCEnvironments;
async function removeCaches(dirPath, level, removeDirsArray) {
    let dirContents = await fs.promises.readdir(dirPath, { withFileTypes: true });
    for await (const dirEnt of dirContents) {
        var entryPath = path.join(dirPath, dirEnt.name);
        if (dirEnt.isDirectory()) {
            await removeCaches(entryPath, level + 1, removeDirsArray);
            removeDirsArray.push(entryPath);
        }
        else {
            try {
                await fs.promises.unlink(entryPath);
                channel_1.OUTPUT_CHANNEL.appendLine(`Removed: ${entryPath}.`);
            }
            catch (err) {
                channel_1.OUTPUT_CHANNEL.appendLine(`Unable to remove: ${entryPath}. ${err}`);
            }
        }
    }
    if (level === 0) {
        // Remove the (empty) directories only after all iterations finished.
        for (const entryPath of removeDirsArray) {
            try {
                await fs.promises.rmdir(entryPath);
                channel_1.OUTPUT_CHANNEL.appendLine(`Removed dir: ${entryPath}.`);
            }
            catch (err) {
                channel_1.OUTPUT_CHANNEL.appendLine(`Unable to remove dir: ${entryPath}. ${err}`);
            }
        }
    }
}
async function clearRobocorpCodeCaches(robocorpHome) {
    let robocorpCodePath = path.join(robocorpHome, ".robocorp_code");
    removeCaches(robocorpCodePath, 0, []);
}
exports.clearRobocorpCodeCaches = clearRobocorpCodeCaches;
async function computeEnvsToCollect(rccLocation, robocorpHome) {
    let args = ["holotree", "list", "--json", "--controller", "RobocorpCode"];
    let execFileReturn = await (0, subprocess_1.execFilePromise)(rccLocation, args, { "env": (0, rcc_1.createEnvWithRobocorpHome)(robocorpHome) }, { "showOutputInteractively": true });
    if (!execFileReturn.stdout) {
        (0, rcc_1.feedbackRobocorpCodeError)("RCC_NO_RCC_ENV_STDOUT_ON_ENVS_TO_COLLECT");
        channel_1.OUTPUT_CHANNEL.appendLine("Error: Unable to collect environment from RCC.");
        return undefined;
    }
    let nameToEnvInfo = undefined;
    try {
        nameToEnvInfo = JSON.parse(execFileReturn.stdout);
    }
    catch (error) {
        (0, channel_1.logError)("Error parsing env from RCC: " + execFileReturn.stdout, error, "RCC_WRONG_RCC_ENV_STDOUT_ON_ENVS_TO_COLLECT");
        return undefined;
    }
    if (!nameToEnvInfo) {
        channel_1.OUTPUT_CHANNEL.appendLine("Error: Unable to collect env array.");
        return undefined;
    }
    let found = [];
    for (const key in nameToEnvInfo) {
        if (Object.prototype.hasOwnProperty.call(nameToEnvInfo, key)) {
            const element = nameToEnvInfo[key];
            let spaceName = element["space"];
            if (spaceName && spaceName.startsWith("vscode")) {
                found.push(element);
            }
        }
    }
    return found;
}
exports.computeEnvsToCollect = computeEnvsToCollect;
//# sourceMappingURL=clear.js.map