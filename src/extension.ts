import * as vscode from 'vscode';
import { Cache } from './vscodeCache';
import { ObjectScriptCodeLensProvider } from "./codeLensProvider";
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
export let codeLensMap = new Map<string, Map<string,{uri:vscode.Uri, origin:string, overrideCount:number}>>();


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
}

export function deactivate() {}