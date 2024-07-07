"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEndpointUrl = exports.collectBaseEnv = exports.feedbackAnyError = exports.feedbackRobocorpCodeError = exports.feedback = exports.submitIssue = exports.collectIssueLogs = exports.runConfigDiagnostics = exports.RCCDiagnostics = exports.STATUS_WARNING = exports.STATUS_FAIL = exports.STATUS_FATAL = exports.STATUS_OK = exports.getRccLocation = exports.download = exports.createEnvWithRobocorpHome = exports.getRobocorpHome = exports.Metrics = void 0;
const fs = require("fs");
const path = require("path");
const os = require("os");
const pathModule = require("path");
const requestLight_1 = require("./requestLight");
const files_1 = require("./files");
const vscode_1 = require("vscode");
const channel_1 = require("./channel");
const time_1 = require("./time");
const subprocess_1 = require("./subprocess");
const roboConfig = require("./robocorpSettings");
const extensionCreateEnv_1 = require("./extensionCreateEnv");
const robocorpSettings_1 = require("./robocorpSettings");
const extension_1 = require("./extension");
let lastPrintedRobocorpHome = "";
var Metrics;
(function (Metrics) {
    Metrics["VSCODE_CODE_ERROR"] = "vscode.code.error";
    Metrics["CONVERTER_USED"] = "vscode.converter.used";
    Metrics["CONVERTER_ERROR"] = "vscode.converter.error";
})(Metrics = exports.Metrics || (exports.Metrics = {}));
async function getRobocorpHome() {
    let robocorpHome = roboConfig.getHome();
    if (!robocorpHome || robocorpHome.length == 0) {
        robocorpHome = process.env["ROBOCORP_HOME"];
        if (!robocorpHome) {
            // Default from RCC (maybe it should provide an API to get it before creating an env?)
            if (process.platform == "win32") {
                robocorpHome = path.join(process.env.LOCALAPPDATA, "robocorp");
            }
            else {
                robocorpHome = path.join(process.env.HOME, ".robocorp");
            }
        }
    }
    if (lastPrintedRobocorpHome != robocorpHome) {
        lastPrintedRobocorpHome = robocorpHome;
        channel_1.OUTPUT_CHANNEL.appendLine("ROBOCORP_HOME: " + robocorpHome);
    }
    return robocorpHome;
}
exports.getRobocorpHome = getRobocorpHome;
function createEnvWithRobocorpHome(robocorpHome) {
    const base = { "ROBOCORP_HOME": robocorpHome };
    if ((0, robocorpSettings_1.getProceedwithlongpathsdisabled)()) {
        base["ROBOCORP_OVERRIDE_SYSTEM_REQUIREMENTS"] = "1";
    }
    let env = (0, subprocess_1.mergeEnviron)(base);
    return env;
}
exports.createEnvWithRobocorpHome = createEnvWithRobocorpHome;
function envArrayToEnvMap(envArray, robocorpHome) {
    let env = createEnvWithRobocorpHome(robocorpHome);
    for (let index = 0; index < envArray.length; index++) {
        const element = envArray[index];
        let key = element["key"];
        if (process.platform == "win32") {
            key = key.toUpperCase();
        }
        env[key] = element["value"];
    }
    return env;
}
async function checkCachedEnvValid(env) {
    let pythonExe = env["PYTHON_EXE"];
    if (!pythonExe || !fs.existsSync(pythonExe)) {
        channel_1.OUTPUT_CHANNEL.appendLine("Error. PYTHON_EXE not valid in env cache.");
        return false;
    }
    let condaPrefix = env["CONDA_PREFIX"];
    if (!condaPrefix || !fs.existsSync(condaPrefix)) {
        channel_1.OUTPUT_CHANNEL.appendLine("Error. CONDA_PREFIX not valid in env cache.");
        return false;
    }
    let condaPrefixIdentityYaml = path.join(condaPrefix, "identity.yaml");
    if (!fs.existsSync(condaPrefixIdentityYaml)) {
        channel_1.OUTPUT_CHANNEL.appendLine("Error. " + condaPrefixIdentityYaml + " no longer exists.");
        return false;
    }
    let execFileReturn = await (0, subprocess_1.execFilePromise)(pythonExe, ["-c", 'import threading;print("OK")'], {
        env: env,
    });
    if (execFileReturn.stderr) {
        channel_1.OUTPUT_CHANNEL.appendLine("Expected no output in stderr from cached python (" + pythonExe + "). Found:\n" + execFileReturn.stderr);
        return false;
    }
    if (!execFileReturn.stdout) {
        channel_1.OUTPUT_CHANNEL.appendLine("No output received when checking cached python (" + pythonExe + ").");
        return false;
    }
    if (!execFileReturn.stdout.includes("OK")) {
        channel_1.OUTPUT_CHANNEL.appendLine("Expected 'OK' in output from cached python (" + pythonExe + "). Found:\n" + execFileReturn.stdout);
        return false;
    }
    return true;
}
async function downloadRcc(progress, token) {
    // Configure library with http settings.
    // i.e.: https://code.visualstudio.com/docs/setup/network
    let httpSettings = vscode_1.workspace.getConfiguration("http");
    (0, requestLight_1.configure)(httpSettings.get("proxy"), httpSettings.get("proxyStrictSSL"));
    let location = getExpectedRccLocation();
    let relativePath;
    if (process.platform == "win32") {
        if (process.arch === "x64" || process.env.hasOwnProperty("PROCESSOR_ARCHITEW6432")) {
            // Check if node is a 64 bit process or if it's a 32 bit process running in a 64 bit processor.
            relativePath = "/windows64/rcc.exe";
        }
        else {
            throw new Error("Currently only Windows amd64 is supported.");
        }
    }
    else if (process.platform == "darwin") {
        relativePath = "/macos64/rcc";
    }
    else {
        // Linux
        if (process.arch == "x64") {
            relativePath = "/linux64/rcc";
        }
        else {
            throw new Error("Currently only Linux amd64 is supported.");
        }
    }
    const RCC_VERSION = "v17.28.4";
    const prefix = "https://downloads.robocorp.com/rcc/releases/" + RCC_VERSION;
    const url = prefix + relativePath;
    return await download(url, progress, token, location);
}
// Note: python tests scan this file and get these constants, so, if the format
// changes the (failing) test also needs to change.
const BASENAME_PREBUILT_WIN_AMD64 = "2195c38e27a4ceb6_windows_amd64.zip";
const BASENAME_PREBUILT_DARWIN = "5522648f69edb3e4_darwin_amd64.zip";
const BASENAME_PREBUILT_LINUX_AMD64 = "e9c56273fd47ede1_linux_amd64.zip";
function getBaseAsZipBasename() {
    let basename;
    if (process.platform == "win32") {
        if (process.arch === "x64" || process.env.hasOwnProperty("PROCESSOR_ARCHITEW6432")) {
            // Check if node is a 64 bit process or if it's a 32 bit process running in a 64 bit processor.
            basename = BASENAME_PREBUILT_WIN_AMD64;
        }
        else {
            throw new Error("Currently only Windows amd64 is supported.");
        }
    }
    else if (process.platform == "darwin") {
        basename = BASENAME_PREBUILT_DARWIN;
    }
    else {
        // Linux
        if (process.arch === "x64") {
            basename = BASENAME_PREBUILT_LINUX_AMD64;
        }
        else {
            throw new Error("Currently only Linux amd64 is supported.");
        }
    }
    return basename;
}
/**
 * Provides the place where the zip with the base environment should be downloaded.
 */
async function getBaseAsZipDownloadLocation() {
    const robocorpHome = await getRobocorpHome();
    let robocorpCodePath = path.join(robocorpHome, ".robocorp_code");
    return path.join(robocorpCodePath, getBaseAsZipBasename());
}
async function downloadBaseAsZip(progress, token, zipDownloadLocation) {
    let timing = new time_1.Timing();
    let httpSettings = vscode_1.workspace.getConfiguration("http");
    (0, requestLight_1.configure)(httpSettings.get("proxy"), httpSettings.get("proxyStrictSSL"));
    const basename = getBaseAsZipBasename();
    const url = "https://downloads.robocorp.com/holotree/bin/" + basename;
    const ret = await download(url, progress, token, zipDownloadLocation);
    channel_1.OUTPUT_CHANNEL.appendLine("Took: " + timing.getTotalElapsedAsStr() + " to download base environment (" + zipDownloadLocation + ").");
    return ret;
}
async function download(url, progress, token, location) {
    // Downloads can go wrong (so, retry a few times before giving up).
    const maxTries = 3;
    let timing = new time_1.Timing();
    channel_1.OUTPUT_CHANNEL.appendLine("Downloading from: " + url);
    for (let i = 0; i < maxTries; i++) {
        function onProgress(currLen, totalLen) {
            if (timing.elapsedFromLastMeasurement(300) || currLen == totalLen) {
                currLen /= 1024 * 1024;
                totalLen /= 1024 * 1024;
                let currProgress = (currLen / totalLen) * 100;
                let msg = "Downloaded: " +
                    currLen.toFixed(1) +
                    "MB of " +
                    totalLen.toFixed(1) +
                    "MB (" +
                    currProgress.toFixed(1) +
                    "%)";
                if (i > 0) {
                    msg = "Attempt: " + (i + 1) + " - " + msg;
                }
                progress.report({ message: msg });
                channel_1.OUTPUT_CHANNEL.appendLine(msg);
            }
        }
        try {
            let response = await (0, requestLight_1.xhr)({
                "url": url,
                "onProgress": onProgress,
            });
            if (response.status == 200) {
                // Ok, we've been able to get it.
                // Note: only write to file after we get all contents to avoid
                // having partial downloads.
                channel_1.OUTPUT_CHANNEL.appendLine("Finished downloading in: " + timing.getTotalElapsedAsStr());
                channel_1.OUTPUT_CHANNEL.appendLine("Writing to: " + location);
                progress.report({ message: "Finished downloading (writing to file)." });
                let s = fs.createWriteStream(location, { "encoding": "binary", "mode": 0o744 });
                try {
                    response.responseData.forEach((element) => {
                        s.write(element);
                    });
                }
                finally {
                    s.close();
                }
                // If we don't sleep after downloading, the first activation seems to fail on Windows and Mac
                // (EBUSY on Windows, undefined on Mac).
                await (0, time_1.sleep)(200);
                return location;
            }
            else {
                throw Error("Unable to download from " +
                    url +
                    ". Response status: " +
                    response.status +
                    "Response message: " +
                    response.responseText);
            }
        }
        catch (error) {
            channel_1.OUTPUT_CHANNEL.appendLine("Error downloading (" + i + " of " + maxTries + "). Error: " + error.message);
            if (i == maxTries - 1) {
                return undefined;
            }
        }
    }
}
exports.download = download;
function getExpectedRccLocation() {
    let location;
    if (process.platform == "win32") {
        location = (0, files_1.getExtensionRelativeFile)("../../bin/rcc.exe", false);
    }
    else {
        location = (0, files_1.getExtensionRelativeFile)("../../bin/rcc", false);
    }
    return location;
}
// We can't really ship rcc per-platform right now (so, we need to either
// download it or ship it along).
// See: https://github.com/microsoft/vscode/issues/6929
// See: https://github.com/microsoft/vscode/issues/23251
// In particular, if we download things, we should use:
// https://www.npmjs.com/package/request-light according to:
// https://github.com/microsoft/vscode/issues/6929#issuecomment-222153748
async function getRccLocation() {
    let location = getExpectedRccLocation();
    if (!(await (0, files_1.fileExists)(location))) {
        await vscode_1.window.withProgress({
            location: vscode_1.ProgressLocation.Notification,
            title: "Download conda manager (rcc).",
            cancellable: false,
        }, downloadRcc);
    }
    return location;
}
exports.getRccLocation = getRccLocation;
exports.STATUS_OK = "ok";
exports.STATUS_FATAL = "fatal";
exports.STATUS_FAIL = "fail";
exports.STATUS_WARNING = "warning";
// RCC categories:
// https://github.com/robocorp/rcc/blob/master/common/categories.go#L4-L14
const CategoryUndefined = 0;
const CategoryLongPath = 1010;
const CategoryLockFile = 1020;
const CategoryLockPid = 1021;
const CategoryPathCheck = 1030;
const CategoryHolotreeShared = 2010;
const CategoryRobocorpHome = 3010;
const CategoryNetworkDNS = 4010;
const CategoryNetworkLink = 4020;
const CategoryNetworkHEAD = 4030;
const CategoryNetworkCanary = 4040;
class RCCDiagnostics {
    constructor(checks, details) {
        this.roboHomeOk = true;
        this.failedChecks = [];
        this.holotreeShared = details["holotree-shared"] == "true";
        for (const check of checks) {
            if (check.status != exports.STATUS_OK) {
                if (check.status === exports.STATUS_WARNING) {
                    if (check.category === CategoryLockFile || check.category === CategoryLockPid) {
                        // We ignore warnings for Locks because they may happen as part of the
                        // regular operation (because RCC may leave those around as leftovers when RCC
                        // is killed).
                        continue;
                    }
                }
                if (check.category === CategoryLockFile) {
                    // We ignore all errors related to lock files (even errors)
                    // due to: https://github.com/robocorp/rcc/issues/43
                    // -- Running rcc.exe config diagnostics in a clean machine gives errors related to locks.
                    continue;
                }
                if (check.category === CategoryLongPath) {
                    // We deal with long paths as a part of the startup process.
                    continue;
                }
                this.failedChecks.push(check);
                if (check.category === CategoryRobocorpHome) {
                    this.roboHomeOk = false;
                }
            }
        }
    }
    isRobocorpHomeOk() {
        return this.roboHomeOk;
    }
}
exports.RCCDiagnostics = RCCDiagnostics;
/**
 * @param robocorpHome if given, this will be passed as the ROBOCORP_HOME environment variable.
 */
async function runConfigDiagnostics(rccLocation, robocorpHome) {
    let configureLongpathsOutput = undefined;
    let timing = new time_1.Timing();
    try {
        let env = (0, subprocess_1.mergeEnviron)({ "ROBOCORP_HOME": robocorpHome });
        configureLongpathsOutput = await (0, subprocess_1.execFilePromise)(rccLocation, ["configure", "diagnostics", "-j", "--controller", "RobocorpCode"], { env: env });
        let outputAsJSON = JSON.parse(configureLongpathsOutput.stdout);
        let checks = outputAsJSON.checks;
        let details = outputAsJSON.details;
        const ret = new RCCDiagnostics(checks, details);
        // Ok, we've been able to parse the JSON. Let's print the output in a format that's not
        // difficult to visually parse afterwards.
        channel_1.OUTPUT_CHANNEL.appendLine("RCC Diagnostics:");
        for (const [key, value] of Object.entries(outputAsJSON)) {
            if (key === "checks") {
                channel_1.OUTPUT_CHANNEL.appendLine("  RCC Checks:");
                for (const check of checks) {
                    channel_1.OUTPUT_CHANNEL.appendLine(`    ${check.type.padEnd(10)} - ${check.status.padEnd(7)} - ${check.message} (${check.category})`);
                }
            }
            else if (key === "details") {
                channel_1.OUTPUT_CHANNEL.appendLine("  RCC Details:");
                for (const [detailsKey, detailsValue] of Object.entries(details)) {
                    channel_1.OUTPUT_CHANNEL.appendLine(`    ${detailsKey.padEnd(40)} - ${detailsValue}`);
                }
            }
            else {
                channel_1.OUTPUT_CHANNEL.appendLine(`  RCC ${JSON.stringify(key)}:`);
                // We didn't expect this, let's just print it as json.
                channel_1.OUTPUT_CHANNEL.appendLine(`    ${JSON.stringify(value)}`);
            }
        }
        return ret;
    }
    catch (error) {
        (0, channel_1.logError)("Error getting RCC diagnostics.", error, "RCC_DIAGNOSTICS");
        channel_1.OUTPUT_CHANNEL.appendLine("RCC Diagnostics:" +
            "\nStdout:\n" +
            configureLongpathsOutput.stdout +
            "\nStderr:\n" +
            configureLongpathsOutput.stderr);
        return undefined;
    }
    finally {
        channel_1.OUTPUT_CHANNEL.appendLine("\nTook " + timing.getTotalElapsedAsStr() + " to obtain diagnostics.");
    }
}
exports.runConfigDiagnostics = runConfigDiagnostics;
async function collectIssueLogs(logPath) {
    function acceptLogFile(f) {
        let lower = path.basename(f).toLowerCase();
        if (!lower.endsWith(".log")) {
            return false;
        }
        // Whitelist what we want so that we don't gather unwanted info.
        if (lower.includes("robocorp code") || lower.includes("robot framework") || lower.includes("exthost")) {
            return true;
        }
        return false;
    }
    // This should be parent directory for the logs.
    let logsRootDir = path.dirname(logPath);
    channel_1.OUTPUT_CHANNEL.appendLine("Log path: " + logsRootDir);
    let logFiles = [];
    const stat = await fs.promises.stat(logsRootDir);
    if (stat.isDirectory()) {
        // Get the .log files under the logsRootDir and subfolders.
        const files = await fs.promises.readdir(logsRootDir);
        for (const fileI of files) {
            let f = path.join(logsRootDir, fileI);
            const stat = await fs.promises.stat(f);
            if (acceptLogFile(f) && stat.isFile()) {
                logFiles.push(f);
            }
            else if (stat.isDirectory()) {
                // No need to recurse (we just go 1 level deep).
                let currDir = f;
                const innerFiles = await fs.promises.readdir(currDir);
                for (const fileI of innerFiles) {
                    let f = path.join(currDir, fileI);
                    const stat = await fs.promises.stat(f);
                    if (acceptLogFile(f) && stat.isFile()) {
                        logFiles.push(f);
                    }
                }
            }
        }
    }
    return {
        "logsRootDir": logsRootDir,
        "logFiles": logFiles,
    };
}
exports.collectIssueLogs = collectIssueLogs;
async function collectIssueBaseMetadata() {
    let version = vscode_1.extensions.getExtension("robocorp.robocorp-code").packageJSON.version;
    const metadata = {
        platform: os.platform(),
        osRelease: os.release(),
        nodeVersion: process.version,
        version: version,
        controller: "rcc.robocorpcode",
    };
    return metadata;
}
async function submitIssue(dialogMessage, email, errorName, errorCode, errorMessage, files // See also: collectIssueLogs(logPath);
) {
    let errored = false;
    try {
        let rccLocation = await getRccLocation();
        if (rccLocation) {
            if (!fs.existsSync(rccLocation)) {
                let msg = "Unable to send issue report (" + rccLocation + ") does not exist.";
                channel_1.OUTPUT_CHANNEL.appendLine(msg);
                vscode_1.window.showErrorMessage(msg);
                return;
            }
            const metadata = await collectIssueBaseMetadata();
            // Add required metadata info from parameters.
            metadata["dialogMessage"] = dialogMessage;
            metadata["email"] = email;
            metadata["errorName"] = errorName;
            metadata["errorCode"] = errorCode;
            metadata["errorMessage"] = errorMessage;
            const robocorpHome = await getRobocorpHome();
            const reportPath = path.join(os.tmpdir(), `robocode_issue_report_${Date.now()}.json`);
            fs.writeFileSync(reportPath, JSON.stringify(metadata, null, 4), { encoding: "utf-8" });
            let args = ["feedback", "issue", "-r", reportPath, "--controller", "RobocorpCode"];
            for (const file of files) {
                args.push("-a");
                args.push(file);
            }
            const env = createEnvWithRobocorpHome(robocorpHome);
            await (0, subprocess_1.execFilePromise)(rccLocation, args, { "env": env });
        }
    }
    catch (err) {
        errored = true;
        (0, channel_1.logError)("Error sending issue.", err, "RCC_SEND_ISSUE");
        vscode_1.window.showErrorMessage("The issue report was not sent. Please see the OUTPUT for more information.");
        channel_1.OUTPUT_CHANNEL.show();
    }
    if (!errored) {
        channel_1.OUTPUT_CHANNEL.appendLine("Issue sent.");
        vscode_1.window.showInformationMessage("Thank you for your issue report. Please check you e-mail (" + email + ") for confirmation.");
    }
    return;
}
exports.submitIssue = submitIssue;
async function feedback(name, value = "+1") {
    const rccLocation = await getRccLocation();
    let args = ["feedback", "metric", "-t", "vscode", "-n", name, "-v", value];
    const robocorpHome = await getRobocorpHome();
    const env = createEnvWithRobocorpHome(robocorpHome);
    await (0, subprocess_1.execFilePromise)(rccLocation, args, { "env": env }, { "hideCommandLine": true });
}
exports.feedback = feedback;
async function feedbackRobocorpCodeError(errorCode) {
    await feedbackAnyError(Metrics.VSCODE_CODE_ERROR, errorCode);
}
exports.feedbackRobocorpCodeError = feedbackRobocorpCodeError;
const reportedErrorCodes = new Set();
/**
 * Submit feedback on some predefined error code.
 *
 * @param errorType Something as "vscode.code.error"
 * @param errorCode The error code to be shown.
 */
async function feedbackAnyError(errorType, errorCode) {
    if (!errorCode) {
        return;
    }
    // Make sure that only one error is reported per error code.
    const errorCodeKey = `${errorType}.${errorCode}`;
    if (reportedErrorCodes.has(errorCodeKey)) {
        return;
    }
    reportedErrorCodes.add(errorCodeKey);
    const rccLocation = await getRccLocation();
    let args = ["feedback", "metric", "-t", "vscode", "-n", errorType, "-v", errorCode];
    const robocorpHome = await getRobocorpHome();
    const env = createEnvWithRobocorpHome(robocorpHome);
    await (0, subprocess_1.execFilePromise)(rccLocation, args, { "env": env }, { "hideCommandLine": true });
}
exports.feedbackAnyError = feedbackAnyError;
/**
 * Note: it's possible that even after enabling this function the holotree isn't shared
 * if the user doesn't have permissions and can't run as admin.
 */
async function enableHolotreeShared(rccLocation, env) {
    const IGNORE_HOLOTREE_SHARED_ENABLE_FAILURE = "IGNORE_HOLOTREE_SHARED_ENABLE_FAILURE";
    try {
        // Enable the holotree shared mode: this changes permissions so that more than one
        // user may write to the holotree (usually in C:\ProgramData\robocorp\ht).
        try {
            const execFileReturn = await (0, subprocess_1.execFilePromise)(rccLocation, ["holotree", "shared", "--enable", "--once"], { "env": env }, { "showOutputInteractively": true });
            channel_1.OUTPUT_CHANNEL.appendLine("Enabled shared holotree");
        }
        catch (err) {
            if (!extension_1.GLOBAL_STATE.get(IGNORE_HOLOTREE_SHARED_ENABLE_FAILURE)) {
                if (process.platform == "win32") {
                    const RETRY_AS_ADMIN = "Retry as admin";
                    const IGNORE = "Ignore (don't ask again)";
                    let response = await vscode_1.window.showWarningMessage("It was not possible to enable the holotree shared mode. How do you want to proceed?", {
                        "modal": true,
                        "detail": "It is Ok to ignore if environments won't be shared with other users in this machine.",
                    }, RETRY_AS_ADMIN, IGNORE);
                    if (response === RETRY_AS_ADMIN) {
                        await (0, extensionCreateEnv_1.runAsAdminWin32)(rccLocation, ["holotree", "shared", "--enable", "--once"], env);
                    }
                    else if (response === IGNORE) {
                        await extension_1.GLOBAL_STATE.update(IGNORE_HOLOTREE_SHARED_ENABLE_FAILURE, true);
                    }
                }
            }
        }
    }
    catch (err) {
        (0, channel_1.logError)("Error while enabling shared holotree.", err, "ERROR_ENABLE_SHARED_HOLOTREE");
    }
}
async function initHolotree(rccLocation, env) {
    try {
        const execFileReturn = await (0, subprocess_1.execFilePromise)(rccLocation, ["holotree", "init"], { "env": env }, { "showOutputInteractively": true });
        channel_1.OUTPUT_CHANNEL.appendLine("Set user to use shared holotree");
        return true;
    }
    catch (err) {
        (0, channel_1.logError)("Error while initializing shared holotree.", err, "ERROR_INITIALIZE_SHARED_HOLOTREE");
        return false;
    }
}
/**
 * This function creates the base holotree space with RCC and then returns its info
 * to start up the language server.
 *
 * @param robocorpHome usually roboConfig.getHome()
 */
async function collectBaseEnv(condaFilePath, robotCondaHash, robocorpHome, rccDiagnostics) {
    let spaceName = "vscode-base-v01-" + robotCondaHash.substring(0, 6);
    let robocorpCodePath = path.join(robocorpHome, ".robocorp_code");
    let spaceInfoPath = path.join(robocorpCodePath, spaceName);
    let rccEnvInfoCachePath = path.join(spaceInfoPath, "rcc_env_info.json");
    try {
        if (!fs.existsSync(spaceInfoPath)) {
            fs.mkdirSync(spaceInfoPath, { "recursive": true });
        }
    }
    catch (err) {
        (0, channel_1.logError)("Error creating directory: " + spaceInfoPath, err, "RCC_COLLECT_BASE_ENV_MKDIR");
    }
    const rccLocation = await getRccLocation();
    if (!rccLocation) {
        vscode_1.window.showErrorMessage("Unable to find RCC.");
        return;
    }
    const USE_PROGRAM_DATA_SHARED = true;
    if (USE_PROGRAM_DATA_SHARED) {
        let execFileReturn;
        const env = createEnvWithRobocorpHome(robocorpHome);
        if (!rccDiagnostics.holotreeShared) {
            // i.e.: if the shared mode is still not enabled, enable it, download the
            // base environment .zip and import it.
            await enableHolotreeShared(rccLocation, env);
            const holotreeInitOk = await initHolotree(rccLocation, env);
            if (holotreeInitOk) {
                // Download and import into holotree.
                const zipDownloadLocation = await getBaseAsZipDownloadLocation();
                let downloadOk = false;
                try {
                    if (!(await (0, files_1.fileExists)(zipDownloadLocation))) {
                        await vscode_1.window.withProgress({
                            location: vscode_1.ProgressLocation.Notification,
                            title: "Download base environment.",
                            cancellable: false,
                        }, async (progress, token) => await downloadBaseAsZip(progress, token, zipDownloadLocation));
                    }
                    downloadOk = await (0, files_1.fileExists)(zipDownloadLocation);
                }
                catch (err) {
                    (0, channel_1.logError)("Error while downloading shared holotree.", err, "ERROR_DOWNLOAD_BASE_ZIP");
                }
                if (downloadOk) {
                    try {
                        let timing = new time_1.Timing();
                        execFileReturn = await (0, subprocess_1.execFilePromise)(rccLocation, ["holotree", "import", zipDownloadLocation], { "env": env }, { "showOutputInteractively": true });
                        channel_1.OUTPUT_CHANNEL.appendLine("Took: " + timing.getTotalElapsedAsStr() + " to import base holotree.");
                    }
                    catch (err) {
                        (0, channel_1.logError)("Error while importing base zip into holotree.", err, "ERROR_IMPORT_BASE_ZIP_HOLOTREE");
                    }
                }
            }
        }
    }
    let envArray = undefined;
    try {
        if (fs.existsSync(rccEnvInfoCachePath)) {
            let contents = fs.readFileSync(rccEnvInfoCachePath, { "encoding": "utf-8" });
            envArray = JSON.parse(contents);
            let cachedEnv = envArrayToEnvMap(envArray, robocorpHome);
            try {
                // Ok, we have the python exe and the env seems valid. Let's make sure it actually works.
                let cachedPythonOk = await checkCachedEnvValid(cachedEnv);
                if (!cachedPythonOk) {
                    envArray = undefined;
                }
            }
            catch (error) {
                (0, channel_1.logError)("Error: error verifying if env is still valid.", error, "RCC_VERIFY_ENV_STILL_VALID");
                envArray = undefined;
            }
            if (envArray) {
                channel_1.OUTPUT_CHANNEL.appendLine("Loading base environment from: " + rccEnvInfoCachePath);
            }
        }
    }
    catch (err) {
        (0, channel_1.logError)("Unable to use cached environment info (recomputing)...", err, "RCC_UNABLE_TO_USE_CACHED");
        envArray = undefined;
    }
    // If the env array is undefined, compute it now and cache the info to be reused later.
    if (!envArray) {
        // If the robot is located in a directory that has '/devdata/env.json', we must automatically
        // add the -e /path/to/devdata/env.json.
        let robotDirName = pathModule.dirname(condaFilePath);
        let envFilename = pathModule.join(robotDirName, "devdata", "env.json");
        let args = ["holotree", "variables", "--space", spaceName, "--json", condaFilePath];
        if (await (0, files_1.fileExists)(envFilename)) {
            args.push("-e");
            args.push(envFilename);
        }
        args.push("--controller");
        args.push("RobocorpCode");
        let execFileReturn = await (0, subprocess_1.execFilePromise)(rccLocation, args, { "env": createEnvWithRobocorpHome(robocorpHome) }, { "showOutputInteractively": true });
        if (!execFileReturn.stdout) {
            feedbackRobocorpCodeError("RCC_NO_RCC_ENV_STDOUT");
            channel_1.OUTPUT_CHANNEL.appendLine("Error: Unable to collect environment from RCC.");
            return undefined;
        }
        try {
            envArray = JSON.parse(execFileReturn.stdout);
        }
        catch (error) {
            (0, channel_1.logError)("Error parsing env from RCC: " + execFileReturn.stdout, error, "RCC_NO_RCC_ENV_STDOUT");
        }
        if (!envArray) {
            channel_1.OUTPUT_CHANNEL.appendLine("Error: Unable to collect env array.");
            return undefined;
        }
        try {
            fs.writeFileSync(rccEnvInfoCachePath, JSON.stringify(envArray));
        }
        catch (err) {
            (0, channel_1.logError)("Error writing environment cache.", err, "RCC_ERROR_WRITE_ENV_CACHE");
        }
    }
    let timestampPath = path.join(spaceInfoPath, "last_usage");
    try {
        fs.writeFileSync(timestampPath, "" + Date.now());
    }
    catch (err) {
        (0, channel_1.logError)("Error writing last usage time to: " + timestampPath, err, "RCC_UPDATE_FILE_USAGE");
    }
    let finalEnv = envArrayToEnvMap(envArray, robocorpHome);
    let tempDir = finalEnv["TEMP"];
    if (tempDir) {
        try {
            // Try to remove the file related to recycling this dir (we don't want to
            // recycle the TEMP dir of this particular env).
            fs.unlink(path.join(tempDir, "recycle.now"), (err) => { });
        }
        catch (err) { }
        try {
            // Create the temp dir (if not there)
            fs.mkdir(tempDir, { "recursive": true }, (err) => { });
        }
        catch (err) { }
    }
    return { "env": finalEnv, "robocorpHome": robocorpHome, "rccLocation": rccLocation };
}
exports.collectBaseEnv = collectBaseEnv;
// Returns something as: https://cloud.robocorp.com/
// The baseUrl is something as: "cloud-ui" or "docs".
async function getEndpointUrl(baseUrl) {
    try {
        const robocorpHome = await getRobocorpHome();
        const env = createEnvWithRobocorpHome(robocorpHome);
        const rccLocation = await getRccLocation();
        let args = ["config", "settings", "--json"];
        const execReturn = await (0, subprocess_1.execFilePromise)(rccLocation, args, { "env": env }, { "hideCommandLine": true });
        const stdout = execReturn.stdout;
        if (stdout) {
            const configSettings = JSON.parse(stdout);
            let url = configSettings["endpoints"][baseUrl];
            if (!url.endsWith("/")) {
                url += "/";
            }
            return url;
        }
        else {
            throw new Error("No stdout from rcc config settings. stderr: " + execReturn.stderr);
        }
    }
    catch (error) {
        (0, channel_1.logError)("Error getting cloud base url.", error, "RCC_GET_CLOUD_BASE_URL");
    }
    if (baseUrl == "cloud-ui") {
        return "https://cloud.robocorp.com/";
    }
    if (baseUrl == "docs") {
        return "https://robocorp.com/docs/";
    }
    throw new Error("Unable to get endpoint url: " + baseUrl);
}
exports.getEndpointUrl = getEndpointUrl;
//# sourceMappingURL=rcc.js.map