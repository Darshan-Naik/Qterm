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
	    sidebarOpen?: boolean;
	    sidebarWidth?: number;
	    uiZoom?: number;
	    collapsedProjects?: Record<string, boolean>;
	    agentCLIs?: Record<string, string>;
	    keybindings?: Record<string, Array<KeyChord>>;
	
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
	        this.sidebarOpen = source["sidebarOpen"];
	        this.sidebarWidth = source["sidebarWidth"];
	        this.uiZoom = source["uiZoom"];
	        this.collapsedProjects = source["collapsedProjects"];
	        this.agentCLIs = source["agentCLIs"];
	        this.keybindings = this.convertValues(source["keybindings"], Array<KeyChord>, true);
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
	
	    static createFrom(source: any = {}) {
	        return new UIPrefs(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sidebarOpen = source["sidebarOpen"];
	        this.sidebarWidth = source["sidebarWidth"];
	        this.uiZoom = source["uiZoom"];
	        this.collapsedProjects = source["collapsedProjects"];
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

}

export namespace git {
	
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

}

export namespace main {
	
	export class SessionDTO {
	    id: string;
	    name: string;
	    projectId: string;
	    cwd: string;
	    pinned: boolean;
	    // Go type: time
	    createdAt: any;
	
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

