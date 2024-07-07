"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerLinkProviders = void 0;
const vscode_1 = require("vscode");
const fs = require("fs");
async function registerLinkProviders(extensionContext) {
    extensionContext.subscriptions.push(vscode_1.window.registerTerminalLinkProvider({
        provideTerminalLinks(context) {
            const regex = /(Robocorp Log(\s*\(html\)\s*)?:\s*)(.+\.html)/;
            const match = context.line.match(regex);
            if (match) {
                let path = match[3].trim();
                if (fs.existsSync(path)) {
                    return [
                        {
                            startIndex: match.index + match[1].length,
                            length: path.length,
                            tooltip: "Open Log in external Browser.",
                            path: path,
                        },
                    ];
                }
            }
            return [];
        },
        handleTerminalLink(link) {
            vscode_1.env.openExternal(vscode_1.Uri.file(link.path));
        },
    }));
}
exports.registerLinkProviders = registerLinkProviders;
//# sourceMappingURL=linkProvider.js.map