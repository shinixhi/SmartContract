"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startActionServer = exports.downloadOrGetActionServerLocation = exports.downloadLatestActionServer = exports.getActionServerVersion = void 0;
const robocorpSettings_1 = require("./robocorpSettings");
const files_1 = require("./files");
const vscode_1 = require("vscode");
const rcc_1 = require("./rcc");
const path = require("path");
const channel_1 = require("./channel");
const http = require("http");
const activities_1 = require("./activities");
const subprocess_1 = require("./subprocess");
const common_1 = require("./common");
const ask_1 = require("./ask");
const time_1 = require("./time");
//Default: Linux
let DOWNLOAD_URL = "https://downloads.robocorp.com/action-server/releases/latest/linux64/action-server";
if (process.platform === "win32") {
    DOWNLOAD_URL = "https://downloads.robocorp.com/action-server/releases/latest/windows64/action-server.exe";
}
else if (process.platform === "darwin") {
    DOWNLOAD_URL = "https://downloads.robocorp.com/action-server/releases/latest/macos64/action-server";
}
// Update so that Robocorp Code requests the latest version of the action server.
const LATEST_ACTION_SERVER_VERSION = "0.3.2";
async function downloadActionServer(internalActionServerLocation) {
    await vscode_1.window.withProgress({
        location: vscode_1.ProgressLocation.Notification,
        title: "Downloading action server",
        cancellable: false,
    }, async (progress, token) => {
        await (0, rcc_1.download)(DOWNLOAD_URL, progress, token, internalActionServerLocation);
    });
}
const getInternalActionServerDirLocation = async () => {
    const robocorpHome = await (0, rcc_1.getRobocorpHome)();
    return path.join(robocorpHome, "action-server-vscode");
};
const getInternalActionServerLocation = async (tmpFlag = "") => {
    let binName = process.platform === "win32" ? `action-server${tmpFlag}.exe` : `action-server${tmpFlag}`;
    return path.join(await getInternalActionServerDirLocation(), binName);
};
const getActionServerVersion = async (actionServerLocation) => {
    let result;
    const maxTimes = 4;
    let lastError = undefined;
    for (let checkedTimes = 0; checkedTimes < maxTimes; checkedTimes++) {
        try {
            result = await (0, subprocess_1.execFilePromise)(actionServerLocation, ["version"], {});
            // this is the version
            return result.stdout.trim();
        }
        catch (err) {
            lastError = err;
            // In Windows right after downloading the file it may not be executable,
            // so, retry a few times.
            await (0, time_1.sleep)(250);
        }
    }
    const msg = `There was an error running the action server at: ${actionServerLocation}. It may be unusable or you may not have permissions to run it.`;
    (0, channel_1.logError)(msg, lastError, "ERR_VERIFY_ACTION_SERVER_VERSION");
    vscode_1.window.showErrorMessage(msg);
    throw lastError;
};
exports.getActionServerVersion = getActionServerVersion;
let verifiedActionServerVersions = new Map();
const downloadLatestActionServer = async () => {
    const tmpLocation = await getInternalActionServerLocation(`-${Date.now()}`);
    channel_1.OUTPUT_CHANNEL.appendLine(`Downloading latest Action Server to ${tmpLocation}.`);
    await (0, files_1.makeDirs)(path.dirname(tmpLocation));
    await downloadActionServer(tmpLocation);
    const version = await (0, exports.getActionServerVersion)(tmpLocation);
    channel_1.OUTPUT_CHANNEL.appendLine("Checking version of latest Action Server.");
    const versionedLocation = await getInternalActionServerLocation(`-${version}`);
    const source = vscode_1.Uri.file(tmpLocation);
    const target = vscode_1.Uri.file(versionedLocation);
    channel_1.OUTPUT_CHANNEL.appendLine(`Putting in final location (${target}).`);
    await vscode_1.workspace.fs.rename(source, target, { overwrite: true });
    (0, robocorpSettings_1.setActionserverLocation)(versionedLocation);
    return versionedLocation;
};
exports.downloadLatestActionServer = downloadLatestActionServer;
const downloadOrGetActionServerLocation = async () => {
    const location = await internalDownloadOrGetActionServerLocation();
    if (!location) {
        return location;
    }
    const verifiedAlready = verifiedActionServerVersions.get(location);
    if (!verifiedAlready) {
        verifiedActionServerVersions.set(location, true);
        const actionServerVersion = await (0, exports.getActionServerVersion)(location);
        const expected = LATEST_ACTION_SERVER_VERSION;
        const compare = (0, common_1.compareVersions)(expected, actionServerVersion);
        if (compare > 0) {
            const DOWNLOAD = "Download new";
            const selection = await (0, ask_1.showSelectOneStrQuickPick)([DOWNLOAD, "Keep current"], "How would you like to proceed.", `Old version of Action Server detected (${actionServerVersion}). Expected '${expected}' or newer.`);
            if (selection === DOWNLOAD) {
                return await (0, exports.downloadLatestActionServer)();
            }
        }
    }
    return location;
};
exports.downloadOrGetActionServerLocation = downloadOrGetActionServerLocation;
const internalDownloadOrGetActionServerLocation = async () => {
    let actionServerLocationInSettings = (0, robocorpSettings_1.getActionserverLocation)();
    let message = undefined;
    if (!actionServerLocationInSettings) {
        message =
            "The action-server executable is not currently specified in the `robocorp.actionServerLocation` setting. How would you like to proceed?";
    }
    else if (!(await (0, files_1.fileExists)(actionServerLocationInSettings))) {
        message =
            "The action-server executable specified in the `robocorp.actionServerLocation` does not point to an existing file. How would you like to proceed?";
    }
    else {
        // Ok, found in settings.
        return actionServerLocationInSettings;
    }
    if (message) {
        const DOWNLOAD_TO_INTERNAL_LOCATION = "Download";
        const SPECIFY_LOCATION = "Specify Location";
        const option = await vscode_1.window.showInformationMessage(message, { "modal": true }, DOWNLOAD_TO_INTERNAL_LOCATION, SPECIFY_LOCATION);
        if (option === DOWNLOAD_TO_INTERNAL_LOCATION) {
            return await (0, exports.downloadLatestActionServer)();
        }
        else if (option === SPECIFY_LOCATION) {
            let uris = await vscode_1.window.showOpenDialog({
                "canSelectFolders": false,
                "canSelectFiles": true,
                "canSelectMany": false,
                "openLabel": `Select the action-server executable`,
            });
            if (uris && uris.length === 1) {
                const f = uris[0].fsPath;
                (0, robocorpSettings_1.setActionserverLocation)(f);
                return f;
            }
            return undefined;
        }
    }
    return undefined;
};
const isActionServerAlive = async (port) => {
    try {
        await fetchData(port, "/openapi.json", "GET");
        return true;
    }
    catch (err) {
        return false;
    }
};
function makeRequest(postData, options) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let responseData = "";
            res.setEncoding("utf8");
            res.on("data", (chunk) => {
                responseData += chunk;
            });
            res.on("end", () => {
                resolve(responseData);
            });
        });
        req.on("error", (error) => {
            reject(error);
        });
        req.write(postData);
        req.end();
    });
}
/**
 * @param path this is the path in the host (i.e.: /api-endpoint)
 */
async function fetchData(port, path, method) {
    const postData = JSON.stringify({});
    const options = {
        hostname: "localhost",
        port: port,
        path: path,
        method: method,
        headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(postData),
        },
    };
    return await makeRequest(postData, options);
}
const shutdownExistingActionServer = async (port) => {
    await fetchData(port, "/api/shutdown", "POST");
};
const port = 8082;
const ACTION_SERVER_TERMINAL_NAME = "Robocorp: Action Server";
const getActionServerTerminal = () => {
    for (const terminal of vscode_1.window.terminals) {
        if (terminal.name === ACTION_SERVER_TERMINAL_NAME) {
            return terminal;
        }
    }
    return undefined;
};
const startActionServer = async (directory) => {
    if (!directory) {
        // Need to list the action packages available to decide
        // which one to use for the action server.
        const selected = await (0, activities_1.listAndAskRobotSelection)("Please select the Action Package from which the Action Server should load actions.", "Unable to start Action Server because no Action Package was found in the workspace.", { showActionPackages: true, showTaskPackages: false });
        if (!selected) {
            return;
        }
        directory = vscode_1.Uri.file(selected.directory);
    }
    let actionServerTerminal = getActionServerTerminal();
    if (actionServerTerminal !== undefined) {
        if (await isActionServerAlive(port)) {
            const RESTART = "Restart action server";
            const option = await vscode_1.window.showWarningMessage("The action server seems to be running already. How do you want to proceed?", RESTART, "Cancel");
            if (option !== RESTART) {
                return;
            }
            await shutdownExistingActionServer(port);
            actionServerTerminal.dispose();
            actionServerTerminal = undefined;
        }
        else {
            channel_1.OUTPUT_CHANNEL.appendLine("Action server not alive.");
            actionServerTerminal.dispose();
            actionServerTerminal = undefined;
        }
    }
    // We need to:
    // Get action server executable (download if not there)
    const location = await (0, exports.downloadOrGetActionServerLocation)();
    if (!location) {
        return;
    }
    const env = (0, rcc_1.createEnvWithRobocorpHome)(await (0, rcc_1.getRobocorpHome)());
    env["RC_ADD_SHUTDOWN_API"] = "1";
    actionServerTerminal = vscode_1.window.createTerminal({
        name: "Robocorp: Action Server",
        env: env,
        cwd: directory,
    });
    actionServerTerminal.show();
    channel_1.OUTPUT_CHANNEL.appendLine("Starting action-server (in terminal): " + location);
    actionServerTerminal.sendText(""); // Just add a new line in case something is there already.
    actionServerTerminal.sendText(`cd ${directory.fsPath}`);
    actionServerTerminal.sendText(`${location} start --port=${port}`);
};
exports.startActionServer = startActionServer;
//# sourceMappingURL=actionServer.js.map