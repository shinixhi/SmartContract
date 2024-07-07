"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleProgressMessage = void 0;
const vscode_1 = require("vscode");
class ProgressReporter {
    start(args) {
        vscode_1.window.withProgress({ location: vscode_1.ProgressLocation.Notification, title: args.title, cancellable: true }, (p, token) => {
            this.progress = p;
            this.token = token;
            this.promise = new Promise((resolve, reject) => {
                this.resolve = resolve;
            });
            return this.promise;
        });
    }
    report(args) {
        if (this.progress) {
            this.progress.report(args);
        }
    }
    end() {
        if (this.resolve) {
            this.resolve();
            this.resolve = undefined;
            this.promise = undefined;
            this.progress = undefined;
        }
    }
}
let id_to_progress = new Map();
function handleProgressMessage(args) {
    switch (args.kind) {
        case "begin":
            let reporter = new ProgressReporter();
            reporter.start(args);
            id_to_progress[args.id] = reporter;
            return reporter;
        case "report":
            let prev = id_to_progress[args.id];
            if (prev) {
                prev.report(args);
            }
            return prev;
        case "end":
            let last = id_to_progress[args.id];
            if (last) {
                last.end();
                id_to_progress.delete(args.id);
            }
            return last;
    }
}
exports.handleProgressMessage = handleProgressMessage;
//# sourceMappingURL=progress.js.map