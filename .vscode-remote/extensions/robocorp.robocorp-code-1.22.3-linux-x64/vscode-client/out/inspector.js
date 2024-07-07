"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_INSPECTOR_VALUE = exports.InspectorType = void 0;
// InspectorType - needs to respect the types from vscode-client/src/inspector/types.ts
var InspectorType;
(function (InspectorType) {
    InspectorType["WebInspector"] = "browser";
    InspectorType["WindowsInspector"] = "windows";
    InspectorType["ImageInspector"] = "image";
    InspectorType["JavaInspector"] = "java";
    InspectorType["PlaywrightRecorder"] = "playwright-recorder";
})(InspectorType = exports.InspectorType || (exports.InspectorType = {}));
exports.DEFAULT_INSPECTOR_VALUE = {
    "browser": false,
    "windows": false,
    "image": false,
    "java": false,
    "playwright-recorder": false,
};
//# sourceMappingURL=inspector.js.map