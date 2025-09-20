import * as vscode from "vscode";
import { objectScriptApi } from "./extension";

export async function serverForUri(uri: vscode.Uri): Promise<any> {
    let serverSpec = objectScriptApi.serverForUri(uri);
    if (
        // Server was resolved
        serverSpec.host !== "" &&
        // Connection isn't unauthenticated (i.e. UnknownUser)
        serverSpec.username !== undefined &&
        serverSpec.username !== "" &&
        serverSpec.username.toLowerCase() !== "unknownuser" &&
        // A password is missing
        typeof serverSpec.password === "undefined"
    ) {
        // The main extension didn't provide a password, so we must 
        // get it from the server manager's authentication provider.
        const AUTHENTICATION_PROVIDER = "intersystems-server-credentials";
        const scopes = [serverSpec.serverName, serverSpec.username || ""];
        try {
            let session = await vscode.authentication.getSession(AUTHENTICATION_PROVIDER, scopes, { silent: true });
            if (!session) {
                session = await vscode.authentication.getSession(AUTHENTICATION_PROVIDER, scopes, { createIfNone: true });
            }
            if (session) {
                serverSpec.username = session.scopes[1];
                serverSpec.password = session.accessToken;
            }
        } catch (error) {
            // The user did not consent to sharing authentication information
            if (error instanceof Error) {
                console.log(`${AUTHENTICATION_PROVIDER}: ${error.message}`);
            }
        }
    }
    return serverSpec;

}

/**
 * Escape a UDL identifier using quotes, if necessary.
 * 
 * @param identifier The identifier to modify.
 * @param direction Pass 1 to add quotes if necessary, 0 to remove existing quotes.
 */
export function quoteUDLIdentifier(identifier: string, direction: 0 | 1): string {
	var result: string = identifier;
	if (direction === 0 && identifier.indexOf('"') === 0) {
		// Remove first and last characters
		result = result.slice(1,-1);
		// Turn any "" into "
		result = result.replace(/""/g,'"');
	}
	else if (direction === 1 && identifier.indexOf('"') !== 0) {
		var needsquoting: boolean = false;
		for (let i = 0; i < result.length; i++) {
			const char: string = result.charAt(i);
			const code: number = result.charCodeAt(i);
			if (i === 0) {
				if (!(char === "%" || (char >= 'A' && char <= 'Z') || (char >= 'a' && char <= 'z') || code > 0x80)) {
					needsquoting = true;
					break;
				}
			}
			else {
				if (!((char >= 'A' && char <= 'Z') || (char >= 'a' && char <= 'z') || code > 0x80 || (char >= '0' && char <= '9'))) {
					needsquoting = true;
					break;
				}
			}
		}
		if (needsquoting) {
			// Turn any " into ""
			result = result.replace(/"/g,'""');
			// Add " to start and end of identifier
			result = '"' + result + '"';
		}
	}
	return result;
}

export function getClassNameFromDocument(document: vscode.TextDocument): string {
	let originSelectionRange = new vscode.Range(0, 0, 1, 0);
	let className = "";

	let inComment = false;
	for (let i = 0; i < document.lineCount; i++) {
		const line = document.lineAt(i);

		// Skip initial comment block(s)
		if (line.text.match(/\/\*/)) {
			inComment = true;
		}
		if (inComment) {
			if (line.text.match(/\*\//)) {
				inComment = false;
			}
			continue;
		}

		// Discover class name
		const classPat = line.text.match(/^(Class) (%?\b\w+\b(?:\.\b\w+\b)+)/i);
		if (classPat) {
			className = classPat[2];
			originSelectionRange = new vscode.Range(i, 0, i, line.text.indexOf(className) + className.length);
			break;
		}
	}
	return className;
}
