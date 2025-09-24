import * as vscode from 'vscode';
import { Cache } from './vscodeCache';
import { ObjectScriptCodeLensProvider } from "./codeLensProvider";
import { XrefProvider } from './referenceProvider';
import { codeLensObject } from './types';
import { quoteUDLIdentifier } from './functions';
/**
 * Cache for cookies from REST requests to InterSystems servers.
 */
export let cookiesCache: Cache;

export let objectScriptApi: any;

/// for utils (from vscode-objectscript)

export const clsLangId = "objectscript-class";
export const macLangId = "objectscript";
export const intLangId = "objectscript-int";
export const incLangId = "objectscript-macros";
export const cspLangId = "objectscript-csp";
export const outputLangId = "vscode-objectscript-output";
export const lsExtensionId = "intersystems.language-server";


// keyed by edited classname = map of method names=origin class
export let codeLensMap = new Map<string, Map<string,codeLensObject>>(); 

export async function activate(context: vscode.ExtensionContext) {

	// Get the main extension exported API
	const objectScriptExt = vscode.extensions.getExtension("intersystems-community.vscode-objectscript");
	objectScriptApi = objectScriptExt?.isActive ? objectScriptExt.exports : objectScriptExt ? await objectScriptExt.activate() : undefined;

	cookiesCache = new Cache(context, "cookies");

	context.subscriptions.push(
		vscode.languages.registerCodeLensProvider(
      		{ language: 'objectscript-class' },
      		new ObjectScriptCodeLensProvider()
    	)
	);

	context.subscriptions.push(
		vscode.languages.registerReferenceProvider(
			{ language: 'objectscript-class' },
			new XrefProvider()
		),
	);


 	const command = 'pxw-vscode-webpack.openoverride';
	const commandHandler = (classname: string ,membername:string) => {
		myOpen(classname,membername);
 	};
	context.subscriptions.push(vscode.commands.registerCommand(command, commandHandler));

}

async function myOpen(classname: string ,membername:string) {
    const uri = objectScriptApi.getUriForDocument(classname+'.cls');
    const symbols: vscode.DocumentSymbol[] =  await vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', uri);
	// Fallback ranges in case we don't find a symbol
	const range = new vscode.Range(0, 0, 1, 0);
	const selectionRange = new vscode.Range(0, 0, 1, 0);
	if (symbols) {
		const members=symbols[0].children;
		if (members) {
			const symbolInfo = members.find((symbol) => symbol.name === quoteUDLIdentifier(membername, 1));
            const targetSelectionRange = symbolInfo?.selectionRange ?? selectionRange;
            const targetRange = symbolInfo?.range ?? range;
			vscode.window.showTextDocument(uri).then(editor => {
				// Line added - by having a selection at the same position twice, the cursor jumps there
				editor.selections = [new vscode.Selection(targetSelectionRange.start,targetSelectionRange.end)]; 
				// And the visible range jumps there too
				//var range = new vscode.Range(pos1, pos1);
				editor.revealRange(targetRange);
			});
		}
	}   
}

/*
async function myOpen(classname: string ,membername:string) {
    const uri = objectScriptApi.getUriForDocument(classname+'.cls');
    const symbols: vscode.DocumentSymbol[] =  await vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', uri);
	// Fallback ranges in case we don't find a symbol
	const range = new vscode.Range(0, 0, 1, 0);
	const selectionRange = new vscode.Range(0, 0, 1, 0);
	if (symbols) {
		const members=symbols[0].children;
		if (members) {
			const symbolInfo = members.find((symbol) => symbol.name === quoteUDLIdentifier(membername, 1));
            const targetSelectionRange = symbolInfo?.selectionRange ?? selectionRange;
            const targetRange = symbolInfo?.range ?? range;
			vscode.window.showTextDocument(uri).then(editor => {
				// Line added - by having a selection at the same position twice, the cursor jumps there
				editor.selections = [new vscode.Selection(targetSelectionRange.start,targetSelectionRange.end)]; 
				// And the visible range jumps there too
				//var range = new vscode.Range(pos1, pos1);
				editor.revealRange(targetRange);
			});
		}
	}   
}
*/

export function deactivate() {}