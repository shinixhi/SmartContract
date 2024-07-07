"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocatorsTreeDataProvider = void 0;
const vscode = require("vscode");
const channel_1 = require("./channel");
const inspector_1 = require("./inspector");
const roboCommands = require("./robocorpCommands");
const viewsCommon_1 = require("./viewsCommon");
class LocatorsTreeDataProvider {
    async getChildren(element) {
        // i.e.: the contents of this tree depend on what's selected in the robots tree.
        const robotEntry = (0, viewsCommon_1.getSelectedRobot)();
        if (!robotEntry) {
            return [
                {
                    name: viewsCommon_1.NO_PACKAGE_FOUND_MSG,
                    type: "info",
                    line: 0,
                    column: 0,
                    filePath: undefined,
                },
            ];
        }
        if (!element) {
            // Collect the basic structure and create tree from it.
            // Afterwards, just return element.children for any subsequent request.
            let actionResult = await vscode.commands.executeCommand(roboCommands.ROBOCORP_GET_LOCATORS_JSON_INFO, { "robotYaml": robotEntry.robot.filePath });
            if (!actionResult["success"]) {
                return [
                    {
                        name: actionResult.message,
                        type: "error",
                        line: 0,
                        column: 0,
                        filePath: robotEntry.robot.filePath,
                    },
                ];
            }
            return buildTree(actionResult["result"]);
        }
        if (element instanceof LocatorEntryNode) {
            return element.children;
        }
        else {
            // LocatorEntry has no children
            return [];
        }
    }
    getTreeItem(entry) {
        if (entry instanceof LocatorCreationNode) {
            // Custom node to add a locator.
            const node = entry;
            const treeItem = new vscode.TreeItem(node.caption);
            treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
            treeItem.iconPath = new vscode.ThemeIcon("add");
            let commandName;
            if (node.locatorType === inspector_1.InspectorType.PlaywrightRecorder) {
                commandName = roboCommands.ROBOCORP_OPEN_PLAYWRIGHT_RECORDER;
                treeItem.command = {
                    "title": node.caption,
                    "command": commandName,
                    "arguments": [true],
                };
            }
            else {
                // Command: robocorp.newRobocorpInspectorBrowser
                // Command: robocorp.newRobocorpInspectorImage
                // Command: robocorp.newRobocorpInspectorWindows
                // Command: robocorp.newRobocorpInspectorWebRecorder
                commandName =
                    "robocorp.newRobocorpInspector" +
                        (node.locatorType.charAt(0).toUpperCase() + node.locatorType.substring(1)).replace("-r", "R");
                treeItem.command = {
                    "title": node.caption,
                    "command": commandName,
                    "arguments": [],
                };
            }
            if (node.tooltip) {
                treeItem.tooltip = node.tooltip;
            }
            return treeItem;
        }
        const type = entry instanceof LocatorEntryNode ? entry.locatorType : entry.type;
        // https://microsoft.github.io/vscode-codicons/dist/codicon.html
        let iconPath = "file-media";
        if (type === inspector_1.InspectorType.WebInspector) {
            iconPath = "globe";
        }
        else if (type === inspector_1.InspectorType.ImageInspector) {
            iconPath = "file-media";
        }
        else if (type === inspector_1.InspectorType.WindowsInspector) {
            iconPath = "multiple-windows";
        }
        else if (type === inspector_1.InspectorType.JavaInspector) {
            iconPath = "coffee";
        }
        else if (type === inspector_1.InspectorType.PlaywrightRecorder) {
            iconPath = "browser";
        }
        else if (type === "error" || type === "info") {
            iconPath = "error";
        }
        else {
            channel_1.OUTPUT_CHANNEL.appendLine("No custom icon for: " + type);
        }
        if (entry instanceof LocatorEntryNode) {
            // Node which contains locators as children.
            const node = entry;
            const treeItem = new vscode.TreeItem(node.caption);
            treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
            treeItem.iconPath = new vscode.ThemeIcon(iconPath);
            if (entry.locatorType === inspector_1.InspectorType.WebInspector) {
                treeItem.contextValue = "newBrowserLocator";
                treeItem.tooltip = "Browser locators saved for future references";
            }
            else if (entry.locatorType === inspector_1.InspectorType.ImageInspector) {
                treeItem.contextValue = "newImageLocator";
            }
            else if (entry.locatorType === inspector_1.InspectorType.WindowsInspector) {
                treeItem.contextValue = "newWindowsLocator";
            }
            else if (entry.locatorType === inspector_1.InspectorType.JavaInspector) {
                treeItem.contextValue = "newJavaLocator";
            }
            return treeItem;
        }
        const element = entry;
        const treeItem = new vscode.TreeItem(element.name);
        // Only add context to actual locator items
        if (element.type !== "error") {
            treeItem.contextValue = "locatorEntry";
        }
        treeItem.iconPath = new vscode.ThemeIcon(iconPath);
        return treeItem;
    }
}
exports.LocatorsTreeDataProvider = LocatorsTreeDataProvider;
class LocatorEntryNode {
    constructor(locatorType, caption, hasCreateNew) {
        this.children = []; // LocatorEntry and LocatorCreationNode entries mixed
        this.tooltip = undefined;
        this.locatorType = locatorType;
        this.caption = caption;
        this.hasCreateNew = hasCreateNew;
    }
    addCreateNewElement() {
        if (this.hasCreateNew) {
            if (this.locatorType === inspector_1.InspectorType.PlaywrightRecorder) {
                this.children.push(new LocatorCreationNode(this.locatorType, "Playwright Recorder (Python) ...", "A recorder which records browser actions to be used in Python with the `playwright` library."));
                return;
            }
            this.children.push(new LocatorCreationNode(this.locatorType, "New " + this.caption + " Locator ...", `Select and store in \`locators.json\` a locator to be used with the ${this.caption} library.`));
        }
    }
}
class LocatorCreationNode {
    constructor(locatorType, caption, tooltip = undefined) {
        this.locatorType = locatorType;
        this.caption = caption;
        this.tooltip = tooltip;
    }
}
function buildTree(entries) {
    // Roots may mix LocatorEntryNode along with LocatorEntry (if it's an error).
    const roots = [
        new LocatorEntryNode(inspector_1.InspectorType.WebInspector, "Web", true),
        new LocatorEntryNode(inspector_1.InspectorType.WindowsInspector, "Windows", true),
        new LocatorEntryNode(inspector_1.InspectorType.ImageInspector, "Image", true),
        new LocatorEntryNode(inspector_1.InspectorType.JavaInspector, "Java", true),
        new LocatorEntryNode(inspector_1.InspectorType.PlaywrightRecorder, "Playwright", true),
    ];
    const typeToElement = {};
    roots.forEach((element) => {
        typeToElement[element.locatorType] = element;
    });
    entries.forEach((element) => {
        const locatorType = element.type;
        if (locatorType === "error") {
            // Just put in the roots in this case.
            roots.push(element);
            return;
        }
        let node = typeToElement[locatorType];
        if (!node) {
            // Fallback if a new type is added which we weren't expecting.
            let caption = locatorType.charAt(0).toUpperCase() + locatorType.substring(1);
            node = new LocatorEntryNode(locatorType, caption, false);
            roots.push(node);
            typeToElement[locatorType] = node;
        }
        node.children.push(element);
    });
    roots.forEach((element) => {
        element.addCreateNewElement();
    });
    return roots;
}
//# sourceMappingURL=viewsLocators.js.map