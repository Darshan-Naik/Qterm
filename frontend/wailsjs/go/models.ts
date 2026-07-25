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
	    }
	}
	export class ProjectMeta {
	    id: string;
	    name: string;
	    path: string;
	
	    static createFrom(source: any = {}) {
	        return new ProjectMeta(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.path = source["path"];
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

export namespace hooks {
	
	export class Permissions {
	    readOutput: boolean;
	    writePty: boolean;
	    notify: boolean;
	    animate: boolean;
	    network: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Permissions(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.readOutput = source["readOutput"];
	        this.writePty = source["writePty"];
	        this.notify = source["notify"];
	        this.animate = source["animate"];
	        this.network = source["network"];
	    }
	}
	export class Manifest {
	    id: string;
	    name: string;
	    version: string;
	    description: string;
	    command: string;
	    args: string[];
	    permissions: Permissions;
	
	    static createFrom(source: any = {}) {
	        return new Manifest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.version = source["version"];
	        this.description = source["description"];
	        this.command = source["command"];
	        this.args = source["args"];
	        this.permissions = this.convertValues(source["permissions"], Permissions);
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
	export class InstalledHook {
	    manifest: Manifest;
	    path: string;
	    enabled: boolean;
	    granted: Permissions;
	    projectOnly?: string[];
	
	    static createFrom(source: any = {}) {
	        return new InstalledHook(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.manifest = this.convertValues(source["manifest"], Manifest);
	        this.path = source["path"];
	        this.enabled = source["enabled"];
	        this.granted = this.convertValues(source["granted"], Permissions);
	        this.projectOnly = source["projectOnly"];
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

export namespace main {
	
	export class SessionDTO {
	    id: string;
	    name: string;
	    projectId: string;
	    cwd: string;
	    pinned: boolean;
	
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
	    }
	}

}

