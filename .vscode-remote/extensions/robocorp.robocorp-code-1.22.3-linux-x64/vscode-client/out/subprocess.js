"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mergeEnviron = exports.execFilePromise = void 0;
const channel_1 = require("./channel");
const child_process_1 = require("child_process");
const files_1 = require("./files");
async function _execFileAsPromise(command, args, options, configChildProcess) {
    return new Promise((resolve, reject) => {
        let childProcess = (0, child_process_1.execFile)(command, args, options, (error, stdout, stderr) => {
            if (error) {
                reject({ "error": error, "stdout": stdout, "stderr": stderr });
                return;
            }
            resolve({ "stdout": stdout, "stderr": stderr });
        });
        if (configChildProcess) {
            configChildProcess(childProcess);
        }
    });
}
function getDefaultCwd() {
    return (0, files_1.getExtensionRelativeFile)("../../bin", false);
}
/**
 * @param options may be something as: { env: mergeEnviron({ ENV_VAR: 'test' }) }
 */
async function execFilePromise(command, args, options, execConfigOptions) {
    let hideCommandLine = false;
    let configChildProcess = undefined;
    let showOutputInteractively = false;
    if (execConfigOptions !== undefined) {
        hideCommandLine = execConfigOptions.hideCommandLine;
        configChildProcess = execConfigOptions.configChildProcess;
        showOutputInteractively = execConfigOptions.showOutputInteractively;
        if (showOutputInteractively) {
            if (configChildProcess !== undefined) {
                throw new Error("Error: if showOutputInteractively == true, configChildProcess must be undefined.");
            }
            configChildProcess = function (childProcess) {
                childProcess.stderr.on("data", function (data) {
                    channel_1.OUTPUT_CHANNEL.append(data);
                });
                childProcess.stdout.on("data", function (data) {
                    channel_1.OUTPUT_CHANNEL.append(data);
                });
            };
        }
    }
    if (!hideCommandLine) {
        channel_1.OUTPUT_CHANNEL.appendLine("Executing: " + command + " " + args.join(" "));
    }
    try {
        if (!options.cwd) {
            options.cwd = getDefaultCwd();
        }
        return await _execFileAsPromise(command, args, options, configChildProcess);
    }
    catch (exc) {
        let errorInfo = exc;
        let error = errorInfo.error;
        channel_1.OUTPUT_CHANNEL.appendLine("Error executing: " + command + " " + args.join(" "));
        if (error !== undefined) {
            channel_1.OUTPUT_CHANNEL.appendLine("Error: " + error);
            if (error?.message) {
                channel_1.OUTPUT_CHANNEL.appendLine("Error message: " + error.message);
            }
            if (error?.code) {
                channel_1.OUTPUT_CHANNEL.appendLine("Error code: " + error.code);
            }
            if (error?.name) {
                channel_1.OUTPUT_CHANNEL.appendLine("Error name: " + error.name);
            }
        }
        if (!showOutputInteractively) {
            // Only print stderr/stdout if output was not being shown interactively.
            if (errorInfo.stderr) {
                channel_1.OUTPUT_CHANNEL.appendLine("Stderr: " + errorInfo.stderr);
            }
            if (errorInfo.stdout) {
                channel_1.OUTPUT_CHANNEL.appendLine("Stdout: " + errorInfo.stdout);
            }
        }
        throw exc;
    }
}
exports.execFilePromise = execFilePromise;
function mergeEnviron(environ) {
    let baseEnv = {};
    if (process.platform == "win32") {
        Object.keys(process.env).forEach(function (key) {
            // We could have something as `Path` -- convert it to `PATH`.
            baseEnv[key.toUpperCase()] = process.env[key];
        });
    }
    else {
        baseEnv = { ...process.env };
    }
    if (!environ) {
        return baseEnv;
    }
    return { ...baseEnv, ...environ };
}
exports.mergeEnviron = mergeEnviron;
//# sourceMappingURL=subprocess.js.map