import * as vscode from "vscode";
import {
  codeLensMap,
  clsLangId,
  intLangId,
  macLangId,
  lsExtensionId,
  objectScriptApi,
} from "./extension";
import { QueryData } from "./types";
import { makeRESTRequest } from "./makeRESTRequest";
import { getClassNameFromDocument, quoteUDLIdentifier, serverForUri, serverForXref } from "./functions";

export class XrefProvider implements vscode.ReferenceProvider {
  async provideReferences(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.ReferenceContext,
    token: vscode.CancellationToken
  ): Promise<vscode.Location[] | null | undefined> {
    console.log(position);
    console.log(position.line);
    console.log(position.character);
    console.log(context);

    const result: vscode.Location[] = [];

    let originSelectionRange = new vscode.Range(0, 0, 1, 0);
    let className = getClassNameFromDocument(document);
    if (className!=="") {
      const symbols: vscode.DocumentSymbol[] =
        await vscode.commands.executeCommand(
          "vscode.executeDocumentSymbolProvider",
          document.uri
        );
      if (!symbols?.length || token.isCancellationRequested) {
        console.log("symbols or token.isCancellationRequested ");
        return result;
      }
      console.log("loaded symbols");
      if (document.languageId === clsLangId) {
        const languageServer: boolean =
          vscode.extensions.getExtension(lsExtensionId)?.isActive ?? false;
        let memberName = "";
        // Loop through the class member symbols
        symbols[0].children.forEach((symbol, idx) => {
          const type = symbol.detail.toLowerCase();
          let symbolLine: number = 0;
          if (languageServer) {
            symbolLine = symbol.selectionRange.start.line;
          } else {
            // This extension's symbol provider doesn't have a range
            // that always maps to the first line of the member definition
            for (let l = symbol.range.start.line; l < document.lineCount; l++) {
              symbolLine = l;
              if (!document.lineAt(l).text.startsWith("///")) {
                break;
              }
            }
          }
          if (symbolLine === position.line) {
            memberName = symbol.name;
          }
        });
        if (memberName === "") {
          console.log(
            "not able to find symbol (cursor must be on the top line of the method"
          );
        } else {
          console.log("xref for " + className + ":" + memberName);
        }

        const server = await serverForXref();

        // Query the server to get all the members that have been overridden by some subclass
        // this query is not quite right, its not the best way to work out the pxw namespace from the actual namespace
        var data2: QueryData = {
          query: `
              select CalledByKey1,CalledByKey2,LineNumber from pxw_xref.data
                  where namespace=(select top 1 ID from PXW_DEV_Dictionary.AtelierSettings as ns1 where ns1.Namespace= ?  ) 
                  and itemtype='CLS' 
                  and itemkey1=?
                  and itemkey2=?
                    `,
          parameters: [server.namespace, className, memberName],
        };
        const respdata2 = await makeRESTRequest(
          "POST",
          1,
          "/action/query",
          server,
          data2
        );
        if (
          respdata2 !== undefined &&
          respdata2.data.status.errors.length === 0 &&
          respdata2.data.result.content.length > 0
        ) {
          // We got data back
          //
          console.log("overrides loaded");
          for (let memobj of respdata2.data.result.content) {
            /*if (memobj.MemberName===' LOAD') {
                        console.log(memobj);
                        }*/
            const uri = objectScriptApi.getUriForDocument(
              `${memobj.CalledByKey1}.cls`
            );
            const line = parseInt(memobj.LineNumber);
            result.push(
              new vscode.Location(uri, new vscode.Position(line - 1, 1))
            );
          }
        } else {
          console.log("xref failed to load");
        }
      }
    }
    console.log("returning result");
    return result;
  }
}
