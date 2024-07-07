"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.showConvertUI = void 0;
/**
 * Interesting docs related to webviews:
 * https://code.visualstudio.com/api/extension-guides/webview
 */
const fs_1 = require("fs");
const path_1 = require("path");
const vscode = require("vscode");
const channel_1 = require("./channel");
const conversion_1 = require("./conversion");
const files_1 = require("./files");
const rcc_1 = require("./rcc");
let panel = undefined;
let globalState = undefined;
async function showConvertUI(context) {
    const convertBundlePromise = (0, conversion_1.ensureConvertBundle)();
    globalState = context.globalState;
    if (!panel) {
        panel = vscode.window.createWebviewPanel("robocorpCodeConvert", "Conversion Accelerator", vscode.ViewColumn.One, {
            enableScripts: true,
        });
        panel.onDidDispose(() => {
            panel = undefined;
        });
    }
    else {
        panel.reveal();
        return;
    }
    const wsFolders = vscode.workspace.workspaceFolders;
    let ws;
    let outputFolder = "";
    if (wsFolders !== undefined && wsFolders.length >= 1) {
        ws = wsFolders[0];
        outputFolder = ws.uri.fsPath;
    }
    else {
        throw new Error("Conversion Accelerator can work only in a workspace");
    }
    const typeToLastOptions = new Map();
    function generateDefaultOptions() {
        return {
            "input": [],
            "generationResults": "",
            "outputFolder": outputFolder,
            "targetLanguage": conversion_1.DEFAULT_TARGET_LANGUAGE,
        };
    }
    typeToLastOptions[conversion_1.RPATypes.uipath] = generateDefaultOptions();
    typeToLastOptions[conversion_1.RPATypes.blueprism] = generateDefaultOptions();
    typeToLastOptions[conversion_1.RPATypes.a360] = generateDefaultOptions();
    typeToLastOptions[conversion_1.RPATypes.aav11] = generateDefaultOptions();
    let conversionInfo = {
        "inputType": conversion_1.RPATypes.uipath,
        "input": [],
        "generationResults": "",
        "outputFolder": outputFolder,
        "typeToLastOptions": typeToLastOptions,
        "targetLanguage": conversion_1.DEFAULT_TARGET_LANGUAGE,
    };
    const oldState = context.globalState.get("robocorpConversionViewState");
    if (oldState) {
        conversionInfo = oldState;
        // Validate that what we had saved is valid for new versions.
        // i.e.: Backward-compatibility.
        if (conversionInfo.typeToLastOptions[conversion_1.RPATypes.aav11] === undefined) {
            conversionInfo.typeToLastOptions[conversion_1.RPATypes.aav11] = generateDefaultOptions();
        }
        // if previous old state, target language might not be defined
        if (conversionInfo.typeToLastOptions[conversion_1.RPATypes.a360].targetLanguage === undefined) {
            conversionInfo.typeToLastOptions[conversion_1.RPATypes.a360].targetLanguage = conversion_1.DEFAULT_TARGET_LANGUAGE;
        }
        if (conversionInfo.typeToLastOptions[conversion_1.RPATypes.blueprism].targetLanguage === undefined) {
            conversionInfo.typeToLastOptions[conversion_1.RPATypes.blueprism].targetLanguage = conversion_1.DEFAULT_TARGET_LANGUAGE;
        }
        if (conversionInfo.typeToLastOptions[conversion_1.RPATypes.uipath].targetLanguage === undefined) {
            conversionInfo.typeToLastOptions[conversion_1.RPATypes.uipath].targetLanguage = conversion_1.DEFAULT_TARGET_LANGUAGE;
        }
        if (conversionInfo.typeToLastOptions[conversion_1.RPATypes.aav11].targetLanguage === undefined) {
            conversionInfo.typeToLastOptions[conversion_1.RPATypes.aav11].targetLanguage = conversion_1.DEFAULT_TARGET_LANGUAGE;
        }
    }
    panel.webview.html = getWebviewContent(conversionInfo);
    panel.webview.onDidReceiveMessage(async (message) => {
        switch (message.command) {
            case "persistState":
                const stateToPersist = message.contents;
                context.globalState.update("robocorpConversionViewState", stateToPersist);
                return;
            case "onClickOutputFolder":
                let outputFolder = "";
                try {
                    const currentOutputFolder = message.currentOutputFolder;
                    outputFolder = await onClickOutputFolder(currentOutputFolder);
                }
                finally {
                    panel.webview.postMessage({ command: "setOutputFolder", "outputFolder": outputFolder });
                }
                return;
            case "onClickAdd":
                let input = [];
                try {
                    input = await onClickAdd(message.contents);
                }
                finally {
                    panel.webview.postMessage({ command: "addFileOrFolder", "input": input });
                }
                return;
            case "onClickConvert":
                let result = { success: false, message: "Unexpected error doing conversion." };
                try {
                    const contents = message.contents;
                    const outputFolder = contents["outputFolder"];
                    const targetLanguage = contents["targetLanguage"];
                    const inputType = contents["inputType"];
                    const input = contents["input"];
                    // adapter files are at the machine level and location cannot be changed by converter webview
                    const home = await (0, rcc_1.getRobocorpHome)();
                    const adapterFolderPath = (0, path_1.join)(home, "rca", inputType, "adapters");
                    result = await onClickConvert(convertBundlePromise, {
                        outputFolder,
                        targetLanguage,
                        inputType,
                        input,
                        adapterFolderPath,
                    });
                }
                finally {
                    panel.webview.postMessage({ command: "conversionFinished", result: result });
                }
                return;
        }
    }, undefined, context.subscriptions);
}
exports.showConvertUI = showConvertUI;
async function onClickOutputFolder(currentOutputFolder) {
    const defaultUri = vscode.Uri.file(currentOutputFolder);
    let uris = await vscode.window.showOpenDialog({
        "canSelectFolders": true,
        "canSelectFiles": false,
        "canSelectMany": false,
        "openLabel": `Select output folder`,
        "defaultUri": defaultUri,
    });
    if (uris && uris.length > 0) {
        return uris[0].fsPath;
    }
    return "";
}
async function onClickAdd(contents) {
    const MEMENTO_KEY = `lastFolderFor${contents.type}`;
    const stored = globalState.get(MEMENTO_KEY);
    const lastFolder = stored ? vscode.Uri.file(stored) : undefined;
    let uris;
    let input = [];
    const type = contents["type"];
    const vendor = conversion_1.RPA_TYPE_TO_CAPTION[type];
    if (!vendor) {
        vscode.window.showErrorMessage("Error: unable to handle type: " + type);
        return input;
    }
    if (type === conversion_1.RPATypes.blueprism || type === conversion_1.RPATypes.aav11) {
        // select files
        uris = await vscode.window.showOpenDialog({
            "canSelectFolders": false,
            "canSelectFiles": true,
            "canSelectMany": true,
            "openLabel": `Select a ${vendor} file project to convert`,
            "defaultUri": lastFolder,
        });
        if (uris && uris.length > 0) {
            globalState.update(MEMENTO_KEY, (0, path_1.dirname)(uris[0].fsPath));
            for (const uri of uris) {
                input.push(uri.fsPath);
            }
        }
    }
    else {
        // select folders
        uris = await vscode.window.showOpenDialog({
            "canSelectFolders": true,
            "canSelectFiles": false,
            "canSelectMany": true,
            "openLabel": `Select a ${vendor} folder project to convert`,
            "defaultUri": lastFolder,
        });
        if (uris && uris.length > 0) {
            globalState.update(MEMENTO_KEY, uris[0].fsPath);
            for (const uri of uris) {
                input.push(uri.fsPath);
            }
        }
    }
    return input;
}
async function onClickConvert(convertBundlePromise, opts) {
    try {
        return await (0, conversion_1.convertAndSaveResults)(convertBundlePromise, opts);
    }
    catch (error) {
        (0, channel_1.logError)("Error making conversion.", error, "ERROR_CONVERTING_INTERNAL");
        return {
            "success": false,
            "message": "Error making conversion: " + error.message,
        };
    }
}
function getWebviewContent(jsonData) {
    const jsonDataStr = JSON.stringify(jsonData, null, 4);
    const templateFile = (0, files_1.getExtensionRelativeFile)("../../vscode-client/templates/converter.html", true);
    const data = (0, fs_1.readFileSync)(templateFile, "utf8");
    const start = '<script id="data" type="application/json">';
    const startI = data.indexOf(start) + start.length;
    const end = "</script>";
    const endI = data.indexOf(end, startI);
    const ret = data.substring(0, startI) + jsonDataStr + data.substring(endI);
    return ret;
}
//# sourceMappingURL=conversionView.js.map