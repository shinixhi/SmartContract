"use strict";
/**
 * @source https://github.com/robocorp/inspector-ext/blob/master/src/vscode/protocols.ts
 *! THIS FILE NEEDS TO ALWAYS MATCH THE SOURCE
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IAppRoutes = exports.IApps = exports.IMessageType = void 0;
var IMessageType;
(function (IMessageType) {
    IMessageType["REQUEST"] = "request";
    IMessageType["RESPONSE"] = "response";
    IMessageType["EVENT"] = "event";
})(IMessageType = exports.IMessageType || (exports.IMessageType = {}));
var IApps;
(function (IApps) {
    IApps["LOCATORS_MANAGER"] = "locatorsManager";
    IApps["WEB_INSPECTOR"] = "webInspector";
    IApps["WINDOWS_INSPECTOR"] = "windowsInspector";
    IApps["IMAGE_INSPECTOR"] = "imageInspector";
    IApps["JAVA_INSPECTOR"] = "javaInspector";
})(IApps = exports.IApps || (exports.IApps = {}));
var IAppRoutes;
(function (IAppRoutes) {
    IAppRoutes["LOCATORS_MANAGER"] = "/locators-manager/";
    IAppRoutes["WEB_INSPECTOR"] = "/web-inspector/";
    IAppRoutes["WINDOWS_INSPECTOR"] = "/windows-inspector/";
    IAppRoutes["IMAGE_INSPECTOR"] = "/image-inspector/";
    IAppRoutes["JAVA_INSPECTOR"] = "/java-inspector/";
})(IAppRoutes = exports.IAppRoutes || (exports.IAppRoutes = {}));
//# sourceMappingURL=protocols.js.map