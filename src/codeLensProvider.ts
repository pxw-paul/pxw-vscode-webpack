import * as vscode from "vscode";
import { codeLensMap,clsLangId, intLangId, macLangId, lsExtensionId } from "./extension";
import { QueryData } from "./types";
import { makeRESTRequest } from "./makeRESTRequest";
import { quoteUDLIdentifier, serverForUri } from "./functions";
import { objectScriptApi } from "./extension";

export class ObjectScriptCodeLensProvider implements vscode.CodeLensProvider {
  public async provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): Promise<vscode.CodeLens[]> {

    const result: vscode.CodeLens[] = [];

    if (![clsLangId, macLangId, intLangId].includes(document.languageId)) {
        console.log("Document language not valid "+document.languageId); 
        return result;
    }

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

      if (!className) {
        console.log("Classname not found");
        return result;
      }

    const symbols: vscode.DocumentSymbol[] = await vscode.commands.executeCommand(
      "vscode.executeDocumentSymbolProvider",
      document.uri
    );
    if (!symbols?.length || token.isCancellationRequested) {
      console.log("symbols or token.isCancellationRequested ");
      return result;
    }

    if (!codeLensMap.has(className)) {
      console.log("Loading origins from server "+className);
      
      const toriginsMap = new Map<string,{uri:vscode.Uri, origin:string}>();
        // Query the server to get the metadata of all appropriate class members
        var data: QueryData = {
          query:  `
                  select * 
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
                  where items.parent %INLIST (select $LISTFROMSTRING(Super) from %Dictionary.CompiledClass where name= ? ) SIZE ((10))
                  `,
          parameters: new Array(1).fill(className)
        };
        const server = await serverForUri(document.uri);     
        const respdata = await makeRESTRequest("POST", 1, "/action/query", server, data);
        if (respdata !== undefined && respdata.data.status.errors.length === 0 && respdata.data.result.content.length > 0) {
          // We got data back
          // 
         console.log("origins loaded");
         
          for (let memobj of respdata.data.result.content) {
            if (!toriginsMap.has(memobj.Name)) {
              const uri = objectScriptApi.getUriForDocument(`${memobj.Origin}.cls`);
              toriginsMap.set(memobj.Name,{uri:uri,origin:memobj.Origin});
            }
          }        
        } else {
          console.log("origins failed to load");
        }
        codeLensMap.set(className,toriginsMap);
    } 
    const originsMap=codeLensMap.get(className);

    if (originsMap) {
      const languageServer: boolean = vscode.extensions.getExtension(lsExtensionId)?.isActive ?? false;
      
      if (document.languageId===clsLangId) {
        // Loop through the class member symbols
        symbols[0].children.forEach((symbol, idx) => {
            const type = symbol.detail.toLowerCase();
            //if (!["xdata", "method", "classmethod", "query", "trigger"].includes(type)) { return;}
            let symbolLine: number=0;
            if (languageServer) {
              symbolLine = symbol.selectionRange.start.line;
            } else {
              // This extension's symbol provider doesn't have a range
              // that always maps to the first line of the member definition
              for (let l = symbol.range.start.line; l < document.lineCount; l++) {
                symbolLine = l;
                if (!document.lineAt(l).text.startsWith("///")) {break; }
              }
            }
            
            if (originsMap.has(symbol.name)) {
              const origindet=originsMap.get(symbol.name);
              if (origindet) {
                result.push(this.addOverride(symbolLine,origindet.origin,origindet.uri,symbol.name));
              }
            }
        });   
      }
    }
    
    
    return result;
  }
  private addOverride(line: number,  origin: string,uri:vscode.Uri, label: string) {
    return new vscode.CodeLens(this.range(line), {
      title: "Override",
      command: "vscode.open",
      arguments: [uri],
    });
  }
    private range(line: number): vscode.Range {
    return new vscode.Range(line, 0, line, 80);
  }

}

