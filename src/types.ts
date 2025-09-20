import * as vscode from 'vscode';

/**
 * Structure of request body for HTTP POST /action/query.
 */
export type QueryData = {
	query: string,
	parameters: any[]
};

export type codeLensObject = {
	uri:vscode.Uri, 
	origin:string, 
	overrideCount:number,
	xrefCount:number,
};

