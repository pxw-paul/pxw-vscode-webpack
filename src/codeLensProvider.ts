import * as vscode from "vscode";
import {
  codeLensMap,
  clsLangId,
  intLangId,
  macLangId,
  lsExtensionId,
} from "./extension";
import { codeLensObject, QueryData } from "./types";
import { makeRESTRequest } from "./makeRESTRequest";
import {
  getClassNameFromDocument,
  quoteUDLIdentifier,
  serverForUri,
} from "./functions";
import { objectScriptApi } from "./extension";

export class ObjectScriptCodeLensProvider implements vscode.CodeLensProvider {
  public async provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): Promise<vscode.CodeLens[]> {
    const result: vscode.CodeLens[] = [];

    if (![clsLangId, macLangId, intLangId].includes(document.languageId)) {
      console.log("Document language not valid " + document.languageId);
      return result;
    }

    const className = getClassNameFromDocument(document);

    if (className === "") {
      console.log("Classname not found");
      return result;
    }

    const symbols: vscode.DocumentSymbol[] =
      await vscode.commands.executeCommand(
        "vscode.executeDocumentSymbolProvider",
        document.uri
      );
    if (!symbols?.length || token.isCancellationRequested) {
      console.log("symbols or token.isCancellationRequested ");
      return result;
    }

    let upperClassName = " " + className.toUpperCase();
    if (!codeLensMap.has(upperClassName)) {
      console.log("Loading origins from server " + className);

      const toriginsMap = new Map<string, codeLensObject>();
      // Query the server to get all the member that are overriding a superclass version of the member
      var data1: QueryData = {
        query: `
            select %SQLUPPER(parent) as Parent, %SQLUPPER(name) as Name, Description, Origin, MemberType
            from (          SELECT Parent,Name, Description, Origin, 'method' AS MemberType FROM %Dictionary.CompiledMethod WHERE Stub IS NULL 
                  UNION ALL SELECT Parent,Name, Description, Origin, 'query' AS MemberType FROM %Dictionary.CompiledQuery 
                  UNION ALL SELECT Parent,Name, Description, Origin, 'projection' AS MemberType FROM %Dictionary.CompiledProjection 
                  UNION ALL SELECT Parent,Name, Description, Origin, 'index' AS MemberType FROM %Dictionary.CompiledIndex 
                  UNION ALL SELECT Parent,Name, Description, Origin, 'foreignkey' AS MemberType FROM %Dictionary.CompiledForeignKey
                  UNION ALL SELECT Parent,Name, Description, Origin, 'trigger' AS MemberType FROM %Dictionary.CompiledTrigger 
                  UNION ALL SELECT Parent,Name, Description, Origin, 'xdata' AS MemberType FROM %Dictionary.CompiledXData 
                  UNION ALL SELECT Parent,Name, Description, Origin, 'property' AS MemberType FROM %Dictionary.CompiledProperty 
                  UNION ALL SELECT Parent,Name, Description, Origin, 'parameter' AS MemberType FROM %Dictionary.CompiledParameter
            ) as items 
            where items.parent %INLIST (select $LISTFROMSTRING(Super) from %Dictionary.CompiledClass where name=?  ) SIZE ((10))
                `,
        parameters: new Array(1).fill(className),
      };
      const server = await serverForUri(document.uri);
      const respdata1 = await makeRESTRequest(
        "POST",
        1,
        "/action/query",
        server,
        data1
      );
      if (
        respdata1 !== undefined &&
        respdata1.data.status.errors.length === 0 &&
        respdata1.data.result.content.length > 0
      ) {
        // We got data back
        //
        console.log("origins loaded");
        for (let memobj of respdata1.data.result.content) {
          if (!toriginsMap.has(memobj.Name)) {
            const uri = objectScriptApi.getUriForDocument(`${memobj.Origin}.cls`);
            var clo: codeLensObject = {
              uri: uri,
              origin: memobj.Origin,
              overrideCount: 0,
              xrefCount: 0,
            };
            toriginsMap.set(memobj.Name, clo);
          }
        }
      } else {
        console.log("origins failed to load");
      }
      // Query the server to get all the members that have been overridden by some subclass
      // this query is not quite right, its not the best way to work out the pxw namespace from the actual namespace
      var data2: QueryData = {
        query: `
          select ns as NameSpace,%SQLUPPER(ik1) as ClassName, %SQLUPPER(ik2) as MemberName
          ,(select count(*) from PXW_Xref."Data" as x2 where %SQLUPPER(x2.Namespace)=%SQLUPPER(x1.ns) and %SQLUPPER(x2.itemtype)=%SQLUPPER(x1.ityp) 
                                                        and %SQLUPPER(x2.itemkey1)=%SQLUPPER(x1.ik1) and %SQLUPPER(x2.itemkey2)=%SQLUPPER(x1.ik2) ) as xrefCount
          ,(select count(*) from PXW_Xref."Data" as x2 where %SQLUPPER(x2.Namespace)=%SQLUPPER(x1.ns) and %SQLUPPER(x2.itemtype)=%SQLUPPER(x1.ityp) 
                                                         and %SQLUPPER(x2.itemkey1)=%SQLUPPER(x1.ik1) and %SQLUPPER(x2.itemkey2)=%SQLUPPER(x1.ik2)
                                                         and %SQLUPPER(x2.calledbycommand)=%SQLUPPER('_Override')) as overriddenCount
          from (
            SELECT xd.NameSpace as ns,xd.ItemType as ityp,xd.ItemKey1 as ik1,xd.ItemKey2 as ik2 FROM pxw_xref."Data" as xd
            union
            SELECT xd.NameSpace,xd.CalledByType ,xd.CalledByKey1 ,xd.CalledByKey2 FROM pxw_xref."Data" as xd
          ) as x1
          where ns=(
                      	select top 1 ID from PXW_DEV_Dictionary.AtelierSettings as ns1 where ns1.Namespace=?
	                  ) and ityp='CLS' and ik1=?

        `,
        parameters: [server.namespace, className],
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
          if (!toriginsMap.has(memobj.MemberName)) {
            const uri = document.uri; //objectScriptApi.getUriForDocument(`${memobj.ClassName}.cls`);
            const clo: codeLensObject = {
              uri: uri,
              origin: "",
              overrideCount: memobj.overriddenCount,
              xrefCount: memobj.xrefCount,
            };
            toriginsMap.set(memobj.MemberName, clo);
          } else {
            const clo = toriginsMap.get(memobj.MemberName);
            if (clo) {
              clo.overrideCount = memobj.overriddenCount;
              clo.xrefCount = memobj.xrefCount;
            }
          }
        }
      } else {
        console.log("overrides failed to load");
      }

      codeLensMap.set(upperClassName, toriginsMap);
    }
    const originsMap = codeLensMap.get(upperClassName);

    if (originsMap) {
      const languageServer: boolean =
        vscode.extensions.getExtension(lsExtensionId)?.isActive ?? false;

      if (document.languageId === clsLangId) {
        // Loop through the class member symbols
        symbols[0].children.forEach((symbol, idx) => {
          const type = symbol.detail.toLowerCase();
          //if (!["xdata", "method", "classmethod", "query", "trigger"].includes(type)) { return;}
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
          // match the name from the server (sqlupper)
          const upperMember = " " + symbol.name.toUpperCase();
          if (originsMap.has(upperMember)) {
            const origindet = originsMap.get(upperMember);
            if (origindet) {
              if (origindet.origin !== "") {
                result.push(
                  this.addOverride(
                    symbolLine,
                    origindet.uri,
                  )
                );
              }
              if (origindet.overrideCount !== 0) {
                result.push(
                  this.addOverridden(
                    symbolLine,
                    origindet.uri,
                    origindet.overrideCount
                  )
                );
              }
              if (origindet.xrefCount !== 0) {
                result.push(
                  this.addXref(
                    symbolLine,
                    origindet.uri,
                    origindet.xrefCount
                  )
                );
              }
            }
          }
        });
      }
    }

    return result;
  }
  private addOverride(
    line: number,
    uri: vscode.Uri,
  ) {
    return new vscode.CodeLens(this.range(line), {
      title: "Override",
      command: "vscode.open",
      arguments: [uri],
    });
  }

  private addOverridden(line: number, uri: vscode.Uri, overCount: number) {
    // peek: editor.action.goToReferences
    // side bar: references-view.findReferences
    return new vscode.CodeLens(this.range(line), {
      title: "Overridden " + overCount + "",
      command: "references-view.findReferences",
      arguments: [uri, new vscode.Position(line, 1)],
    });
  }

  private addXref(line: number, uri: vscode.Uri, xrefCount: number) {
    // peek editor.action.goToReferences
    // references-view.findReferences
    return new vscode.CodeLens(this.range(line), {
      title: "Xref " + xrefCount + "",
      command: "references-view.findReferences",
      arguments: [uri, new vscode.Position(line, 1)],
    });
  }

  private range(line: number): vscode.Range {
    return new vscode.Range(line, 0, line, 80);
  }
}
