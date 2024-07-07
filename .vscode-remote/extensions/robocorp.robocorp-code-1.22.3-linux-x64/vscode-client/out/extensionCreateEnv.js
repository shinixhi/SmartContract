"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLanguageServerPythonInfoUncached = exports.CACHE_KEY_LAST_WORKED = exports.basicValidations = exports.runAsAdminWin32 = void 0;
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const vscode_1 = require("vscode");
const channel_1 = require("./channel");
const files_1 = require("./files");
const rcc_1 = require("./rcc");
const time_1 = require("./time");
const subprocess_1 = require("./subprocess");
const time_2 = require("./time");
const robocorpSettings_1 = require("./robocorpSettings");
const path_1 = require("path");
const extension_1 = require("./extension");
async function resolveDrive(driveLetter) {
    const output = await (0, subprocess_1.execFilePromise)("subst.exe", [], { shell: true }, { hideCommandLine: true, showOutputInteractively: false });
    const stdout = output.stdout;
    driveLetter = driveLetter.toUpperCase();
    for (const line of stdout.split(/\r?\n/)) {
        const splitted = line.split("=>");
        if (splitted.length === 2) {
            const drivepart = splitted[0].trim();
            const resolvepart = splitted[1].trim();
            if (drivepart.endsWith(":\\:") && drivepart[1] == ":") {
                if (drivepart[0].toUpperCase() === driveLetter) {
                    channel_1.OUTPUT_CHANNEL.appendLine(`Resolved substed drive: ${driveLetter} to ${resolvepart}.`);
                    return resolvepart;
                }
            }
        }
    }
    return undefined;
}
async function runAsAdminWin32(rccLocation, args, env) {
    try {
        // Now, at this point we resolve the links to have a canonical location, because
        // we'll execute with a different user (i.e.: admin), we first resolve substs
        // which may not be available for that user (i.e.: a subst can be applied to one
        // account and not to the other) because path.resolve and fs.realPathSync don't
        // seem to resolve substed drives, we do it manually here.
        if (rccLocation.charAt(1) == ":") {
            // Check that we actually have a drive there.
            let resolved = undefined;
            try {
                // Note: this used to work for me (on Windows 10/some version of VSCode),
                // but it seems be failing now, so, another workaround is done to read
                // the drive mappings using subst directly.
                resolved = fs.readlinkSync(rccLocation.charAt(0) + ":");
            }
            catch (error) {
                // ignore (maybe it's not a link)
                try {
                    resolved = await resolveDrive(rccLocation.charAt(0));
                }
                catch (error) {
                    // ignore
                }
            }
            if (resolved) {
                rccLocation = path.join(resolved, rccLocation.slice(2));
            }
        }
        rccLocation = path.resolve(rccLocation);
        rccLocation = fs.realpathSync(rccLocation);
    }
    catch (error) {
        channel_1.OUTPUT_CHANNEL.appendLine("Error (handled) resolving rcc canonical location: " + error);
    }
    rccLocation = rccLocation.split("\\").join("/"); // escape for the shell execute
    let argsAsStr = args.join(" ");
    let result = await (0, subprocess_1.execFilePromise)("C:/Windows/System32/mshta.exe", // i.e.: Windows scripting
    [
        "javascript: var shell = new ActiveXObject('shell.application');" + // create a shell
            "shell.ShellExecute('" +
            rccLocation +
            "', '" +
            argsAsStr +
            "', '', 'runas', 1);close();", // runas will run in elevated mode
    ], { env: env });
}
exports.runAsAdminWin32 = runAsAdminWin32;
async function enableWindowsLongPathSupport(rccLocation) {
    try {
        try {
            // Expected failure if not admin.
            await (0, subprocess_1.execFilePromise)(rccLocation, ["configure", "longpaths", "--enable"], { env: { ...process.env } });
            await (0, time_2.sleep)(100);
        }
        catch (error) {
            // Expected error (it means we need an elevated shell to run the command).
            await runAsAdminWin32(rccLocation, ["configure", "longpaths", "--enable"], { ...process.env });
            // Wait a second for the command to be executed as admin before proceeding.
            await (0, time_2.sleep)(1000);
        }
    }
    catch (error) {
        // Ignore here...
    }
}
async function isLongPathSupportEnabledOnWindows(rccLocation, robocorpHome) {
    try {
        await (0, files_1.makeDirs)(robocorpHome);
        const initialTarget = (0, path_1.join)(robocorpHome, "longpath_" + Date.now() + "" + process.pid);
        let target = initialTarget;
        for (let i = 0; target.length < 270; i++) {
            target = (0, path_1.join)(target, "subdirectory" + i);
        }
        // await makeDirs(target); -- this seems to always work (applications can be built
        // with a manifest to support longpaths, which is apparently done by node, so,
        // check using cmd /c mkdir).
        const args = ["/c", "mkdir", target];
        let enabled = false;
        try {
            await (0, subprocess_1.execFilePromise)("cmd.exe", args, { shell: false }, { hideCommandLine: true, showOutputInteractively: false });
            enabled = await (0, files_1.fileExists)(target);
        }
        catch (err) {
            // Ignore
        }
        try {
            // Note: remove even if not found as it may've created it partially.
            await fs.promises.rm(initialTarget, { recursive: true, force: true, maxRetries: 1 });
        }
        catch (error) {
            // Ignore error
        }
        channel_1.OUTPUT_CHANNEL.appendLine("Windows long paths support enabled");
        return enabled;
    }
    catch (error) {
        channel_1.OUTPUT_CHANNEL.appendLine("Windows long paths support not enabled. Error: " + error.message);
        return false;
    }
    // Code which used to use RCC (not using it because it could error if using diagnostics at the same time.
    // See: https://github.com/robocorp/rcc/issues/45).
    // let enabled: boolean = true;
    // let stdout = "<not collected>";
    // let stderr = "<not collected>";
    // try {
    //     let configureLongpathsOutput: ExecFileReturn = await execFilePromise(rccLocation, ["configure", "longpaths"], {
    //         env: { ...process.env },
    //     });
    //     stdout = configureLongpathsOutput.stdout;
    //     stderr = configureLongpathsOutput.stderr;
    //     if (stdout.indexOf("OK.") != -1 || stderr.indexOf("OK.") != -1) {
    //         enabled = true;
    //     } else {
    //         enabled = false;
    //     }
    // } catch (error) {
    //     enabled = false;
    //     logError("There was some error with rcc configure longpaths.", error, "RCC_CONFIGURE_LONGPATHS");
    // }
    // if (enabled) {
    //     OUTPUT_CHANNEL.appendLine("Windows long paths support enabled");
    // } else {
    //     OUTPUT_CHANNEL.appendLine(
    //         `Windows long paths support NOT enabled.\nRCC stdout:\n${stdout}\nRCC stderr:\n${stderr}`
    //     );
    // }
    // return enabled;
}
async function verifyLongPathSupportOnWindows(rccLocation, robocorpHome, failsPreventStartup) {
    if (process.env.ROBOCORP_OVERRIDE_SYSTEM_REQUIREMENTS) {
        // i.e.: When set we do not try to check (this flag makes "rcc configure longpaths"
        // return an error).
        return true;
    }
    if (process.platform == "win32") {
        while (true) {
            const proceed = (0, robocorpSettings_1.getProceedwithlongpathsdisabled)();
            if (proceed) {
                return true;
            }
            let enabled = await isLongPathSupportEnabledOnWindows(rccLocation, robocorpHome);
            if (!enabled) {
                const YES = "Yes (requires admin)";
                const MANUALLY = "Open manual instructions";
                const NO = "No (don't warn again)";
                let result = await vscode_1.window.showErrorMessage("Windows long paths support is not enabled. Would you like to have Robocorp Code enable it now?", {
                    "modal": true,
                    "detail": "Note: it's possible to  proceed without enabling long paths, but keep in mind that may " +
                        "result in failures creating environments or running Robots if a dependency has long paths.",
                }, YES, MANUALLY, NO
                // Auto-cancel in modal
                );
                if (result == YES) {
                    // Enable it.
                    await enableWindowsLongPathSupport(rccLocation);
                    let enabled = await isLongPathSupportEnabledOnWindows(rccLocation, robocorpHome);
                    if (enabled) {
                        return true;
                    }
                    else {
                        let result = await vscode_1.window.showErrorMessage("It was not possible to automatically enable windows long path support. " +
                            "Please follow the instructions from https://robocorp.com/docs/troubleshooting/windows-long-path (press Ok to open in browser).", { "modal": true }, "Ok"
                        // Auto-cancel in modal
                        );
                        if (result == "Ok") {
                            await vscode_1.env.openExternal(vscode_1.Uri.parse("https://robocorp.com/docs/troubleshooting/windows-long-path"));
                        }
                    }
                }
                else if (result == MANUALLY) {
                    await vscode_1.env.openExternal(vscode_1.Uri.parse("https://robocorp.com/docs/troubleshooting/windows-long-path"));
                }
                else if (result == NO) {
                    await (0, robocorpSettings_1.setProceedwithlongpathsdisabled)(true);
                    return true;
                }
                else {
                    // Cancel
                    if (failsPreventStartup) {
                        channel_1.OUTPUT_CHANNEL.appendLine("Extension will not be activated because Windows long paths support not enabled.");
                    }
                    else {
                        channel_1.OUTPUT_CHANNEL.appendLine("Windows long paths support not enabled.");
                    }
                    return false;
                }
                let resultOkLongPath = await vscode_1.window.showInformationMessage("Press Ok after Long Path support is manually enabled.", { "modal": true }, "Ok"
                // Auto-cancel in modal
                );
                if (!resultOkLongPath) {
                    if (failsPreventStartup) {
                        channel_1.OUTPUT_CHANNEL.appendLine("Extension will not be activated because Windows long paths support not enabled.");
                    }
                    else {
                        channel_1.OUTPUT_CHANNEL.appendLine("Windows long paths support not enabled.");
                    }
                    return false;
                }
            }
            else {
                return true;
            }
        }
    }
    return true;
}
async function basicValidations(rccLocation, robocorpHome, configDiagnosticsPromise, failsPreventStartup) {
    // Check that the user has long names enabled on windows.
    if (!(await verifyLongPathSupportOnWindows(rccLocation, robocorpHome, failsPreventStartup)) &&
        failsPreventStartup) {
        (0, rcc_1.feedbackRobocorpCodeError)("INIT_NO_LONGPATH_SUPPORT");
        return { success: false, message: "", result: undefined };
    }
    // Check that ROBOCORP_HOME is valid (i.e.: doesn't have any spaces in it).
    let rccDiagnostics = await configDiagnosticsPromise;
    if (!rccDiagnostics) {
        let msg = "There was an error getting RCC diagnostics. Robocorp Code will not be started!";
        if (!failsPreventStartup) {
            msg = "There was an error getting RCC diagnostics.";
        }
        channel_1.OUTPUT_CHANNEL.appendLine(msg);
        vscode_1.window.showErrorMessage(msg);
        (0, rcc_1.feedbackRobocorpCodeError)("INIT_NO_RCC_DIAGNOSTICS");
        return { success: false, message: "", result: rccDiagnostics };
    }
    while (!rccDiagnostics.isRobocorpHomeOk()) {
        const SELECT_ROBOCORP_HOME = "Set new ROBOCORP_HOME";
        const CANCEL = "Cancel";
        let result = await vscode_1.window.showInformationMessage("The current ROBOCORP_HOME is invalid (paths with spaces/non ascii chars are not supported).", SELECT_ROBOCORP_HOME, CANCEL);
        if (!result || result == CANCEL) {
            channel_1.OUTPUT_CHANNEL.appendLine("Cancelled setting new ROBOCORP_HOME.");
            (0, rcc_1.feedbackRobocorpCodeError)("INIT_INVALID_ROBOCORP_HOME");
            if (failsPreventStartup) {
                return { success: false, message: "", result: rccDiagnostics };
            }
            else {
                break;
            }
        }
        let uriResult = await vscode_1.window.showOpenDialog({
            "canSelectFolders": true,
            "canSelectFiles": false,
            "canSelectMany": false,
            "openLabel": "Set as ROBOCORP_HOME",
        });
        if (!uriResult) {
            channel_1.OUTPUT_CHANNEL.appendLine("Cancelled getting ROBOCORP_HOME path.");
            (0, rcc_1.feedbackRobocorpCodeError)("INIT_CANCELLED_ROBOCORP_HOME");
            if (failsPreventStartup) {
                return { success: false, message: "", result: rccDiagnostics };
            }
            else {
                break;
            }
        }
        if (uriResult.length != 1) {
            channel_1.OUTPUT_CHANNEL.appendLine("Expected 1 path to set as ROBOCORP_HOME. Found: " + uriResult.length);
            (0, rcc_1.feedbackRobocorpCodeError)("INIT_ROBOCORP_HOME_NO_PATH");
            if (failsPreventStartup) {
                return { success: false, message: "", result: rccDiagnostics };
            }
            else {
                break;
            }
        }
        robocorpHome = uriResult[0].fsPath;
        rccDiagnostics = await (0, rcc_1.runConfigDiagnostics)(rccLocation, robocorpHome);
        if (!rccDiagnostics) {
            let msg = "There was an error getting RCC diagnostics. Robocorp Code will not be started!";
            if (!failsPreventStartup) {
                msg = "There was an error getting RCC diagnostics.";
            }
            channel_1.OUTPUT_CHANNEL.appendLine(msg);
            vscode_1.window.showErrorMessage(msg);
            (0, rcc_1.feedbackRobocorpCodeError)("INIT_NO_RCC_DIAGNOSTICS_2");
            if (failsPreventStartup) {
                return { success: false, message: "", result: rccDiagnostics };
            }
            else {
                break;
            }
        }
        if (rccDiagnostics.isRobocorpHomeOk()) {
            channel_1.OUTPUT_CHANNEL.appendLine("Selected ROBOCORP_HOME: " + robocorpHome);
            let config = vscode_1.workspace.getConfiguration("robocorp");
            await config.update("home", robocorpHome, vscode_1.ConfigurationTarget.Global);
        }
    }
    function createOpenUrl(failedCheck) {
        return (value) => {
            if (value == "Open troubleshoot URL") {
                vscode_1.env.openExternal(vscode_1.Uri.parse(failedCheck.url));
            }
        };
    }
    let canProceed = true;
    for (const failedCheck of rccDiagnostics.failedChecks) {
        if (failedCheck.status == rcc_1.STATUS_FATAL) {
            canProceed = false;
        }
        let func = vscode_1.window.showErrorMessage;
        if (failedCheck.status == rcc_1.STATUS_WARNING) {
            func = vscode_1.window.showWarningMessage;
        }
        if (failedCheck.url) {
            func(failedCheck.message, "Open troubleshoot URL").then(createOpenUrl(failedCheck));
        }
        else {
            func(failedCheck.message);
        }
    }
    if (!canProceed) {
        (0, rcc_1.feedbackRobocorpCodeError)("INIT_RCC_STATUS_FATAL");
        return { success: false, message: "", result: rccDiagnostics };
    }
    return { success: true, message: "", result: rccDiagnostics };
}
exports.basicValidations = basicValidations;
/**
 * @returns the result of running `get_env_info.py`.
 */
async function createDefaultEnv(progress, robotConda, robotCondaHash, rccLocation, robocorpHome, configDiagnosticsPromise) {
    const getEnvInfoPy = (0, files_1.getExtensionRelativeFile)("../../bin/create_env/get_env_info.py");
    if (!getEnvInfoPy) {
        channel_1.OUTPUT_CHANNEL.appendLine("Unable to find: ../../bin/create_env/get_env_info.py in extension.");
        (0, rcc_1.feedbackRobocorpCodeError)("INIT_GET_ENV_INFO_FAIL");
        return undefined;
    }
    const basicValidationsResult = await basicValidations(rccLocation, robocorpHome, configDiagnosticsPromise, true);
    if (!basicValidationsResult.success) {
        return undefined;
    }
    progress.report({ message: "Update env (may take a few minutes)." });
    // Get information on a base package with our basic dependencies (this can take a while...).
    const rccDiagnostics = basicValidationsResult.result;
    let rccEnvPromise = (0, rcc_1.collectBaseEnv)(robotConda, robotCondaHash, robocorpHome, rccDiagnostics);
    let timing = new time_1.Timing();
    let finishedCondaRun = false;
    let onFinish = function () {
        finishedCondaRun = true;
    };
    rccEnvPromise.then(onFinish, onFinish);
    // Busy async loop so that we can show the elapsed time.
    while (true) {
        await (0, time_2.sleep)(93); // Strange sleep so it's not always a .0 when showing ;)
        if (finishedCondaRun) {
            break;
        }
        if (timing.elapsedFromLastMeasurement(5000)) {
            progress.report({
                message: "Update env (may take a few minutes). " + timing.getTotalElapsedAsStr() + " elapsed.",
            });
        }
    }
    let envResult = await rccEnvPromise;
    channel_1.OUTPUT_CHANNEL.appendLine("Took: " + timing.getTotalElapsedAsStr() + " to update conda env.");
    if (!envResult) {
        channel_1.OUTPUT_CHANNEL.appendLine("Error creating conda env.");
        (0, rcc_1.feedbackRobocorpCodeError)("INIT_ERROR_CONDA_ENV");
        return undefined;
    }
    // Ok, we now have the holotree space created and just collected the environment variables. Let's now do
    // a raw python run with that information to collect information from python.
    let pythonExe = envResult.env["PYTHON_EXE"];
    if (!pythonExe) {
        channel_1.OUTPUT_CHANNEL.appendLine("Error: PYTHON_EXE not available in the holotree environment.");
        (0, rcc_1.feedbackRobocorpCodeError)("INIT_NO_PYTHON_EXE_IN_HOLOTREE");
        return undefined;
    }
    let pythonTiming = new time_1.Timing();
    let resultPromise = (0, subprocess_1.execFilePromise)(pythonExe, [getEnvInfoPy], { env: envResult.env });
    let finishedPythonRun = false;
    let onFinishPython = function () {
        finishedPythonRun = true;
    };
    resultPromise.then(onFinishPython, onFinishPython);
    // Busy async loop so that we can show the elapsed time.
    while (true) {
        await (0, time_2.sleep)(93); // Strange sleep so it's not always a .0 when showing ;)
        if (finishedPythonRun) {
            break;
        }
        if (timing.elapsedFromLastMeasurement(5000)) {
            progress.report({ message: "Collecting env info. " + timing.getTotalElapsedAsStr() + " elapsed." });
        }
    }
    let ret = await resultPromise;
    channel_1.OUTPUT_CHANNEL.appendLine("Took: " + pythonTiming.getTotalElapsedAsStr() + " to collect python info.");
    return ret;
}
/**
 * Shows a messages saying that the extension is disabled (as an error message to the user)
 * and logs it to OUTPUT > Robocorp Code.
 */
function disabled(msg) {
    msg = "Robocorp Code extension disabled. Reason: " + msg;
    channel_1.OUTPUT_CHANNEL.appendLine(msg);
    vscode_1.window.showErrorMessage(msg);
    channel_1.OUTPUT_CHANNEL.show();
    return undefined;
}
/**
 * Helper class for making the startup.
 */
class StartupHelper {
    constructor() {
        this.feedbackErrorCode = undefined;
        this.feedbackErrorMessage = undefined;
        this.robotYaml = (0, files_1.getExtensionRelativeFile)("../../bin/create_env/robot.yaml");
        if (!this.robotYaml) {
            this.error("INIT_ROBOT_YAML_NOT_AVAILABLE", "Unable to find: ../../bin/create_env/robot.yaml in extension.");
            return;
        }
        switch (process.platform) {
            case "darwin":
                this.robotConda = (0, files_1.getExtensionRelativeFile)("../../bin/create_env/conda_vscode_darwin_amd64.yaml");
                break;
            case "linux":
                this.robotConda = (0, files_1.getExtensionRelativeFile)("../../bin/create_env/conda_vscode_linux_amd64.yaml");
                break;
            case "win32":
                this.robotConda = (0, files_1.getExtensionRelativeFile)("../../bin/create_env/conda_vscode_windows_amd64.yaml");
                break;
            default:
                this.robotConda = (0, files_1.getExtensionRelativeFile)("../../bin/create_env/conda.yaml");
                break;
        }
        if (!this.robotConda) {
            this.error("INIT_CONDA_YAML_NOT_AVAILABLE", `Unable to find: conda.yaml for ${process.platform} in ../../bin/create_env/.`);
        }
        this.robotCondaHashPromise = (async () => {
            try {
                const text = (await fs.promises.readFile(this.robotConda, "utf-8")).replace(/(?:\r\n|\r)/g, "\n");
                return crypto.createHash("sha256").update(text, "utf8").digest("hex");
            }
            catch (error) {
                this.error("INIT_READ_CONDA_YAML", "Error reading: " + this.robotConda, error);
            }
            return undefined;
        })();
    }
    error(errorCode, msg, error) {
        this.feedbackErrorMessage = msg;
        this.feedbackErrorCode = errorCode;
        (0, channel_1.logError)(msg, error, errorCode);
        disabled(this.feedbackErrorMessage);
    }
    hasStartupErrors() {
        return this.feedbackErrorMessage !== undefined || this.feedbackErrorCode !== undefined;
    }
    async getRobotCondaHash() {
        return await this.robotCondaHashPromise;
    }
}
const CACHE_KEY_DEFAULT_ENV_JSON_CONTENTS = "DEFAULT_ENV_JSON_CONTENTS";
const CACHE_KEY_LAST_ROBOT_CONDA_HASH = "LAST_ROBOT_CONDA_HASH";
// This is set just when the language server is properly set (and it's reset at each new invocation).
exports.CACHE_KEY_LAST_WORKED = "LAST_WORKED";
/**
 * Provides the python information needed to start the language server.
 */
async function getLanguageServerPythonInfoUncached() {
    const getRccLocationPromise = (0, rcc_1.getRccLocation)();
    const startupHelper = new StartupHelper();
    if (startupHelper.hasStartupErrors()) {
        return;
    }
    // Note: the startup helper notifies about errors in getRobotCondaHash already.
    let robotCondaHash = await startupHelper.getRobotCondaHash();
    if (!robotCondaHash) {
        return;
    }
    let rccLocation = await getRccLocationPromise;
    if (!rccLocation) {
        (0, rcc_1.feedbackRobocorpCodeError)("INIT_RCC_NOT_AVAILABLE");
        return disabled("Unable to get rcc executable location.");
    }
    let robocorpHome = await (0, rcc_1.getRobocorpHome)();
    const configDiagnosticsPromise = (0, rcc_1.runConfigDiagnostics)(rccLocation, robocorpHome);
    // Get and clear flag (it's set to true when the language server successfully starts afterwards
    // -- if it doesn't we have to refresh the env again instead of using the cached version).
    const lastWorked = extension_1.GLOBAL_STATE.get(exports.CACHE_KEY_LAST_WORKED);
    extension_1.GLOBAL_STATE.update(exports.CACHE_KEY_LAST_WORKED, undefined);
    if (extension_1.GLOBAL_STATE.get(CACHE_KEY_LAST_ROBOT_CONDA_HASH) === robotCondaHash && lastWorked) {
        const initialJsonContents = extension_1.GLOBAL_STATE.get(CACHE_KEY_DEFAULT_ENV_JSON_CONTENTS);
        if (initialJsonContents !== undefined && initialJsonContents.length > 0) {
            const ret = extractInfoFromJsonContents(initialJsonContents);
            if (ret.success) {
                // If it worked, schedule the validation to be done later but return with the result right away!
                basicValidations(rccLocation, robocorpHome, configDiagnosticsPromise, false);
                return ret.result;
            }
            // Don't log anything if it didn't work (just stop using the cache).
        }
    }
    let stderr = "<not available>";
    let stdout = "<not available>";
    let result = await vscode_1.window.withProgress({
        location: vscode_1.ProgressLocation.Notification,
        title: "Robocorp",
        cancellable: false,
    }, async (progress) => {
        return await createDefaultEnv(progress, startupHelper.robotConda, robotCondaHash, rccLocation, robocorpHome, configDiagnosticsPromise);
    });
    if (!result) {
        (0, rcc_1.feedbackRobocorpCodeError)("INIT_NO_PYTHON_LANGUAGE_SERVER");
        return disabled("Unable to get python to launch language server.");
    }
    const initialJsonContents = result.stderr;
    stderr = result.stderr;
    stdout = result.stdout;
    try {
        if (initialJsonContents === undefined || initialJsonContents.length == 0) {
            (0, rcc_1.feedbackRobocorpCodeError)("INIT_PYTHON_NO_JSON_CONTENTS");
            return disabled("Unable to collect information for base environment (no json contents).");
        }
        const ret = extractInfoFromJsonContents(initialJsonContents);
        if (ret.success) {
            // If everything seems fine up to this point, cache it so that we can start
            // just by using it afterwards.
            extension_1.GLOBAL_STATE.update(CACHE_KEY_DEFAULT_ENV_JSON_CONTENTS, initialJsonContents);
            extension_1.GLOBAL_STATE.update(CACHE_KEY_LAST_ROBOT_CONDA_HASH, robotCondaHash);
            return ret.result;
        }
        else {
            (0, rcc_1.feedbackRobocorpCodeError)("INIT_PYTHON_BAD_JSON_CONTENTS");
            return disabled(ret.message);
        }
    }
    catch (error) {
        (0, rcc_1.feedbackRobocorpCodeError)("INIT_UNEXPECTED");
        return disabled("Unable to get python to launch language server.\nStderr: " + stderr + "\nStdout: " + stdout);
    }
}
exports.getLanguageServerPythonInfoUncached = getLanguageServerPythonInfoUncached;
function extractInfoFromJsonContents(initialJsonContents) {
    let jsonContents = initialJsonContents;
    let start = jsonContents.indexOf("JSON START>>");
    let end = jsonContents.indexOf("<<JSON END");
    if (start == -1 || end == -1) {
        return {
            success: false,
            message: `Unable to start because JSON START or JSON END could not be found.`,
            result: undefined,
        };
    }
    start += "JSON START>>".length;
    jsonContents = jsonContents.substr(start, end - start);
    let contents = JSON.parse(jsonContents);
    let pythonExe = contents["python_executable"];
    channel_1.OUTPUT_CHANNEL.appendLine("Python executable: " + pythonExe);
    channel_1.OUTPUT_CHANNEL.appendLine("Python version: " + contents["python_version"]);
    channel_1.OUTPUT_CHANNEL.appendLine("Robot Version: " + contents["robot_version"]);
    let env = contents["environment"];
    if (!env) {
        channel_1.OUTPUT_CHANNEL.appendLine("Environment: NOT received");
    }
    else {
        // Print some env vars we may care about:
        channel_1.OUTPUT_CHANNEL.appendLine("Environment:");
        channel_1.OUTPUT_CHANNEL.appendLine("    PYTHONPATH: " + env["PYTHONPATH"]);
        channel_1.OUTPUT_CHANNEL.appendLine("    APPDATA: " + env["APPDATA"]);
        channel_1.OUTPUT_CHANNEL.appendLine("    HOMEDRIVE: " + env["HOMEDRIVE"]);
        channel_1.OUTPUT_CHANNEL.appendLine("    HOMEPATH: " + env["HOMEPATH"]);
        channel_1.OUTPUT_CHANNEL.appendLine("    HOME: " + env["HOME"]);
        channel_1.OUTPUT_CHANNEL.appendLine("    ROBOT_ROOT: " + env["ROBOT_ROOT"]);
        channel_1.OUTPUT_CHANNEL.appendLine("    ROBOT_ARTIFACTS: " + env["ROBOT_ARTIFACTS"]);
        channel_1.OUTPUT_CHANNEL.appendLine("    RCC_INSTALLATION_ID: " + env["RCC_INSTALLATION_ID"]);
        channel_1.OUTPUT_CHANNEL.appendLine("    ROBOCORP_HOME: " + env["ROBOCORP_HOME"]);
        channel_1.OUTPUT_CHANNEL.appendLine("    PROCESSOR_ARCHITECTURE: " + env["PROCESSOR_ARCHITECTURE"]);
        channel_1.OUTPUT_CHANNEL.appendLine("    OS: " + env["OS"]);
        channel_1.OUTPUT_CHANNEL.appendLine("    PATH: " + env["PATH"]);
    }
    if ((0, files_1.verifyFileExists)(pythonExe)) {
        return {
            success: true,
            message: "",
            result: {
                pythonExe: pythonExe,
                environ: contents["environment"],
                additionalPythonpathEntries: [],
            },
        };
    }
    return {
        success: false,
        message: `Unable to start because ${pythonExe} does not exist.`,
        result: undefined,
    };
}
//# sourceMappingURL=extensionCreateEnv.js.map