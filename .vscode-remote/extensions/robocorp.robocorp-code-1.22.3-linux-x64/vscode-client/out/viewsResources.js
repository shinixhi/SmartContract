"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResourcesTreeDataProvider = exports.getLocatorSingleTreeSelection = void 0;
const vscode = require("vscode");
const robocorpViews_1 = require("./robocorpViews");
const viewsCommon_1 = require("./viewsCommon");
const viewsLocators_1 = require("./viewsLocators");
const viewsRobotSelectionTreeBase_1 = require("./viewsRobotSelectionTreeBase");
const viewsWorkItems_1 = require("./viewsWorkItems");
const NO_ROBOT_TYPE = "no-robot-selected";
const ROOT_TYPE = "root";
const SUBTREE_WORK_ITEMS = "work-items";
const SUBTREE_LOCATORS = "locators";
async function getLocatorSingleTreeSelection(opts) {
    let selection = await (0, viewsCommon_1.getSingleTreeSelection)(robocorpViews_1.TREE_VIEW_ROBOCORP_PACKAGE_RESOURCES_TREE, opts);
    if (selection.resourcesTreeType == ROOT_TYPE) {
        return undefined; // Root items aren't part of the locators tree.
    }
    if (selection.subTree == SUBTREE_LOCATORS) {
        return selection; // We can only select items from the locators subtree in this case.
    }
    return undefined;
}
exports.getLocatorSingleTreeSelection = getLocatorSingleTreeSelection;
class ResourcesTreeDataProvider extends viewsRobotSelectionTreeBase_1.RobotSelectionTreeDataProviderBase {
    constructor() {
        super(...arguments);
        this.locatorsTreeDataProvider = new viewsLocators_1.LocatorsTreeDataProvider();
        this.workItemsTreeDataProvider = new viewsWorkItems_1.WorkItemsTreeDataProvider();
    }
    async getChildren(element) {
        const robotEntry = (0, viewsCommon_1.getSelectedRobot)();
        if (!robotEntry) {
            this.lastRobotEntry = undefined;
            return [
                {
                    name: viewsCommon_1.NO_PACKAGE_FOUND_MSG,
                    resourcesTreeType: NO_ROBOT_TYPE,
                },
            ];
        }
        this.lastRobotEntry = robotEntry;
        if (!element) {
            const ret = [
                {
                    name: "Inspectors / Locators",
                    resourcesTreeType: ROOT_TYPE,
                    subTree: SUBTREE_LOCATORS,
                    tooltip: "Inspectors which output code and locators (which identify how to locate a specific element in a given library).",
                },
            ];
            if (robotEntry.type !== viewsCommon_1.RobotEntryType.Action &&
                robotEntry.type !== viewsCommon_1.RobotEntryType.ActionPackage &&
                robotEntry.type !== viewsCommon_1.RobotEntryType.ActionsInActionPackage &&
                robotEntry.type !== viewsCommon_1.RobotEntryType.ActionsInRobot) {
                // No work items unless it's a task package (i.e.: Robot)
                // Using reverse logic because we need to keep showing the Work Items in cases like RobotEntryType == Error
                ret.push({
                    name: "Work Items",
                    resourcesTreeType: ROOT_TYPE,
                    subTree: SUBTREE_WORK_ITEMS,
                });
            }
            return ret;
        }
        let childrenForElement = element;
        if (element.resourcesTreeType === ROOT_TYPE) {
            childrenForElement = undefined; // i.e.: root
        }
        let ret;
        if (element.subTree === SUBTREE_LOCATORS) {
            ret = await this.locatorsTreeDataProvider.getChildren(childrenForElement);
        }
        else if (element.subTree === SUBTREE_WORK_ITEMS) {
            ret = await this.workItemsTreeDataProvider.getChildren(childrenForElement);
        }
        if (ret && ret.length > 0) {
            for (const el of ret) {
                // Keep the subtree
                el.subTree = element.subTree;
            }
            return ret;
        }
        return [];
    }
    getTreeItem(element) {
        if (element.resourcesTreeType === NO_ROBOT_TYPE) {
            const item = new vscode.TreeItem(element.name);
            item.iconPath = new vscode.ThemeIcon("error");
            return item;
        }
        if (element.resourcesTreeType === ROOT_TYPE) {
            const item = new vscode.TreeItem(element.name, vscode.TreeItemCollapsibleState.Expanded);
            if (element.subTree === SUBTREE_LOCATORS) {
                item.contextValue = "locatorsRoot";
                item.iconPath = new vscode.ThemeIcon("inspect");
            }
            else if (element.subTree === SUBTREE_WORK_ITEMS) {
                item.contextValue = "workItemsRoot";
                item.iconPath = new vscode.ThemeIcon("combine");
            }
            if (element.tooltip !== undefined) {
                item.tooltip = element.tooltip;
            }
            return item;
        }
        if (element.subTree === SUBTREE_LOCATORS) {
            return this.locatorsTreeDataProvider.getTreeItem(element);
        }
        else if (element.subTree === SUBTREE_WORK_ITEMS) {
            return this.workItemsTreeDataProvider.getTreeItem(element);
        }
        return new vscode.TreeItem("<unhandled tree item>");
    }
}
exports.ResourcesTreeDataProvider = ResourcesTreeDataProvider;
//# sourceMappingURL=viewsResources.js.map