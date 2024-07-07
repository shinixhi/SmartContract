"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RobotOutputViewProvider = void 0;
const util_1 = require("util");
const vscode = require("vscode");
const common_1 = require("../common");
const files_1 = require("../files");
const outViewRunIntegration_1 = require("./outViewRunIntegration");
class RobotOutputViewProvider {
    constructor(context) {
        this.localResourceRoot = undefined;
        // We can use this as a place to store the run results we've seen.
        this.storageUri = undefined;
        this.updateDebounced = (0, common_1.debounce)(() => {
            this._doUpdate();
        }, 500);
        this.extensionUri = context.extensionUri;
        this.storageUri = context.storageUri;
        // Constructor is called only once, afterwards it just resolves...
        context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(() => {
            this.update();
        }));
    }
    resolveWebviewView(webviewView, context, token) {
        async function showSourceAtLineno(source, lineno) {
            lineno -= 1;
            const start = new vscode.Position(lineno, 0);
            const options = { selection: new vscode.Selection(start, start) };
            const editor = await vscode.window.showTextDocument(vscode.Uri.file(source), options);
        }
        this.view = webviewView;
        webviewView.webview.onDidReceiveMessage(async (message) => {
            if (message.type == "event") {
                if (message.event == "onClickReference") {
                    const data = message.data;
                    if (data) {
                        let source = data["source"];
                        let lineno = data["lineno"];
                        if (source && lineno && lineno > 0) {
                            showSourceAtLineno(source, lineno);
                        }
                        else if (data["messageType"] === "ST") {
                            // Tests have a line but the source comes from the suite.
                            if (lineno && lineno > 0) {
                                const scope = data["scope"];
                                if (scope !== undefined && scope.length > 0) {
                                    const parentMsg = scope[0];
                                    source = parentMsg["decoded"].suite_source;
                                    if (source && (0, files_1.isFile)(source)) {
                                        showSourceAtLineno(source, lineno);
                                    }
                                }
                            }
                        }
                    }
                }
                else if (message.event === "onSetCurrentRunId") {
                    const data = message.data;
                    if (data) {
                        outViewRunIntegration_1.globalOutputViewState.setCurrentRunId(data["runId"]);
                    }
                }
            }
        });
        webviewView.onDidChangeVisibility(() => {
            if (!this.view || !this.view.visible) {
                outViewRunIntegration_1.globalOutputViewState.setWebview(undefined);
            }
            else {
                outViewRunIntegration_1.globalOutputViewState.setWebview(this.view.webview);
                outViewRunIntegration_1.globalOutputViewState.updateAfterVisible();
            }
            // Can be used in dev to update the whole HTML instead of just the contents.
            // this.updateHTML(undefined); //TODO: Comment this line when not in dev mode.
            this.update();
        });
        webviewView.onDidDispose(() => {
            outViewRunIntegration_1.globalOutputViewState.setWebview(undefined);
            this.view = undefined;
        });
        outViewRunIntegration_1.globalOutputViewState.setWebview(this.view.webview);
        this.updateHTML(token);
    }
    async updateHTML(token) {
        if (!this.localResourceRoot) {
            this.localResourceRoot = await getLocalResourceRoot(this.extensionUri);
        }
        const localResourceRoots = [];
        if (this.localResourceRoot) {
            localResourceRoots.push(this.localResourceRoot);
        }
        if (token?.isCancellationRequested) {
            return;
        }
        const webviewView = this.view;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: localResourceRoots,
        };
        let html;
        try {
            // const indexHTML: vscode.Uri = vscode.Uri.joinPath(this.localResourceRoot, "index.html");
            const templateFile = (0, files_1.getExtensionRelativeFile)("../../vscode-client/templates/output.html", true);
            const indexHTML = vscode.Uri.file(templateFile);
            const indexContents = await vscode.workspace.fs.readFile(indexHTML);
            if (token?.isCancellationRequested) {
                return;
            }
            const decoded = new util_1.TextDecoder("utf-8").decode(indexContents);
            html = decoded;
        }
        catch (error) {
            html = "Error loading HTML: " + error;
        }
        webviewView.webview.html = html;
        outViewRunIntegration_1.globalOutputViewState.updateAfterVisible();
        this.update();
    }
    async update() {
        this.updateDebounced();
    }
    async _doUpdate() {
        if (!this.view || !this.view.visible) {
            return;
        }
        if (this.loading) {
            this.loading.cts.cancel();
            this.loading = undefined;
        }
        const loadingEntry = { cts: new vscode.CancellationTokenSource() };
        this.loading = loadingEntry;
        const updatePromise = (async () => {
            if (this.loading !== loadingEntry) {
                return;
            }
            this.loading = undefined;
            if (this.view && this.view.visible) {
                this.onUpdatedEditorSelection(loadingEntry.cts.token);
            }
        })();
        await Promise.race([
            updatePromise,
            new Promise((resolve) => setTimeout(resolve, 250)).then(() => {
                if (loadingEntry.cts.token.isCancellationRequested) {
                    return;
                }
                return vscode.window.withProgress({ location: { viewId: RobotOutputViewProvider.viewType } }, () => updatePromise);
            }),
        ]);
    }
    async onUpdatedEditorSelection(token) {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }
        if (token.isCancellationRequested) {
            return;
        }
        const filePath = editor.document.uri.fsPath;
        if (!filePath.endsWith(".robolog")) {
            return;
        }
        const currDoc = editor.document;
        let text = currDoc.getText();
        await outViewRunIntegration_1.globalOutputViewState.addRun(filePath, filePath, text);
    }
}
exports.RobotOutputViewProvider = RobotOutputViewProvider;
RobotOutputViewProvider.viewType = "robocorp.python.view.output";
async function getLocalResourceRoot(extensionUri) {
    let localResourceRoot = vscode.Uri.file((0, files_1.getExtensionRelativeFile)("../../vscode-client/templates", true));
    return localResourceRoot;
}
//# sourceMappingURL=outView.js.map