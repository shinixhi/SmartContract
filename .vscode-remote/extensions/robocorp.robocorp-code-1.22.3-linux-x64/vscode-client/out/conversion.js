"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertAndSaveResults = exports.ensureConvertBundle = exports.getConverterBundleVersion = exports.conversionMain = exports.RPA_TYPE_TO_CAPTION = exports.DEFAULT_TARGET_LANGUAGE = exports.TargetLanguages = exports.RPATypes = exports.CONVERSION_STATUS = void 0;
const AdmZip = require("adm-zip");
const rimraf = require("rimraf");
const path = require("path");
const vscode_1 = require("vscode");
const files_1 = require("./files");
const rcc_1 = require("./rcc");
const path_1 = require("path");
const channel_1 = require("./channel");
const util_1 = require("util");
const protocols_1 = require("./protocols");
const fs_1 = require("fs");
exports.CONVERSION_STATUS = {
    alreadyCheckedVersion: false,
};
var RPATypes;
(function (RPATypes) {
    RPATypes["uipath"] = "uipath";
    RPATypes["blueprism"] = "blueprism";
    RPATypes["a360"] = "a360";
    RPATypes["aav11"] = "aav11";
})(RPATypes = exports.RPATypes || (exports.RPATypes = {}));
var TargetLanguages;
(function (TargetLanguages) {
    TargetLanguages["RF"] = "RF";
    TargetLanguages["PYTHON"] = "PYTHON";
    TargetLanguages["DOT"] = "DOT";
})(TargetLanguages = exports.TargetLanguages || (exports.TargetLanguages = {}));
exports.DEFAULT_TARGET_LANGUAGE = TargetLanguages.RF;
exports.RPA_TYPE_TO_CAPTION = {
    "uipath": "UiPath",
    "blueprism": "Blue Prism",
    "a360": "Automation Anywhere 360",
    "aav11": "Automation Anywhere 11",
};
async function conversionMain(converterBundle, command) {
    return await converterBundle.main(command);
}
exports.conversionMain = conversionMain;
const getConverterBundleVersion = async () => {
    const versionURL = "https://downloads.robocorp.com/converter/latest/version-with-commons.txt";
    const currentVersionLocation = (0, files_1.getExtensionRelativeFile)("../../vscode-client/out/converterBundle.version", false);
    const newVersionLocation = (0, files_1.getExtensionRelativeFile)("../../vscode-client/out/converterBundle.version.new", false);
    // downloading & reading the new version
    const currentVersion = await (0, files_1.readFromFile)(currentVersionLocation);
    let newVersion = undefined;
    await vscode_1.window.withProgress({
        location: vscode_1.ProgressLocation.Notification,
        title: "Checking converter version",
        cancellable: false,
    }, async (progress, token) => {
        const result = await (0, rcc_1.download)(versionURL, progress, token, currentVersion ? newVersionLocation : currentVersionLocation);
        newVersion = await (0, files_1.readFromFile)(currentVersion ? newVersionLocation : currentVersionLocation);
        return result;
    });
    return { currentVersion: currentVersion, newVersion: newVersion, currentVersionLocation: currentVersionLocation };
};
exports.getConverterBundleVersion = getConverterBundleVersion;
async function ensureConvertBundle() {
    const bundleURL = "https://downloads.robocorp.com/converter/latest/converter-with-commons.zip";
    const bundleRelativeLocation = "../../vscode-client/out/converter-with-commons.zip";
    const bundleLocation = (0, files_1.getExtensionRelativeFile)(bundleRelativeLocation, false);
    const bundleFolderRelativeLocation = "../../vscode-client/out/converter-with-commons";
    const bundleFolderLocation = (0, files_1.getExtensionRelativeFile)(bundleFolderRelativeLocation, false);
    // downloading the bundle
    const downloadBundle = async () => await vscode_1.window.withProgress({
        location: vscode_1.ProgressLocation.Notification,
        title: "Downloading converter bundle",
        cancellable: false,
    }, async (progress, token) => await (0, rcc_1.download)(bundleURL, progress, token, bundleLocation));
    const unzipBundle = async () => {
        // remove previous bundle if it exists
        if ((0, files_1.verifyFileExists)(bundleFolderLocation, false)) {
            rimraf.sync(bundleFolderLocation);
        }
        const zip = new AdmZip(bundleLocation);
        zip.extractAllTo(bundleFolderLocation);
    };
    // if the bundle file doesn't exit or isn't marked as being downloaded, force download
    const warnUser = false;
    if (!(0, files_1.verifyFileExists)(bundleLocation, warnUser)) {
        await downloadBundle();
        await unzipBundle();
    }
    else if (!exports.CONVERSION_STATUS.alreadyCheckedVersion) {
        exports.CONVERSION_STATUS.alreadyCheckedVersion = true;
        const { currentVersion, newVersion, currentVersionLocation } = await (0, exports.getConverterBundleVersion)();
        if (currentVersion && newVersion && currentVersion !== newVersion) {
            // ask user if we should download the new version of the bundle or use old one
            const items = ["Yes", "No"];
            const shouldUpgrade = await vscode_1.window.showQuickPick(items, {
                "placeHolder": `Would you like to update the converter to version: ${newVersion}?`,
                "canPickMany": false,
                "ignoreFocusOut": true,
            });
            if (shouldUpgrade && shouldUpgrade !== "No") {
                await (0, files_1.writeToFile)(currentVersionLocation, newVersion);
                await downloadBundle();
                await unzipBundle();
            }
        }
    }
    const executable = path.join(bundleFolderLocation, "bundle.js");
    const convertYaml = path.join(bundleFolderLocation, "robocorp-commons", "convert.yaml");
    return {
        pathToExecutable: executable,
        pathToConvertYaml: (0, files_1.verifyFileExists)(convertYaml) ? convertYaml : undefined,
    };
}
exports.ensureConvertBundle = ensureConvertBundle;
async function convertAndSaveResults(convertBundlePromise, opts) {
    const converterLocation = await convertBundlePromise;
    if (!converterLocation) {
        return {
            "success": false,
            "message": "There was an issue downloading the converter bundle. Please try again.",
        };
    }
    const converterBundle = require(converterLocation.pathToExecutable);
    let rpaConversionCommands = [];
    if (!opts.input || opts.input.length === 0) {
        return {
            "success": false,
            "message": "Unable to do conversion because input was not specified.",
        };
    }
    // We want to create a structure such as:
    //
    // Just for conversions:
    // /output_folder/converted-uipath/...
    // /output_folder/converted-uipath-1/...
    // ...
    //
    // For analysis + conversion:
    // /output_folder/converted-uipath-1/analysis
    // /output_folder/converted-uipath-1/generated
    const cleanups = [];
    (0, rcc_1.feedback)(rcc_1.Metrics.CONVERTER_USED, opts.inputType);
    try {
        let nextBasename;
        const targetLanguage = opts.targetLanguage;
        switch (opts.inputType) {
            case RPATypes.uipath: {
                nextBasename = await (0, files_1.findNextBasenameIn)(opts.outputFolder, "converted-uipath");
                const projects = opts.input;
                const tempDir = (0, path_1.join)(opts.outputFolder, nextBasename, "temp");
                await (0, files_1.makeDirs)(tempDir);
                cleanups.push(() => {
                    try {
                        (0, fs_1.rmSync)(tempDir, { recursive: true, force: true, maxRetries: 1 });
                    }
                    catch (err) {
                        channel_1.OUTPUT_CHANNEL.appendLine("Error deleting: " + tempDir + ": " + err.message);
                    }
                });
                rpaConversionCommands.push({
                    command: protocols_1.CommandType.Schema,
                    vendor: protocols_1.Format.UIPATH,
                    projects: projects,
                    onProgress: undefined,
                    outputRelativePath: (0, path_1.join)(nextBasename, "schema"),
                });
                rpaConversionCommands.push({
                    command: protocols_1.CommandType.Analyse,
                    vendor: protocols_1.Format.UIPATH,
                    projects: projects,
                    onProgress: undefined,
                    tempFolder: tempDir,
                    outputRelativePath: (0, path_1.join)(nextBasename, "analysis"),
                });
                for (const it of opts.input) {
                    rpaConversionCommands.push({
                        vendor: protocols_1.Format.UIPATH,
                        command: protocols_1.CommandType.Convert,
                        projectFolderPath: it,
                        targetLanguage,
                        onProgress: undefined,
                        outputRelativePath: (0, path_1.join)(nextBasename, (0, path_1.basename)(it)),
                    });
                }
                break;
            }
            case RPATypes.blueprism: {
                nextBasename = await (0, files_1.findNextBasenameIn)(opts.outputFolder, "converted-blueprism");
                const projects = opts.input;
                const tempDir = (0, path_1.join)(opts.outputFolder, nextBasename, "temp");
                await (0, files_1.makeDirs)(tempDir);
                cleanups.push(() => {
                    try {
                        (0, fs_1.rmSync)(tempDir, { recursive: true, force: true, maxRetries: 1 });
                    }
                    catch (err) {
                        channel_1.OUTPUT_CHANNEL.appendLine("Error deleting: " + tempDir + ": " + err.message);
                    }
                });
                rpaConversionCommands.push({
                    command: protocols_1.CommandType.Analyse,
                    vendor: protocols_1.Format.BLUEPRISM,
                    projects: projects,
                    onProgress: undefined,
                    tempFolder: tempDir,
                    outputRelativePath: (0, path_1.join)(nextBasename, "analysis"),
                });
                for (const it of opts.input) {
                    let contents = "";
                    try {
                        if (!(await (0, files_1.fileExists)(it))) {
                            return {
                                "success": false,
                                "message": `${it} does not exist.`,
                            };
                        }
                        const uri = vscode_1.Uri.file(it);
                        const bytes = await vscode_1.workspace.fs.readFile(uri);
                        contents = new util_1.TextDecoder("utf-8").decode(bytes);
                    }
                    catch (err) {
                        const message = "Unable to read: " + it + "\n" + err.message;
                        (0, channel_1.logError)(message, err, "ERROR_READ_BLUEPRISM_FILE");
                        return {
                            "success": false,
                            "message": message,
                        };
                    }
                    rpaConversionCommands.push({
                        vendor: protocols_1.Format.BLUEPRISM,
                        command: protocols_1.CommandType.Convert,
                        releaseFileContent: contents,
                        apiImplementationFolderPath: converterLocation.pathToConvertYaml,
                        targetLanguage,
                        onProgress: undefined,
                        outputRelativePath: (0, path_1.join)(nextBasename, (0, path_1.basename)(it)),
                    });
                }
                break;
            }
            case RPATypes.a360: {
                nextBasename = await (0, files_1.findNextBasenameIn)(opts.outputFolder, "converted-a360");
                const projects = opts.input;
                const tempDir = (0, path_1.join)(opts.outputFolder, nextBasename, "temp");
                await (0, files_1.makeDirs)(tempDir);
                cleanups.push(() => {
                    try {
                        (0, fs_1.rmSync)(tempDir, { recursive: true, force: true, maxRetries: 1 });
                    }
                    catch (err) {
                        channel_1.OUTPUT_CHANNEL.appendLine("Error deleting: " + tempDir + ": " + err.message);
                    }
                });
                rpaConversionCommands.push({
                    command: protocols_1.CommandType.Schema,
                    vendor: protocols_1.Format.A360,
                    projects: projects,
                    onProgress: undefined,
                    outputRelativePath: (0, path_1.join)(nextBasename, "schema"),
                });
                rpaConversionCommands.push({
                    command: protocols_1.CommandType.Analyse,
                    vendor: protocols_1.Format.A360,
                    projects: projects,
                    onProgress: undefined,
                    tempFolder: tempDir,
                    outputRelativePath: (0, path_1.join)(nextBasename, "analysis"),
                });
                const adapterFilePaths = [];
                if ((0, fs_1.existsSync)(opts.adapterFolderPath)) {
                    const stat = (0, fs_1.statSync)(opts.adapterFolderPath);
                    if (stat.isDirectory()) {
                        const files = (0, fs_1.readdirSync)(opts.adapterFolderPath);
                        for (const file of files) {
                            const filepath = path.join(opts.adapterFolderPath, file);
                            const fileStat = (0, fs_1.statSync)(filepath);
                            if (fileStat.isFile()) {
                                adapterFilePaths.push(filepath);
                            }
                        }
                    }
                }
                for (const it of opts.input) {
                    rpaConversionCommands.push({
                        vendor: protocols_1.Format.A360,
                        command: protocols_1.CommandType.Convert,
                        projectFolderPath: it,
                        adapterFilePaths,
                        targetLanguage,
                        onProgress: undefined,
                        outputRelativePath: (0, path_1.join)(nextBasename, (0, path_1.basename)(it)),
                    });
                }
                break;
            }
            case RPATypes.aav11:
                nextBasename = await (0, files_1.findNextBasenameIn)(opts.outputFolder, "converted-aav11");
                const projects = opts.input;
                const tempDir = (0, path_1.join)(opts.outputFolder, nextBasename, "temp");
                await (0, files_1.makeDirs)(tempDir);
                cleanups.push(() => {
                    try {
                        (0, fs_1.rmSync)(tempDir, { recursive: true, force: true, maxRetries: 1 });
                    }
                    catch (err) {
                        channel_1.OUTPUT_CHANNEL.appendLine("Error deleting: " + tempDir + ": " + err.message);
                    }
                });
                rpaConversionCommands.push({
                    vendor: protocols_1.Format.AAV11,
                    command: protocols_1.CommandType.Analyse,
                    projects: projects,
                    onProgress: undefined,
                    tempFolder: tempDir,
                    outputRelativePath: (0, path_1.join)(nextBasename, "analysis"),
                });
                rpaConversionCommands.push({
                    vendor: protocols_1.Format.AAV11,
                    command: protocols_1.CommandType.Generate,
                    projects: projects,
                    onProgress: undefined,
                    tempFolder: tempDir,
                    outputRelativePath: (0, path_1.join)(nextBasename, "api"),
                });
                rpaConversionCommands.push({
                    command: protocols_1.CommandType.Schema,
                    vendor: protocols_1.Format.AAV11,
                    projects: projects,
                    onProgress: undefined,
                    tempFolder: tempDir,
                    outputRelativePath: (0, path_1.join)(nextBasename, "schema"),
                });
                for (const it of opts.input) {
                    rpaConversionCommands.push({
                        vendor: protocols_1.Format.AAV11,
                        command: protocols_1.CommandType.Convert,
                        projects: [it],
                        onProgress: undefined,
                        targetLanguage,
                        tempFolder: tempDir,
                        outputRelativePath: (0, path_1.join)(nextBasename, "conversion", (0, path_1.basename)(it)),
                    });
                }
                break;
        }
        return await vscode_1.window.withProgress({
            location: vscode_1.ProgressLocation.Notification,
            title: `${exports.RPA_TYPE_TO_CAPTION[opts.inputType]} conversion`,
            cancellable: true,
        }, async (progress, token) => {
            const COMMAND_TO_LABEL = {
                "Generate": "Generate API",
                "Convert": "Convert",
                "Analyse": "Analyse",
                "Schema": "Generate Schema",
            };
            // If we got here, things worked, let's write it to the filesystem.
            const outputDirsWrittenTo = new Set();
            const results = [];
            const steps = rpaConversionCommands.length;
            const errors = [];
            let incrementStep = 0;
            let currStep = 0;
            // execute commands in sequence, but not fail all if one fails
            for (const command of rpaConversionCommands) {
                currStep += 1;
                progress.report({
                    message: `Step (${currStep}/${steps}): ${COMMAND_TO_LABEL[command.command]}`,
                    increment: incrementStep,
                });
                incrementStep = 100 / steps;
                // Give the UI a chance to show the progress.
                await new Promise((r) => setTimeout(r, 5));
                const conversionResult = await conversionMain(converterBundle, command);
                if (!(0, protocols_1.isSuccessful)(conversionResult)) {
                    const message = conversionResult.error;
                    (0, channel_1.logError)(`Error processing ${command.command} command`, new Error(message), "EXT_CONVERT_PROJECT");
                    (0, rcc_1.feedback)(rcc_1.Metrics.CONVERTER_ERROR, command.vendor);
                    errors.push([command, message]);
                    // skip and process next command
                    continue;
                }
                conversionResult.outputDir = (0, path_1.join)(opts.outputFolder, command.outputRelativePath);
                results.push(conversionResult);
                if (token.isCancellationRequested) {
                    return {
                        "success": false,
                        "message": "Operation cancelled.",
                    };
                }
            }
            const filesWritten = [];
            async function handleOutputFile(file, content, encoding = "utf-8") {
                filesWritten.push(file);
                const { dir } = path.parse(file);
                if (dir) {
                    await (0, files_1.makeDirs)(dir);
                }
                await (0, files_1.writeToFile)(file, content, { encoding });
            }
            const tasks = [];
            for (const result of results) {
                const okResult = result;
                const files = okResult?.files;
                await (0, files_1.makeDirs)(result.outputDir);
                outputDirsWrittenTo.add(result.outputDir);
                if (files && files.length > 0) {
                    for (const f of files) {
                        tasks.push(handleOutputFile((0, path_1.join)(result.outputDir, f.filename), f.content, f.encoding));
                    }
                }
            }
            await Promise.all(tasks);
            progress.report({ increment: incrementStep });
            const outputDirsWrittenToStr = [];
            for (const s of outputDirsWrittenTo) {
                outputDirsWrittenToStr.push(s);
            }
            const d = new Date();
            const readmePath = (0, path_1.join)(opts.outputFolder, nextBasename, "README.md");
            await (0, files_1.writeToFile)(readmePath, `Generated: ${d.toISOString()}
----------------------------------

Sources
----------------------------------
${opts.input.join("\n")}

Created Directories
----------------------------------
${outputDirsWrittenToStr.join("\n")}

Created Files
----------------------------------
${filesWritten.join("\n")}

Errors
----------------------------------
${errors.length > 0
                ? errors.map(([cmd, error]) => `Cannot process command ${cmd.command}, reason ${error}`).join("\n")
                : "No errors"}
`);
            while (cleanups.length > 0) {
                const c = cleanups.pop();
                c.call();
            }
            return {
                "success": false,
                "message": `Conversion succeeded.\n\nFinished: ${d.toISOString()}.\n\nWritten to directories:\n\n` +
                    outputDirsWrittenToStr.join("\n"),
            };
        });
    }
    finally {
        for (const c of cleanups) {
            c.call();
        }
    }
}
exports.convertAndSaveResults = convertAndSaveResults;
//# sourceMappingURL=conversion.js.map