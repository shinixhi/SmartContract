"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupDebugSessionOutViewIntegration = exports.globalOutputViewState = exports.envVarsForOutViewIntegration = void 0;
const channel_1 = require("../channel");
const net = require("net");
const crypto_1 = require("crypto");
let lastRunId = 0;
function nextRunLabel() {
    lastRunId += 1;
    return `Run: ${lastRunId}`;
}
function nextRunId() {
    return (0, crypto_1.randomUUID)();
}
class Contents {
    constructor(uniqueRunId, label, contents) {
        this.uniqueRunId = uniqueRunId;
        this.label = label;
        this.contents = [contents];
    }
    getFullContents() {
        return this.contents.join("");
    }
    addContent(line) {
        this.contents.push(line);
    }
}
class OutputViewState {
    constructor(storageUri, workspaceState) {
        this.storageUri = undefined;
        this.workspaceState = undefined;
        // NOTE: uniqueRunIds is a FIFO
        this.uniqueRunIds = [];
        this.runIdToContents = new Map();
        this.storageUri = storageUri;
        this.workspaceState = workspaceState;
    }
    async setWebview(webview) {
        this.webview = webview;
    }
    updateAfterVisible() {
        if (this.currentRunUniqueId !== undefined) {
            this.setCurrentRunId(this.currentRunUniqueId);
        }
    }
    async setCurrentRunId(uniqueRunId) {
        this.currentRunUniqueId = uniqueRunId;
        const webview = this.webview;
        if (webview !== undefined) {
            const contents = this.runIdToContents.get(uniqueRunId);
            if (contents === undefined) {
                channel_1.OUTPUT_CHANNEL.appendLine("No contents registered for runId: " + uniqueRunId);
                return;
            }
            const allRunIdsToLabel = {};
            for (const rId of this.uniqueRunIds) {
                const c = this.runIdToContents.get(rId);
                if (c !== undefined) {
                    allRunIdsToLabel[rId] = c.label;
                }
            }
            const msg = {
                type: "request",
                command: "setContents",
                "initialContents": contents.getFullContents(),
                "runId": uniqueRunId,
                "allRunIdsToLabel": allRunIdsToLabel,
            };
            webview.postMessage(msg);
        }
    }
    /**
     * @param runId the run id which should be tracked.
     */
    async addRun(uniqueRunId, label, contents) {
        this.uniqueRunIds.push(uniqueRunId);
        const MAX_RUNS_SHOWN = 15;
        while (this.uniqueRunIds.length > MAX_RUNS_SHOWN) {
            // NOTE: uniqueRunIds is a FIFO
            let removeI = 0;
            let removeRunId = this.uniqueRunIds[removeI];
            this.runIdToContents.delete(removeRunId);
            this.uniqueRunIds.splice(removeI, 1);
        }
        this.runIdToContents.set(uniqueRunId, new Contents(uniqueRunId, label, contents));
        await this.setCurrentRunId(uniqueRunId);
    }
    async setRunLabel(uniqueRunId, label) {
        const contents = this.runIdToContents.get(uniqueRunId);
        if (contents !== undefined) {
            contents.label = label;
            const webview = this.webview;
            if (webview !== undefined) {
                const msg = {
                    type: "request",
                    command: "updateLabel",
                    "runId": uniqueRunId,
                    "label": label,
                };
                webview.postMessage(msg);
            }
        }
    }
    async appendToRunContents(uniqueRunId, line) {
        const runContents = this.runIdToContents.get(uniqueRunId);
        if (runContents !== undefined) {
            runContents.addContent(line);
        }
        if (uniqueRunId === this.currentRunUniqueId) {
            const webview = this.webview;
            if (webview !== undefined) {
                const msg = {
                    type: "request",
                    command: "appendContents",
                    "appendContents": line,
                    "runId": uniqueRunId,
                };
                webview.postMessage(msg);
            }
        }
    }
}
exports.envVarsForOutViewIntegration = new Map();
/**
 * We create a server socket that'll accept connections.
 */
async function setupDebugSessionOutViewIntegration(context) {
    try {
        exports.globalOutputViewState = new OutputViewState(context.storageUri, context.workspaceState);
        const server = net.createServer((socket) => {
            // OUTPUT_CHANNEL.appendLine("Client connected (Robo Tasks Output connection)");
            const label = nextRunLabel();
            const uniqueId = nextRunId();
            exports.globalOutputViewState.addRun(uniqueId, label, "");
            socket.on("data", (data) => {
                const strData = data.toString("utf-8");
                // OUTPUT_CHANNEL.appendLine(`Received (Robo Tasks Output connection): ${strData}`);
                exports.globalOutputViewState.appendToRunContents(uniqueId, strData);
            });
            socket.on("end", () => {
                // OUTPUT_CHANNEL.appendLine("Client disconnected (Robo Tasks Output connection)");
                exports.globalOutputViewState.setRunLabel(uniqueId, label + " (finished)");
            });
            socket.on("error", (error) => {
                channel_1.OUTPUT_CHANNEL.appendLine(`Socket Error (Robo Tasks Output connection): ${error.message}`);
            });
        });
        server.on("error", (error) => {
            channel_1.OUTPUT_CHANNEL.appendLine(`Error on Robo Tasks Output connections: ${error.message}`);
        });
        server.listen(0, () => {
            exports.envVarsForOutViewIntegration.set("ROBOCORP_TASKS_LOG_LISTENER_PORT", `${server.address()['port']}`);
            channel_1.OUTPUT_CHANNEL.appendLine(`Listening for Robo Tasks Output connections on: ${JSON.stringify(server.address())}`);
        });
    }
    catch (err) {
        (0, channel_1.logError)("Error creating socket for Robocorp Tasks Output integration.", err, "ROBO_TASKS_SOCKET");
    }
}
exports.setupDebugSessionOutViewIntegration = setupDebugSessionOutViewIntegration;
//# sourceMappingURL=outViewRunIntegration.js.map