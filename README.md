# pxw-vscode-webpack README

Welcome to PXW Tools for VSCode.

## Features

Enables the "Find All References" tool in VSCode for objectscript code.
Right click on the member name (property, method etc) and select "Find All References" to show a list of all references in the side bar. Clicking within the member code does not work, it will not know what method you are working on.

Add up to 3 new items to the codelens on object script.
1. If the class member (property, method etc) overrides the same member in a superclass this is shown with the word "Override". Clicking on the link opens the appropriate class in the editor.
2. If the class member has been overridden by subclasses it shows the word "Overridden N" where N is the number of times it has been overridden.
3. If the class member has been used in any class it shows the word "Xref N" where N is the number of times it has been referenced.

Clicking on "Overridden" and "Xref" show the complete reference lookup in "peek" mode. This is the same data as "Find All References" in both cases. I have not worked out how to distinguish between the two buttons.

## Requirements

The References are all calculated using data from PXW Tools so it will only work on namespaces that are covered by those tools. 

## Extension Settings

VSCode pulls this data from PXW Tools which needs it's own connection as it may not be in the same place as the code you are looking at:

~~~
"pxw.xref.connection": {
        "namespace": "IRISAPP",
        "host": "localhost",
        "port": "52775",
        "username": "_SYSTEM",
        "scheme":"http"
    }
~~~

These settings probably will be similar to one of your existing "intersystems.servers" except with an added "namespace" which is the location of the PXW tools code.

## Known Issues

Keeps an internal cache of all overrides/overridden members. This is never cleared meaning that it could fill memory and may become out of date as other code changes. 

I have "borrowed" a lot of code from elsewhere, I do not fully understand how it works yet!

## Release Notes

**Enjoy!**
