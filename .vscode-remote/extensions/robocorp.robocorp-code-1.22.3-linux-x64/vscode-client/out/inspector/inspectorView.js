"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.showInspectorUI = void 0;
/**
 * Interesting docs related to webviews:
 * https://code.visualstudio.com/api/extension-guides/webview
 */
const path = require("path");
const fs_1 = require("fs");
const vscode = require("vscode");
const files_1 = require("../files");
const channel_1 = require("../channel");
const viewsCommon_1 = require("../viewsCommon");
const protocols_1 = require("./protocols");
const extension_1 = require("../extension");
const robocorpCommands_1 = require("../robocorpCommands");
const utils_1 = require("./utils");
// singleton objects
let ROBOCORP_INSPECTOR_PANEL = undefined;
let ROBOT_DIRECTORY = undefined;
// showInspectorUI - registered function for opening the Inspector while calling VSCode commands
async function showInspectorUI(context, route) {
    if (ROBOCORP_INSPECTOR_PANEL !== undefined) {
        channel_1.OUTPUT_CHANNEL.appendLine("# Robocorp Inspector is already opened! Thank you!");
        channel_1.OUTPUT_CHANNEL.appendLine(`# Switching to the commanded Route: ${route}`);
        const response = {
            id: "",
            type: protocols_1.IMessageType.EVENT,
            event: {
                type: "gotoInspectorApp",
                status: "success",
                data: route,
            },
        };
        // this is an event - postMessage will update the useLocator hook
        ROBOCORP_INSPECTOR_PANEL.webview.postMessage(response);
        ROBOCORP_INSPECTOR_PANEL.reveal();
        return;
    }
    channel_1.OUTPUT_CHANNEL.appendLine(`# Robocorp Inspector is ROBOCORP_INSPECTOR_PANEL: ${ROBOCORP_INSPECTOR_PANEL}`);
    const panel = vscode.window.createWebviewPanel("robocorpCodeInspector", "Robocorp Inspector", vscode.ViewColumn.Active, {
        enableScripts: true,
        retainContextWhenHidden: true,
    });
    ROBOCORP_INSPECTOR_PANEL = panel;
    const robot = (0, viewsCommon_1.getSelectedRobot)();
    let directory = undefined;
    let locatorJson = undefined;
    if (robot) {
        directory = robot.robot.directory;
    }
    else {
        let actionResult = await vscode.commands.executeCommand(robocorpCommands_1.ROBOCORP_LOCAL_LIST_ROBOTS_INTERNAL);
        if (actionResult.success) {
            if (actionResult.result.length === 1) {
                directory = actionResult.result[0].directory;
            }
        }
    }
    if (directory) {
        locatorJson = path.join(directory, "locators.json");
        ROBOT_DIRECTORY = directory;
    }
    let locatorsMap = {};
    if (locatorJson) {
        if ((0, files_1.verifyFileExists)(locatorJson, false)) {
            let doc = await vscode.workspace.openTextDocument(vscode.Uri.file(locatorJson));
            locatorsMap = JSON.parse(doc.getText());
        }
    }
    const onDiskPath = vscode.Uri.file(directory);
    const directoryURI = panel.webview.asWebviewUri(onDiskPath);
    channel_1.OUTPUT_CHANNEL.appendLine(`> ON DISK PATH ROBOT DIRECTORY: ${directoryURI.toString()}`);
    panel.webview.html = getWebviewContent(directory, directoryURI.toString(), locatorsMap, route);
    // Web Inspector - Create listeners for BE (Python) messages
    context.subscriptions.push(extension_1.langServer.onNotification("$/webPick", (values) => {
        const pickedLocator = JSON.stringify(values);
        channel_1.OUTPUT_CHANNEL.appendLine(`[Web] > Receiving: picked.element: ${pickedLocator}`);
        const response = {
            id: (0, utils_1.generateID)(),
            type: protocols_1.IMessageType.EVENT,
            event: {
                type: "pickedLocator",
                status: "success",
                data: pickedLocator,
            },
        };
        // this is an event - postMessage will update the useLocator hook
        panel.webview.postMessage(response);
    }));
    context.subscriptions.push(extension_1.langServer.onNotification("$/webInspectorState", (state) => {
        channel_1.OUTPUT_CHANNEL.appendLine(`[Web] > Receiving: webInspectorState: ${JSON.stringify(state)}`);
        const response = {
            id: (0, utils_1.generateID)(),
            type: protocols_1.IMessageType.EVENT,
            event: {
                type: "browserState",
                status: "success",
                data: state.state,
            },
        };
        // this is an event - postMessage will update the useLocator hook
        panel.webview.postMessage(response);
    }));
    context.subscriptions.push(extension_1.langServer.onNotification("$/webURLChange", (url) => {
        channel_1.OUTPUT_CHANNEL.appendLine(`[Web] > Receiving: webURLChange: ${JSON.stringify(url)}`);
        const response = {
            id: (0, utils_1.generateID)(),
            type: protocols_1.IMessageType.EVENT,
            event: {
                type: "urlChange",
                status: "success",
                data: url.url,
            },
        };
        // this is an event - postMessage will update the useLocator hook
        panel.webview.postMessage(response);
    }));
    context.subscriptions.push(extension_1.langServer.onNotification("$/webReigniteThread", async (values) => {
        channel_1.OUTPUT_CHANNEL.appendLine(`[Web] > Receiving: webReigniteThread: ${JSON.stringify(values)}`);
        const browserConfig = values;
        await sendRequest("webInspectorConfigureBrowser", {
            width: browserConfig.browser_config.viewport_size[0],
            height: browserConfig.browser_config.viewport_size[1],
            url: browserConfig.url !== "" ? browserConfig.url : undefined,
        });
        await sendRequest("webInspectorStartPick", {
            url_if_new: browserConfig.url !== "" ? browserConfig.url : undefined,
        });
    }));
    // Windows Inspector - Create listeners for BE (Python) messages
    context.subscriptions.push(extension_1.langServer.onNotification("$/windowsPick", (values) => {
        const pickedLocator = JSON.stringify(values["picked"]);
        channel_1.OUTPUT_CHANNEL.appendLine(`[Windows] > Receiving: picked.element: ${pickedLocator}`);
        const response = {
            id: (0, utils_1.generateID)(),
            type: protocols_1.IMessageType.EVENT,
            event: {
                type: "pickedWinLocatorTree",
                status: "success",
                data: pickedLocator,
            },
        };
        // this is an event - postMessage will update the useLocator hook
        panel.webview.postMessage(response);
    }));
    // Image Inspector - Create listeners for BE (Python) messages
    context.subscriptions.push(extension_1.langServer.onNotification("$/imagePick", (values) => {
        const pickedLocator = JSON.stringify(values["picked"]);
        channel_1.OUTPUT_CHANNEL.appendLine(`[Image] > Receiving: picked.element: ${pickedLocator}`);
        const response = {
            id: (0, utils_1.generateID)(),
            type: protocols_1.IMessageType.EVENT,
            event: {
                type: "pickedImageSnapshot",
                status: "success",
                data: pickedLocator,
            },
        };
        // this is an event - postMessage will update the useLocator hook
        panel.webview.postMessage(response);
    }));
    context.subscriptions.push(extension_1.langServer.onNotification("$/imageValidation", (values) => {
        const matches = JSON.stringify(values["matches"]);
        channel_1.OUTPUT_CHANNEL.appendLine(`[Image] > Receiving: matches: ${matches}`);
        const response = {
            id: (0, utils_1.generateID)(),
            type: protocols_1.IMessageType.EVENT,
            event: {
                type: "pickedImageValidation",
                status: "success",
                data: matches,
            },
        };
        // this is an event - postMessage will update the useLocator hook
        panel.webview.postMessage(response);
    }));
    context.subscriptions.push(extension_1.langServer.onNotification("$/imageInspectorState", (state) => {
        channel_1.OUTPUT_CHANNEL.appendLine(`[Image] > Receiving: imageInspectorState: ${JSON.stringify(state)}`);
        const response = {
            id: (0, utils_1.generateID)(),
            type: protocols_1.IMessageType.EVENT,
            event: {
                type: "snippingToolState",
                status: "success",
                data: state.state,
            },
        };
        // this is an event - postMessage will update the useLocator hook
        panel.webview.postMessage(response);
    }));
    // Java Inspector - Create listeners for BE (Python) messages
    context.subscriptions.push(extension_1.langServer.onNotification("$/javaPick", (values) => {
        const pickedLocator = JSON.stringify(values["picked"]);
        channel_1.OUTPUT_CHANNEL.appendLine(`[Java] > Receiving: picked.element: ${pickedLocator}`);
        const response = {
            id: (0, utils_1.generateID)(),
            type: protocols_1.IMessageType.EVENT,
            event: {
                type: "pickedJavaLocatorTree",
                status: "success",
                data: pickedLocator,
            },
        };
        // this is an event - postMessage will update the useLocator hook
        panel.webview.postMessage(response);
    }));
    panel.onDidDispose(() => {
        channel_1.OUTPUT_CHANNEL.appendLine(`> Killing all Inspectors...`);
        sendRequest("killInspectors", { inspector: null });
        ROBOCORP_INSPECTOR_PANEL = undefined;
    });
    const buildProtocolResponseFromActionResponse = (message, actionResult, dataType) => {
        const response = {
            id: message.id,
            app: message.app,
            type: "response",
            status: actionResult.success ? "success" : "failure",
            message: actionResult.message,
            data: dataType && actionResult.result
                ? {
                    type: dataType,
                    value: actionResult.result,
                }
                : undefined,
        };
        return response;
    };
    const sendRequest = async (requestName, args) => {
        try {
            if (args !== undefined) {
                return await extension_1.langServer.sendRequest(requestName, args);
            }
            else {
                return await extension_1.langServer.sendRequest(requestName);
            }
        }
        catch (error) {
            (0, channel_1.logError)("Error on request: " + requestName, error, "INSPECTOR_VIEW_REQUEST_ERROR");
            // We always need a response even if an exception happens (so, build an ActionResult
            // from it).
            return { message: (0, channel_1.buildErrorStr)(error), success: false, result: undefined };
        }
    };
    panel.webview.onDidReceiveMessage(async (message) => {
        channel_1.OUTPUT_CHANNEL.appendLine(`incoming.message: ${JSON.stringify(message)}`);
        switch (message.type) {
            case protocols_1.IMessageType.REQUEST:
                const command = message.command;
                if (command["type"] === "getLocators") {
                    channel_1.OUTPUT_CHANNEL.appendLine(`> Requesting: Get Locators: ${JSON.stringify(command)}`);
                    const actionResult = await sendRequest("managerLoadLocators", {
                        directory: directory,
                    });
                    channel_1.OUTPUT_CHANNEL.appendLine(`[Manager] > Requesting: Response: ${JSON.stringify(actionResult)}`);
                    panel.webview.postMessage(buildProtocolResponseFromActionResponse(message, actionResult, "locatorsMap"));
                }
                else if (message.app === protocols_1.IApps.LOCATORS_MANAGER) {
                    if (command["type"] === "delete") {
                        channel_1.OUTPUT_CHANNEL.appendLine(`[Manager] > Requesting: Delete Locators: ${command["ids"]}`);
                        const actionResult = await sendRequest("managerDeleteLocators", {
                            directory: directory,
                            ids: command["ids"],
                        });
                        panel.webview.postMessage(buildProtocolResponseFromActionResponse(message, actionResult));
                    }
                    else if (command["type"] === "save") {
                        const locator = message["command"]["locator"];
                        channel_1.OUTPUT_CHANNEL.appendLine(`[Manager] > Requesting: Save Locator: ${JSON.stringify(locator)}`);
                        const actionResult = await sendRequest("managerSaveLocator", {
                            locator: locator,
                            directory: directory,
                        });
                        panel.webview.postMessage(buildProtocolResponseFromActionResponse(message, actionResult));
                    }
                }
                else if (message.app === protocols_1.IApps.WEB_INSPECTOR) {
                    if (command["type"] === "startPicking") {
                        // configure the browser before opening anything
                        channel_1.OUTPUT_CHANNEL.appendLine(`[Web] > Requesting: Configure Browser: ${JSON.stringify(command)}`);
                        await sendRequest("webInspectorConfigureBrowser", {
                            width: command["viewportWidth"],
                            height: command["viewportHeight"],
                            url: command["url"],
                        });
                        // start picking
                        channel_1.OUTPUT_CHANNEL.appendLine(`[Web] > Requesting: Start Picking: ${JSON.stringify(command)}`);
                        await sendRequest("webInspectorStartPick", {
                            url_if_new: command["url"],
                        });
                    }
                    else if (command["type"] === "stopPicking") {
                        channel_1.OUTPUT_CHANNEL.appendLine(`[Web] > Requesting: Stop Picking: ${JSON.stringify(command)}`);
                        await sendRequest("webInspectorStopPick");
                    }
                    else if (command["type"] === "validate") {
                        channel_1.OUTPUT_CHANNEL.appendLine(`[Web] > Requesting: Validate: ${JSON.stringify(command)}`);
                        const actionResult = await sendRequest("webInspectorValidateLocator", {
                            locator: command["locator"],
                            url: command["url"],
                        });
                        panel.webview.postMessage(buildProtocolResponseFromActionResponse(message, actionResult.result, "locatorMatches"));
                    }
                    else if (command["type"] === "killMe") {
                        await sendRequest("killInspectors", { inspector: "browser" /* LocatorType.Browser */ });
                    }
                }
                else if (message.app === protocols_1.IApps.WINDOWS_INSPECTOR) {
                    if (command["type"] === "startPicking") {
                        channel_1.OUTPUT_CHANNEL.appendLine(`[Windows] > Requesting: Start Picking: ${JSON.stringify(command)}`);
                        await sendRequest("windowsInspectorStartPick");
                    }
                    else if (command["type"] === "stopPicking") {
                        channel_1.OUTPUT_CHANNEL.appendLine(`[Windows] > Requesting: Stop Picking: ${JSON.stringify(command)}`);
                        await sendRequest("windowsInspectorStopPick");
                    }
                    else if (command["type"] === "getAppWindows") {
                        channel_1.OUTPUT_CHANNEL.appendLine(`[Windows] > Requesting: Get Apps: ${JSON.stringify(command)}`);
                        const actionResult = await sendRequest("windowsInspectorListWindows");
                        panel.webview.postMessage(buildProtocolResponseFromActionResponse(message, actionResult.result, "winApps"));
                    }
                    else if (command["type"] === "setSelectedApp") {
                        channel_1.OUTPUT_CHANNEL.appendLine(`[Windows] > Requesting: Set Selected App: ${JSON.stringify(command)}`);
                        const actionResult = await sendRequest("windowsInspectorSetWindowLocator", { locator: `handle:${command["handle"]}` });
                        panel.webview.postMessage(buildProtocolResponseFromActionResponse(message, actionResult.result));
                    }
                    else if (command["type"] === "collectAppTree") {
                        channel_1.OUTPUT_CHANNEL.appendLine(`[Windows] > Requesting: Collect App Tree: ${JSON.stringify(command)}`);
                        const actionResult = await sendRequest("windowsInspectorCollectTree", {
                            locator: command["locator"],
                            search_depth: command["depth"] || 8,
                            search_strategy: command["strategy"] || "all",
                        });
                        panel.webview.postMessage(buildProtocolResponseFromActionResponse(message, actionResult.result, "winAppTree"));
                    }
                    else if (command["type"] === "validateLocatorSyntax") {
                        channel_1.OUTPUT_CHANNEL.appendLine(`[Windows] > Requesting: Validate Locator Syntax: ${JSON.stringify(command)}`);
                        const actionResult = await sendRequest("windowsInspectorParseLocator", {
                            locator: command["locator"],
                        });
                        panel.webview.postMessage(buildProtocolResponseFromActionResponse(message, actionResult.result, "locator"));
                    }
                    else if (command["type"] === "startHighlighting") {
                        channel_1.OUTPUT_CHANNEL.appendLine(`[Windows] > Requesting: Start Highlighting: ${JSON.stringify(command)}`);
                        const actionResult = await sendRequest("windowsInspectorStartHighlight", {
                            locator: command["locator"],
                            search_depth: command["depth"] || 8,
                            search_strategy: command["strategy"] || "all",
                        });
                        panel.webview.postMessage(buildProtocolResponseFromActionResponse(message, actionResult.result, "locator"));
                    }
                    else if (command["type"] === "stopHighlighting") {
                        channel_1.OUTPUT_CHANNEL.appendLine(`[Windows] > Requesting: Stop Highlighting: ${JSON.stringify(command)}`);
                        const actionResult = await sendRequest("windowsInspectorStopHighlight");
                        panel.webview.postMessage(buildProtocolResponseFromActionResponse(message, actionResult.result, "locator"));
                    }
                    else if (command["type"] === "killMe") {
                        await sendRequest("killInspectors", { inspector: "windows" /* LocatorType.Windows */ });
                    }
                }
                else if (message.app === protocols_1.IApps.IMAGE_INSPECTOR) {
                    if (command["type"] === "startPicking") {
                        channel_1.OUTPUT_CHANNEL.appendLine(`[Image] > Requesting: Start Picking: ${JSON.stringify(command)}`);
                        await sendRequest("imageInspectorStartPick", {
                            minimize: command["minimize"],
                            confidence_level: command["confidenceLevel"],
                        });
                    }
                    else if (command["type"] === "stopPicking") {
                        channel_1.OUTPUT_CHANNEL.appendLine(`[Image] > Requesting: Stop Picking: ${JSON.stringify(command)}`);
                        await sendRequest("imageInspectorStopPick");
                    }
                    else if (command["type"] === "validate") {
                        channel_1.OUTPUT_CHANNEL.appendLine(`[Image] > Requesting: Validate: ${JSON.stringify(command)}`);
                        await sendRequest("imageInspectorValidateLocator", {
                            locator: command["locator"],
                            confidence_level: command["locator"].confidence,
                        });
                    }
                    else if (command["type"] === "saveImage") {
                        channel_1.OUTPUT_CHANNEL.appendLine(`[Image] > Requesting: SaveImage: ${JSON.stringify(command)}`);
                        const actionResult = await sendRequest("imageInspectorSaveImage", {
                            root_directory: ROBOT_DIRECTORY,
                            image_base64: command["imageBase64"],
                        });
                        channel_1.OUTPUT_CHANNEL.appendLine(`[Image] > Result: SaveImage: ${JSON.stringify(actionResult)}`);
                        panel.webview.postMessage(buildProtocolResponseFromActionResponse(message, actionResult.result, "imagePath"));
                    }
                    else if (command["type"] === "killMe") {
                        await sendRequest("killInspectors", { inspector: "image" /* LocatorType.Image */ });
                    }
                }
                else if (message.app === protocols_1.IApps.JAVA_INSPECTOR) {
                    if (command["type"] === "startPicking") {
                        channel_1.OUTPUT_CHANNEL.appendLine(`[Java] > Requesting: Start Picking: ${JSON.stringify(command)}`);
                        await sendRequest("javaInspectorStartPick");
                    }
                    else if (command["type"] === "stopPicking") {
                        channel_1.OUTPUT_CHANNEL.appendLine(`[Java] > Requesting: Stop Picking: ${JSON.stringify(command)}`);
                        await sendRequest("javaInspectorStopPick");
                    }
                    else if (command["type"] === "getAppJava") {
                        channel_1.OUTPUT_CHANNEL.appendLine(`[Java] > Requesting: Get Apps: ${JSON.stringify(command)}`);
                        const actionResult = await sendRequest("javaInspectorListWindows");
                        channel_1.OUTPUT_CHANNEL.appendLine(`[Java] > Result: Get Apps: ${JSON.stringify(actionResult)}`);
                        panel.webview.postMessage(buildProtocolResponseFromActionResponse(message, actionResult.result, "javaApps"));
                    }
                    else if (command["type"] === "setSelectedApp") {
                        channel_1.OUTPUT_CHANNEL.appendLine(`[Java] > Requesting: Set Selected App: ${JSON.stringify(command)}`);
                        const actionResult = await sendRequest("javaInspectorSetWindowLocator", {
                            locator: `${command["handle"]}`,
                        });
                        channel_1.OUTPUT_CHANNEL.appendLine(`[Java] > Result: Set Selected Apps: ${JSON.stringify(actionResult)}`);
                        panel.webview.postMessage(buildProtocolResponseFromActionResponse(message, actionResult.result));
                    }
                    else if (command["type"] === "collectAppTree") {
                        channel_1.OUTPUT_CHANNEL.appendLine(`[Java] > Requesting: Collect App Tree: ${JSON.stringify(command)}`);
                        const actionResult = await sendRequest("javaInspectorCollectTree", {
                            locator: command["locator"],
                            search_depth: command["depth"] || 8,
                        });
                        channel_1.OUTPUT_CHANNEL.appendLine(`[Java] > Result: Collect App Apps: ${JSON.stringify(actionResult)}`);
                        panel.webview.postMessage(buildProtocolResponseFromActionResponse(message, actionResult.result, "javaAppTree"));
                    }
                    else if (command["type"] === "validateLocatorSyntax") {
                        channel_1.OUTPUT_CHANNEL.appendLine(`[Java] > Requesting: Validate Locator Syntax: ${JSON.stringify(command)}`);
                        const actionResult = await sendRequest("javaInspectorParseLocator", {
                            locator: command["locator"],
                        });
                        channel_1.OUTPUT_CHANNEL.appendLine(`[Java] > Result: Validate Locator Apps: ${JSON.stringify(actionResult)}`);
                        panel.webview.postMessage(buildProtocolResponseFromActionResponse(message, actionResult.result, "locator"));
                    }
                    else if (command["type"] === "startHighlighting") {
                        channel_1.OUTPUT_CHANNEL.appendLine(`[Java] > Requesting: Start Highlighting: ${JSON.stringify(command)}`);
                        const actionResult = await sendRequest("javaInspectorStartHighlight", {
                            locator: command["locator"],
                            search_depth: command["depth"] || 8,
                        });
                        channel_1.OUTPUT_CHANNEL.appendLine(`[Java] > Result: Start Highlighting: ${JSON.stringify(actionResult)}`);
                        panel.webview.postMessage(buildProtocolResponseFromActionResponse(message, actionResult.result, "locator"));
                    }
                    else if (command["type"] === "stopHighlighting") {
                        channel_1.OUTPUT_CHANNEL.appendLine(`[Java] > Requesting: Stop Highlighting: ${JSON.stringify(command)}`);
                        const actionResult = await sendRequest("javaInspectorStopHighlight");
                        channel_1.OUTPUT_CHANNEL.appendLine(`[Java] > Result: Stop Highlighting: ${JSON.stringify(actionResult)}`);
                        panel.webview.postMessage(buildProtocolResponseFromActionResponse(message, actionResult.result, "locator"));
                    }
                    else if (command["type"] === "killMe") {
                        await sendRequest("killInspectors", { inspector: "java" /* LocatorType.Java */ });
                    }
                }
                return;
            case protocols_1.IMessageType.RESPONSE:
                return;
            case protocols_1.IMessageType.EVENT:
                return;
            default:
                return;
        }
    }, undefined, context.subscriptions);
}
exports.showInspectorUI = showInspectorUI;
function getWebviewContent(directory, directoryURI, jsonData, startRoute) {
    // get the template that's created via the inspector-ext
    const templateFile = (0, files_1.getExtensionRelativeFile)("../../vscode-client/templates/inspector.html", true);
    const data = (0, fs_1.readFileSync)(templateFile, "utf8");
    // inject the locators.json contents
    const startLocators = '<script id="locatorsJSON" type="application/json">';
    const startIndexLocators = data.indexOf(startLocators) + startLocators.length;
    const endLocators = "</script>";
    const endIndexLocators = data.indexOf(endLocators, startIndexLocators);
    const contentLocators = JSON.stringify({
        location: directory,
        locationURI: directoryURI,
        locatorsLocation: path.join(directory, "locators.json"),
        data: jsonData,
    }, null, 4);
    const retLocators = data.substring(0, startIndexLocators) + contentLocators + data.substring(endIndexLocators);
    // inject the controls json
    const startControl = '<script id="controlJSON" type="application/json">';
    const startIndexControl = retLocators.indexOf(startControl) + startControl.length;
    const endControl = "</script>";
    const endIndexControl = retLocators.indexOf(endControl, startIndexControl);
    const controlContent = JSON.stringify({ startRoute: startRoute || protocols_1.IAppRoutes.LOCATORS_MANAGER }, null, 4);
    const retControl = retLocators.substring(0, startIndexControl) + controlContent + retLocators.substring(endIndexControl);
    return retControl;
}
//# sourceMappingURL=inspectorView.js.map