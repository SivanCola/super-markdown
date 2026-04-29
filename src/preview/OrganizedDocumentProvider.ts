import * as vscode from "vscode";

export class OrganizedDocumentProvider implements vscode.TextDocumentContentProvider {
  private readonly documents = new Map<string, string>();
  private readonly changeEmitter = new vscode.EventEmitter<vscode.Uri>();

  readonly onDidChange = this.changeEmitter.event;

  provideTextDocumentContent(uri: vscode.Uri): string {
    return this.documents.get(uri.toString()) ?? "";
  }

  setContent(source: vscode.Uri, content: string): vscode.Uri {
    const uri = vscode.Uri.from({
      scheme: "super-markdown-organized",
      path: `/${Date.now()}-${sanitizePath(source.path)}.md`,
      query: source.toString()
    });
    this.documents.set(uri.toString(), content);
    this.changeEmitter.fire(uri);
    return uri;
  }

  dispose(): void {
    this.changeEmitter.dispose();
    this.documents.clear();
  }
}

function sanitizePath(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-80);
}
