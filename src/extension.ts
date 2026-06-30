import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { spawn, execFile } from 'child_process';
import {
  startWebhookServer,
  stopWebhookServer,
} from './webhook_server';
import {
  handleIncomingLead,
  showLastLeadCommand,
  setExtensionPath,
} from './lead_handler';

// ───────── Intake Pipeline Provider ─────────

export class IntakeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly id?: string,
    public readonly command?: vscode.Command
  ) {
    super(label, collapsibleState);
    this.id = id ?? label;
    if (command) { this.command = command; }
  }
}

export class IntakePipelineProvider implements vscode.TreeDataProvider<IntakeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<IntakeItem | undefined | null | void> =
    new vscode.EventEmitter<IntakeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<IntakeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private _entries: Map<string, IntakeItem[]> = new Map(); // intakeId -> child tasks

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: IntakeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: IntakeItem): Thenable<IntakeItem[]> {
    if (!element) {
      // Root: list every intake file we've discovered
      const roots = Array.from(this._entries.keys()).map(id => {
        const item = new IntakeItem(
          id,
          vscode.TreeItemCollapsibleState.Expanded,
          id
        );
        item.iconPath = new vscode.ThemeColor('symbolIcon.fileForeground');
        return item;
      });
      return Promise.resolve(roots);
    }
    // Return the directive tasks for this intake file
    return Promise.resolve(this._entries.get(element.id!) ?? []);
  }

  /** Called by the file watcher when a new intake MD drops in. */
  addIntakeFromMarkdown(intakeId: string, absolutePath: string, sectionFour: string[]): void {
    const children = sectionFour.map((line, idx) => {
      const clean = line.replace(/^[-•*\s]+/, '').trim();
      const item = new IntakeItem(
        clean.substring(0, 60) + (clean.length > 60 ? '…' : ''),
        vscode.TreeItemCollapsibleState.None,
        `${intakeId}_task_${idx}`,
        {
          title: 'Open Intake Note',
          command: 'sovereign-workspace-ide.openIntakeFile',
          arguments: [absolutePath],
        }
      );
      item.iconPath = new vscode.ThemeColor('symbolIcon.snippetForeground');
      item.tooltip = clean;
      return item;
    });
    this._entries.set(intakeId, children);
    this.refresh();
  }

  clear(): void {
    this._entries.clear();
    this.refresh();
  }
}

// ───────── Tree Item Definitions ─────────

export class SovereignTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly id?: string,
        public readonly command?: vscode.Command
    ) {
        super(label, collapsibleState);
        this.id = id || label;
        if (command) {
            this.command = command;
        }
    }
}

// ───────── TreeDataProvider: Autonomous Control Center ─────────

export class SovereignControlCenterProvider implements vscode.TreeDataProvider<SovereignTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<SovereignTreeItem | undefined | null | void> = new vscode.EventEmitter<SovereignTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<SovereignTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private _agents = [
        { label: 'Swarm Agent 1: IDE Extension UI Engineer', ctx: 'agentNode', icon: '$(symbol-class)' },
        { label: 'Swarm Agent 2: Unified Gateway & AST Architect', ctx: 'agentNode', icon: '$(circuit-board)' },
        { label: 'Swarm Agent 3: Autonomous Workspace Execution Engineer', ctx: 'agentNode', icon: '$(terminal)' },
        { label: 'Swarm Agent 4: Multi-Media Processing Architect', ctx: 'agentNode', icon: '$(preview)' },
        { label: 'Swarm Agent 5: Graphic Render & Component Architect', ctx: 'agentNode', icon: '$(graph)' },
    ];

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: SovereignTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: SovereignTreeItem): Thenable<SovereignTreeItem[]> {
        if (!element) {
            // Root nodes
            return Promise.resolve([
                new SovereignTreeItem('Agent Swarm', vscode.TreeItemCollapsibleState.Expanded, 'agentRoot'),
                new SovereignTreeItem('Local Providers', vscode.TreeItemCollapsibleState.Expanded, 'providerRoot'),
                new SovereignTreeItem('Sandboxes', vscode.TreeItemCollapsibleState.Collapsed, 'sandboxRoot'),
                new SovereignTreeItem('Telemetry', vscode.TreeItemCollapsibleState.None, 'telemetryNode', {
                    title: 'Export Telemetry',
                    command: 'sovereign-workspace-ide.exportTelemetry',
                    arguments: []
                })
            ]);
        }

        if (element.id === 'agentRoot') {
            return Promise.resolve(
                this._agents.map(a => {
                    const item = new SovereignTreeItem(
                        a.label,
                        vscode.TreeItemCollapsibleState.None,
                        undefined,
                        {
                            title: 'Run Orchestrator for Agent',
                            command: 'sovereign-workspace-ide.runOrchestrator',
                            arguments: [a.label]
                        }
                    );
                    item.iconPath = new vscode.ThemeColor('symbolIcon.classForeground');
                    item.contextValue = a.ctx;
                    return item;
                })
            );
        }

        if (element.id === 'providerRoot') {
            const config = vscode.workspace.getConfiguration('sovereign-workspace-ide');
            return Promise.resolve([
                new SovereignTreeItem(`Vertex AI: ${config.get('vertexAi.projectId') || 'Not Configured'}`, vscode.TreeItemCollapsibleState.None),
                new SovereignTreeItem(`Cohere: ${config.get('cohere.model') || 'Not Configured'}`, vscode.TreeItemCollapsibleState.None),
                new SovereignTreeItem(`Hermes CLI: ${config.get('hermes.cliPath') || 'hermes'}`, vscode.TreeItemCollapsibleState.None)
            ]);
        }

        if (element.id === 'sandboxRoot') {
            const workspaceRoot = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri.fsPath : '';
            const sandboxesPath = path.join(workspaceRoot, 'workspace-ide', 'sandboxes');
            if (fs.existsSync(sandboxesPath)) {
                const dirs = fs.readdirSync(sandboxesPath).filter(f => fs.statSync(path.join(sandboxesPath, f)).isDirectory());
                if (dirs.length === 0) {
                    return Promise.resolve([new SovereignTreeItem('No active sandboxes', vscode.TreeItemCollapsibleState.None)]);
                }
                return Promise.resolve(dirs.map(d => new SovereignTreeItem(d, vscode.TreeItemCollapsibleState.None)));
            }
            return Promise.resolve([new SovereignTreeItem('No active sandboxes', vscode.TreeItemCollapsibleState.None)]);
        }

        return Promise.resolve([]);
    }
}

// ───────── Telemetry Exporter ─────────

async function exportTelemetryToDesktop(): Promise<void> {
    const config = vscode.workspace.getConfiguration('sovereign-workspace-ide');
    const storageRaw = config.get<string>('telemetry.storagePath') || '~/.hermes/trajectory';
    const storagePath = storageRaw.startsWith('~') ? path.join(os.homedir(), storageRaw.slice(1)) : storageRaw;
    const desktopPath = path.join(os.homedir(), 'Desktop');
    const outFile = path.join(desktopPath, `sovereign_telemetry_export_${Date.now()}.json`);

    if (!fs.existsSync(storagePath)) {
        vscode.window.showWarningMessage(`Telemetry storage not found at ${storagePath}`);
        return;
    }

    try {
        const files = fs.readdirSync(storagePath).filter(f => f.endsWith('.json'));
        const sanitized = files.map(f => {
            const raw = fs.readFileSync(path.join(storagePath, f), 'utf8');
            const parsed = JSON.parse(raw);
            // Sanitize potential PII / secrets
            const redactKeys = ['apiKey', 'token', 'password', 'secret', 'key'];
            redactKeys.forEach(k => { if (parsed[k]) parsed[k] = '[REDACTED]'; });
            return { source: f, importedAt: new Date().toISOString(), trajectory: parsed };
        });

        fs.writeFileSync(outFile, JSON.stringify(sanitized, null, 2));
        vscode.window.showInformationMessage(`Telemetry exported to Desktop: ${outFile}`);
    } catch (err: any) {
        vscode.window.showErrorMessage(`Telemetry export failed: ${err.message}`);
    }
}

// ───────── Orchestrator Spawner ─────────

function runOrchestrator(context: vscode.ExtensionContext, agentLabel?: string): void {
    const config = vscode.workspace.getConfiguration('sovereign-workspace-ide');
    const blueprintDir = path.join(context.extensionPath, 'Blueprints');
    const scriptPath = path.join(blueprintDir, 'orchestrator.py');
    const astScriptPath = path.join(blueprintDir, 'ast_parser.py');
    const gatewayScriptPath = path.join(blueprintDir, 'gateway.py');
    const timeout = config.get<number>('sandbox.timeout') || 120000;

    // Pre-flight: ensure all core Blueprint scripts exist
    const missing: string[] = [];
    if (!fs.existsSync(scriptPath)) missing.push('orchestrator.py');
    if (!fs.existsSync(astScriptPath)) missing.push('ast_parser.py');
    if (!fs.existsSync(gatewayScriptPath)) missing.push('gateway.py');
    if (missing.length > 0) {
        vscode.window.showErrorMessage(`Missing Blueprint scripts: ${missing.join(', ')} – re-install the extension.`);
        return;
    }

    const term = vscode.window.createTerminal({
        name: agentLabel ? `Orchestrator: ${agentLabel}` : 'Sovereign Orchestrator',
        cwd: vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri.fsPath : undefined
    });
    term.show();

    // Use correct CLI subcommand syntax aligned with orchestrator.py argparse
    const args = [`"${scriptPath}"`, 'self-heal'];
    args.push(`--test-cmd="pytest tests/ -v"`);
    const workspaceRoot = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri.fsPath : process.cwd();
    args.push(`--root="${workspaceRoot}"`);
    if (agentLabel) args.push(`--agent="${agentLabel}"`);

    term.sendText(`python3 ${args.join(' ')}`);

    setTimeout(() => {
        vscode.window.showWarningMessage(`Orchestrator subprocess has exceeded ${timeout}ms safety threshold. Review isolation status.`);
    }, timeout);
}

// ───────── AST Index ─────────

async function runAstIndex(context: vscode.ExtensionContext): Promise<void> {
    const blueprintDir = path.join(context.extensionPath, 'Blueprints');
    const scriptPath = path.join(blueprintDir, 'orchestrator.py');
    const workspaceRoot = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri.fsPath : process.cwd();

    if (!fs.existsSync(scriptPath)) {
        vscode.window.showErrorMessage(`Orchestrator script not found: ${scriptPath}`);
        return;
    }

    const term = vscode.window.createTerminal({
        name: 'AST Indexer',
        cwd: workspaceRoot,
    });
    term.show();

    term.sendText(`python3 "${scriptPath}" ast-index "${workspaceRoot}" -o "${path.join(workspaceRoot, '.passaggio_ast_index.json')}"`);
}

// ───────── Hermes CLI Bridge ─────────

function activateHermesDaemon(context: vscode.ExtensionContext): void {
    const config = vscode.workspace.getConfiguration('sovereign-workspace-ide');
    const hermesPath = config.get<string>('hermes.cliPath') || 'hermes';
    const modelPath = config.get<string>('hermes.modelPath') || '';

    const term = vscode.window.createTerminal({
        name: 'Local Hermes Daemon',
        cwd: vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri.fsPath : undefined
    });
    term.show();

    if (modelPath && modelPath.trim().length > 0) {
        term.sendText(`${hermesPath} run --path "${modelPath}"`);
    } else {
        term.sendText(`${hermesPath} run`);
    }
}

// ───────── Activation Entrypoint ─────────

export async function activate(context: vscode.ExtensionContext) {
   console.log('Passaggio IDE Core Activation Initiated...');

   // Make extension path available to the lead handler so it can spawn Blueprints
   setExtensionPath(context.extensionPath);

   // ── Auto-start voice-agent webhook server ──
   const cfg = vscode.workspace.getConfiguration('sovereign-workspace-ide');
   const webhookPort = cfg.get<number>('webhook.port') ?? 8787;
   startWebhookServer(webhookPort, handleIncomingLead).catch((err) => {
      console.error('[extension] Failed to start webhook server:', err);
   });

   // 1. Register the tree view data providers
   const provider = new SovereignControlCenterProvider();
   vscode.window.registerTreeDataProvider('autonomousControlCenter', provider);

   // ── NEW: Intake Pipeline Sidebar Tree + File Watcher ──
   const intakeProvider = new IntakePipelineProvider();
   vscode.window.registerTreeDataProvider('intakePipelineView', intakeProvider);

   // Watch for new /client_intake/*.md files
   if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
     const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
     const intakeGlob = new vscode.RelativePattern(workspaceRoot, 'client_intake/*.md');
     const intakeWatcher = vscode.workspace.createFileSystemWatcher(intakeGlob);

     const processIntakeFile = async (uri: vscode.Uri) => {
       try {
         // 1. Auto-open in editor
         const doc = await vscode.workspace.openTextDocument(uri);
         await vscode.window.showTextDocument(doc, { preview: false });

         // 2. Parse Section 4 – Developer Asset Directives
         const text = doc.getText();
         const directives = parseSectionFour(text);

         // 3. Derive a display ID from filename
         const baseName = path.basename(uri.fsPath, '.md');
         const displayId = `📝 ${baseName}`;

         // 4. Inject into Intake Pipeline sidebar tree
         intakeProvider.addIntakeFromMarkdown(displayId, uri.fsPath, directives);
       } catch (err: any) {
         console.error('[intake-watcher] Failed processing intake file:', err.message);
       }
     };

     intakeWatcher.onDidCreate(processIntakeFile);

     // Seed existing files into the tree on startup
     const existingFiles = await vscode.workspace.findFiles(intakeGlob);
     for (const uri of existingFiles) {
       await processIntakeFile(uri);
     }

     context.subscriptions.push(intakeWatcher);
   }

   // 2. Register your custom chatbot webview panel
   const chatProvider = new PassaggioChatViewProvider(context.extensionUri);
   context.subscriptions.push(
       vscode.window.registerWebviewViewProvider('passaggioChatView', chatProvider)
   );

   // ─── NEW CODE BLOCK: Register the command to spawn a central Editor Tab Chat ───
   context.subscriptions.push(
       vscode.commands.registerCommand('sovereign-workspace-ide.openEditorChat', () => {
           const panel = vscode.window.createWebviewPanel(
               'passaggioEditorChat', 
               'Passaggio Chat Workspace', 
               vscode.ViewColumn.One, // Opens directly in the active main code editor column
               { enableScripts: true }
           );

           // Feed the tab the exact same clean HTML chat canvas layout
           panel.webview.html = chatProvider.getHtmlContent();
       })
   );

   // 3. Register all background backend commands natively
   context.subscriptions.push(
       vscode.commands.registerCommand('sovereign-workspace-ide.refresh', () => provider.refresh())
   );

   context.subscriptions.push(
       vscode.commands.registerCommand('sovereign-workspace-ide.runOrchestrator', (agentLabel?: string) => {
           runOrchestrator(context, agentLabel);
       })
   );

   context.subscriptions.push(
       vscode.commands.registerCommand('sovereign-workspace-ide.exportTelemetry', () => {
           exportTelemetryToDesktop();
       })
   );

   context.subscriptions.push(
       vscode.commands.registerCommand('sovereign-workspace-ide.openSettings', () => {
           vscode.commands.executeCommand('workbench.action.openSettings', 'sovereign-workspace-ide');
       })
   );

   context.subscriptions.push(
       vscode.commands.registerCommand('sovereign-workspace-ide.quickAgent', () => {
           activateHermesDaemon(context);
       })
   );

   context.subscriptions.push(
       vscode.commands.registerCommand('sovereign-workspace-ide.astIndex', () => {
           runAstIndex(context);
       })
   );

   // ── NEW: Voice Agent Lead Pipeline Commands ──
   context.subscriptions.push(
       vscode.commands.registerCommand('sovereign-workspace-ide.startWebhookServer', () => {
           const cfg2 = vscode.workspace.getConfiguration('sovereign-workspace-ide');
           const port = cfg2.get<number>('webhook.port') ?? 8787;
           startWebhookServer(port, handleIncomingLead)
               .then((p) => vscode.window.showInformationMessage(`Webhook server started on port ${p}`))
               .catch((err) => vscode.window.showErrorMessage(`Webhook server failed: ${err.message}`));
       })
   );

   context.subscriptions.push(
       vscode.commands.registerCommand('sovereign-workspace-ide.showLastLead', () => {
           showLastLeadCommand();
       })
   );

   context.subscriptions.push(
        vscode.commands.registerCommand('sovereign-workspace-ide.exportLeads', () => {
            const approvedPath = path.join(os.homedir(), '.passaggio', 'leads', 'approved.ndjson');
            const rejectedPath = path.join(os.homedir(), '.passaggio', 'leads', 'rejected.ndjson');
            const outDir = path.join(os.homedir(), 'Desktop', 'passaggio_leads');
            if (!fs.existsSync(outDir)) {
                fs.mkdirSync(outDir, { recursive: true });
            }
            const stamp = Date.now();
            let copied = 0;
            if (fs.existsSync(approvedPath)) {
                fs.copyFileSync(approvedPath, path.join(outDir, `approved_${stamp}.ndjson`));
                copied++;
            }
            if (fs.existsSync(rejectedPath)) {
                fs.copyFileSync(rejectedPath, path.join(outDir, `rejected_${stamp}.ndjson`));
                copied++;
            }
            if (copied > 0) {
                vscode.window.showInformationMessage(`Exported ${copied} lead log(s) to Desktop/passaggio_leads/`);
            } else {
                vscode.window.showWarningMessage('No lead logs found yet. Complete a voice call first.');
            }
        })
    );

    // ── Intake Pipeline Commands ──
    context.subscriptions.push(
        vscode.commands.registerCommand('sovereign-workspace-ide.refreshIntakes', () => {
            intakeProvider.refresh();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('sovereign-workspace-ide.openIntakeFile', (filePath: string) => {
            vscode.workspace.openTextDocument(filePath).then((doc) => {
                vscode.window.showTextDocument(doc, { preview: false });
            });
        })
    );

   // Auto-refresh providers when configuration changes
   context.subscriptions.push(
       vscode.workspace.onDidChangeConfiguration(e => {
           if (e.affectsConfiguration('sovereign-workspace-ide')) {
               provider.refresh();
           }
       })
   );

   vscode.window.showInformationMessage('Passaggio IDE: Autonomous Control Center is active.');
   vscode.window.showInformationMessage('Passaggio IDE: Workspace Engine Ready.');
}

export function deactivate() {
   stopWebhookServer();
}

// ───────── Intake Markdown Parser ─────────

function parseSectionFour(markdown: string): string[] {
  /**
   * Extract line-level directives from "SECTION 4: Developer Asset Directives"
   * or "### SECTION 4: Developer Asset Directives".
   * Returns an array of clean directive strings (bullet items, list numbers, etc.).
   */
  const sectionRegex = /#{0,3}\s*SECTION\s*4[:\s]*.*Developer Asset Directives/im;
  const idx = markdown.search(sectionRegex);
  if (idx === -1) { return []; }

  // Slice from section header to end (or next header starting with #)
  const fromSection = markdown.slice(idx);
  const nextHeader = fromSection.search(/\n#{1,6}\s/);
  const block = nextHeader !== -1 ? fromSection.slice(0, nextHeader) : fromSection;

  // Collect lines that look like directives (start with bullet, number, or are non-empty)
  const lines: string[] = [];
  for (const rawLine of block.split('\n')) {
    const line = rawLine.trim();
    if (!line || /^#{1,6}\s/.test(line)) { continue; }
    if (/^[-•*]\s/.test(line) || /^\d+[.)]\s/.test(line)) {
      lines.push(line);
    } else if (line.length > 3 && line.length < 200) {
      // Accept short plain text lines inside the section too (sentences, etc.)
      lines.push(line);
    }
  }
  return lines;
}

// ───────── Custom Webview Chat Bot Interface Panel ─────────

class PassaggioChatViewProvider implements vscode.WebviewViewProvider {
   constructor(private readonly _extensionUri: vscode.Uri) {}

   public resolveWebviewView(webviewView: vscode.WebviewView) {
    webviewView.webview.options = { enableScripts: true };
    // Call the unified method directly
    webviewView.webview.html = this.getHtmlContent(); 
}

   // Move your existing HTML template into this public method
   public getHtmlContent(): string {
       return `
           <!DOCTYPE html>
           <html>
           <head>
               <style>
                   body { font-family: var(--vscode-font-family, sans-serif); padding: 15px; color: var(--vscode-foreground); background: transparent; }
                   #chat-box { height: calc(100vh - 120px); min-height: 250px; overflow-y: auto; border: 1px solid var(--vscode-panel-border); padding: 12px; margin-bottom: 10px; background: var(--vscode-editor-background); border-radius: 4px; font-size: 13px; }
                   .input-container { display: flex; gap: 8px; }
                   input { flex-grow: 1; padding: 8px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 2px; }
                   button { padding: 8px 16px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; cursor: pointer; border-radius: 2px; font-weight: bold; }
                   .msg { margin-bottom: 6px; line-height: 1.4; }
               </style>
           </head>
           <body>
               <div id="chat-box">
                   <div class="msg" style="color: var(--vscode-textLink-foreground);">🤖 <b>Passaggio Editor Workspace:</b> Agent canvas initialized directly in core code surface.</div>
               </div>
               <div class="input-container">
                   <input type="text" id="user-input" placeholder="Instruct your central agent workspace...">
                   <button onclick="sendMessage()">Send</button>
               </div>
               <script>
                   function sendMessage() {
                       const input = document.getElementById('user-input');
                       const box = document.getElementById('chat-box');
                       if(!input.value) return;
                       
                       // Added class="msg" to user strings
                       box.innerHTML += '<div class="msg"><b>You:</b> ' + input.value + '</div>';
                       
                       setTimeout(() => {
                           // Added class="msg" to bot strings
                           box.innerHTML += '<div class="msg" style="color: var(--vscode-charts-green);">🤖 <b>Kimi K2.6:</b> Processing active code layout tab hooks...</div>';
                           box.scrollTop = box.scrollHeight;
                       }, 400);
                       
                       input.value = '';
                       box.scrollTop = box.scrollHeight;
                   }
               </script>
           </body>
           </html>
       `;
   }
}
