export namespace appmode {
	
	export class AboutInfo {
	    title: string;
	    description: string;
	    version: string;
	    author: string;
	
	    static createFrom(source: any = {}) {
	        return new AboutInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.title = source["title"];
	        this.description = source["description"];
	        this.version = source["version"];
	        this.author = source["author"];
	    }
	}

}

export namespace config {
	
	export class SplitNode {
	    type: string;
	    id?: string;
	    sessionId?: string;
	    direction?: string;
	    size?: number;
	    children?: SplitNode[];
	
	    static createFrom(source: any = {}) {
	        return new SplitNode(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type = source["type"];
	        this.id = source["id"];
	        this.sessionId = source["sessionId"];
	        this.direction = source["direction"];
	        this.size = source["size"];
	        this.children = this.convertValues(source["children"], SplitNode);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class SessionMeta {
	    id: string;
	    name: string;
	    projectId: string;
	    cwd: string;
	    pinned: boolean;
	    // Go type: time
	    createdAt?: any;
	    nameLocked?: boolean;
	    autoTitled?: boolean;
	    agentCli?: string;
	    agentSessionId?: string;
	
	    static createFrom(source: any = {}) {
	        return new SessionMeta(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.projectId = source["projectId"];
	        this.cwd = source["cwd"];
	        this.pinned = source["pinned"];
	        this.createdAt = this.convertValues(source["createdAt"], null);
	        this.nameLocked = source["nameLocked"];
	        this.autoTitled = source["autoTitled"];
	        this.agentCli = source["agentCli"];
	        this.agentSessionId = source["agentSessionId"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ProjectMeta {
	    id: string;
	    name: string;
	    path: string;
	    // Go type: time
	    addedAt?: any;
	
	    static createFrom(source: any = {}) {
	        return new ProjectMeta(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.path = source["path"];
	        this.addedAt = this.convertValues(source["addedAt"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class AppConfig {
	    projects: ProjectMeta[];
	    sessions: SessionMeta[];
	    layouts: Record<string, SplitNode>;
	    activeScope: string;
	    theme: string;
	    shell: string;
	    fontSize: number;
	    defaultIDE?: string;
	    sidebarOpen?: boolean;
	    sidebarWidth?: number;
	    uiZoom?: number;
	    collapsedProjects?: Record<string, boolean>;
	    sidebarFooter: string[];
	    agentCLIs?: Record<string, string>;
	    keybindings?: Record<string, Array<KeyChord>>;
	    snippets?: Snippet[];
	    skippedAppUpdate?: string;
	
	    static createFrom(source: any = {}) {
	        return new AppConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.projects = this.convertValues(source["projects"], ProjectMeta);
	        this.sessions = this.convertValues(source["sessions"], SessionMeta);
	        this.layouts = this.convertValues(source["layouts"], SplitNode, true);
	        this.activeScope = source["activeScope"];
	        this.theme = source["theme"];
	        this.shell = source["shell"];
	        this.fontSize = source["fontSize"];
	        this.defaultIDE = source["defaultIDE"];
	        this.sidebarOpen = source["sidebarOpen"];
	        this.sidebarWidth = source["sidebarWidth"];
	        this.uiZoom = source["uiZoom"];
	        this.collapsedProjects = source["collapsedProjects"];
	        this.sidebarFooter = source["sidebarFooter"];
	        this.agentCLIs = source["agentCLIs"];
	        this.keybindings = this.convertValues(source["keybindings"], Array<KeyChord>, true);
	        this.snippets = this.convertValues(source["snippets"], Snippet);
	        this.skippedAppUpdate = source["skippedAppUpdate"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Snippet {
	    id: string;
	    name: string;
	    body: string;
	    keyword?: string;
	    chord?: KeyChord;
	    send?: boolean;

	    static createFrom(source: any = {}) {
	        return new Snippet(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.body = source["body"];
	        this.keyword = source["keyword"];
	        this.chord = this.convertValues(source["chord"], KeyChord);
	        this.send = source["send"];
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class KeyChord {
	    key: string;
	    codes?: string[];
	    metaOrCtrl?: boolean;
	    ctrlOnly?: boolean;
	    shift?: boolean;
	    alt?: boolean;
	
	    static createFrom(source: any = {}) {
	        return new KeyChord(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.key = source["key"];
	        this.codes = source["codes"];
	        this.metaOrCtrl = source["metaOrCtrl"];
	        this.ctrlOnly = source["ctrlOnly"];
	        this.shift = source["shift"];
	        this.alt = source["alt"];
	    }
	}
	
	
	
	export class UIPrefs {
	    sidebarOpen: boolean;
	    sidebarWidth: number;
	    uiZoom: number;
	    collapsedProjects: Record<string, boolean>;
	    sidebarFooter: string[];
	
	    static createFrom(source: any = {}) {
	        return new UIPrefs(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sidebarOpen = source["sidebarOpen"];
	        this.sidebarWidth = source["sidebarWidth"];
	        this.uiZoom = source["uiZoom"];
	        this.collapsedProjects = source["collapsedProjects"];
	        this.sidebarFooter = source["sidebarFooter"];
	    }
	}

}

export namespace core {
	
	export class CLIInfo {
	    id: string;
	    name: string;
	    available: boolean;
	    path: string;
	    installed: boolean;
	    version?: string;
	    expectedVersion?: string;
	    outdated?: boolean;
	
	    static createFrom(source: any = {}) {
	        return new CLIInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.available = source["available"];
	        this.path = source["path"];
	        this.installed = source["installed"];
	        this.version = source["version"];
	        this.expectedVersion = source["expectedVersion"];
	        this.outdated = source["outdated"];
	    }
	}
	export class InstallResult {
	    cli: string;
	    installed: boolean;
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new InstallResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.cli = source["cli"];
	        this.installed = source["installed"];
	        this.message = source["message"];
	    }
	}
	export class Session {
	    id: string;
	    cli: string;
	    cliName: string;
	    title: string;
	    cwd?: string;
	    preview?: string;
	    updatedAt: number;
	    match?: string;
	
	    static createFrom(source: any = {}) {
	        return new Session(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.cli = source["cli"];
	        this.cliName = source["cliName"];
	        this.title = source["title"];
	        this.cwd = source["cwd"];
	        this.preview = source["preview"];
	        this.updatedAt = source["updatedAt"];
	        this.match = source["match"];
	    }
	}
	export class ToolPart {
	    name: string;
	    description?: string;
	
	    static createFrom(source: any = {}) {
	        return new ToolPart(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.description = source["description"];
	    }
	}
	export class ToolItem {
	    id: string;
	    name: string;
	    kind: string;
	    version?: string;
	    source?: string;
	    description?: string;
	    enabled: boolean;
	    scope?: string;
	    system?: boolean;
	    available?: boolean;
	    installCount?: number;
	    managedBy?: string;
	    skills?: ToolPart[];
	    hooks?: ToolPart[];
	    agents?: ToolPart[];
	    mcpServers?: ToolPart[];
	
	    static createFrom(source: any = {}) {
	        return new ToolItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.kind = source["kind"];
	        this.version = source["version"];
	        this.source = source["source"];
	        this.description = source["description"];
	        this.enabled = source["enabled"];
	        this.scope = source["scope"];
	        this.system = source["system"];
	        this.available = source["available"];
	        this.installCount = source["installCount"];
	        this.managedBy = source["managedBy"];
	        this.skills = this.convertValues(source["skills"], ToolPart);
	        this.hooks = this.convertValues(source["hooks"], ToolPart);
	        this.agents = this.convertValues(source["agents"], ToolPart);
	        this.mcpServers = this.convertValues(source["mcpServers"], ToolPart);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class ToolsCaps {
	    list: boolean;
	    install: boolean;
	    uninstall: boolean;
	    enable: boolean;
	    update: boolean;
	    browse: boolean;
	    kinds: string[];
	    installPlaceholder?: string;
	    hint?: string;
	
	    static createFrom(source: any = {}) {
	        return new ToolsCaps(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.list = source["list"];
	        this.install = source["install"];
	        this.uninstall = source["uninstall"];
	        this.enable = source["enable"];
	        this.update = source["update"];
	        this.browse = source["browse"];
	        this.kinds = source["kinds"];
	        this.installPlaceholder = source["installPlaceholder"];
	        this.hint = source["hint"];
	    }
	}

}

export namespace git {
	
	export class Branch {
	    name: string;
	    current: boolean;
	    date: number;
	
	    static createFrom(source: any = {}) {
	        return new Branch(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.current = source["current"];
	        this.date = source["date"];
	    }
	}
	export class File {
	    path: string;
	    code: string;
	    staged: boolean;
	    unstaged: boolean;
	
	    static createFrom(source: any = {}) {
	        return new File(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.code = source["code"];
	        this.staged = source["staged"];
	        this.unstaged = source["unstaged"];
	    }
	}
	export class Result {
	    ok: boolean;
	    stdout: string;
	    stderr: string;
	    cmd: string;
	
	    static createFrom(source: any = {}) {
	        return new Result(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ok = source["ok"];
	        this.stdout = source["stdout"];
	        this.stderr = source["stderr"];
	        this.cmd = source["cmd"];
	    }
	}
	export class Snapshot {
	    path: string;
	    isRepo: boolean;
	    branch: string;
	    dirty: boolean;
	    ahead: number;
	    behind: number;
	    upstream: string;
	    inProgress: string;
	    stashCount: number;
	    files: File[];
	
	    static createFrom(source: any = {}) {
	        return new Snapshot(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.isRepo = source["isRepo"];
	        this.branch = source["branch"];
	        this.dirty = source["dirty"];
	        this.ahead = source["ahead"];
	        this.behind = source["behind"];
	        this.upstream = source["upstream"];
	        this.inProgress = source["inProgress"];
	        this.stashCount = source["stashCount"];
	        this.files = this.convertValues(source["files"], File);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class StashEntry {
	    ref: string;
	    message: string;
	    age: string;
	
	    static createFrom(source: any = {}) {
	        return new StashEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ref = source["ref"];
	        this.message = source["message"];
	        this.age = source["age"];
	    }
	}
	export class Status {
	    path: string;
	    isRepo: boolean;
	    branch: string;
	    dirty: boolean;
	    ahead: number;
	    behind: number;
	
	    static createFrom(source: any = {}) {
	        return new Status(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.isRepo = source["isRepo"];
	        this.branch = source["branch"];
	        this.dirty = source["dirty"];
	        this.ahead = source["ahead"];
	        this.behind = source["behind"];
	    }
	}
	export class Worktree {
	    path: string;
	    branch: string;
	    bare: boolean;
	    locked: boolean;
	    main: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Worktree(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.branch = source["branch"];
	        this.bare = source["bare"];
	        this.locked = source["locked"];
	        this.main = source["main"];
	    }
	}
	export class WorktreeAddResult {
	    ok: boolean;
	    path: string;
	    stdout: string;
	    stderr: string;
	    cmd: string;
	
	    static createFrom(source: any = {}) {
	        return new WorktreeAddResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ok = source["ok"];
	        this.path = source["path"];
	        this.stdout = source["stdout"];
	        this.stderr = source["stderr"];
	        this.cmd = source["cmd"];
	    }
	}

}

export namespace update {
	
	export class Status {
	    available: boolean;
	    currentVersion: string;
	    latestVersion: string;
	    downloadUrl: string;
	    releaseUrl: string;
	    skipped: boolean;
	    state: string;
	    bytes: number;
	    total: number;
	    error: string;
	
	    static createFrom(source: any = {}) {
	        return new Status(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.available = source["available"];
	        this.currentVersion = source["currentVersion"];
	        this.latestVersion = source["latestVersion"];
	        this.downloadUrl = source["downloadUrl"];
	        this.releaseUrl = source["releaseUrl"];
	        this.skipped = source["skipped"];
	        this.state = source["state"];
	        this.bytes = source["bytes"];
	        this.total = source["total"];
	        this.error = source["error"];
	    }
	}

}

export namespace main {
	
	export class IDEInfo {
	    id: string;
	    label: string;
	
	    static createFrom(source: any = {}) {
	        return new IDEInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.label = source["label"];
	    }
	}
	export class BusyTerminal {
	    id: string;
	    name: string;
	    commands: string[];
	
	    static createFrom(source: any = {}) {
	        return new BusyTerminal(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.commands = source["commands"];
	    }
	}
	export class UpdateRisk {
	    sessionCount: number;
	    busy: BusyTerminal[];
	
	    static createFrom(source: any = {}) {
	        return new UpdateRisk(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sessionCount = source["sessionCount"];
	        this.busy = this.convertValues(source["busy"], BusyTerminal);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class SessionDTO {
	    id: string;
	    name: string;
	    projectId: string;
	    cwd: string;
	    pinned: boolean;
	    // Go type: time
	    createdAt: any;
	    agentCli?: string;
	
	    static createFrom(source: any = {}) {
	        return new SessionDTO(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.projectId = source["projectId"];
	        this.cwd = source["cwd"];
	        this.pinned = source["pinned"];
	        this.createdAt = this.convertValues(source["createdAt"], null);
	        this.agentCli = source["agentCli"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

