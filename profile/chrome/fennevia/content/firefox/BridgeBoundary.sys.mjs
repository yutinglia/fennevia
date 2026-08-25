//#region src/firefox/bridge-boundary.ts
var e = /^[A-Za-z0-9._+-]{1,64}$/u, t = /^window-[a-z0-9-]{1,64}$/u, n = /^FENNEVIA_[A-Z0-9_]{1,95}$/u, r = /^[A-Za-z][A-Za-z0-9:-]{0,63}$/u, i = /^[a-z][a-z0-9-]{0,31}$/u, a = /^[a-z][a-z0-9-]{0,31}-registry-[1-9][0-9]*-handle-[1-9][0-9]*$/u, o = /^[a-z][a-z0-9-]{0,95}$/u, s = /^[A-Za-z][A-Za-z0-9.[\]-]{0,127}$/u, c = new Set(), l = new WeakMap(), u = 0, d = (e) => typeof e == "object" && !!e || typeof e == "function", f = (e) => typeof e == "object" && !!e, p = (e) => f(e) && typeof e.addEventListener == "function" && typeof e.removeEventListener == "function", m = (t) => {
	let n = String(t ?? "");
	return e.test(n) ? n : "unknown";
}, h = (e) => Object.freeze({
	buildId: m(e?.buildId),
	firefoxVersion: m(e?.firefoxVersion),
	windowKind: e?.windowKind === "private" ? "private" : "normal"
}), g = class extends Error {
	constructor({ cause: e, code: t, context: r, phase: i, symbol: a }) {
		let c = n.test(t) ? t : "FENNEVIA_FIREFOX_BRIDGE_ERROR_INVALID";
		super(c);
		let l = h(r);
		Object.defineProperties(this, {
			cause: {
				configurable: !0,
				enumerable: !1,
				value: e
			},
			fenneviaBuildId: {
				enumerable: !1,
				value: l.buildId
			},
			fenneviaCode: {
				enumerable: !1,
				value: c
			},
			fenneviaFirefoxVersion: {
				enumerable: !1,
				value: l.firefoxVersion
			},
			fenneviaPhase: {
				enumerable: !1,
				value: o.test(i) ? i : "firefox-bridge-error"
			},
			fenneviaSymbol: {
				enumerable: !1,
				value: s.test(a) ? a : "firefox.unknown"
			},
			fenneviaWindowKind: {
				enumerable: !1,
				value: l.windowKind
			},
			name: {
				configurable: !0,
				enumerable: !1,
				value: "FenneviaFirefoxBridgeError"
			}
		});
	}
};
function _(e) {
	return e instanceof g || f(e) && e.name === "FenneviaFirefoxBridgeError" && typeof e.fenneviaCode == "string" && typeof e.fenneviaPhase == "string" && typeof e.fenneviaSymbol == "string";
}
function v(e) {
	if (!_(e)) throw TypeError("FENNEVIA_FIREFOX_DIAGNOSTIC_ERROR_INVALID");
	return Object.freeze({
		buildId: e.fenneviaBuildId,
		code: e.fenneviaCode,
		firefoxVersion: e.fenneviaFirefoxVersion,
		phase: e.fenneviaPhase,
		symbol: e.fenneviaSymbol,
		windowKind: e.fenneviaWindowKind
	});
}
var y = (e, t, n, r, i) => new g({
	cause: i,
	code: e,
	context: r,
	phase: t,
	symbol: n
});
function b(e) {
	if (typeof e != "function") throw TypeError("FENNEVIA_FIREFOX_DISPOSER_INVALID");
	let t = !0;
	return Object.freeze(() => t ? (t = !1, e(), !0) : !1);
}
function x({ listener: e, options: t, target: n, type: i }) {
	if (!p(n) || typeof e != "function" || !r.test(i)) throw TypeError("FENNEVIA_FIREFOX_SUBSCRIPTION_INVALID");
	return n.addEventListener(i, e, t), b(() => {
		n.removeEventListener(i, e, t);
	});
}
function S({ context: e, kind: t }) {
	if (!i.test(t)) throw TypeError("FENNEVIA_FIREFOX_HANDLE_KIND_INVALID");
	let n = h(e), r = `${t}-registry-${++u}-handle-`, o = 0, s = !1, c = new WeakMap(), l = new Map(), f = (e) => {
		if (s) throw y("FENNEVIA_FIREFOX_HANDLE_REGISTRY_DISPOSED", e, `${t}.opaque-id`, n);
	}, p = (e, i) => {
		if (f(i), typeof e != "string" || !a.test(e)) throw y("FENNEVIA_FIREFOX_HANDLE_ID_INVALID", i, `${t}.opaque-id`, n);
		if (!e.startsWith(r)) throw y("FENNEVIA_FIREFOX_HANDLE_CONTEXT_MISMATCH", i, `${t}.opaque-id`, n);
		let o = l.get(e);
		if (!o) throw y("FENNEVIA_FIREFOX_HANDLE_STALE", i, `${t}.opaque-id`, n);
		return o;
	};
	return Object.freeze({
		dispose() {
			return !s && (s = !0, l.clear(), c = new WeakMap(), !0);
		},
		register(e) {
			if (f("firefox-handle-register"), !d(e)) throw y("FENNEVIA_FIREFOX_HANDLE_INVALID", "firefox-handle-register", `${t}.native-handle`, n);
			let i = c.get(e);
			if (i) return i;
			let a = `${r}${++o}`;
			return c.set(e, a), l.set(a, e), a;
		},
		release(e) {
			let t = p(e, "firefox-handle-release");
			return l.delete(e), c.delete(t), !0;
		},
		resolve(e) {
			return p(e, "firefox-handle-resolve");
		},
		snapshot() {
			return Object.freeze({
				activeHandleCount: l.size,
				disposed: s,
				kind: t
			});
		}
	});
}
var C = Object.freeze([
	Object.freeze({
		isAvailable: f,
		name: "firefox.g-browser",
		read: (e) => e.gBrowser,
		requirement: "required",
		symbol: "window.gBrowser"
	}),
	Object.freeze({
		isAvailable: Array.isArray,
		name: "firefox.tabs",
		read: (e) => f(e.gBrowser) ? e.gBrowser.tabs : void 0,
		requirement: "required",
		symbol: "window.gBrowser.tabs"
	}),
	Object.freeze({
		isAvailable: p,
		name: "firefox.tab-events",
		read: (e) => f(e.gBrowser) ? e.gBrowser.tabContainer : void 0,
		requirement: "required",
		symbol: "window.gBrowser.tabContainer"
	}),
	Object.freeze({
		isAvailable: d,
		name: "firefox.selected-browser",
		read: (e) => f(e.gBrowser) ? e.gBrowser.selectedBrowser : void 0,
		requirement: "required",
		symbol: "window.gBrowser.selectedBrowser"
	}),
	Object.freeze({
		isAvailable: (e) => e === !0,
		name: "firefox.web-navigation",
		read: (e) => {
			let t = f(e.gBrowser) ? e.gBrowser.selectedBrowser : void 0;
			return d(t) && "webNavigation" in t;
		},
		requirement: "optional",
		symbol: "window.gBrowser.selectedBrowser.webNavigation"
	})
]), w = (e) => Object.freeze(C.map((t) => {
	let n = !1, r;
	try {
		n = t.isAvailable(t.read(e));
	} catch (e) {
		r = e;
	}
	return Object.freeze({
		...r === void 0 ? {} : { cause: r },
		snapshot: Object.freeze({
			available: n,
			name: t.name,
			requirement: t.requirement,
			symbol: t.symbol
		})
	});
}));
function T({ buildId: e, contextId: n, firefoxVersion: r, window: i, windowKind: a }) {
	let o = h({
		buildId: e,
		firefoxVersion: r,
		windowKind: a
	});
	if (!f(i) || !t.test(n) || a !== "normal" && a !== "private") throw y("FENNEVIA_FIREFOX_CONTEXT_INVALID", "firefox-context-create", "window", o);
	let s = i.document;
	if (!f(s) || s.documentURI !== "chrome://browser/content/browser.xhtml" || s.defaultView !== i) throw y("FENNEVIA_FIREFOX_CONTEXT_DOCUMENT_INVALID", "firefox-context-create", "window.document.defaultView", o);
	if (c.has(n) || l.has(i)) throw y("FENNEVIA_FIREFOX_CONTEXT_ALREADY_ACTIVE", "firefox-context-create", "window", o);
	c.add(n), l.set(i, n);
	let u = i, d = !1, p = new Set(), m = new Set(), g = () => {
		if (d || !u) throw y("FENNEVIA_FIREFOX_CONTEXT_DISPOSED", "firefox-context-access", "window", o);
		return u;
	}, _ = () => Object.freeze(w(g()).map((e) => e.snapshot));
	return Object.freeze({
		assertOwnsWindow(e) {
			if (e !== g()) throw y("FENNEVIA_FIREFOX_CONTEXT_WINDOW_MISMATCH", "firefox-context-access", "window", o);
			return !0;
		},
		assertRequiredCapabilities() {
			let e = w(g()), t = e.find((e) => e.snapshot.requirement === "required" && !e.snapshot.available);
			if (t) throw y("FENNEVIA_FIREFOX_CAPABILITY_MISSING", "firefox-bridge-capability", t.snapshot.symbol, o, t.cause);
			return Object.freeze(e.map((e) => e.snapshot));
		},
		createHandleRegistry(e) {
			g();
			let t = S({
				context: o,
				kind: e
			});
			return m.add(t), t;
		},
		dispose() {
			if (d) return !1;
			d = !0, c.delete(n), l.delete(i), u = null;
			let e;
			for (let t of Array.from(p).reverse()) try {
				t();
			} catch (t) {
				e ??= t;
			}
			p.clear();
			for (let t of m) try {
				t.dispose();
			} catch (t) {
				e ??= t;
			}
			if (m.clear(), e !== void 0) throw y("FENNEVIA_FIREFOX_CONTEXT_DISPOSE_FAILED", "firefox-context-dispose", "window", o, e);
			return !0;
		},
		getCapabilities: _,
		snapshot() {
			let e = d ? [] : _();
			return Object.freeze({
				buildId: o.buildId,
				capabilityCount: e.length,
				contextId: n,
				disposed: d,
				firefoxVersion: o.firefoxVersion,
				optionalCapabilityCount: e.filter((e) => e.requirement === "optional").length,
				registryCount: m.size,
				requiredCapabilityCount: e.filter((e) => e.requirement === "required").length,
				subscriptionCount: p.size,
				windowKind: o.windowKind
			});
		},
		subscribe(e, t, n, r) {
			g();
			let i = x({
				listener: n,
				options: r,
				target: e,
				type: t
			}), a = b(() => {
				p.delete(a), i();
			});
			return p.add(a), a;
		}
	});
}
var E = /^data:image\/(?:avif|gif|jpeg|png|vnd\.microsoft\.icon|webp|x-icon);base64,(?=[a-z0-9+/]+={0,2}$)(?:[a-z0-9+/]{4})*(?:[a-z0-9+/]{2}==|[a-z0-9+/]{3}=)?$/iu, D = "resource://gre/modules/PlacesUtils.sys.mjs", O = "moz-src:///browser/components/places/PlacesUIUtils.sys.mjs", k = Object.freeze([
	"bookmark-added",
	"bookmark-removed",
	"bookmark-moved",
	"bookmark-title-changed",
	"bookmark-url-changed",
	"favicon-changed"
]), A = /^[A-Za-z0-9_-]{12}$/u, ee = new Set([
	"data:",
	"javascript:",
	"place:",
	"vbscript:"
]), j = (e) => typeof e == "object" && !!e, M = (e) => typeof e == "function", te = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, N = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: te(e),
	phase: n,
	symbol: r
}), ne = (e, t, n, r) => {
	if (typeof t != "string" || !A.test(t)) throw N(e, "FENNEVIA_FIREFOX_BOOKMARK_GUID_INVALID", n, r);
	return t;
}, re = (e) => {
	let t = "", n = 0;
	for (let r of e) {
		if (n >= 160) break;
		t += r, n += 1;
	}
	return t;
}, P = (e) => typeof e == "string" && e.length <= 262144 && E.test(e) ? e : void 0, ie = (e, t, n, r, i) => {
	if (!j(t) || typeof t.guid != "string" || typeof t.parentGuid != "string" || typeof t.index != "number" || !Number.isSafeInteger(t.index) || t.index < 0 || typeof t.type != "number" || typeof t.title != "string" || (ne(e, t.guid, r, "PlacesUtils.bookmarks.fetch.result.guid"), ne(e, t.parentGuid, r, "PlacesUtils.bookmarks.fetch.result.parentGuid"), i !== void 0 && t.guid !== i || ![
		n.TYPE_BOOKMARK,
		n.TYPE_FOLDER,
		n.TYPE_SEPARATOR
	].includes(t.type) || t.type === n.TYPE_FOLDER && (!Number.isSafeInteger(t.childCount) || t.childCount < 0))) throw N(e, "FENNEVIA_FIREFOX_BOOKMARK_RECORD_INVALID", r, "PlacesUtils.bookmarks.fetch.result");
	return t;
}, F = (e, t, n) => {
	if (t.type === n.TYPE_BOOKMARK) return "bookmark";
	if (t.type === n.TYPE_FOLDER) return "folder";
	if (t.type === n.TYPE_SEPARATOR) return "separator";
	throw N(e, "FENNEVIA_FIREFOX_BOOKMARK_TYPE_INVALID", "firefox-bookmarks-snapshot", "PlacesUtils.bookmarks.TYPE_BOOKMARK");
}, I = (e) => {
	if (!j(e) || typeof e.href != "string") return null;
	if (typeof e.protocol == "string") return e.protocol.toLowerCase();
	let t = e.href.indexOf(":");
	return t > 0 ? `${e.href.slice(0, t).toLowerCase()}:` : null;
};
//#endregion
//#region src/firefox/bookmarks/controller.ts
function L({ boundary: e, moduleLoader: t, onError: n, window: r }) {
	if (e.assertOwnsWindow(r), !j(r) || typeof t != "function" || typeof n != "function") throw N(e, "FENNEVIA_FIREFOX_BOOKMARKS_OPTIONS_INVALID", "firefox-bookmarks-create", "ChromeUtils.importESModule");
	let i, a;
	try {
		i = t(D), a = t(O);
	} catch (t) {
		throw N(e, "FENNEVIA_FIREFOX_BOOKMARKS_MODULE_LOAD_FAILED", "firefox-bookmarks-module-load", "ChromeUtils.importESModule", t);
	}
	let o = j(i) ? i.PlacesUtils : void 0, s = j(a) ? a.PlacesUIUtils : void 0, c = o, l = s, u = Object.freeze([
		Object.freeze({
			isAvailable: j,
			name: "firefox.places-utils",
			read: () => o,
			symbol: "PlacesUtils"
		}),
		Object.freeze({
			isAvailable: j,
			name: "firefox.places-bookmarks",
			read: () => c?.bookmarks,
			symbol: "PlacesUtils.bookmarks"
		}),
		Object.freeze({
			isAvailable: M,
			name: "firefox.places-bookmarks-fetch",
			read: () => c?.bookmarks?.fetch,
			symbol: "PlacesUtils.bookmarks.fetch"
		}),
		Object.freeze({
			isAvailable: (e) => Array.isArray(e) && e.length === 4 && e.every((e) => typeof e == "string" && A.test(e)),
			name: "firefox.places-bookmark-roots",
			read: () => c?.bookmarks?.userContentRoots,
			symbol: "PlacesUtils.bookmarks.userContentRoots"
		}),
		Object.freeze({
			isAvailable: M,
			name: "firefox.places-root-title",
			read: () => c?.bookmarks?.getLocalizedTitle,
			symbol: "PlacesUtils.bookmarks.getLocalizedTitle"
		}),
		Object.freeze({
			isAvailable: j,
			name: "firefox.places-observers",
			read: () => c?.observers,
			symbol: "PlacesUtils.observers"
		}),
		...["addListener", "removeListener"].map((e) => Object.freeze({
			isAvailable: M,
			name: `firefox.places-observers-${e.toLowerCase()}`,
			read: () => c?.observers?.[e],
			symbol: `PlacesUtils.observers.${e}`
		})),
		Object.freeze({
			isAvailable: j,
			name: "firefox.places-ui-utils",
			read: () => s,
			symbol: "PlacesUIUtils"
		}),
		Object.freeze({
			isAvailable: M,
			name: "firefox.places-node-conversion",
			read: () => l?.promiseNodeLikeFromFetchInfo,
			symbol: "PlacesUIUtils.promiseNodeLikeFromFetchInfo"
		}),
		Object.freeze({
			isAvailable: M,
			name: "firefox.places-open-node",
			read: () => l?.openNodeIn,
			symbol: "PlacesUIUtils.openNodeIn"
		}),
		Object.freeze({
			isAvailable: M,
			name: "firefox.places-organizer",
			read: () => j(r.PlacesCommandHook) ? r.PlacesCommandHook.showPlacesOrganizer : void 0,
			symbol: "window.PlacesCommandHook.showPlacesOrganizer"
		}),
		Object.freeze({
			isAvailable: M,
			name: "firefox.places-favicon-query",
			read: () => c?.favicons?.getFaviconForPage,
			requirement: "optional",
			symbol: "PlacesUtils.favicons.getFaviconForPage"
		}),
		Object.freeze({
			isAvailable: M,
			name: "firefox.places-favicon-uri",
			read: () => j(r.Services) && j(r.Services.io) ? r.Services.io.newURI : void 0,
			requirement: "optional",
			symbol: "window.Services.io.newURI"
		})
	]), d = r, f = !1, p = null, m = !1, h = 0, g = new Set(), v = e.createHandleRegistry("bookmark"), y = new Map(), x = new Map(), S = () => {
		if (f || !d) throw N(e, "FENNEVIA_FIREFOX_BOOKMARKS_DISPOSED", "firefox-bookmarks-access", "window");
		if (p) throw p;
		return e.assertOwnsWindow(d), d;
	}, C = () => Object.freeze(u.map((e) => {
		let t = !1, n;
		try {
			t = e.isAvailable(e.read());
		} catch (e) {
			n = e;
		}
		return Object.freeze({
			...n === void 0 ? {} : { cause: n },
			snapshot: Object.freeze({
				available: t,
				name: e.name,
				requirement: e.requirement ?? "required",
				symbol: e.symbol
			})
		});
	})), w = () => {
		S();
		let t = C(), n = t.find((e) => e.snapshot.requirement === "required" && !e.snapshot.available);
		if (n) throw N(e, "FENNEVIA_FIREFOX_BOOKMARKS_CAPABILITY_MISSING", "firefox-bookmarks-capability", n.snapshot.symbol, n.cause);
		return Object.freeze(t.map((e) => e.snapshot));
	}, T = (t) => {
		S();
		let n = ne(e, t, "firefox-bookmarks-handle", "PlacesUtils.bookmarks.guid"), r = x.get(n);
		if (r) return r;
		let i = Object.freeze({ guid: n }), a = v.register(i);
		return y.set(n, i), x.set(n, a), a;
	}, E = (e) => {
		if (typeof e != "string" || !A.test(e)) return !1;
		let t = x.get(e);
		if (!t) return !1;
		x.delete(e), y.delete(e);
		try {
			return v.release(t);
		} catch {
			return !1;
		}
	}, te = (e) => (S(), v.resolve(e).guid), L = async (e) => {
		if (e.type !== c.bookmarks.TYPE_BOOKMARK) return;
		let t = S(), n = c.favicons, r = t.Services, i = j(r) ? r.io : void 0, a = j(i) ? i.newURI : void 0, o = n?.getFaviconForPage, s = j(e.url) ? e.url.href : void 0;
		if (!(!n || !M(o) || !j(i) || !M(a) || typeof s != "string")) try {
			let e = Reflect.apply(a, i, [s]), r = typeof t.devicePixelRatio == "number" && Number.isFinite(t.devicePixelRatio) ? t.devicePixelRatio : 1, c = Math.min(64, Math.max(16, Math.round(16 * r))), l = await Reflect.apply(o, n, [e, c]);
			S();
			let u = j(l) ? l.dataURI : void 0;
			return P(j(u) ? u.spec : void 0);
		} catch (e) {
			if (_(e)) throw e;
			return;
		}
	}, ae = async (t, n = t.title) => {
		let r = F(e, t, c.bookmarks), i = await L(t);
		return Object.freeze({
			...i === void 0 ? {} : { faviconUrl: i },
			hasChildren: r === "folder" && Number.isSafeInteger(t.childCount) && t.childCount > 0,
			id: T(t.guid),
			kind: r,
			title: re(n)
		});
	}, oe = async (t, n) => {
		S();
		let r;
		try {
			r = await Reflect.apply(c.bookmarks.fetch, c.bookmarks, [t]);
		} catch (t) {
			throw N(e, "FENNEVIA_FIREFOX_BOOKMARK_QUERY_FAILED", n, "PlacesUtils.bookmarks.fetch", t);
		}
		return S(), r === null ? null : ie(e, r, c.bookmarks, n, "guid" in t ? t.guid : void 0);
	}, se = (t, r) => {
		h += 1;
		let i = Object.freeze({
			parentIds: Object.freeze([...t]),
			revision: h,
			scope: r,
			type: "changed"
		});
		for (let t of Array.from(g)) try {
			t(i);
		} catch (t) {
			n(N(e, "FENNEVIA_FIREFOX_BOOKMARKS_SUBSCRIBER_FAILED", "firefox-bookmarks-notify", "bookmarks.subscribe", t));
		}
	}, ce = (t) => {
		p = _(t) ? t : N(e, "FENNEVIA_FIREFOX_BOOKMARKS_OBSERVER_FAILED", "firefox-bookmarks-observer", "PlacesUtils.observers.addListener", t), n(p);
	}, le = (t) => {
		if (!(f || p)) try {
			if (!Array.isArray(t)) throw N(e, "FENNEVIA_FIREFOX_BOOKMARKS_EVENT_INVALID", "firefox-bookmarks-observer", "PlacesEventCallback.events");
			if (t.length > 128) {
				se(Object.freeze([]), "all");
				return;
			}
			let n = new Set(), r = [], i = !1;
			for (let a of t) {
				if (!j(a) || typeof a.type != "string" || !k.includes(a.type)) throw N(e, "FENNEVIA_FIREFOX_BOOKMARKS_EVENT_INVALID", "firefox-bookmarks-observer", "PlacesEvent");
				if (a.type === "favicon-changed") {
					i = !0;
					continue;
				}
				if (typeof a.parentGuid != "string" || typeof a.isTagging != "boolean") throw N(e, "FENNEVIA_FIREFOX_BOOKMARKS_EVENT_INVALID", "firefox-bookmarks-observer", "PlacesEvent");
				if (a.isTagging) continue;
				ne(e, a.parentGuid, "firefox-bookmarks-observer", "PlacesEvent.parentGuid");
				let t = x.get(a.parentGuid);
				if (t && n.add(t), a.type === "bookmark-moved") {
					let t = ne(e, a.oldParentGuid, "firefox-bookmarks-observer", "PlacesBookmarkMoved.oldParentGuid"), r = x.get(t);
					r && n.add(r);
				}
				a.type === "bookmark-removed" && r.push(ne(e, a.guid, "firefox-bookmarks-observer", "PlacesBookmarkRemoved.guid"));
			}
			let a = Array.from(n);
			i || a.length > 16 ? se(Object.freeze([]), "all") : a.length > 0 && se(Object.freeze(a), "parents");
			for (let e of r) E(e);
		} catch (e) {
			ce(e);
		}
	}, ue = b(() => {
		m && (m = !1, Reflect.apply(c.observers.removeListener, c.observers, [k, le]));
	}), de = Object.freeze({
		async children(t, n = {}) {
			let r;
			try {
				r = te(t);
			} catch (e) {
				if (_(e) && e.fenneviaCode === "FENNEVIA_FIREFOX_HANDLE_STALE") return Object.freeze({
					parentId: t,
					status: "stale"
				});
				throw e;
			}
			if (!j(n) || Object.keys(n).some((e) => e !== "limit" && e !== "offset")) throw N(e, "FENNEVIA_FIREFOX_BOOKMARK_QUERY_OPTIONS_INVALID", "firefox-bookmarks-query", "bookmarks.children.options");
			let i = n.limit ?? 32, a = n.offset ?? 0;
			if (!Number.isSafeInteger(i) || i < 1 || i > 32 || !Number.isSafeInteger(a) || a < 0 || a > 1e6) throw N(e, "FENNEVIA_FIREFOX_BOOKMARK_QUERY_OPTIONS_INVALID", "firefox-bookmarks-query", "bookmarks.children.options");
			let o = await oe({ guid: r }, "firefox-bookmarks-query-parent");
			if (!o) return E(r), Object.freeze({
				parentId: t,
				status: "stale"
			});
			if (o.type !== c.bookmarks.TYPE_FOLDER) return Object.freeze({
				parentId: t,
				status: "stale"
			});
			let s = o.childCount, l = s === 0 ? 0 : Math.min(a, Math.floor((s - 1) / i) * i), u = Math.min(s, l + i), d = [];
			for (let e = l; e < u; e += 1) {
				let n = await oe({
					index: e,
					parentGuid: r
				}, "firefox-bookmarks-query-child");
				if (!n || n.parentGuid !== r || n.index !== e) return Object.freeze({
					parentId: t,
					status: "stale"
				});
				d.push(n);
			}
			let f = await Promise.all(d.map((e) => ae(e)));
			return S(), Object.freeze({
				items: Object.freeze(f),
				offset: l,
				parentId: t,
				status: "ok",
				totalCount: s,
				truncated: l + f.length < s
			});
		},
		manage() {
			let t = S().PlacesCommandHook, n = j(t) ? t.showPlacesOrganizer : void 0;
			if (!M(n)) throw N(e, "FENNEVIA_FIREFOX_BOOKMARKS_CAPABILITY_MISSING", "firefox-bookmarks-manage", "window.PlacesCommandHook.showPlacesOrganizer");
			try {
				Reflect.apply(n, t, ["UnfiledBookmarks"]);
			} catch (t) {
				throw N(e, "FENNEVIA_FIREFOX_BOOKMARKS_MANAGE_FAILED", "firefox-bookmarks-manage", "window.PlacesCommandHook.showPlacesOrganizer", t);
			}
			return !0;
		},
		async open(t, n = "current") {
			if (n !== "current" && n !== "new-tab") throw N(e, "FENNEVIA_FIREFOX_BOOKMARK_DISPOSITION_INVALID", "firefox-bookmarks-open", "bookmarks.open.disposition");
			let r;
			try {
				r = te(t);
			} catch (e) {
				if (_(e) && e.fenneviaCode === "FENNEVIA_FIREFOX_HANDLE_STALE") return Object.freeze({
					reason: "stale",
					status: "rejected"
				});
				throw e;
			}
			let i = await oe({ guid: r }, "firefox-bookmarks-open-fetch");
			if (!i) return E(r), Object.freeze({
				reason: "stale",
				status: "rejected"
			});
			if (i.type !== c.bookmarks.TYPE_BOOKMARK) return Object.freeze({
				reason: "not-bookmark",
				status: "rejected"
			});
			let a = I(i.url);
			if (!a || ee.has(a)) return Object.freeze({
				reason: "unsupported-scheme",
				status: "rejected"
			});
			let o;
			try {
				o = await Reflect.apply(l.promiseNodeLikeFromFetchInfo, l, [i]);
				let t = S(), r = j(t.gBrowser) ? t.gBrowser : void 0, a = n === "new-tab" ? r?.selectedTab : void 0;
				Reflect.apply(l.openNodeIn, l, [
					o,
					n === "new-tab" ? "tab" : "current",
					{ ownerWindow: t },
					e.snapshot().windowKind === "private"
				]), a !== void 0 && r && r.selectedTab !== a && Reflect.set(r, "selectedTab", a);
			} catch (t) {
				throw N(e, "FENNEVIA_FIREFOX_BOOKMARK_OPEN_FAILED", "firefox-bookmarks-open", "PlacesUIUtils.openNodeIn", t);
			}
			return Object.freeze({ status: "opened" });
		},
		async roots() {
			S();
			let t = c.bookmarks.userContentRoots, n = [];
			for (let r of t) {
				let t = await oe({ guid: r }, "firefox-bookmarks-query-roots");
				if (!t || t.type !== c.bookmarks.TYPE_FOLDER) throw N(e, "FENNEVIA_FIREFOX_BOOKMARK_ROOT_INVALID", "firefox-bookmarks-query-roots", "PlacesUtils.bookmarks.userContentRoots");
				let i;
				try {
					i = Reflect.apply(c.bookmarks.getLocalizedTitle, c.bookmarks, [t]);
				} catch (t) {
					throw N(e, "FENNEVIA_FIREFOX_BOOKMARK_ROOT_TITLE_FAILED", "firefox-bookmarks-query-roots", "PlacesUtils.bookmarks.getLocalizedTitle", t);
				}
				if (typeof i != "string") throw N(e, "FENNEVIA_FIREFOX_BOOKMARK_ROOT_TITLE_INVALID", "firefox-bookmarks-query-roots", "PlacesUtils.bookmarks.getLocalizedTitle");
				n.push(await ae(t, i));
			}
			return Object.freeze(n);
		},
		subscribe(t) {
			if (S(), typeof t != "function") throw N(e, "FENNEVIA_FIREFOX_BOOKMARKS_LISTENER_INVALID", "firefox-bookmarks-subscribe", "bookmarks.subscribe");
			return g.add(t), b(() => {
				g.delete(t);
			});
		}
	});
	try {
		e.assertRequiredCapabilities(), w(), Reflect.apply(c.observers.addListener, c.observers, [k, le]), m = !0;
	} catch (t) {
		f = !0, d = null;
		let r;
		try {
			ue();
		} catch (e) {
			r = e;
		}
		try {
			v.dispose();
		} catch (e) {
			r ??= e;
		}
		throw r !== void 0 && n(N(e, "FENNEVIA_FIREFOX_BOOKMARKS_DISPOSE_FAILED", "firefox-bookmarks-dispose", "PlacesUtils.observers.removeListener", r)), t;
	}
	return Object.freeze({
		assertRequiredCapabilities: w,
		bookmarks: de,
		dispose() {
			if (f) return !1;
			f = !0, d = null;
			let t;
			try {
				ue();
			} catch (e) {
				t = e;
			}
			g.clear(), y.clear(), x.clear();
			try {
				v.dispose();
			} catch (e) {
				t ??= e;
			}
			if (t !== void 0) throw N(e, "FENNEVIA_FIREFOX_BOOKMARKS_DISPOSE_FAILED", "firefox-bookmarks-dispose", "PlacesUtils.observers.removeListener", t);
			return !0;
		},
		snapshot() {
			return Object.freeze({
				disposed: f,
				failed: p !== null,
				handleCount: x.size,
				observerRegistered: m,
				revision: h,
				subscriberCount: g.size
			});
		}
	});
}
//#endregion
//#region src/app/browser-tools-state.ts
var ae = Object.freeze([
	"site-information",
	"protections",
	"site-permissions",
	"downloads",
	"extensions",
	"translate",
	"application-menu",
	"settings",
	"customize",
	"native-toolbar"
]), oe = Object.freeze([
	"site-information",
	"protections",
	"site-permissions",
	"downloads",
	"extensions",
	"translate",
	"application-menu"
]), se = new Set(ae), ce = new Set(oe);
function le(e) {
	return typeof e == "string" && se.has(e);
}
function ue(e) {
	return typeof e == "string" && ce.has(e);
}
//#endregion
//#region src/firefox/browser-tools/support.ts
var de = Object.freeze({ capture: !0 }), fe = Object.freeze([
	"appMenu-popup",
	"downloadsPanel",
	"identity-popup",
	"permission-popup",
	"protections-popup",
	"trustpanel-popup",
	"unified-extensions-panel",
	"full-page-translations-panel"
]), pe = new Set(fe), me = Object.freeze({
	"application-menu": Object.freeze(["appMenu-popup"]),
	downloads: Object.freeze(["downloadsPanel"]),
	extensions: Object.freeze(["unified-extensions-panel"]),
	translate: Object.freeze(["full-page-translations-panel"]),
	protections: Object.freeze(["trustpanel-popup", "protections-popup"]),
	"site-information": Object.freeze(["trustpanel-popup", "identity-popup"]),
	"site-permissions": Object.freeze(["permission-popup"])
}), he = "bottomcenter topright", ge = Object.freeze({
	"application-menu": he,
	downloads: "after_start",
	extensions: "after_end",
	translate: "after_end",
	protections: "end_before",
	"site-information": "end_before",
	"site-permissions": "after_end"
}), _e = (e) => e === he, R = (e) => typeof e == "object" && !!e, z = (e) => typeof e == "function", ve = (e) => {
	let t = e.PanelMultiView;
	if (typeof t == "function") {
		let e = t;
		return z(e.openPopup) ? e : null;
	}
	return R(t) && z(t.openPopup) ? t : null;
}, ye = (e) => R(e) && z(e.addEventListener) && z(e.removeEventListener), be = (e) => R(e) && z(e.click) && z(e.focus), xe = (e) => R(e) && z(e.hidePopup) && z(e.moveToAnchor) && z(e.openPopup), Se = (e) => typeof e == "number" && Number.isFinite(e) ? e : void 0, Ce = (e) => {
	try {
		let t = Reflect.apply(e.getBoundingClientRect, e, []);
		if (!R(t)) return null;
		let n = Se(t.left) ?? Se(t.x), r = Se(t.top) ?? Se(t.y), i = Se(t.width), a = Se(t.height);
		return n === void 0 || r === void 0 || i === void 0 || a === void 0 ? null : Object.freeze({
			height: Math.max(1, Math.round(a)),
			width: Math.max(1, Math.round(i)),
			x: Math.round(n),
			y: Math.round(r)
		});
	} catch {
		return null;
	}
}, we = (e) => {
	let t = Se(e.mozInnerScreenX) ?? 0, n = Se(e.mozInnerScreenY) ?? 0;
	return Object.freeze({
		x: Math.round(t),
		y: Math.round(n)
	});
}, Te = (e) => {
	let t = Se(e.innerWidth), n = Se(e.innerHeight);
	return t === void 0 || n === void 0 || t <= 0 || n <= 0 ? null : Object.freeze({
		height: Math.max(1, Math.round(n)),
		width: Math.max(1, Math.round(t))
	});
}, B = (e, t) => {
	let n = e.document;
	if (!(!R(n) || !z(n.getElementById))) return Reflect.apply(n.getElementById, n, [t]);
}, Ee = (e) => R(e) ? e.panel : void 0, V = (e) => Object.freeze(e), De = Object.freeze([
	V({
		isAvailable: (e) => be(e) && z(e.checkVisibility),
		name: "browser-tools.trust-anchor",
		read: (e) => B(e, "trust-icon-container"),
		symbol: "document.trust-icon-container.click.focus.checkVisibility"
	}),
	V({
		isAvailable: be,
		name: "browser-tools.identity-anchor",
		read: (e) => B(e, "identity-icon-box"),
		symbol: "document.identity-icon-box.click.focus"
	}),
	V({
		isAvailable: be,
		name: "browser-tools.protections-anchor",
		read: (e) => B(e, "tracking-protection-icon-container"),
		symbol: "document.tracking-protection-icon-container.click.focus"
	}),
	V({
		isAvailable: be,
		name: "browser-tools.permissions-anchor",
		read: (e) => B(e, "identity-permission-box"),
		symbol: "document.identity-permission-box.click.focus"
	}),
	V({
		isAvailable: z,
		name: "browser-tools.unified-extensions",
		read: (e) => R(e.gUnifiedExtensions) ? e.gUnifiedExtensions.togglePanel : void 0,
		symbol: "window.gUnifiedExtensions.togglePanel"
	}),
	V({
		isAvailable: z,
		name: "browser-tools.full-page-translations",
		read: (e) => R(e.FullPageTranslationsPanel) ? e.FullPageTranslationsPanel.open : void 0,
		requirement: "optional",
		symbol: "window.FullPageTranslationsPanel.open"
	}),
	V({
		isAvailable: z,
		name: "browser-tools.application-menu",
		read: (e) => R(e.PanelUI) ? e.PanelUI.show : void 0,
		symbol: "window.PanelUI.show"
	}),
	V({
		isAvailable: z,
		name: "browser-tools.application-menu-ready",
		read: (e) => R(e.PanelUI) ? e.PanelUI.ensureReady : void 0,
		symbol: "window.PanelUI.ensureReady"
	}),
	V({
		isAvailable: z,
		name: "browser-tools.settings",
		read: (e) => e.openPreferences,
		symbol: "window.openPreferences"
	}),
	V({
		isAvailable: z,
		name: "browser-tools.customize",
		read: (e) => R(e.gCustomizeMode) ? e.gCustomizeMode.enter : void 0,
		symbol: "window.gCustomizeMode.enter"
	}),
	V({
		isAvailable: (e) => R(e) && z(e.focus),
		name: "browser-tools.native-toolbar-focus",
		read: (e) => B(e, "back-button"),
		symbol: "document.back-button.focus"
	}),
	V({
		isAvailable: be,
		name: "browser-tools.extensions-anchor",
		read: (e) => B(e, "unified-extensions-button"),
		symbol: "document.unified-extensions-button.click.focus"
	}),
	V({
		isAvailable: be,
		name: "browser-tools.application-menu-anchor",
		read: (e) => B(e, "PanelUI-menu-button"),
		symbol: "document.PanelUI-menu-button.click.focus"
	}),
	V({
		isAvailable: z,
		name: "browser-tools.trust-panel",
		read: (e) => R(e.gTrustPanelHandler) ? e.gTrustPanelHandler.showPopup : void 0,
		symbol: "window.gTrustPanelHandler.showPopup"
	}),
	V({
		isAvailable: z,
		name: "browser-tools.permission-set-anchor",
		read: (e) => R(e.gPermissionPanel) ? e.gPermissionPanel.setAnchor : void 0,
		symbol: "window.gPermissionPanel.setAnchor"
	}),
	V({
		isAvailable: z,
		name: "browser-tools.permission-open-popup",
		read: (e) => R(e.gPermissionPanel) ? e.gPermissionPanel.openPopup : void 0,
		symbol: "window.gPermissionPanel.openPopup"
	}),
	V({
		isAvailable: z,
		name: "browser-tools.downloads-initialize",
		read: (e) => R(e.DownloadsPanel) ? e.DownloadsPanel.initialize : void 0,
		symbol: "window.DownloadsPanel.initialize"
	}),
	V({
		isAvailable: xe,
		name: "browser-tools.downloads-panel",
		read: (e) => {
			let t = B(e, "downloadsPanel");
			return xe(t) ? t : Ee(e.DownloadsPanel);
		},
		symbol: "document.downloadsPanel.openPopup.moveToAnchor.hidePopup"
	}),
	V({
		isAvailable: xe,
		name: "browser-tools.application-menu-panel",
		read: (e) => {
			let t = B(e, "appMenu-popup");
			return xe(t) ? t : Ee(e.PanelUI);
		},
		symbol: "document.appMenu-popup.openPopup.moveToAnchor.hidePopup"
	}),
	V({
		isAvailable: xe,
		name: "browser-tools.extensions-panel",
		read: (e) => {
			let t = B(e, "unified-extensions-panel");
			return xe(t) ? t : Ee(e.gUnifiedExtensions);
		},
		symbol: "document.unified-extensions-panel.openPopup.moveToAnchor.hidePopup"
	}),
	V({
		isAvailable: ye,
		name: "browser-tools.document-events",
		read: (e) => e.document,
		symbol: "document.addEventListener.removeEventListener"
	})
]), Oe = (e) => Object.freeze(De.map((t) => {
	let n = !1, r;
	try {
		n = t.isAvailable(t.read(e));
	} catch (e) {
		r = e;
	}
	return Object.freeze({
		...r === void 0 ? {} : { cause: r },
		snapshot: Object.freeze({
			available: n,
			name: t.name,
			requirement: t.requirement ?? "required",
			symbol: t.symbol
		})
	});
})), ke = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, H = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: ke(e),
	phase: n,
	symbol: r
}), Ae = (e) => {
	let t = (t) => e.some((e) => e.snapshot.name === t && e.snapshot.available);
	return Object.freeze({
		applicationMenu: t("browser-tools.application-menu"),
		customize: t("browser-tools.customize"),
		downloads: t("browser-tools.downloads-initialize") && t("browser-tools.downloads-panel"),
		extensions: t("browser-tools.unified-extensions"),
		nativeToolbar: t("browser-tools.native-toolbar-focus"),
		protections: t("browser-tools.trust-panel") && t("browser-tools.protections-anchor"),
		settings: t("browser-tools.settings"),
		siteInformation: t("browser-tools.trust-panel") && t("browser-tools.identity-anchor"),
		sitePermissions: t("browser-tools.permission-open-popup"),
		translate: t("browser-tools.full-page-translations")
	});
}, je = (e) => {
	let t = e.state;
	if (t === "open" || t === "showing") return !0;
	let n = e.getAttribute;
	if (!z(n)) return !1;
	let r = Reflect.apply(n, e, ["state"]);
	return r === "open" || r === "showing";
}, Me = (e) => R(e) ? R(e.originalTarget) ? e.originalTarget : R(e.target) ? e.target : null : null, Ne = (e, t, n) => Math.min(Math.max(e, t), n), Pe = (e, t, n, r) => {
	let i = e, a = e + t - n, o = Math.max(0, r - n), s = i >= 0 && i <= o, c = a >= 0 && a <= o;
	return s && c ? e + t / 2 <= r / 2 ? i : a : s ? i : c ? a : Ne(e + t / 2 - n / 2, 0, o);
}, Fe = (e, t, n, r, i) => {
	let a = e + t, o = e - n, s = Math.max(0, r - n), c = a >= 0 && a <= s, l = o >= 0 && o <= s;
	if (i === !0 && c) return a;
	if (i === !1 && l) return o;
	if (c) return a;
	if (l) return o;
	let u = Math.max(0, r - a), d = Math.max(0, e);
	return u === d && i !== void 0 ? i ? a : o : u >= d ? a : o;
};
function Ie({ direction: e = "auto", hostRect: t, popupSize: n, viewportSize: r }) {
	if (![
		t.height,
		t.width,
		t.x,
		t.y,
		n.height,
		n.width,
		r.height,
		r.width
	].every((e) => Number.isFinite(e)) || t.height <= 0 || t.width <= 0 || n.height <= 0 || n.width <= 0 || r.height <= 0 || r.width <= 0 || ![
		"auto",
		"down",
		"left",
		"right",
		"up"
	].includes(e)) return null;
	let i = e === "left" || e === "right";
	return Object.freeze({
		x: Math.round(i ? Fe(t.x, t.width, n.width, r.width, e === "right") : Pe(t.x, t.width, n.width, r.width)),
		y: Math.round(i ? Pe(t.y, t.height, n.height, r.height) : Fe(t.y, t.height, n.height, r.height, e === "auto" ? void 0 : e === "down"))
	});
}
//#endregion
//#region src/firefox/browser-tools/panel-placement.ts
var Le = Object.freeze([
	Object.freeze([
		"top",
		"down",
		"after_start",
		"after_end"
	]),
	Object.freeze([
		"left",
		"right",
		"end_before",
		"end_after"
	]),
	Object.freeze([
		"right",
		"left",
		"start_before",
		"start_after"
	]),
	Object.freeze([
		"bottom",
		"up",
		"before_start",
		"before_end"
	])
]);
function Re({ boundary: e, requireWindow: t }) {
	let n = (e) => {
		let t = e.closest;
		if (!z(t)) return null;
		for (let n of Le) {
			let [r] = n;
			try {
				if (Reflect.apply(t, e, [`[data-fennevia-edge="${r}"]`]) != null) return n;
			} catch {
				return null;
			}
		}
		return null;
	}, r = (e) => n(e)?.[1] ?? "auto", i = (e, r) => {
		let i = e.closest;
		if (z(i)) try {
			if (Reflect.apply(i, e, ["[data-fennevia-address-popup]"]) != null) return "after_end";
		} catch {
			return r;
		}
		let a = n(e);
		if (!a) return r;
		let o = Ce(e), s = Te(t());
		if (!o || !s) return a[2];
		let c = a[0] === "top" || a[0] === "bottom";
		return (c ? o.x + o.width / 2 : o.y + o.height / 2) <= (c ? s.width : s.height) / 2 ? a[2] : a[3];
	}, a = (e) => {
		let n = t();
		for (let t of e) {
			let e = B(n, t);
			if (xe(e) && je(e)) return e;
		}
		return null;
	}, o = (t, n) => {
		try {
			Reflect.apply(t.hidePopup, t, []);
		} catch (t) {
			throw H(e, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", n, t);
		}
	}, s = (t, n, r, i) => {
		try {
			Reflect.apply(t.openPopup, t, [
				n,
				r,
				0,
				0
			]);
		} catch (t) {
			throw H(e, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", i, t);
		}
	}, c = (t, n, r, i) => {
		try {
			Reflect.apply(t.moveToAnchor, t, [
				n,
				r,
				0,
				0
			]);
		} catch (t) {
			throw H(e, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", i, t);
		}
	}, l = (e, n, a, o) => {
		let s = t(), l = Ce(n), u = Te(s), d = we(s), f = e.moveTo, p = e.getOuterScreenRect;
		if (l && u && z(f) && z(p)) try {
			let t = Reflect.apply(p, e, []);
			if (!R(t)) throw TypeError("native popup outer rectangle unavailable");
			let i = Se(t.width), a = Se(t.height);
			if (i === void 0 || a === void 0) throw TypeError("native popup dimensions unavailable");
			let o = Ie({
				direction: r(n),
				hostRect: l,
				popupSize: {
					height: a,
					width: i
				},
				viewportSize: u
			});
			if (!o) throw TypeError("native popup geometry invalid");
			Reflect.apply(f, e, [d.x + o.x, d.y + o.y]);
			return;
		} catch {}
		c(e, n, i(n, a), o);
	}, u = (e) => {
		let n = t();
		for (let t of fe) {
			if (e.has(t)) continue;
			let r = B(n, t);
			xe(r) && je(r) && o(r, `document.${t}.hidePopup`);
		}
	}, d = (e, t) => i(e, ge[t]), f = (e) => {
		let n = t();
		for (let t of me[e]) {
			let e = B(n, t);
			if (xe(e)) return e;
		}
		return a(me[e]);
	}, p = (t) => {
		let n = f(t);
		if (!n) throw H(e, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", `document.${me[t][0]}.openPopup.moveToAnchor.hidePopup`);
		return n;
	}, m = async (n, r, i, a) => {
		let o = t(), c = ve(o), u = Ce(r), d = we(o), f, p = () => je(n), m = async (e) => {
			try {
				await e();
			} catch (e) {
				return f = e, p();
			}
			return p();
		}, h = () => {
			if (_e(i)) try {
				l(n, r, i, `${a}.moveTo`);
			} catch {}
		}, g = c && z(c.openPopup) ? c.openPopup : void 0, v = async (e, t) => !c || !g ? !1 : m(() => Reflect.apply(g, c, [
			n,
			e,
			t
		])), y = () => v(r, Object.freeze({ position: i })), b = () => v(r, i), x = () => u ? v(null, Object.freeze({
			x: u.x,
			y: u.y + u.height
		})) : Promise.resolve(!1), S = () => m(() => {
			s(n, r, i, `${a}.openPopup`);
		}), C = () => {
			let e = n.openPopupAtScreenRect;
			return !u || !z(e) ? Promise.resolve(!1) : m(() => Reflect.apply(e, n, [
				i,
				d.x + u.x,
				d.y + u.y,
				u.width,
				u.height,
				!1,
				!1
			]));
		}, w = () => {
			let e = n.openPopupAtScreen;
			return !u || !z(e) ? Promise.resolve(!1) : m(() => Reflect.apply(e, n, [
				d.x + u.x,
				d.y + u.y + u.height,
				!1
			]));
		}, T = (() => {
			let e = n.querySelector;
			if (!z(e)) return !1;
			try {
				return Reflect.apply(e, n, ["panelmultiview"]) != null;
			} catch {
				return !1;
			}
		})(), E = g && (T || _e(i)) ? _e(i) ? [
			async () => {
				let e = n.openPopupAtScreenRect, t = n.openPopup;
				if (!u || !g || !z(e) || !z(t)) return !1;
				let a = () => Reflect.apply(e, n, [
					i,
					d.x + u.x,
					d.y + u.y,
					u.width,
					u.height,
					!1,
					!1
				]);
				try {
					n.openPopup = a;
				} catch {
					return !1;
				}
				try {
					return await v(r, Object.freeze({ position: i }));
				} finally {
					try {
						n.openPopup = t;
					} catch {}
				}
			},
			x,
			y,
			b
		] : [
			y,
			b,
			x
		] : _e(i) ? [
			x,
			C,
			y,
			b,
			S,
			w
		] : [
			y,
			b,
			x,
			S,
			C,
			w
		];
		for (let e of E) {
			if (await e()) {
				h();
				return;
			}
			await Promise.resolve();
		}
		if (p()) {
			h();
			return;
		}
		throw _(f) ? f : H(e, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", `${a}.openPopup`, f);
	};
	return Object.freeze({
		findOpenPanel: a,
		hideOtherPanels: u,
		hidePanel: o,
		moveToAnchor: c,
		openOrMovePanel: async (e, t, n) => {
			let r = p(e), i = typeof r.id == "string" && r.id ? r.id : me[e][0];
			return je(r) ? (r.anchorNode === t || l(r, t, n, `document.${i}.moveToAnchor`), r) : (await m(r, t, n, `document.${i}`), r);
		},
		placePanelBesideHost: l,
		requireActionPanel: p,
		resolveActionPanel: f,
		resolvePopupPosition: d
	});
}
//#endregion
//#region src/firefox/browser-tools/popup-actions.ts
var ze = 1e4;
function Be({ beginHandoff: e, boundary: t, closeOpenPanel: n, invokeMethod: r, panelPlacement: i, resolveTranslationTriggerEvent: a, waitForPanelShown: o }) {
	let s = async (e, n, a) => {
		if (!R(n.gTrustPanelHandler)) throw H(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.gTrustPanelHandler.showPopup");
		let o = ve(n), s = o?.openPopup, c = new Set(me[e]), l = null;
		if (o && z(s)) {
			l = (e, ...t) => {
				if (R(e) && typeof e.id == "string" && c.has(e.id)) {
					let n = R(t[1]) ? Object.freeze({
						...t[1],
						position: a.position
					}) : Object.freeze({ position: a.position });
					return Reflect.apply(s, o, [
						e,
						a.host,
						n
					]);
				}
				return Reflect.apply(s, o, [e, ...t]);
			};
			try {
				o.openPopup = l;
			} catch {
				l = null;
			}
		}
		try {
			await r(n.gTrustPanelHandler, "showPopup", "window.gTrustPanelHandler.showPopup");
		} catch {} finally {
			if (o && s && l && o.openPopup === l) try {
				o.openPopup = s;
			} catch {}
		}
		let u = i.findOpenPanel(me[e]);
		return u && u.anchorNode !== a.host ? (i.placePanelBesideHost(u, a.host, a.position, `document.${u.id ?? a.panelId}.moveToAnchor`), !0) : (await i.openOrMovePanel(e, a.host, a.position), !0);
	}, c = async (e, n) => {
		if (!R(e.gPermissionPanel)) throw H(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.gPermissionPanel.setAnchor");
		let a = e.gPermissionPanel.setAnchor;
		if (!z(a)) throw H(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.gPermissionPanel.setAnchor");
		try {
			Reflect.apply(a, e.gPermissionPanel, [n.host, n.position]);
		} catch (e) {
			throw H(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", "window.gPermissionPanel.setAnchor", e);
		}
		try {
			await r(e.gPermissionPanel, "openPopup", "window.gPermissionPanel.openPopup", [Object.freeze({})]);
		} catch {}
		let o = i.findOpenPanel(["permission-popup"]);
		return o && o.anchorNode !== n.host ? (i.placePanelBesideHost(o, n.host, n.position, "document.permission-popup.moveToAnchor"), !0) : (await i.openOrMovePanel("site-permissions", n.host, n.position), !0);
	}, l = async (e, n) => {
		if (!R(e.DownloadsPanel)) throw H(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.DownloadsPanel.initialize");
		return await r(e.DownloadsPanel, "initialize", "window.DownloadsPanel.initialize"), await i.openOrMovePanel("downloads", n.host, n.position), !0;
	}, u = async (e, a) => {
		let o = i.requireActionPanel("extensions");
		if (je(o)) return n("extensions", o, "document.unified-extensions-panel.hidePopup"), !0;
		if (!R(e.gUnifiedExtensions)) throw H(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.gUnifiedExtensions.togglePanel");
		let s = ve(e), c = s && z(s.openPopup) ? s.openPopup : void 0;
		if (s && c) try {
			s.openPopup = (e, ...t) => {
				if (!(R(e) && e.id === "unified-extensions-panel")) return Reflect.apply(c, s, [e, ...t]);
			};
		} catch {}
		try {
			await r(e.gUnifiedExtensions, "togglePanel", "window.gUnifiedExtensions.togglePanel");
		} catch {} finally {
			if (s && c) try {
				s.openPopup = c;
			} catch {}
		}
		return await i.openOrMovePanel("extensions", a.host, a.position), !0;
	}, d = async (e, n, s) => {
		let c = e.FullPageTranslationsPanel;
		if (!R(c) || !z(c.open)) throw H(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.FullPageTranslationsPanel.open");
		let l = ve(e), u = l?.openPopup, d = null;
		if (l && z(u)) {
			d = (e, ...t) => {
				if (R(e) && e.id === "full-page-translations-panel") {
					let r = R(t[1]) ? Object.freeze({
						...t[1],
						position: n.position
					}) : Object.freeze({ position: n.position });
					return Reflect.apply(u, l, [
						e,
						n.host,
						r
					]);
				}
				return Reflect.apply(u, l, [e, ...t]);
			};
			try {
				l.openPopup = d;
			} catch {
				d = null;
			}
		}
		let f;
		try {
			await r(c, "open", "window.FullPageTranslationsPanel.open", [a(s, n.host)]), f = await o(n.panelId, ze);
		} finally {
			if (l && u && d && l.openPopup === d) try {
				l.openPopup = u;
			} catch {}
		}
		if (!f) throw H(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", "document.full-page-translations-panel.popupshown");
		let p = i.resolveActionPanel("translate");
		if (!p || !je(p)) throw H(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", "document.full-page-translations-panel.openPopup");
		return p.anchorNode !== n.host && i.placePanelBesideHost(p, n.host, n.position, "document.full-page-translations-panel.moveToAnchor"), !0;
	}, f = async (a, s) => {
		let c = i.requireActionPanel("application-menu");
		if (je(c)) return n("application-menu", c, "document.appMenu-popup.hidePopup"), !0;
		if (!R(a.PanelUI)) throw H(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.PanelUI.ensureReady");
		await r(a.PanelUI, "ensureReady", "window.PanelUI.ensureReady");
		let l = a.PanelUI._ensureShortcutsShown;
		if (z(l)) try {
			Reflect.apply(l, a.PanelUI, []);
		} catch {}
		try {
			await i.openOrMovePanel("application-menu", s.host, s.position);
		} catch {}
		let u = i.resolveActionPanel("application-menu");
		if (u && je(u)) return !0;
		if (e("appMenu-popup"), !z(a.PanelUI.show)) throw H(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.PanelUI.show");
		let d = o("appMenu-popup");
		try {
			let e = Reflect.apply(a.PanelUI.show, a.PanelUI, []);
			Promise.resolve(e).catch(() => {});
		} catch (e) {
			throw H(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", "window.PanelUI.show", e);
		}
		await d;
		let f = i.resolveActionPanel("application-menu");
		return f && je(f) ? (i.placePanelBesideHost(f, s.host, s.position, "document.appMenu-popup.moveTo"), !0) : (await i.openOrMovePanel("application-menu", s.host, s.position), !0);
	};
	return Object.freeze({ invoke: async (e, n, r, i) => {
		switch (e) {
			case "site-information":
			case "protections": return s(e, n, r);
			case "site-permissions": return c(n, r);
			case "downloads": return l(n, r);
			case "extensions": return u(n, r);
			case "translate": return d(n, r, i);
			case "application-menu": return f(n, r);
		}
		throw H(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_INVALID", "firefox-browser-tools-action", "browser-tools.action");
	} });
}
//#endregion
//#region src/firefox/browser-tools/controller.ts
function Ve({ beginNativePopupHandoff: e, boundary: t, endNativePopupHandoff: n, frame: r, requestNativeUiReveal: i, window: a }) {
	if (t.assertOwnsWindow(a), !R(a) || !R(r) || typeof r.contains != "function" || typeof i != "function" || typeof e != "function" || typeof n != "function") throw H(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_OPTIONS_INVALID", "firefox-browser-tools-create", "window");
	let o = (e) => Reflect.apply(r.contains, r, [e]) === !0, s = a, c = !1, l = 0, u = null, d = new Set(), f = [], p = new Set(), m = new Set(), h = () => {
		if (c || !s) throw H(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_DISPOSED", "firefox-browser-tools-access", "window");
		return s;
	}, g = () => {
		let e = Oe(h()), n = e.find((e) => e.snapshot.requirement === "required" && !e.snapshot.available);
		if (n) throw H(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-capability", n.snapshot.symbol, n.cause);
		return Object.freeze(e.map((e) => e.snapshot));
	}, _ = () => {
		let e;
		try {
			e = i() === !0;
		} catch (e) {
			throw H(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_REVEAL_FAILED", "firefox-browser-tools-reveal", "nativeUi.revealForToolbar", e);
		}
		if (!e) throw H(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_REVEAL_REJECTED", "firefox-browser-tools-reveal", "nativeUi.revealForToolbar");
	}, v = async (e, n, r, i = []) => {
		let a = e[n];
		if (!z(a)) throw H(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", r);
		try {
			await Reflect.apply(a, e, i);
		} catch (e) {
			throw H(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", r, e);
		}
	}, y = (e) => {
		let n = h();
		if (!R(e) || !z(e.getBoundingClientRect) || e.ownerDocument !== n.document || o(e) !== !0) throw H(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_HOST_INVALID", "firefox-browser-tools-action", "browser-tools.host");
		return e;
	}, b = (e, t) => {
		if (R(e) && z(e.stopPropagation) && (e.type === "click" || e.type === "keypress")) return e;
		let n = h().MouseEvent;
		if (z(n)) try {
			let e = Reflect.construct(n, ["click", Object.freeze({
				bubbles: !0,
				button: 0
			})]);
			if (R(e) && z(e.stopPropagation)) return e;
		} catch {}
		return Object.freeze({
			button: 0,
			stopPropagation() {},
			target: t,
			type: "click"
		});
	}, x = Re({
		boundary: t,
		requireWindow: h
	}), S = (n) => {
		let r;
		try {
			r = e(n) === !0;
		} catch (e) {
			throw H(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_HANDOFF_FAILED", "firefox-browser-tools-handoff", "nativeUi.beginPopupHandoff", e);
		}
		if (!r) throw H(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_HANDOFF_REJECTED", "firefox-browser-tools-handoff", "nativeUi.beginPopupHandoff");
	}, C = (e) => {
		try {
			n(e);
		} catch {}
	}, w = async () => {
		let e = h(), t = e.promiseDocumentFlushed;
		if (z(t)) try {
			await Reflect.apply(t, e, [() => void 0]);
			return;
		} catch {}
		await Promise.resolve();
	}, T = (e, t = 800) => {
		let n = h(), r = B(n, e);
		return xe(r) && je(r) ? Promise.resolve(!0) : new Promise((r) => {
			let i = !1, a = (e) => {
				i || (i = !0, r(e));
			}, o = {
				panelId: e,
				resolve: a,
				timeoutHandle: void 0
			}, s = n.setTimeout;
			z(s) ? o.timeoutHandle = Reflect.apply(s, n, [() => {
				m.delete(o);
				let t = B(n, e);
				a(xe(t) && je(t));
			}, t]) : queueMicrotask(() => {
				m.delete(o);
				let t = B(n, e);
				a(xe(t) && je(t));
			}), m.add(o);
		});
	}, E = (e, t) => {
		let n = s;
		for (let r of Array.from(m)) if (r.panelId === e) {
			if (m.delete(r), n && z(n.clearTimeout)) try {
				Reflect.apply(n.clearTimeout, n, [r.timeoutHandle]);
			} catch {}
			r.resolve(t);
		}
	}, D = async (e, t) => {
		let n = y(t), r = me[e][0], i = x.resolvePopupPosition(n, e);
		x.hideOtherPanels(new Set(me[e])), await w();
		for (let t of me[e]) S(t);
		return u = Object.freeze({
			host: n,
			panelId: r,
			position: i
		}), u;
	}, O = () => {
		let e = s;
		if (!e || !R(e.gPermissionPanel)) return;
		let t = e.gPermissionPanel.setAnchor;
		if (z(t)) try {
			Reflect.apply(t, e.gPermissionPanel, [null, "bottomleft topleft"]);
		} catch {}
	}, k = (e) => {
		let t = Object.freeze({
			open: e,
			type: "native-popup"
		});
		for (let e of Array.from(p)) e(t);
	}, A = (e) => {
		if (c) return;
		let t = Me(e), n = typeof t?.id == "string" ? t.id : typeof t?.getAttribute == "function" ? t.getAttribute("id") : void 0;
		if (typeof n != "string" || !pe.has(n)) return;
		let r = R(e) ? e.type : void 0;
		if (r === "popupshown") {
			E(n, !0);
			for (let e of fe) e !== n && C(e);
			if (u && xe(t) && t.anchorNode !== u.host) try {
				x.placePanelBesideHost(t, u.host, u.position, `document.${n}.moveToAnchor`);
			} catch {}
			k(!0);
			return;
		}
		if (r === "popuphidden") {
			if (d.has(n)) return;
			u = null, n === "permission-popup" && O(), C(n), k(!1);
		}
	}, ee = Be({
		beginHandoff: S,
		boundary: t,
		closeOpenPanel: (e, t, n) => {
			x.hidePanel(t, n), u = null;
			for (let t of me[e]) C(t);
			k(!1);
		},
		invokeMethod: v,
		panelPlacement: x,
		resolveTranslationTriggerEvent: b,
		waitForPanelShown: T
	}), j = async (e, t, n) => {
		let r = h(), i = await D(e, t);
		for (let t of me[e]) d.add(t);
		try {
			return await ee.invoke(e, r, i, n);
		} finally {
			for (let t of me[e]) d.delete(t);
		}
	}, M = Object.freeze({
		invoke: async (e, n, r) => {
			if (!le(e)) throw H(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_INVALID", "firefox-browser-tools-action", "browser-tools.action");
			let i = h();
			l += 1;
			try {
				if (ue(e)) return await j(e, n, r);
				switch (e) {
					case "settings": return await v(i, "openPreferences", "window.openPreferences"), !0;
					case "customize":
						if (!R(i.gCustomizeMode)) throw H(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.gCustomizeMode.enter");
						return await v(i.gCustomizeMode, "enter", "window.gCustomizeMode.enter"), !0;
					case "native-toolbar": {
						_();
						let e = B(i, "back-button");
						if (!R(e) || !z(e.focus)) throw H(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "document.back-button.focus");
						try {
							Reflect.apply(e.focus, e, [Object.freeze({ preventScroll: !0 })]);
						} catch (e) {
							throw H(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", "document.back-button.focus", e);
						}
						return !0;
					}
				}
				throw H(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_INVALID", "firefox-browser-tools-action", "browser-tools.action");
			} finally {
				--l;
			}
		},
		snapshot() {
			return Ae(Oe(h()));
		},
		subscribe(e) {
			if (h(), typeof e != "function") throw H(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_LISTENER_INVALID", "firefox-browser-tools-subscribe", "browser-tools.subscribe");
			p.add(e);
			let n = !0;
			return Object.freeze(() => n ? (n = !1, p.delete(e), !0) : !1);
		}
	});
	try {
		t.assertRequiredCapabilities(), g();
		let e = h().document;
		if (!ye(e)) throw H(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-capability", "document.addEventListener.removeEventListener");
		f.push(t.subscribe(e, "popupshown", A, de), t.subscribe(e, "popuphidden", A, de));
	} catch (e) {
		c = !0, s = null;
		for (let e of f.reverse()) try {
			e();
		} catch {}
		throw e;
	}
	return Object.freeze({
		assertRequiredCapabilities: g,
		browserTools: M,
		dispose() {
			if (c) return !1;
			c = !0;
			let e = s;
			u = null, p.clear();
			for (let e of Array.from(m)) m.delete(e), e.resolve(!1);
			if (e) {
				for (let t of fe) {
					let n = B(e, t);
					if (xe(n) && je(n)) try {
						Reflect.apply(n.hidePopup, n, []);
					} catch {}
					C(t);
				}
				O();
			}
			s = null;
			for (let e of f.reverse()) try {
				e();
			} catch {}
			return f.length = 0, !0;
		},
		snapshot() {
			return Object.freeze({
				disposed: c,
				pendingActionCount: l
			});
		}
	});
}
//#endregion
//#region src/app/edge-surfaces/contracts.ts
var He = Object.freeze([
	"single-dynamic",
	"single-reserved",
	"multiple-dynamic",
	"multiple-reserved"
]);
Object.freeze(["default", "new-tab-highlight"]);
var Ue = Object.freeze({
	defaultProgrammaticRevealMs: 1200,
	hideDelayMs: 300,
	maximumProgrammaticRevealMs: 1e4,
	windowLeaveHideDelayMs: 800
}), We = Object.freeze({
	hideDelayMs: Object.freeze({
		max: 5e3,
		min: 100
	}),
	programmaticRevealMs: Object.freeze({
		max: 1e4,
		min: 400
	}),
	triggerThicknessCssPixels: Object.freeze({
		max: 24,
		min: 6
	}),
	windowLeaveHideDelayMs: Object.freeze({
		max: 5e3,
		min: 100
	})
}), Ge = Object.freeze({
	hideDelayMs: Ue.hideDelayMs,
	programmaticRevealMs: Ue.defaultProgrammaticRevealMs,
	triggerThicknessCssPixels: 12,
	windowLeaveHideDelayMs: Ue.windowLeaveHideDelayMs
}), Ke = "multiple-dynamic";
function qe(e) {
	return He.includes(e);
}
//#endregion
//#region src/app/toolbar-widgets/contracts.ts
var Je = Object.freeze([
	"built-in",
	"extension-action",
	"fennevia",
	"project",
	"separator",
	"spacer",
	"spring"
]), Ye = Object.freeze([
	"top",
	"left",
	"right",
	"bottom"
]), Xe = Object.freeze([
	"show-bookmarks",
	"show-downloads",
	"show-translate"
]), Ze = Object.freeze([
	"address-launcher",
	"application-menu",
	"back",
	"bookmarks",
	"close-window",
	"customize-shell",
	"downloads-status",
	"extensions",
	"forward",
	"home",
	"minimize-window",
	"new-tab",
	"private-indicator",
	"reload-stop",
	"settings",
	"show-bookmarks",
	"show-downloads",
	"show-translate",
	"tabs",
	"toggle-maximize-window",
	"trust"
]), Qe = new Set(Ze), $e = Object.freeze([
	"",
	"address",
	"tabs",
	"bookmarks",
	"downloads"
]), et = Object.freeze([
	"address-launcher",
	"tabs",
	"bookmarks",
	"downloads-status"
]), tt = new Set(et), nt = Object.freeze([
	"trust",
	"new-tab",
	"show-bookmarks",
	"show-downloads"
]), rt = new Set(nt), it = Object.freeze([
	"address-launcher",
	"trust",
	"tabs",
	"new-tab",
	"bookmarks",
	"show-bookmarks",
	"downloads-status",
	"show-downloads"
]), at = new Set(it), ot = Object.freeze({
	"address-launcher": "address",
	bookmarks: "bookmarks",
	"downloads-status": "downloads",
	"new-tab": "tabs",
	"show-bookmarks": "bookmarks",
	"show-downloads": "downloads",
	tabs: "tabs",
	trust: "address"
}), st = Object.freeze([
	"address-launcher",
	"bookmarks",
	"customize-shell",
	"downloads-status",
	"private-indicator",
	"tabs"
]), ct = new Set(st), lt = Object.freeze([
	"built-in",
	"extension-action",
	"feature",
	"feature-companion",
	"fennevia",
	"project",
	"container",
	"wrapper",
	"special"
]), ut = Object.freeze([
	"address-only",
	"with-site-status",
	"tabs-only",
	"with-new-tab"
]), dt = Object.freeze([
	"auto",
	"light",
	"dark"
]), ft = Object.freeze([
	"compact",
	"cozy",
	"comfortable"
]), pt = Object.freeze(["tabs-left", "tabs-right"]), mt = Object.freeze([
	"loading",
	"downloads",
	"off"
]), ht = Object.freeze(["row", "column"]), gt = Object.freeze([
	"center",
	"expanded",
	"padding"
]), _t = Object.freeze({
	autoHideDelay: We.hideDelayMs,
	blur: Object.freeze({
		max: 32,
		min: 0
	}),
	edgeTriggerSize: We.triggerThicknessCssPixels,
	fontSize: Object.freeze({
		max: 14,
		min: 11
	}),
	motion: Object.freeze({
		max: 400,
		min: 0
	}),
	radius: Object.freeze({
		max: 16,
		min: 0
	}),
	saturation: Object.freeze({
		max: 180,
		min: 100
	}),
	shadow: Object.freeze({
		max: 100,
		min: 0
	}),
	shortcutHintDuration: Object.freeze({
		max: 1e4,
		min: 0
	}),
	surfaceOpacity: Object.freeze({
		max: 100,
		min: 50
	}),
	temporaryRevealDuration: We.programmaticRevealMs,
	windowLeaveHideDelay: We.windowLeaveHideDelayMs
}), vt = /^#[0-9A-Fa-f]{6}$/u, yt = Object.freeze([
	"accent",
	"border",
	"chromeBackground",
	"surface",
	"text"
]), bt = /^[a-z][a-z0-9-]{0,63}$/u;
new Set(Je);
var xt = new Set(Ye), St = new Set(Xe);
new Set(lt), new Set($e);
var Ct = new Set(dt), wt = new Set(ft), Tt = new Set(pt), Et = new Set(mt), Dt = Object.freeze([
	"separator",
	"spacer",
	"spring"
]);
new Set(Dt);
//#endregion
//#region src/app/toolbar-widgets/errors.ts
var U = (e) => {
	let t = Error(e);
	return t.name = "FenneviaToolbarWidgetsStateError", Object.defineProperties(t, {
		fenneviaCode: {
			enumerable: !1,
			value: e
		},
		fenneviaPhase: {
			enumerable: !1,
			value: "toolbar-widgets-state"
		}
	}), t;
}, Ot = Object.freeze(["address-only", "with-site-status"]), kt = Object.freeze(["tabs-only", "with-new-tab"]), At = Object.freeze([]);
function jt(e) {
	return e === "address-launcher" ? Ot : e === "tabs" ? kt : At;
}
function Mt(e) {
	return jt(e)[0] ?? "";
}
function Nt(e, t) {
	return typeof t == "string" && jt(e).includes(t);
}
//#endregion
//#region src/app/toolbar-widgets/validation.ts
function Pt(e) {
	return typeof e == "string" && xt.has(e);
}
var Ft = new Set(ht);
new Set(gt);
var It = new Set(ut);
function Lt(e) {
	return typeof e == "string" && It.has(e);
}
function Rt(e) {
	return typeof e == "string" && Ft.has(e);
}
function zt(e) {
	return typeof e == "string" && St.has(e);
}
function Bt(e) {
	return typeof e == "string" && Ct.has(e);
}
function Vt(e) {
	return typeof e == "string" && wt.has(e);
}
function Ht(e) {
	return typeof e == "string" && Tt.has(e);
}
function Ut(e) {
	return typeof e == "string" && Et.has(e);
}
function Wt() {
	return Object.freeze({
		allowCompactWindow: !1,
		bottomPanelEnabled: !0,
		bottomProgressLight: "downloads",
		leftPanelEnabled: !0,
		panelDodgeMode: Ke,
		rightPanelEnabled: !0,
		sidePanelLayout: "tabs-left",
		topProgressLight: "loading"
	});
}
function Gt(e) {
	if (!e || typeof e != "object" || typeof e.allowCompactWindow != "boolean" || typeof e.bottomPanelEnabled != "boolean" || !Ut(e.bottomProgressLight) || typeof e.leftPanelEnabled != "boolean" || !qe(e.panelDodgeMode) || typeof e.rightPanelEnabled != "boolean" || !Ht(e.sidePanelLayout) || !Ut(e.topProgressLight)) throw U("FENNEVIA_TOOLBAR_WIDGETS_STATE_PANELS_INVALID");
	return Object.freeze({
		allowCompactWindow: e.allowCompactWindow,
		bottomPanelEnabled: e.bottomPanelEnabled,
		bottomProgressLight: e.bottomProgressLight,
		leftPanelEnabled: e.leftPanelEnabled,
		panelDodgeMode: e.panelDodgeMode,
		rightPanelEnabled: e.rightPanelEnabled,
		sidePanelLayout: e.sidePanelLayout,
		topProgressLight: e.topProgressLight
	});
}
function Kt(e) {
	if (!e || typeof e != "object") throw U("FENNEVIA_TOOLBAR_WIDGETS_STATE_PANELS_INVALID");
	let t = Object.keys(e), n = Gt({
		...Wt(),
		...e
	});
	if (t.length === 0 || t.some((e) => !Object.hasOwn(n, e))) throw U("FENNEVIA_TOOLBAR_WIDGETS_STATE_PANELS_INVALID");
	let r = {};
	for (let i of t) {
		let t = i;
		if (e[t] !== n[t]) throw U("FENNEVIA_TOOLBAR_WIDGETS_STATE_PANELS_INVALID");
		Object.assign(r, { [t]: n[t] });
	}
	return Object.freeze(r);
}
function qt() {
	return Object.freeze({
		accent: "",
		autoHideDelay: Ge.hideDelayMs,
		blur: 18,
		border: "",
		chromeBackground: "",
		density: "cozy",
		edgeTriggerSize: Ge.triggerThicknessCssPixels,
		fontSize: 12,
		motion: 180,
		radius: 4,
		saturation: 145,
		shadow: 50,
		shortcutHintDuration: 600,
		surface: "",
		surfaceOpacity: 94,
		temporaryRevealDuration: Ge.programmaticRevealMs,
		text: "",
		theme: "auto",
		windowLeaveHideDelay: Ge.windowLeaveHideDelayMs
	});
}
var Jt = (e, t) => typeof e == "number" && Number.isSafeInteger(e) && e >= t.min && e <= t.max, Yt = new Set(yt);
function Xt(e) {
	return typeof e == "string" && Yt.has(e);
}
function Zt(e) {
	return typeof e == "string" ? e === "" ? "" : vt.test(e) ? e.toLowerCase() : null : null;
}
var Qt = (e) => Zt(e);
function $t(e) {
	if (!e || typeof e != "object") throw U("FENNEVIA_TOOLBAR_WIDGETS_STATE_STYLE_INVALID");
	let t = Qt(e.accent), n = Qt(e.border), r = Qt(e.chromeBackground), i = Qt(e.surface), a = Qt(e.text);
	if (t === null || n === null || r === null || i === null || a === null || !Jt(e.autoHideDelay, _t.autoHideDelay) || !Jt(e.blur, _t.blur) || !Vt(e.density) || !Jt(e.edgeTriggerSize, _t.edgeTriggerSize) || !Jt(e.fontSize, _t.fontSize) || !Jt(e.motion, _t.motion) || !Jt(e.radius, _t.radius) || !Jt(e.saturation, _t.saturation) || !Jt(e.shadow, _t.shadow) || !Jt(e.shortcutHintDuration, _t.shortcutHintDuration) || !Jt(e.surfaceOpacity, _t.surfaceOpacity) || !Jt(e.temporaryRevealDuration, _t.temporaryRevealDuration) || !Bt(e.theme) || !Jt(e.windowLeaveHideDelay, _t.windowLeaveHideDelay)) throw U("FENNEVIA_TOOLBAR_WIDGETS_STATE_STYLE_INVALID");
	return Object.freeze({
		accent: t,
		autoHideDelay: e.autoHideDelay,
		blur: e.blur,
		border: n,
		chromeBackground: r,
		density: e.density,
		edgeTriggerSize: e.edgeTriggerSize,
		fontSize: e.fontSize,
		motion: e.motion,
		radius: e.radius,
		saturation: e.saturation,
		shadow: e.shadow,
		shortcutHintDuration: e.shortcutHintDuration,
		surface: i,
		surfaceOpacity: e.surfaceOpacity,
		temporaryRevealDuration: e.temporaryRevealDuration,
		text: a,
		theme: e.theme,
		windowLeaveHideDelay: e.windowLeaveHideDelay
	});
}
function en(e) {
	if (!e || typeof e != "object") throw U("FENNEVIA_TOOLBAR_WIDGETS_STATE_STYLE_INVALID");
	let t = Object.keys(e), n = {};
	for (let r of t) {
		if (Xt(r)) {
			let t = Qt(e[r]);
			if (t === null) throw U("FENNEVIA_TOOLBAR_WIDGETS_STATE_STYLE_INVALID");
			Object.assign(n, { [r]: t });
			continue;
		}
		Object.assign(n, { [r]: e[r] });
	}
	let r = $t({
		...qt(),
		...n
	});
	if (t.length === 0 || t.some((e) => !Object.hasOwn(r, e)) || t.some((e) => n[e] !== r[e])) throw U("FENNEVIA_TOOLBAR_WIDGETS_STATE_STYLE_INVALID");
	let i = {};
	for (let e of t) {
		let t = e;
		Object.assign(i, { [t]: r[t] });
	}
	return Object.freeze(i);
}
function tn() {
	return Object.freeze({
		bottom: Object.freeze([]),
		left: Object.freeze([]),
		right: Object.freeze([]),
		top: Object.freeze([])
	});
}
function nn(e) {
	if (!Array.isArray(e) || e.length > 4 || e.some((e) => !Number.isSafeInteger(e) || e < 0 || e > 48)) throw U("FENNEVIA_TOOLBAR_WIDGETS_STATE_LAYOUT_PATH_INVALID");
	return Object.freeze([...e]);
}
function rn(e) {
	if (!e || typeof e != "object" || !Pt(e.zone)) throw U("FENNEVIA_TOOLBAR_WIDGETS_STATE_LAYOUT_PATH_INVALID");
	return Object.freeze({
		path: nn(e.path),
		zone: e.zone
	});
}
function an() {
	return Object.freeze({
		bottom: Object.freeze([]),
		left: Object.freeze([]),
		right: Object.freeze([]),
		top: Object.freeze([])
	});
}
function on() {
	return Object.freeze({
		allowMultiplePlacements: !1,
		available: !1,
		canEdit: !1,
		layout: an(),
		layoutCustomized: !1,
		palette: Object.freeze([]),
		panels: Wt(),
		panelsCustomized: !1,
		style: qt(),
		zones: tn()
	});
}
var sn = (e) => typeof e == "number" && Number.isSafeInteger(e) && e >= 0 && e <= 48, cn = (e) => typeof e == "number" && Number.isSafeInteger(e) && e >= 0;
function ln(e) {
	if (!e || typeof e != "object") throw U("FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID");
	switch (e.type) {
		case "add":
			if (typeof e.token != "string" || !bt.test(e.token) || !Pt(e.zone) || !sn(e.index) || !cn(e.revision)) throw U("FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID");
			return Object.freeze({
				index: e.index,
				revision: e.revision,
				token: e.token,
				type: "add",
				zone: e.zone
			});
		case "add-node":
			if (typeof e.token != "string" || !bt.test(e.token) || !Pt(e.zone) || !sn(e.index) || !cn(e.revision)) throw U("FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID");
			return Object.freeze({
				index: e.index,
				parentPath: nn(e.parentPath),
				revision: e.revision,
				token: e.token,
				type: "add-node",
				zone: e.zone
			});
		case "add-container":
			if (!Rt(e.direction) || !Pt(e.zone) || !sn(e.index) || !cn(e.revision)) throw U("FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID");
			return Object.freeze({
				direction: e.direction,
				index: e.index,
				parentPath: nn(e.parentPath),
				revision: e.revision,
				type: "add-container",
				zone: e.zone
			});
		case "move":
			if (!Pt(e.fromZone) || !Pt(e.toZone) || !sn(e.fromIndex) || !sn(e.toIndex) || !cn(e.revision)) throw U("FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID");
			return Object.freeze({
				fromIndex: e.fromIndex,
				fromZone: e.fromZone,
				revision: e.revision,
				toIndex: e.toIndex,
				toZone: e.toZone,
				type: "move"
			});
		case "remove":
			if (!Pt(e.zone) || !sn(e.index) || !cn(e.revision)) throw U("FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID");
			return Object.freeze({
				index: e.index,
				revision: e.revision,
				type: "remove",
				zone: e.zone
			});
		case "move-node": {
			let t = rn(e.from);
			if (t.path.length === 0 || !e.to || typeof e.to != "object" || !Pt(e.to.zone) || !sn(e.to.index) || !cn(e.revision)) throw U("FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID");
			return Object.freeze({
				from: t,
				revision: e.revision,
				to: Object.freeze({
					index: e.to.index,
					parentPath: nn(e.to.parentPath),
					zone: e.to.zone
				}),
				type: "move-node"
			});
		}
		case "remove-node": {
			let t = rn(e.location);
			if (t.path.length === 0 || !cn(e.revision)) throw U("FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID");
			return Object.freeze({
				location: t,
				revision: e.revision,
				type: "remove-node"
			});
		}
		case "set-multiple-placements":
			if (typeof e.allow != "boolean" || !cn(e.revision)) throw U("FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID");
			return Object.freeze({
				allow: e.allow,
				revision: e.revision,
				type: "set-multiple-placements"
			});
		case "set-container-direction": {
			let t = rn(e.location);
			if (t.path.length === 0 || !Rt(e.direction) || !cn(e.revision)) throw U("FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID");
			return Object.freeze({
				direction: e.direction,
				location: t,
				revision: e.revision,
				type: "set-container-direction"
			});
		}
		case "set-node-style": {
			let t = rn(e.location);
			if (t.path.length === 0 || !Lt(e.style) || !cn(e.revision)) throw U("FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID");
			return Object.freeze({
				location: t,
				revision: e.revision,
				style: e.style,
				type: "set-node-style"
			});
		}
		case "clean-layout":
		case "reset-layout":
			if (!cn(e.revision)) throw U("FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID");
			return Object.freeze({
				revision: e.revision,
				type: e.type
			});
		case "set-style": return Object.freeze({
			style: en(e.style),
			type: "set-style"
		});
		case "reset-style": return Object.freeze({ type: "reset-style" });
		case "set-panels": return Object.freeze({
			panels: Kt(e.panels),
			type: "set-panels"
		});
		case "reset-panels": return Object.freeze({ type: "reset-panels" });
		default: throw U("FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID");
	}
}
//#endregion
//#region src/firefox/customize-model.ts
var un = Object.freeze([
	"separator",
	"spacer",
	"spring"
]), dn = new Set(un), fn = Object.freeze({
	adoptedMaxEntries: 64,
	serializedMaxLength: 16384,
	widgetIdMaxLength: 128,
	zoneMaxEntries: 48
}), pn = /^[A-Za-z0-9_.-]{1,128}$/u;
function mn(e) {
	let t = Error(e);
	return t.name = "FenneviaCustomizeModelError", Object.defineProperties(t, {
		fenneviaCode: {
			enumerable: !1,
			value: e
		},
		fenneviaPhase: {
			enumerable: !1,
			value: "customize-model"
		}
	}), t;
}
function hn(e) {
	return typeof e == "string" && dn.has(e);
}
function gn(e) {
	return typeof e == "string" && pn.test(e);
}
function _n(e) {
	if (!e || typeof e != "object") throw mn("FENNEVIA_CUSTOMIZE_MODEL_ENTRY_INVALID");
	let t = e;
	if (t.type === "widget" && gn(t.id)) return Object.freeze({
		id: t.id,
		type: "widget"
	});
	if (t.type === "special" && hn(t.kind)) return Object.freeze({
		kind: t.kind,
		type: "special"
	});
	if (t.type === "fennevia" && zt(t.id)) return Object.freeze({
		id: t.id,
		type: "fennevia"
	});
	throw mn("FENNEVIA_CUSTOMIZE_MODEL_ENTRY_INVALID");
}
function vn(e) {
	if (!e || typeof e != "object") throw mn("FENNEVIA_CUSTOMIZE_MODEL_LAYOUT_INVALID");
	let t = e, n = [];
	for (let e of Ye) {
		let r = t[e];
		if (!Array.isArray(r) || r.length > fn.zoneMaxEntries) throw mn("FENNEVIA_CUSTOMIZE_MODEL_LAYOUT_INVALID");
		n.push([e, Object.freeze(r.map(_n))]);
	}
	return Object.freeze(Object.fromEntries(n));
}
function yn(e) {
	if (!e || typeof e != "object") throw mn("FENNEVIA_CUSTOMIZE_MODEL_LAYOUT_INVALID");
	let t = e;
	if (t.version !== 1 || !Array.isArray(t.adopted) || t.adopted.length > fn.adoptedMaxEntries || t.adopted.some((e) => !gn(e))) throw mn("FENNEVIA_CUSTOMIZE_MODEL_LAYOUT_INVALID");
	return Object.freeze({
		adopted: Object.freeze([...t.adopted]),
		version: 1,
		zones: vn(t.zones)
	});
}
function bn() {
	return Object.freeze({
		adopted: Object.freeze([]),
		version: 1,
		zones: Object.freeze({
			bottom: Object.freeze([]),
			left: Object.freeze([]),
			right: Object.freeze([]),
			top: Object.freeze([])
		})
	});
}
function xn(e, t = []) {
	return yn({
		adopted: t,
		version: 1,
		zones: {
			...bn().zones,
			...e
		}
	});
}
function Sn(e) {
	if (typeof e != "string" || e === "" || e.length > fn.serializedMaxLength) return null;
	try {
		return yn(JSON.parse(e));
	} catch {
		return null;
	}
}
function Cn(e) {
	let t = JSON.stringify(yn(e));
	if (t.length > fn.serializedMaxLength) throw mn("FENNEVIA_CUSTOMIZE_MODEL_LAYOUT_TOO_LARGE");
	return t;
}
function wn(e) {
	if (typeof e != "string" || e === "" || e.length > fn.serializedMaxLength) return null;
	try {
		let t = JSON.parse(e);
		return !t || typeof t != "object" || t.version !== 1 ? null : $t({
			...qt(),
			...t,
			version: void 0
		});
	} catch {
		return null;
	}
}
function Tn(e) {
	return JSON.stringify({
		...$t(e),
		version: 1
	});
}
var En = new Set([
	"allowCompactWindow",
	"bottomDownloadsEnabled",
	"bottomProgressLight",
	"sidePanelLayout",
	"topProgressLight",
	"version"
]), Dn = new Set([
	"allowCompactWindow",
	"bottomPanelEnabled",
	"bottomProgressLight",
	"leftPanelEnabled",
	"rightPanelEnabled",
	"sidePanelLayout",
	"topProgressLight",
	"version"
]), On = new Set([
	"allowCompactWindow",
	"bottomPanelEnabled",
	"bottomProgressLight",
	"leftPanelEnabled",
	"panelDodgeMode",
	"rightPanelEnabled",
	"sidePanelLayout",
	"topProgressLight",
	"version"
]);
function kn(e) {
	if (typeof e != "string" || e === "" || e.length > fn.serializedMaxLength) return null;
	try {
		let t = JSON.parse(e);
		if (!t || typeof t != "object") return null;
		if (t.version === 1 && Object.keys(t).every((e) => En.has(e))) {
			let e = Wt();
			return Gt({
				...e,
				allowCompactWindow: t.allowCompactWindow ?? e.allowCompactWindow,
				bottomPanelEnabled: t.bottomDownloadsEnabled ?? e.bottomPanelEnabled,
				bottomProgressLight: t.bottomProgressLight ?? e.bottomProgressLight,
				sidePanelLayout: t.sidePanelLayout ?? e.sidePanelLayout,
				topProgressLight: t.topProgressLight ?? e.topProgressLight
			});
		}
		return t.version === 2 && Object.keys(t).every((e) => Dn.has(e)) || t.version === 3 && Object.keys(t).every((e) => On.has(e)) ? Gt({
			...Wt(),
			...t,
			version: void 0
		}) : null;
	} catch {
		return null;
	}
}
function An(e) {
	return JSON.stringify({
		...Gt(e),
		version: 3
	});
}
function jn(e, t) {
	if (t.type === "special") return null;
	for (let n of Ye) {
		let r = e.zones[n];
		for (let [e, i] of r.entries()) if (i.type === t.type && i.id === t.id) return Object.freeze({
			index: e,
			zone: n
		});
	}
	return null;
}
var Mn = (e) => {
	if (!Pt(e)) throw mn("FENNEVIA_CUSTOMIZE_MODEL_ZONE_INVALID");
	return e;
}, Nn = (e, t) => {
	if (!Number.isSafeInteger(e) || e < 0) throw mn("FENNEVIA_CUSTOMIZE_MODEL_INDEX_INVALID");
	return Math.min(e, t);
}, Pn = (e, t, n) => Object.freeze({
	adopted: e.adopted,
	version: 1,
	zones: Object.freeze({
		...e.zones,
		[t]: Object.freeze([...n])
	})
});
function Fn(e, t, n, r) {
	let i = _n(t), a = Mn(n), o = jn(e, i), s = e;
	o && (s = In(e, o.zone, o.index));
	let c = [...s.zones[a]];
	if (c.length >= fn.zoneMaxEntries) throw mn("FENNEVIA_CUSTOMIZE_MODEL_ZONE_FULL");
	return c.splice(Nn(r, c.length), 0, i), Pn(s, a, c);
}
function In(e, t, n) {
	let r = Mn(t), i = [...e.zones[r]];
	if (!Number.isSafeInteger(n) || n < 0 || n >= i.length) throw mn("FENNEVIA_CUSTOMIZE_MODEL_INDEX_INVALID");
	return i.splice(n, 1), Pn(e, r, i);
}
function Ln(e, t, n) {
	let r = Mn(t), i = e.zones[r];
	if (!Number.isSafeInteger(n) || n < 0 || n >= i.length) throw mn("FENNEVIA_CUSTOMIZE_MODEL_INDEX_INVALID");
	return i[n];
}
function Rn(e, t, n, r, i) {
	let a = Ln(e, t, n), o = In(e, t, n), s = [...o.zones[Mn(r)]];
	if (s.length >= fn.zoneMaxEntries) throw mn("FENNEVIA_CUSTOMIZE_MODEL_ZONE_FULL");
	return s.splice(Nn(i, s.length), 0, a), Pn(o, r, s);
}
function zn(e, t) {
	if (!gn(t)) throw mn("FENNEVIA_CUSTOMIZE_MODEL_ENTRY_INVALID");
	if (e.adopted.includes(t)) return e;
	if (e.adopted.length >= fn.adoptedMaxEntries) throw mn("FENNEVIA_CUSTOMIZE_MODEL_LAYOUT_TOO_LARGE");
	return Object.freeze({
		adopted: Object.freeze([...e.adopted, t]),
		version: 1,
		zones: e.zones
	});
}
function Bn(e, t) {
	return e.adopted.includes(t) ? Object.freeze({
		adopted: Object.freeze(e.adopted.filter((e) => e !== t)),
		version: 1,
		zones: e.zones
	}) : e;
}
function Vn(e, t) {
	return jn(e, {
		id: t,
		type: "widget"
	}) !== null;
}
//#endregion
//#region src/firefox/downloads/support.ts
var Hn = "resource://gre/modules/Downloads.sys.mjs", Un = (e) => typeof e == "object" && !!e, Wn = (e) => typeof e == "function", Gn = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, Kn = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: Gn(e),
	phase: n,
	symbol: r
}), qn = (e) => typeof e == "number" && Number.isFinite(e) && Number.isSafeInteger(e) && e >= 0, Jn = (e, t) => {
	if (!Un(t) || typeof t.stopped != "boolean" || typeof t.succeeded != "boolean" || typeof t.canceled != "boolean" || typeof t.hasPartialData != "boolean" || typeof t.hasProgress != "boolean" || !Number.isInteger(t.progress) || t.progress < 0 || t.progress > 100 || !qn(t.currentBytes) || !qn(t.totalBytes)) throw Kn(e, "FENNEVIA_FIREFOX_DOWNLOAD_RECORD_INVALID", "firefox-downloads-event", "Download");
	return t;
}, Yn = (e) => e.stopped ? e.succeeded ? "succeeded" : e.error ? "failed" : e.canceled ? e.hasPartialData ? "paused" : "canceled" : "queued" : "active", Xn = (e) => e === "succeeded" || e === "failed" || e === "canceled", Zn = (e) => Math.min(e, 999), Qn = () => Object.freeze({
	activeCount: 0,
	aggregatePercent: null,
	canceledCount: 0,
	countOverflow: !1,
	failedCount: 0,
	items: Object.freeze([]),
	pausedCount: 0,
	phase: "loading",
	progressMode: "none",
	queuedCount: 0,
	revision: 0,
	succeededCount: 0,
	truncated: !1
});
//#endregion
//#region src/firefox/downloads/controller.ts
function $n({ boundary: e, moduleLoader: t, onError: n, window: r }) {
	if (e.assertOwnsWindow(r), !Un(r) || typeof t != "function" || typeof n != "function") throw Kn(e, "FENNEVIA_FIREFOX_DOWNLOADS_OPTIONS_INVALID", "firefox-downloads-create", "ChromeUtils.importESModule");
	let i;
	try {
		i = t(Hn);
	} catch (t) {
		throw Kn(e, "FENNEVIA_FIREFOX_DOWNLOADS_MODULE_LOAD_FAILED", "firefox-downloads-module-load", "ChromeUtils.importESModule", t);
	}
	let a = Un(i) ? i.Downloads : void 0, o = a, s = e.snapshot().windowKind === "private" ? "private" : "public", c = s === "private" ? o?.PRIVATE : o?.PUBLIC, l = Object.freeze([
		Object.freeze({
			isAvailable: Un,
			name: "firefox.downloads",
			read: () => a,
			symbol: "Downloads"
		}),
		Object.freeze({
			isAvailable: Wn,
			name: "firefox.downloads-get-list",
			read: () => o?.getList,
			symbol: "Downloads.getList"
		}),
		Object.freeze({
			isAvailable: (e) => typeof e == "string",
			name: `firefox.downloads-${s}-list`,
			read: () => c,
			symbol: s === "private" ? "Downloads.PRIVATE" : "Downloads.PUBLIC"
		})
	]), u = r, d = null, f = !1, p = null, m = !0, h = 0, g = !1, v = !1, y = 0, x = 0, S = !1, C = Qn(), w = "", T = new Set(), E = e.createHandleRegistry("download"), D = new Map(), O = new WeakSet(), k = [], A = () => {
		if (f || !u) throw Kn(e, "FENNEVIA_FIREFOX_DOWNLOADS_DISPOSED", "firefox-downloads-access", "window");
		if (p) throw p;
		return e.assertOwnsWindow(u), u;
	}, ee = () => {
		let e = l.map((e) => {
			let t = !1, n;
			try {
				t = e.isAvailable(e.read());
			} catch (e) {
				n = e;
			}
			return Object.freeze({
				...n === void 0 ? {} : { cause: n },
				snapshot: Object.freeze({
					available: t,
					name: e.name,
					requirement: "required",
					symbol: e.symbol
				})
			});
		});
		return d && e.push(Object.freeze({ snapshot: Object.freeze({
			available: Wn(d.addView),
			name: "firefox.downloads-list-add-view",
			requirement: "required",
			symbol: "DownloadList.addView"
		}) }), Object.freeze({ snapshot: Object.freeze({
			available: Wn(d.removeView),
			name: "firefox.downloads-list-remove-view",
			requirement: "required",
			symbol: "DownloadList.removeView"
		}) })), Object.freeze(e);
	}, j = () => {
		A();
		let t = ee(), n = t.find((e) => !e.snapshot.available);
		if (n) throw Kn(e, "FENNEVIA_FIREFOX_DOWNLOADS_CAPABILITY_MISSING", "firefox-downloads-capability", n.snapshot.symbol, n.cause);
		return Object.freeze(t.map((e) => e.snapshot));
	}, M = (t) => p || (p = _(t) ? t : Kn(e, "FENNEVIA_FIREFOX_DOWNLOADS_EVENT_FAILED", "firefox-downloads-event", "DownloadList.view", t), n(p), p), te = (e) => {
		let t = D.get(e);
		if (!t) return !1;
		D.delete(e);
		let n = k.indexOf(e);
		return n !== -1 && k.splice(n, 1), E.release(t.id), !0;
	}, N = (e) => {
		let t = k.indexOf(e);
		for (t !== -1 && k.splice(t, 1), k.unshift(e); k.length > 3;) {
			let e = k.pop();
			e && te(e);
		}
	}, ne = (t) => {
		let n = Jn(e, t), r = Yn(n);
		if (m && (O.add(n), Xn(r))) return;
		let i = D.get(n);
		if (!(!i && Xn(r) && O.has(n))) {
			if (i || (i = {
				currentBytes: 0,
				download: n,
				hasProgress: !1,
				id: E.register(n),
				order: ++x,
				progressPercent: null,
				state: r,
				totalBytes: 0
			}, D.set(n, i)), i.currentBytes = n.currentBytes, i.hasProgress = n.hasProgress, i.progressPercent = r === "succeeded" ? 100 : n.hasProgress ? n.progress : null, i.state = r, i.totalBytes = n.totalBytes, Xn(r)) N(n);
			else {
				let e = k.indexOf(n);
				e !== -1 && k.splice(e, 1);
			}
		}
	}, re = (e) => {
		if (e.length === 0) return Object.freeze({
			mode: "none",
			percent: null
		});
		if (e.some((e) => !e.hasProgress)) return Object.freeze({
			mode: "indeterminate",
			percent: null
		});
		let t = 0, n = 0, r = 0, i = 0;
		for (let a of e) a.totalBytes > 0 ? (n += a.totalBytes, t += Math.min(a.currentBytes, a.totalBytes)) : (r += a.progressPercent ?? 0, i += 1);
		let a = n > 0 ? t / n * 100 : i > 0 ? r / i : 0;
		return Object.freeze({
			mode: "determinate",
			percent: Math.max(0, Math.min(100, Math.floor(a)))
		});
	}, P = () => {
		let e = {
			active: [],
			canceled: [],
			failed: [],
			paused: [],
			queued: [],
			succeeded: []
		};
		for (let t of D.values()) e[t.state].push(t);
		for (let t of [
			"active",
			"paused",
			"queued"
		]) e[t].sort((e, t) => e.order - t.order);
		let t = k.map((e) => D.get(e)).filter((e) => !!e), n = [
			...e.active,
			...e.paused,
			...e.queued,
			...t
		], r = n.slice(0, 6).map((e) => Object.freeze({
			id: e.id,
			progressPercent: e.progressPercent,
			state: e.state
		})), i = re(e.active), a = Object.freeze({
			active: e.active.length,
			canceled: e.canceled.length,
			failed: e.failed.length,
			paused: e.paused.length,
			queued: e.queued.length,
			succeeded: e.succeeded.length
		}), o = Object.values(a).some((e) => e > 999);
		return Object.freeze({
			activeCount: Zn(a.active),
			aggregatePercent: i.percent,
			canceledCount: Zn(a.canceled),
			countOverflow: o,
			failedCount: Zn(a.failed),
			items: Object.freeze(r),
			pausedCount: Zn(a.paused),
			phase: v ? "ready" : "loading",
			progressMode: i.mode,
			queuedCount: Zn(a.queued),
			revision: y + 1,
			succeededCount: Zn(a.succeeded),
			truncated: n.length > 6 || o
		});
	}, ie = () => {
		if (f || p || m || h > 0) {
			g = !0;
			return;
		}
		g = !1;
		let t = P(), n = JSON.stringify({
			...t,
			revision: 0
		});
		if (n !== w) {
			w = n, y += 1, C = Object.freeze({
				...t,
				revision: y
			});
			for (let t of Array.from(T)) try {
				t(C);
			} catch (t) {
				M(Kn(e, "FENNEVIA_FIREFOX_DOWNLOADS_SUBSCRIBER_FAILED", "firefox-downloads-notify", "downloads.subscribe", t));
				return;
			}
		}
	}, F = Object.freeze({
		onDownloadAdded(e) {
			if (!(f || p)) try {
				ne(e), ie();
			} catch (e) {
				M(e);
			}
		},
		onDownloadBatchEnded() {
			f || p || (h > 0 && --h, h === 0 && g && ie());
		},
		onDownloadBatchStarting() {
			!f && !p && (h += 1);
		},
		onDownloadChanged(e) {
			if (!(f || p)) try {
				ne(e), ie();
			} catch (e) {
				M(e);
			}
		},
		onDownloadRemoved(t) {
			if (!(f || p)) try {
				let n = Jn(e, t);
				te(n), ie();
			} catch (e) {
				M(e);
			}
		}
	}), I = b(() => {
		!S || !d || (S = !1, Reflect.apply(d.removeView, d, [F]));
	});
	e.assertRequiredCapabilities(), j();
	let L = (async () => {
		try {
			let t = await Reflect.apply(o.getList, o, [c]);
			if (f) return !0;
			if (!Un(t) || !Wn(t.addView) || !Wn(t.removeView)) throw Kn(e, "FENNEVIA_FIREFOX_DOWNLOADS_CAPABILITY_MISSING", "firefox-downloads-capability", !Un(t) || !Wn(t.addView) ? "DownloadList.addView" : "DownloadList.removeView");
			if (d = t, S = !0, Reflect.apply(d.addView, d, [F]), f) return I(), !0;
			if (m = !1, h = 0, p) throw p;
			return v = !0, ie(), !0;
		} catch (t) {
			if (f) return !0;
			throw p ?? M(_(t) ? t : Kn(e, "FENNEVIA_FIREFOX_DOWNLOADS_INITIALIZATION_FAILED", "firefox-downloads-initialize", "Downloads.getList", t));
		}
	})();
	L.catch(() => void 0);
	let ae = Object.freeze({
		ready() {
			return A(), L;
		},
		snapshot() {
			return A(), C;
		},
		subscribe(t) {
			if (A(), typeof t != "function") throw Kn(e, "FENNEVIA_FIREFOX_DOWNLOADS_LISTENER_INVALID", "firefox-downloads-subscribe", "downloads.subscribe");
			return T.add(t), b(() => {
				T.delete(t);
			});
		}
	});
	return Object.freeze({
		assertRequiredCapabilities: j,
		dispose() {
			if (f) return !1;
			f = !0, u = null, m = !1, h = 0, g = !1;
			let t;
			try {
				I();
			} catch (e) {
				t = e;
			}
			T.clear(), D.clear(), k.length = 0;
			try {
				E.dispose();
			} catch (e) {
				t ??= e;
			}
			if (d = null, t !== void 0) throw Kn(e, "FENNEVIA_FIREFOX_DOWNLOADS_DISPOSE_FAILED", "firefox-downloads-dispose", "DownloadList.removeView", t);
			return !0;
		},
		downloads: ae,
		ready() {
			return A(), L;
		},
		snapshot() {
			return Object.freeze({
				disposed: f,
				failed: p !== null,
				handleCount: E.snapshot().activeHandleCount,
				listKind: s,
				ready: v,
				revision: y,
				subscriberCount: T.size,
				viewRegistered: S
			});
		}
	});
}
//#endregion
//#region src/app/locale-state.ts
var er = Object.freeze(["en", "zh-Hant"]), tr = "en", nr = new Set(er), rr = (e) => {
	let t = Error(e);
	return t.name = "FenneviaLocaleStateError", Object.defineProperties(t, {
		fenneviaCode: {
			enumerable: !1,
			value: e
		},
		fenneviaPhase: {
			enumerable: !1,
			value: "locale-state"
		}
	}), t;
}, ir = (e) => e.trim().replaceAll("_", "-").toLowerCase(), ar = (e, t) => e === t || e.startsWith(`${t}-`);
function or(e) {
	return typeof e == "string" && nr.has(e);
}
function sr(e) {
	return typeof e != "string" || e.trim().length === 0 ? "en" : ar(ir(e), "zh") ? "zh-Hant" : "en";
}
function cr(e) {
	if (!e || typeof e != "object" || !or(e.id)) throw rr("FENNEVIA_LOCALE_STATE_SNAPSHOT_INVALID");
	return Object.freeze({ id: e.id });
}
function lr(e = "en") {
	if (!or(e)) throw rr("FENNEVIA_LOCALE_STATE_SNAPSHOT_INVALID");
	let t = Object.freeze({ id: e });
	return Object.freeze({
		snapshot() {
			return t;
		},
		subscribe() {
			return () => !1;
		}
	});
}
//#endregion
//#region src/app/i18n.ts
var ur = Object.freeze({
	en: {
		"address.close": "Close",
		"address.closeAria": "Close address and search",
		"address.empty": "Enter an address or search.",
		"address.enterHint": "Enter to open · Escape to cancel",
		"address.fieldLabel": "Enter an address or search",
		"address.firefoxControls": "Firefox controls",
		"address.loading": "The current page is loading.",
		"address.nativeAccess": "Open Firefox address bar",
		"address.openSitePermissions": "Open Firefox site permissions. {label}",
		"address.openTrust": "Open Firefox site trust. Connection: {connection}. Protection: {protection}",
		"address.placeholder": "Search or enter address",
		"address.privateBrowsing": "Private browsing",
		"address.productName": "Fennevia",
		"address.statusSitePermissions": "Site permissions",
		"address.statusTrust": "Site trust",
		"address.submitting": "Opening with Firefox…",
		"address.submissionFailed": "Firefox could not open this entry. Native controls remain available.",
		"address.title": "Address and search",
		"address.tooLong": "Keep the address or search under {max} characters.",
		"address.unsafeScheme": "Executable address schemes are not opened here.",
		"suggestions.count": "{count} Firefox suggestions available.",
		"suggestions.empty": "Firefox found no suggestions.",
		"suggestions.failed": "Firefox suggestions are unavailable. Enter still opens the typed value.",
		"suggestions.heuristicBadge": "Best match",
		"suggestions.listAria": "Firefox address-bar suggestions",
		"suggestions.loading": "Getting suggestions from Firefox…",
		"suggestions.nativeBadge": "Open in Firefox",
		"suggestions.nativeResult": "Continue in the full Firefox address bar",
		"suggestions.source.actions": "Firefox action",
		"suggestions.source.addon": "Extension",
		"suggestions.source.bookmarks": "Bookmark",
		"suggestions.source.history": "History",
		"suggestions.source.other-local": "Firefox",
		"suggestions.source.other-network": "Firefox service",
		"suggestions.source.search": "Search",
		"suggestions.source.tabs": "Open tab",
		"suggestions.source.unknown": "Firefox result",
		"bookmarks.collapseLimit": "Collapse a folder before opening another deep branch.",
		"bookmarks.collapseFolder": "Collapse folder",
		"bookmarks.contextMenuAria": "Bookmark actions",
		"bookmarks.emptyFolder": "No bookmarks here.",
		"bookmarks.error": "Bookmarks are unavailable. Native Firefox tools remain usable.",
		"bookmarks.folderChanged": "This folder changed or was removed.",
		"bookmarks.folderLoadError": "Couldn't load this folder.",
		"bookmarks.folderPages": "Folder pages",
		"bookmarks.expandFolder": "Expand folder",
		"bookmarks.listAria": "Bookmarks in selected location",
		"bookmarks.loading": "Loading bookmark locations…",
		"bookmarks.loadingShort": "Loading…",
		"bookmarks.locationTitle": "Bookmark location",
		"bookmarks.manage": "Manage bookmarks",
		"bookmarks.next": "Next",
		"bookmarks.openFailed": "Firefox could not open that bookmark.",
		"bookmarks.openCurrent": "Open",
		"bookmarks.openNewTab": "Open in new tab",
		"bookmarks.openNewTabAria": "Open {title} in a new tab",
		"bookmarks.pageRange": "{start}–{end} of {total}",
		"bookmarks.panelAria": "Bookmarks",
		"bookmarks.previous": "Previous",
		"bookmarks.retry": "Retry",
		"bookmarks.separator": "Separator",
		"bookmarks.stale": "That bookmark was removed or changed. The list is refreshing.",
		"bookmarks.unsupported": "Executable and data bookmark links are not opened here.",
		"bookmarks.untitledBookmark": "Untitled bookmark",
		"bookmarks.untitledFolder": "Untitled folder",
		"chrome.host.bottom": "Fennevia downloads surface",
		"chrome.host.frame": "Fennevia floating browser shell",
		"chrome.host.left": "Fennevia tabs and address surface",
		"chrome.host.overlay": "Fennevia address and search popup layer",
		"chrome.host.right": "Fennevia bookmarks surface",
		"chrome.host.top": "Fennevia top controls surface",
		"connection.associated.badge": "Linked",
		"connection.associated.label": "Security belongs to an associated page",
		"connection.certificate-error.badge": "Cert",
		"connection.certificate-error.label": "Certificate error",
		"connection.extension.badge": "Extension",
		"connection.extension.label": "Extension page",
		"connection.https-only-error.badge": "HTTPS",
		"connection.https-only-error.label": "HTTPS-Only Mode could not establish a secure connection",
		"connection.internal.badge": "Firefox",
		"connection.internal.label": "Secure Firefox page",
		"connection.local.badge": "Local",
		"connection.local.label": "Local or potentially trustworthy resource",
		"connection.network-error.badge": "Error",
		"connection.network-error.label": "Network error page",
		"connection.not-secure.badge": "HTTP",
		"connection.not-secure.label": "Connection is not secure",
		"connection.secure.badge": "HTTPS",
		"connection.secure.label": "Secure connection",
		"connection.secure-certificate-override.badge": "HTTPS",
		"connection.secure-certificate-override.label": "Secure connection using a certificate exception",
		"connection.secure-qualified-certificate.badge": "HTTPS",
		"connection.secure-qualified-certificate.label": "Secure connection with a qualified website certificate",
		"connection.secure-verified-organization.badge": "HTTPS",
		"connection.secure-verified-organization.label": "Secure connection with verified organization information",
		"connection.unavailable.badge": "Info",
		"connection.unavailable.label": "Connection information is unavailable",
		"customize.addWidgetAria": "Add {label} to the {zone} panel",
		"customize.addToPanel": "Add widgets to",
		"customize.autoHideDelay": "Hide after entering page",
		"customize.autoHideDelayHelp": "How long a panel remains visible after the pointer moves into page content or another area inside Firefox.",
		"customize.bottomDownloadsPanel": "Enable bottom Downloads panel",
		"customize.bottomPanel": "Enable Bottom panel",
		"customize.bottomProgressLight": "Bottom light",
		"customize.changeToColumn": "Change Row to Column",
		"customize.changeToRow": "Change Column to Row",
		"customize.closeAria": "Close customize panel",
		"customize.closeWidgetInspector": "Close widget settings",
		"customize.colorAccent": "Accent color",
		"customize.colorBorder": "Border color",
		"customize.colorCustomAria": "Custom {label} color",
		"customize.colorDefaultAria": "Default {label}",
		"customize.colorDefaultTitle": "Default",
		"customize.colorLabelAria": "{label} {color}",
		"customize.colorPanel": "Panel background",
		"customize.colorSwatchCustom": "Custom color",
		"customize.colorText": "Text color",
		"customize.colorWindow": "Window background",
		"customize.columnDropArea": "Column drop area",
		"customize.cleanPanels": "Clean all panels",
		"customize.cleanPanelsCancel": "Cancel",
		"customize.cleanPanelsConfirm": "Clean panels",
		"customize.cleanPanelsConfirmDescription": "This removes every widget, row, column, wrapper, and space from all four panels. Customize will remain in the Top panel, and panel settings will not change.",
		"customize.cleanPanelsConfirmTitle": "Clean all panels?",
		"customize.density": "Density",
		"customize.density.comfortable": "Comfortable",
		"customize.density.compact": "Compact",
		"customize.density.cozy": "Cozy",
		"customize.dragCompleted": "Moved {label} to the {zone} panel.",
		"customize.dragDestination": "Move {label} to the {zone} panel at position {position}.",
		"customize.editFailed": "That change could not be applied. The layout may have just changed; try again.",
		"customize.editNode": "Edit {label}",
		"customize.editNodeWithHint": "Configure {label}. Press Enter to open widget settings.",
		"customize.required": "Customize must remain on an enabled panel.",
		"customize.edgeTriggerSize": "Edge trigger size",
		"customize.edgeTriggerSizeHelp": "Width of the invisible edge target. Larger values are easier to hit but cover more of the page edge.",
		"customize.emptyPalette": "Every available widget is already placed. Drop a widget here to remove it from a panel.",
		"customize.emptyPanelDrop": "Drop widgets here or select this panel for keyboard adds",
		"customize.emptyPanelSelected": "This panel is now the keyboard add target.",
		"customize.followingFirefox": "Fennevia default layout",
		"customize.guide.bottomRecipeAria": "Bottom Row containing Expanded, then Center, then Download status.",
		"customize.guide.bottomRecipeDescription": "Expanded fills the Bottom Row; Center keeps the status in the middle.",
		"customize.guide.bottomRecipeTitle": "Centered bottom status",
		"customize.guide.centerDescription": "Centers one child in the room it receives. Pair it with Expanded when you want a centered child across the remaining area.",
		"customize.guide.columnDescription": "Places children from top to bottom and sets vertical behavior for feature widgets.",
		"customize.guide.companionsDescription": "The wide tile is the feature itself; the smaller tile beside it is the action people commonly use with that feature. Either can still be placed independently.",
		"customize.guide.companionsTitle": "Main features and their companions",
		"customize.guide.controls": "Controls",
		"customize.guide.editingAdd": "Click, Enter, or Space to append a widget; drag when you need an exact nested position.",
		"customize.guide.editingChoose": "Choose the destination panel in Widgets, or focus an edge panel to make it the target.",
		"customize.guide.editingInspect": "Select a placed widget, then use the floating inspector to move, wrap, change direction, style, or remove it.",
		"customize.guide.editingRecover": "Use Reset layout to restore the Fennevia default. Clean all panels is the separate minimal-layout action.",
		"customize.guide.editingTitle": "Add and edit without guesswork",
		"customize.guide.edgesIntro": "Every edge already provides its first flow, so you usually add widgets directly before adding a nested Row or Column.",
		"customize.guide.edgesTitle": "Each edge starts with a direction",
		"customize.guide.expandedDescription": "Gives one child the remaining space along its parent Row or Column. This is the usual wrapper for Address, Tabs, Bookmarks, and Download status.",
		"customize.guide.flexibleSpaceDescription": "Consumes remaining space as an empty gap and pushes later siblings toward the far edge.",
		"customize.guide.horizontalEdges": "Top and Bottom · Row",
		"customize.guide.horizontalEdgesDescription": "Children run left to right. Use Expanded around the one item that should grow wider.",
		"customize.guide.intro": "Fennevia layouts are ordered flows, not a freeform canvas. Set direction with Row or Column, then use a wrapper only when a child needs sizing, centering, or padding.",
		"customize.guide.kicker": "Layout basics",
		"customize.guide.layoutWidgetsIntro": "Layout widgets shape other widgets. They do not create a new browser feature or another edge panel.",
		"customize.guide.layoutWidgetsTitle": "What each layout widget does",
		"customize.guide.paddingDescription": "Adds one consistent Fennevia inset around a single child; it does not store a custom pixel value.",
		"customize.guide.recipesIntro": "These combinations match the sizing logic used by the default layout.",
		"customize.guide.recipesTitle": "Three useful recipes",
		"customize.guide.rowDescription": "Places children from left to right and sets horizontal behavior for feature widgets.",
		"customize.guide.separatorDescription": "Draws a visual divider between neighboring groups without taking remaining space.",
		"customize.guide.sideRecipeAria": "Side Column containing New Tab followed by Expanded Tabs.",
		"customize.guide.sideRecipeDescription": "New Tab stays intrinsic while Expanded lets the tab list use the remaining height.",
		"customize.guide.sideRecipeTitle": "Full-height side tabs",
		"customize.guide.spaceDescription": "Adds a fixed empty gap. Use Flexible space instead when the gap should grow.",
		"customize.guide.title": "Build a layout that behaves predictably",
		"customize.guide.tools": "Tools",
		"customize.guide.topRecipeAria": "Top Row containing Controls, Expanded Address launcher, and Tools.",
		"customize.guide.topRecipeDescription": "Controls and tools stay compact while Expanded gives Address the remaining width.",
		"customize.guide.topRecipeTitle": "Flexible top bar",
		"customize.guide.verticalEdges": "Left and Right · Column",
		"customize.guide.verticalEdgesDescription": "Children run top to bottom. Use Expanded around the one item that should grow taller.",
		"customize.interaction": "Interaction",
		"customize.interactionHelp": "These settings apply to all four edge panels. Focus, keyboard access, and open popups always keep a panel visible.",
		"customize.keyboardAdd": "Keyboard add targets the {zone} panel. Press Delete on a placed widget to remove it.",
		"customize.labelAccent": "Accent",
		"customize.labelBlur": "Blur",
		"customize.labelBorder": "Border",
		"customize.labelCorners": "Corners",
		"customize.labelMotion": "Motion",
		"customize.labelOpacity": "Opacity",
		"customize.labelPanels": "Panels",
		"customize.labelSaturate": "Saturate",
		"customize.labelShadow": "Shadow",
		"customize.labelSize": "Size",
		"customize.labelType": "Type",
		"customize.labelWindow": "Window",
		"customize.layoutCustomized": "Your Fennevia layout",
		"customize.multiplePlacements": "Allow compatible widgets in multiple positions",
		"customize.multiplePlacementsHelp": "Window controls and other compatible actions may be repeated. Tabs, bookmarks, download status, the address launcher, private indicator, and Customize remain single-instance. Rows, columns, Center, Expanded, Padding, separators, spaces, and flexible spaces are always repeatable.",
		"customize.moveAfter": "Move after",
		"customize.moveBefore": "Move before",
		"customize.moveIntoPrevious": "Move into previous layout group",
		"customize.moveOut": "Move out of container",
		"customize.nodeSelected": "Selected {label} for layout editing.",
		"customize.nodeSelectionCleared": "Layout selection cleared.",
		"customize.paletteAria": "Available widgets",
		"customize.paletteCategoriesAria": "Widget categories",
		"customize.paletteCategoryAll": "All",
		"customize.paletteCategoryBrowser": "Fennevia",
		"customize.paletteCategoryFeature": "Main features",
		"customize.paletteCategoryFirefox": "Firefox",
		"customize.paletteCategoryLayout": "Layout",
		"customize.paletteDestination": "Click adds to the {zone} panel",
		"customize.paletteDragHint": "Drag for precise placement, or click a widget to add it to the selected panel.",
		"customize.paletteFilterCount": "{count} widgets shown",
		"customize.paletteNoResults": "No widgets match this search and category.",
		"customize.paletteSearch": "Search widgets",
		"customize.paletteSearchPlaceholder": "Search available widgets",
		"customize.panelAria": "Customize Fennevia shell",
		"customize.panelDodge.multipleDynamic": "Multiple panels · Dynamic clearance",
		"customize.panelDodge.multipleReserved": "Multiple panels · Reserved edge lanes",
		"customize.panelDodge.singleDynamic": "Single panel · Dynamic clearance",
		"customize.panelDodge.singleReserved": "Single panel · Reserved edge lanes",
		"customize.panelDodgeHelp": "Dynamic clearance avoids only visible neighbors. Reserved lanes always leave room for enabled adjacent panels. New tabs may briefly reveal Tabs in either single-panel mode.",
		"customize.panelDodgeMode": "Panel reveal and clearance",
		"customize.panelLayoutAria": "{zone} panel layout",
		"customize.allowCompactWindow": "Allow smaller than Firefox minimum window size",
		"customize.allowCompactWindowHelp": "Firefox chrome normally refuses to shrink below its official minimum. Enable this to resize smaller while Fennevia is active. Caption buttons and some chrome may clip. The operating system still keeps its own floor.",
		"customize.panels": "Panels and progress lights",
		"customize.panelsHelp": "Enable the optional Left, Right, and Bottom panels, choose what each gutter light reports, or allow a smaller-than-Firefox window size. The Top panel always remains enabled.",
		"customize.progressLight.downloads": "Downloads",
		"customize.progressLight.loading": "Page loading",
		"customize.progressLight.off": "Off",
		"customize.resetLayout": "Reset layout",
		"customize.resetPanels": "Reset panels and lights",
		"customize.resetStyle": "Reset appearance and interaction",
		"customize.removeNode": "Remove from layout",
		"customize.rowDropArea": "Row drop area",
		"customize.shortcutHintDuration": "Shortcut tips",
		"customize.shortcutHintDurationHelp": "How long keyboard shortcut tips stay visible when an edge panel opens. Set to 0 to hide them entirely.",
		"customize.shortcutHintOff": "Off",
		"customize.sidePanels": "Side panel roles",
		"customize.sidePanels.tabsLeft": "Tabs left · bookmarks right",
		"customize.sidePanels.tabsRight": "Bookmarks left · tabs right",
		"customize.leftPanel": "Enable Left panel",
		"customize.rightPanel": "Enable Right panel",
		"customize.style": "Appearance",
		"customize.tab.appearance": "Appearance",
		"customize.tab.guide": "Guide",
		"customize.tab.interaction": "Interaction",
		"customize.tab.panels": "Panels",
		"customize.tab.widgets": "Widgets",
		"customize.tabsAria": "Customize sections",
		"customize.styleBlur": "Glass blur",
		"customize.styleFontSize": "Font size",
		"customize.styleMotion": "Motion duration",
		"customize.styleOpacity": "Surface opacity",
		"customize.styleRadius": "Corner radius",
		"customize.styleSaturation": "Glass saturation",
		"customize.styleShadow": "Shadow intensity",
		"customize.temporaryRevealDuration": "Temporary reveal",
		"customize.temporaryRevealDurationHelp": "How long actions such as Show bookmarks reveal a panel when it is not otherwise held.",
		"customize.topProgressLight": "Top light",
		"customize.theme": "Theme",
		"customize.theme.auto": "Auto",
		"customize.theme.dark": "Dark",
		"customize.theme.light": "Light",
		"customize.windowLeaveHideDelay": "Hide after leaving window",
		"customize.windowLeaveHideDelayHelp": "How long a panel remains visible after the pointer leaves the Firefox window.",
		"customize.widgetStyle": "Style",
		"customize.widgetStyleAddressOnly": "Address only",
		"customize.widgetStyleChanged": "Changed {label} style to {style}.",
		"customize.widgetStyleFor": "Style for {label}",
		"customize.widgetStyleTabsOnly": "Tabs only",
		"customize.widgetStyleWithNewTab": "Tabs with New Tab button",
		"customize.widgetStyleWithSiteStatus": "Address with site status",
		"customize.widgetWorkflow": "Choose a destination, then click a widget to append it or drag for exact placement. Select a placed widget to open its layout inspector.",
		"customize.widgetInspectorAria": "Settings for {label}",
		"customize.widgetInspectorToolbar": "Layout actions for {label}",
		"customize.wrapperDropArea": "{label} drop area",
		"customize.title": "Customize Fennevia",
		"customize.unavailable": "Customization is unavailable in this window. The fixed Fennevia controls and native Firefox customize mode remain usable.",
		"customize.zone.bottom": "bottom",
		"customize.zone.left": "left",
		"customize.zone.right": "right",
		"customize.zone.top": "top",
		"downloads.activeOne": "{count} download active",
		"downloads.activeOther": "{count} downloads active",
		"downloads.canceled": "Canceled",
		"downloads.canceledOne": "{count} download canceled",
		"downloads.canceledOther": "{count} downloads canceled",
		"downloads.detailCanceled": "No transfer is active",
		"downloads.detailFailed": "Use Firefox Downloads for details",
		"downloads.detailFinished": "No transfer is active",
		"downloads.detailIdle": "The surface stays quiet until needed",
		"downloads.detailIndeterminate": "Total size is not yet known",
		"downloads.detailLoading": "Waiting for the native list",
		"downloads.detailOverall": "{percent}% overall",
		"downloads.detailPaused": "Resume from Firefox when ready",
		"downloads.detailQueued": "Waiting to start",
		"downloads.downloading": "Downloading",
		"downloads.failed": "Failed",
		"downloads.failedOne": "{count} recent failure",
		"downloads.failedOther": "{count} recent failures",
		"downloads.finished": "Finished",
		"downloads.finishedOne": "{count} download finished",
		"downloads.finishedOther": "{count} downloads finished",
		"downloads.idle": "Idle",
		"downloads.itemAria": "Download {index}: {label}",
		"downloads.itemAriaPercent": "Download {index}: {label}, {percent}%",
		"downloads.itemTitlePercent": "{label} · {percent}%",
		"downloads.itemsAria": "Current and recent download states",
		"downloads.loading": "Loading downloads",
		"downloads.moreAria": "More downloads are not shown",
		"downloads.none": "No active downloads",
		"downloads.panelAria": "Download progress",
		"downloads.paused": "Paused",
		"downloads.pausedOne": "{count} download paused",
		"downloads.pausedOther": "{count} downloads paused",
		"downloads.progressDeterminate": "Overall download progress: {percent}%",
		"downloads.progressUnknown": "Overall download progress: unknown total size",
		"downloads.queued": "Queued",
		"downloads.queuedOne": "{count} download queued",
		"downloads.queuedOther": "{count} downloads queued",
		"nav.back": "Back",
		"nav.backAria": "Go back",
		"nav.browserToolbar": "Browser toolbar",
		"nav.customizeAria": "Customize Fennevia shell",
		"nav.customizeTitle": "Customize Fennevia",
		"nav.extensions": "Extensions",
		"nav.extensionsAria": "Open Firefox extensions",
		"nav.firefoxMenu": "Firefox menu",
		"nav.firefoxMenuAria": "Open Firefox menu",
		"nav.firefoxTools": "Firefox tools",
		"nav.forward": "Forward",
		"nav.forwardAria": "Go forward",
		"nav.home": "Home",
		"nav.homeAria": "Go to home page",
		"nav.keyboardShortcut": "Keyboard shortcut",
		"nav.launcherAria": "Address and site status",
		"nav.openAddress": "Open address and search",
		"nav.openTrust": "Open Firefox site trust. Connection: {connection}. Protection: {protection}",
		"nav.primaryNavigation": "Primary navigation",
		"nav.private": "Private",
		"nav.reload": "Reload",
		"nav.reloadAria": "Reload page",
		"nav.settings": "Settings",
		"nav.settingsAria": "Open Firefox settings",
		"nav.stop": "Stop",
		"nav.stopAria": "Stop loading",
		"panelContext.aria": "{edge} actions",
		"panelContext.customizeFennevia": "Customize Fennevia",
		"panelContext.customizeFirefox": "Customize Firefox toolbar",
		"panelContext.nativeToolbar": "Show original Firefox toolbar",
		"panelContext.newTab": "New tab",
		"panelContext.openDownloads": "Open Firefox Downloads",
		"panelContext.settings": "Firefox settings",
		"permission.blocked.autoplay": "Autoplay blocked",
		"permission.blocked.camera": "Camera blocked",
		"permission.blocked.canvas": "Canvas access blocked",
		"permission.blocked.install": "Add-on install blocked",
		"permission.blocked.local-network": "Local network blocked",
		"permission.blocked.location": "Location blocked",
		"permission.blocked.loopback-network": "Loopback network access blocked",
		"permission.blocked.microphone": "Microphone blocked",
		"permission.blocked.midi": "MIDI blocked",
		"permission.blocked.notifications": "Notifications blocked",
		"permission.blocked.persistent-storage": "Persistent storage blocked",
		"permission.blocked.popups": "Pop-up or redirect blocked",
		"permission.blocked.screen": "Screen sharing blocked",
		"permission.blocked.serial": "Serial device blocked",
		"permission.blocked.xr": "XR access blocked",
		"permission.indicatorsAria": "Firefox permission indicators",
		"permission.sharing.location": "Location in use",
		"permission.sharing.media": "Camera, microphone, or screen in use",
		"permission.sharing.serial": "Serial device in use",
		"permission.sharing.xr": "XR device in use",
		"permission.site.badgeActive": "In use",
		"permission.site.badgeIdle": "Permissions",
		"permission.site.badgeUnavailable": "Permissions —",
		"permission.site.labelActive": "Firefox reports an active site capability",
		"permission.site.labelBlocked": "Firefox is blocking one or more site capabilities",
		"permission.site.labelGranted": "Firefox has site-specific permissions for this page",
		"permission.site.labelNone": "No site permission indicator is active",
		"permission.site.labelUnavailable": "Site permission information is not available for this page",
		"protection.blocking.badge": "ETP",
		"protection.blocking.label": "Enhanced Tracking Protection is blocking known trackers",
		"protection.detected.badge": "ETP",
		"protection.detected.label": "Trackers were detected but none are currently blocked",
		"protection.exception.badge": "ETP off",
		"protection.exception.label": "Enhanced Tracking Protection is disabled for this site",
		"protection.no-trackers-detected.badge": "ETP",
		"protection.no-trackers-detected.label": "No known trackers detected",
		"protection.unavailable.badge": "ETP —",
		"protection.unavailable.label": "Enhanced Tracking Protection is not available for this page",
		"trust.summary": "{connection} · {protection}",
		"surface.bottom": "Downloads",
		"surface.bookmarks": "Bookmarks",
		"surface.left": "Tabs and address",
		"surface.right": "Bookmarks",
		"surface.tabs": "Tabs and address",
		"surface.top": "Browser controls",
		"tab.allowMedia": "Allow media for",
		"tab.attention": "Attention",
		"tab.cameraInUse": "Using camera",
		"tab.close": "Close",
		"tab.closeCount": "Close {count} tabs",
		"tab.closeTab": "Close tab",
		"tab.crashed": "Crashed",
		"tab.dragPreview": "Moving tab",
		"tab.indexOf": "{index} of {total}",
		"tab.loading": "Loading",
		"tab.mediaBlocked": "Media blocked",
		"tab.microphoneInUse": "Using microphone",
		"tab.mute": "Mute",
		"tab.muted": "Muted",
		"tab.newTab": "New tab",
		"tab.newTabAria": "Open new tab",
		"tab.openCount": "{count} open tabs",
		"tab.openHeading": "Open tabs",
		"tab.pin": "Pin",
		"tab.pinTab": "Pin tab",
		"tab.pinned": "Pinned",
		"tab.pinnedCount": "Pinned tabs ({count})",
		"tab.pip": "Picture in picture",
		"tab.playing": "Playing",
		"tab.reordered": "Moved {title} to position {index} of {total}",
		"tab.screenSharing": "Sharing screen",
		"tab.unmute": "Unmute",
		"tab.unpin": "Unpin",
		"tab.unpinTab": "Unpin tab",
		"tab.untitled": "Untitled tab",
		"widget.dropHere": "Drop widgets here",
		"widget.row": "Row",
		"widget.column": "Column",
		"widget.center": "Center",
		"widget.expanded": "Expanded",
		"widget.padding": "Padding",
		"widget.addressLauncher": "Address launcher",
		"widget.downloadStatus": "Download status",
		"widget.privateIndicator": "Private browsing",
		"widget.tabs": "Tabs",
		"widget.trust": "Site trust",
		"widget.droppableAria": "{zone} panel widgets, droppable",
		"widget.fenneviaControl": "Fennevia control",
		"widget.flexibleSpace": "Flexible space",
		"widget.separator": "Separator",
		"widget.showBookmarks": "Show bookmarks panel",
		"widget.showBookmarksTooltip": "Reveal the Fennevia bookmarks panel",
		"widget.showDownloads": "Open Firefox downloads",
		"widget.showDownloadsTooltip": "Open the Firefox downloads panel",
		"widget.showTranslate": "Translate this page",
		"widget.showTranslateTooltip": "Open Firefox built-in translations",
		"widget.space": "Space",
		"widget.toolbarItem": "Toolbar item",
		"widget.toolbarShortcuts": "Toolbar shortcuts",
		"widget.unavailableSuffix": "{label} (unavailable)",
		"window.close": "Close",
		"window.closeAria": "Close window",
		"window.controls": "Window controls",
		"window.maximize": "Maximize",
		"window.maximizeAria": "Maximize window",
		"window.minimize": "Minimize",
		"window.minimizeAria": "Minimize window",
		"window.restore": "Restore",
		"window.restoreAria": "Restore window"
	},
	"zh-Hant": {
		"address.close": "關閉",
		"address.closeAria": "關閉網址與搜尋",
		"address.empty": "請輸入網址或搜尋。",
		"address.enterHint": "Enter 開啟 · Escape 取消",
		"address.fieldLabel": "輸入網址或搜尋",
		"address.firefoxControls": "Firefox 控制",
		"address.loading": "目前頁面正在載入。",
		"address.nativeAccess": "開啟 Firefox 網址列",
		"address.openSitePermissions": "開啟 Firefox 網站權限。{label}",
		"address.openTrust": "開啟 Firefox 網站信任。連線：{connection}。保護：{protection}",
		"address.placeholder": "搜尋或輸入網址",
		"address.privateBrowsing": "隱私瀏覽",
		"address.productName": "Fennevia",
		"address.statusSitePermissions": "網站權限",
		"address.statusTrust": "網站信任",
		"address.submitting": "正在以 Firefox 開啟…",
		"address.submissionFailed": "Firefox 無法開啟此項目。原生控制項仍可使用。",
		"address.title": "網址與搜尋",
		"address.tooLong": "請將網址或搜尋控制在 {max} 個字元以內。",
		"address.unsafeScheme": "不會在此開啟可執行的網址配置。",
		"suggestions.count": "有 {count} 個 Firefox 建議可用。",
		"suggestions.empty": "Firefox 找不到建議。",
		"suggestions.failed": "Firefox 建議目前無法使用。按 Enter 仍可開啟輸入內容。",
		"suggestions.heuristicBadge": "最佳結果",
		"suggestions.listAria": "Firefox 網址列建議",
		"suggestions.loading": "正在向 Firefox 取得建議…",
		"suggestions.nativeBadge": "在 Firefox 開啟",
		"suggestions.nativeResult": "在完整 Firefox 網址列中繼續",
		"suggestions.source.actions": "Firefox 動作",
		"suggestions.source.addon": "擴充功能",
		"suggestions.source.bookmarks": "書籤",
		"suggestions.source.history": "瀏覽紀錄",
		"suggestions.source.other-local": "Firefox",
		"suggestions.source.other-network": "Firefox 服務",
		"suggestions.source.search": "搜尋",
		"suggestions.source.tabs": "已開啟分頁",
		"suggestions.source.unknown": "Firefox 結果",
		"bookmarks.collapseLimit": "請先收合一個資料夾，再開啟另一個深層分支。",
		"bookmarks.collapseFolder": "收合資料夾",
		"bookmarks.contextMenuAria": "書籤操作",
		"bookmarks.emptyFolder": "這裡沒有書籤。",
		"bookmarks.error": "書籤無法使用。原生 Firefox 工具仍可使用。",
		"bookmarks.folderChanged": "此資料夾已變更或被移除。",
		"bookmarks.folderLoadError": "無法載入此資料夾。",
		"bookmarks.folderPages": "資料夾分頁",
		"bookmarks.expandFolder": "展開資料夾",
		"bookmarks.listAria": "所選位置中的書籤",
		"bookmarks.loading": "正在載入書籤位置…",
		"bookmarks.loadingShort": "載入中…",
		"bookmarks.locationTitle": "書籤位置",
		"bookmarks.manage": "管理書籤",
		"bookmarks.next": "下一頁",
		"bookmarks.openFailed": "Firefox 無法開啟該書籤。",
		"bookmarks.openCurrent": "開啟",
		"bookmarks.openNewTab": "在新分頁開啟",
		"bookmarks.openNewTabAria": "在新分頁開啟 {title}",
		"bookmarks.pageRange": "{start}–{end} / 共 {total}",
		"bookmarks.panelAria": "書籤",
		"bookmarks.previous": "上一頁",
		"bookmarks.retry": "重試",
		"bookmarks.separator": "分隔線",
		"bookmarks.stale": "該書籤已移除或變更。清單正在重新整理。",
		"bookmarks.unsupported": "不會在此開啟可執行或資料類型的書籤連結。",
		"bookmarks.untitledBookmark": "未命名書籤",
		"bookmarks.untitledFolder": "未命名資料夾",
		"chrome.host.bottom": "Fennevia 下載面板",
		"chrome.host.frame": "Fennevia 浮動瀏覽器介面",
		"chrome.host.left": "Fennevia 分頁與網址面板",
		"chrome.host.overlay": "Fennevia 網址與搜尋彈出層",
		"chrome.host.right": "Fennevia 書籤面板",
		"chrome.host.top": "Fennevia 頂部控制面板",
		"connection.associated.badge": "關聯",
		"connection.associated.label": "安全性屬於關聯頁面",
		"connection.certificate-error.badge": "憑證",
		"connection.certificate-error.label": "憑證錯誤",
		"connection.extension.badge": "擴充功能",
		"connection.extension.label": "擴充功能頁面",
		"connection.https-only-error.badge": "HTTPS",
		"connection.https-only-error.label": "僅 HTTPS 模式無法建立安全連線",
		"connection.internal.badge": "Firefox",
		"connection.internal.label": "安全的 Firefox 頁面",
		"connection.local.badge": "本機",
		"connection.local.label": "本機或可能可信的資源",
		"connection.network-error.badge": "錯誤",
		"connection.network-error.label": "網路錯誤頁面",
		"connection.not-secure.badge": "HTTP",
		"connection.not-secure.label": "連線不安全",
		"connection.secure.badge": "HTTPS",
		"connection.secure.label": "安全連線",
		"connection.secure-certificate-override.badge": "HTTPS",
		"connection.secure-certificate-override.label": "使用憑證例外的安全連線",
		"connection.secure-qualified-certificate.badge": "HTTPS",
		"connection.secure-qualified-certificate.label": "具合格網站憑證的安全連線",
		"connection.secure-verified-organization.badge": "HTTPS",
		"connection.secure-verified-organization.label": "具已驗證組織資訊的安全連線",
		"connection.unavailable.badge": "資訊",
		"connection.unavailable.label": "無法取得連線資訊",
		"customize.addWidgetAria": "將 {label} 加到{zone}面板",
		"customize.addToPanel": "將元件加入",
		"customize.autoHideDelay": "移入網頁後隱藏",
		"customize.autoHideDelayHelp": "指標從面板移入網頁內容或 Firefox 視窗內其他區域後，面板繼續顯示的時間。",
		"customize.bottomDownloadsPanel": "啟用底部下載面板",
		"customize.bottomPanel": "啟用底部面板",
		"customize.bottomProgressLight": "底部光條",
		"customize.changeToColumn": "將橫列改為直欄",
		"customize.changeToRow": "將直欄改為橫列",
		"customize.closeAria": "關閉自訂面板",
		"customize.closeWidgetInspector": "關閉元件設定",
		"customize.colorAccent": "強調色",
		"customize.colorBorder": "邊框顏色",
		"customize.colorCustomAria": "自訂{label}顏色",
		"customize.colorDefaultAria": "預設{label}",
		"customize.colorDefaultTitle": "預設",
		"customize.colorLabelAria": "{label} {color}",
		"customize.colorPanel": "面板背景",
		"customize.colorSwatchCustom": "自訂顏色",
		"customize.colorText": "文字顏色",
		"customize.colorWindow": "視窗背景",
		"customize.columnDropArea": "直欄放置區",
		"customize.cleanPanels": "清空所有面板",
		"customize.cleanPanelsCancel": "取消",
		"customize.cleanPanelsConfirm": "確認清空",
		"customize.cleanPanelsConfirmDescription": "這會移除四個面板中的所有元件、Row、Column、包裝元件與空白。自訂按鈕會保留在頂部面板，面板設定不會變更。",
		"customize.cleanPanelsConfirmTitle": "要清空所有面板嗎？",
		"customize.density": "密度",
		"customize.density.comfortable": "寬鬆",
		"customize.density.compact": "緊湊",
		"customize.density.cozy": "適中",
		"customize.dragCompleted": "已將{label}移到{zone}面板。",
		"customize.dragDestination": "將{label}移到{zone}面板第 {position} 個位置。",
		"customize.editFailed": "無法套用該變更。版面可能剛改變，請再試一次。",
		"customize.editNode": "編輯{label}",
		"customize.editNodeWithHint": "設定{label}。按 Enter 開啟元件設定。",
		"customize.required": "必須在已啟用的面板中保留「自訂」元件。",
		"customize.edgeTriggerSize": "邊緣觸發區",
		"customize.edgeTriggerSizeHelp": "隱形邊緣目標的寬度。數值越大越容易觸發，但會覆蓋較多網頁邊緣。",
		"customize.emptyPalette": "所有可用元件都已放置。將元件拖到這裡可從面板移除。",
		"customize.emptyPanelDrop": "將元件拖到這裡，或選取此面板作為鍵盤新增目標",
		"customize.emptyPanelSelected": "此面板現在是鍵盤新增目標。",
		"customize.followingFirefox": "Fennevia 預設版面",
		"customize.guide.bottomRecipeAria": "底部橫列依序包含延展、置中與下載狀態。",
		"customize.guide.bottomRecipeDescription": "延展會填滿底部橫列，置中則讓下載狀態保持在中央。",
		"customize.guide.bottomRecipeTitle": "置中的底部狀態",
		"customize.guide.centerDescription": "將一個子元件放在所得空間的中央。若要讓子元件在剩餘區域中央顯示，可在外層再加延展。",
		"customize.guide.columnDescription": "由上到下排列子元件，並讓主要功能採用垂直呈現方式。",
		"customize.guide.companionsDescription": "較寬的方塊是功能本身，旁邊較小的方塊則是常與它搭配的操作；兩者仍可各自獨立放置。",
		"customize.guide.companionsTitle": "主要功能與伴隨操作",
		"customize.guide.controls": "控制項",
		"customize.guide.editingAdd": "點選或按 Enter／空白鍵可附加元件；需要精確的巢狀位置時再使用拖曳。",
		"customize.guide.editingChoose": "先在「元件」中選擇目標面板，或將焦點移到邊緣面板以指定目標。",
		"customize.guide.editingInspect": "選取已放置的元件，再用浮動檢查器移動、包裝、切換方向、變更樣式或移除。",
		"customize.guide.editingRecover": "使用「重設版面」還原 Fennevia 預設；「清空所有面板」則是另一個最小版面操作。",
		"customize.guide.editingTitle": "清楚地新增與編輯",
		"customize.guide.edgesIntro": "每個邊緣已經提供第一層排列方式，通常可直接加入元件，不必先建立巢狀橫列或直欄。",
		"customize.guide.edgesTitle": "每個邊緣都有預設方向",
		"customize.guide.expandedDescription": "讓一個子元件取得父層橫列或直欄的剩餘空間。網址列、分頁、書籤與下載狀態通常會搭配它使用。",
		"customize.guide.flexibleSpaceDescription": "以可延展的空白吃掉剩餘空間，並將後面的同層元件推向另一端。",
		"customize.guide.horizontalEdges": "頂部與底部・橫列",
		"customize.guide.horizontalEdgesDescription": "子元件由左到右排列。將唯一需要變寬的元件包在「延展」中。",
		"customize.guide.intro": "Fennevia 版面是有順序的排列流程，不是任意座標畫布。先用橫列或直欄決定方向，只在子元件需要尺寸、置中或內距時加入包裝元件。",
		"customize.guide.kicker": "版面基礎",
		"customize.guide.layoutWidgetsIntro": "版面元件只負責排列其他元件，不會建立新的瀏覽器功能或另一個邊緣面板。",
		"customize.guide.layoutWidgetsTitle": "各種版面元件的用途",
		"customize.guide.paddingDescription": "在單一子元件四周加入一致的 Fennevia 內距，不會儲存自訂像素值。",
		"customize.guide.recipesIntro": "以下組合與預設版面使用相同的尺寸邏輯。",
		"customize.guide.recipesTitle": "三個實用組合",
		"customize.guide.rowDescription": "由左到右排列子元件，並讓主要功能採用水平呈現方式。",
		"customize.guide.separatorDescription": "在相鄰群組之間畫出分隔線，但不會取得剩餘空間。",
		"customize.guide.sideRecipeAria": "側邊直欄包含新增分頁，接著是包在延展中的分頁。",
		"customize.guide.sideRecipeDescription": "新增分頁維持原始大小，延展則讓分頁清單使用剩餘高度。",
		"customize.guide.sideRecipeTitle": "填滿高度的側邊分頁",
		"customize.guide.spaceDescription": "加入固定大小的空白；若空白需要自動延展，請改用彈性空白。",
		"customize.guide.title": "建立行為可預期的版面",
		"customize.guide.tools": "工具",
		"customize.guide.topRecipeAria": "頂部橫列包含控制項、包在延展中的網址列，以及工具。",
		"customize.guide.topRecipeDescription": "控制項與工具維持緊湊，延展則讓網址列取得剩餘寬度。",
		"customize.guide.topRecipeTitle": "可延展的頂部列",
		"customize.guide.verticalEdges": "左側與右側・直欄",
		"customize.guide.verticalEdgesDescription": "子元件由上到下排列。將唯一需要變高的元件包在「延展」中。",
		"customize.interaction": "互動",
		"customize.interactionHelp": "這些設定會套用到四個邊緣面板。面板取得焦點、經鍵盤開啟或有彈出面板時，將一律保持顯示。",
		"customize.keyboardAdd": "鍵盤新增會放到{zone}面板。在已放置的元件上按 Delete 可移除。",
		"customize.labelAccent": "強調",
		"customize.labelBlur": "模糊",
		"customize.labelBorder": "邊框",
		"customize.labelCorners": "圓角",
		"customize.labelMotion": "動畫",
		"customize.labelOpacity": "不透明度",
		"customize.labelPanels": "面板",
		"customize.labelSaturate": "飽和",
		"customize.labelShadow": "陰影",
		"customize.labelSize": "大小",
		"customize.labelType": "文字",
		"customize.labelWindow": "視窗",
		"customize.layoutCustomized": "你的 Fennevia 版面",
		"customize.multiplePlacements": "允許相容元件出現在多個位置",
		"customize.multiplePlacementsHelp": "視窗控制與其他相容動作可重複放置；分頁、書籤、下載狀態、網址啟動器、隱私指示與自訂按鈕仍為單一實例。Row、Column、置中、延展、內距、分隔線、空白與彈性空白永遠可重複。",
		"customize.moveAfter": "向後移動",
		"customize.moveBefore": "向前移動",
		"customize.moveIntoPrevious": "移入前一個版面群組",
		"customize.moveOut": "移出容器",
		"customize.nodeSelected": "已選取{label}以編輯版面。",
		"customize.nodeSelectionCleared": "已清除版面選取。",
		"customize.paletteAria": "可用元件",
		"customize.paletteCategoriesAria": "元件分類",
		"customize.paletteCategoryAll": "全部",
		"customize.paletteCategoryBrowser": "Fennevia",
		"customize.paletteCategoryFeature": "主要功能",
		"customize.paletteCategoryFirefox": "Firefox",
		"customize.paletteCategoryLayout": "版面",
		"customize.paletteDestination": "點選會加入{zone}面板",
		"customize.paletteDragHint": "拖曳可精確放置，或點選元件將它加入目前選取的面板。",
		"customize.paletteFilterCount": "顯示 {count} 個元件",
		"customize.paletteNoResults": "沒有符合此搜尋與分類的元件。",
		"customize.paletteSearch": "搜尋元件",
		"customize.paletteSearchPlaceholder": "搜尋可用元件",
		"customize.panelAria": "自訂 Fennevia 介面",
		"customize.panelDodge.multipleDynamic": "多面板・動態避讓",
		"customize.panelDodge.multipleReserved": "多面板・固定保留邊緣空間",
		"customize.panelDodge.singleDynamic": "單一面板・動態避讓",
		"customize.panelDodge.singleReserved": "單一面板・固定保留邊緣空間",
		"customize.panelDodgeHelp": "動態避讓只避開目前顯示的相鄰面板；固定保留會持續為已啟用的相鄰面板留空。兩種單一面板模式仍會在新增分頁時短暫顯示分頁列。",
		"customize.panelDodgeMode": "面板顯示與避讓方式",
		"customize.panelLayoutAria": "{zone}面板版面",
		"customize.allowCompactWindow": "允許小於 Firefox 官方下限的視窗尺寸",
		"customize.allowCompactWindowHelp": "Firefox 通常不允許視窗小於官方 chrome 下限。開啟後，Fennevia 啟用期間可以縮得更小。標題列按鈕與部分介面可能被裁切。作業系統仍會保留自己的下限。",
		"customize.panels": "面板與進度光條",
		"customize.panelsHelp": "啟用可選的左側、右側與底部面板，指定上下光條要顯示的狀態，或允許小於 Firefox 官方下限的視窗。頂部面板會永遠保持啟用。",
		"customize.progressLight.downloads": "下載進度",
		"customize.progressLight.loading": "網頁載入",
		"customize.progressLight.off": "關閉",
		"customize.resetLayout": "重設版面",
		"customize.resetPanels": "重設面板與光條",
		"customize.resetStyle": "重設外觀與互動",
		"customize.removeNode": "從版面移除",
		"customize.rowDropArea": "橫列放置區",
		"customize.shortcutHintDuration": "快速鍵提示",
		"customize.shortcutHintDurationHelp": "邊緣面板開啟時，鍵盤快速鍵提示要顯示多久。設為 0 可完全隱藏提示。",
		"customize.shortcutHintOff": "不顯示",
		"customize.sidePanels": "左右面板用途",
		"customize.sidePanels.tabsLeft": "左側分頁 · 右側書籤",
		"customize.sidePanels.tabsRight": "左側書籤 · 右側分頁",
		"customize.leftPanel": "啟用左側面板",
		"customize.rightPanel": "啟用右側面板",
		"customize.style": "外觀",
		"customize.tab.appearance": "外觀",
		"customize.tab.guide": "指南",
		"customize.tab.interaction": "互動",
		"customize.tab.panels": "面板",
		"customize.tab.widgets": "元件",
		"customize.tabsAria": "自訂區段",
		"customize.styleBlur": "玻璃模糊",
		"customize.styleFontSize": "字型大小",
		"customize.styleMotion": "動畫時長",
		"customize.styleOpacity": "表面不透明度",
		"customize.styleRadius": "圓角半徑",
		"customize.styleSaturation": "玻璃飽和度",
		"customize.styleShadow": "陰影強度",
		"customize.temporaryRevealDuration": "暫時顯示",
		"customize.temporaryRevealDurationHelp": "「顯示書籤」等動作在沒有其他保持狀態時，讓面板顯示多久。",
		"customize.topProgressLight": "頂部光條",
		"customize.theme": "主題",
		"customize.theme.auto": "自動",
		"customize.theme.dark": "深色",
		"customize.theme.light": "淺色",
		"customize.windowLeaveHideDelay": "離開視窗後隱藏",
		"customize.windowLeaveHideDelayHelp": "指標離開 Firefox 視窗後，面板繼續顯示的時間。",
		"customize.widgetStyle": "樣式",
		"customize.widgetStyleAddressOnly": "僅網址列",
		"customize.widgetStyleChanged": "已將{label}樣式改為「{style}」。",
		"customize.widgetStyleFor": "{label}的樣式",
		"customize.widgetStyleTabsOnly": "僅分頁",
		"customize.widgetStyleWithNewTab": "分頁與新增分頁按鈕",
		"customize.widgetStyleWithSiteStatus": "網址列與網站狀態",
		"customize.widgetWorkflow": "先選擇目標面板，再點選元件將它附加到末端，或拖曳到精確位置。選取已放置的元件可開啟版面檢查器。",
		"customize.widgetInspectorAria": "{label}的設定",
		"customize.widgetInspectorToolbar": "{label}的版面操作",
		"customize.wrapperDropArea": "{label}放置區",
		"customize.title": "自訂 Fennevia",
		"customize.unavailable": "此視窗無法自訂。固定的 Fennevia 控制項與原生 Firefox 自訂模式仍可使用。",
		"customize.zone.bottom": "底部",
		"customize.zone.left": "左側",
		"customize.zone.right": "右側",
		"customize.zone.top": "頂部",
		"downloads.activeOne": "{count} 個下載進行中",
		"downloads.activeOther": "{count} 個下載進行中",
		"downloads.canceled": "已取消",
		"downloads.canceledOne": "{count} 個下載已取消",
		"downloads.canceledOther": "{count} 個下載已取消",
		"downloads.detailCanceled": "目前沒有傳輸",
		"downloads.detailFailed": "請使用 Firefox 下載管理查看詳細資料",
		"downloads.detailFinished": "目前沒有傳輸",
		"downloads.detailIdle": "有需要時才會顯示此面板",
		"downloads.detailIndeterminate": "尚不知道總大小",
		"downloads.detailLoading": "正在等待原生清單",
		"downloads.detailOverall": "整體 {percent}%",
		"downloads.detailPaused": "就緒後請從 Firefox 繼續",
		"downloads.detailQueued": "等待開始",
		"downloads.downloading": "下載中",
		"downloads.failed": "失敗",
		"downloads.failedOne": "{count} 個最近失敗",
		"downloads.failedOther": "{count} 個最近失敗",
		"downloads.finished": "已完成",
		"downloads.finishedOne": "{count} 個下載已完成",
		"downloads.finishedOther": "{count} 個下載已完成",
		"downloads.idle": "閒置",
		"downloads.itemAria": "下載 {index}：{label}",
		"downloads.itemAriaPercent": "下載 {index}：{label}，{percent}%",
		"downloads.itemTitlePercent": "{label} · {percent}%",
		"downloads.itemsAria": "目前與最近的下載狀態",
		"downloads.loading": "正在載入下載",
		"downloads.moreAria": "還有下載未顯示",
		"downloads.none": "沒有進行中的下載",
		"downloads.panelAria": "下載進度",
		"downloads.paused": "已暫停",
		"downloads.pausedOne": "{count} 個下載已暫停",
		"downloads.pausedOther": "{count} 個下載已暫停",
		"downloads.progressDeterminate": "整體下載進度：{percent}%",
		"downloads.progressUnknown": "整體下載進度：總大小未知",
		"downloads.queued": "佇列中",
		"downloads.queuedOne": "{count} 個下載在佇列中",
		"downloads.queuedOther": "{count} 個下載在佇列中",
		"nav.back": "上一頁",
		"nav.backAria": "返回上一頁",
		"nav.browserToolbar": "瀏覽器工具列",
		"nav.customizeAria": "自訂 Fennevia 介面",
		"nav.customizeTitle": "自訂 Fennevia",
		"nav.extensions": "擴充功能",
		"nav.extensionsAria": "開啟 Firefox 擴充功能",
		"nav.firefoxMenu": "Firefox 選單",
		"nav.firefoxMenuAria": "開啟 Firefox 選單",
		"nav.firefoxTools": "Firefox 工具",
		"nav.forward": "下一頁",
		"nav.forwardAria": "前進到下一頁",
		"nav.home": "首頁",
		"nav.homeAria": "前往首頁",
		"nav.keyboardShortcut": "鍵盤快速鍵",
		"nav.launcherAria": "網址與網站狀態",
		"nav.openAddress": "開啟網址與搜尋",
		"nav.openTrust": "開啟 Firefox 網站信任。連線：{connection}。保護：{protection}",
		"nav.primaryNavigation": "主要導覽",
		"nav.private": "隱私",
		"nav.reload": "重新載入",
		"nav.reloadAria": "重新載入頁面",
		"nav.settings": "設定",
		"nav.settingsAria": "開啟 Firefox 設定",
		"nav.stop": "停止",
		"nav.stopAria": "停止載入",
		"panelContext.aria": "{edge}操作",
		"panelContext.customizeFennevia": "自訂 Fennevia",
		"panelContext.customizeFirefox": "自訂 Firefox 工具列",
		"panelContext.nativeToolbar": "顯示原始 Firefox 工具列",
		"panelContext.newTab": "新增分頁",
		"panelContext.openDownloads": "開啟 Firefox 下載面板",
		"panelContext.settings": "Firefox 設定",
		"permission.blocked.autoplay": "已封鎖自動播放",
		"permission.blocked.camera": "已封鎖攝影機",
		"permission.blocked.canvas": "已封鎖畫布存取",
		"permission.blocked.install": "已封鎖附加元件安裝",
		"permission.blocked.local-network": "已封鎖本機網路",
		"permission.blocked.location": "已封鎖位置",
		"permission.blocked.loopback-network": "已封鎖回送網路存取",
		"permission.blocked.microphone": "已封鎖麥克風",
		"permission.blocked.midi": "已封鎖 MIDI",
		"permission.blocked.notifications": "已封鎖通知",
		"permission.blocked.persistent-storage": "已封鎖持續性儲存空間",
		"permission.blocked.popups": "已封鎖彈出式視窗或重新導向",
		"permission.blocked.screen": "已封鎖螢幕分享",
		"permission.blocked.serial": "已封鎖序列裝置",
		"permission.blocked.xr": "已封鎖 XR 存取",
		"permission.indicatorsAria": "Firefox 權限指示器",
		"permission.sharing.location": "正在使用位置",
		"permission.sharing.media": "正在使用攝影機、麥克風或螢幕",
		"permission.sharing.serial": "正在使用序列裝置",
		"permission.sharing.xr": "正在使用 XR 裝置",
		"permission.site.badgeActive": "使用中",
		"permission.site.badgeIdle": "權限",
		"permission.site.badgeUnavailable": "權限 —",
		"permission.site.labelActive": "Firefox 回報網站功能正在使用中",
		"permission.site.labelBlocked": "Firefox 正在封鎖一或多項網站功能",
		"permission.site.labelGranted": "Firefox 對此頁面具有網站專屬權限",
		"permission.site.labelNone": "目前沒有作用中的網站權限指示器",
		"permission.site.labelUnavailable": "此頁面無法取得網站權限資訊",
		"protection.blocking.badge": "ETP",
		"protection.blocking.label": "加強型追蹤保護正在封鎖已知追蹤器",
		"protection.detected.badge": "ETP",
		"protection.detected.label": "偵測到追蹤器，但目前未封鎖任何項目",
		"protection.exception.badge": "ETP 關閉",
		"protection.exception.label": "已為此網站停用加強型追蹤保護",
		"protection.no-trackers-detected.badge": "ETP",
		"protection.no-trackers-detected.label": "未偵測到已知追蹤器",
		"protection.unavailable.badge": "ETP —",
		"protection.unavailable.label": "此頁面無法使用加強型追蹤保護",
		"trust.summary": "{connection} · {protection}",
		"surface.bottom": "下載",
		"surface.bookmarks": "書籤",
		"surface.left": "分頁與網址",
		"surface.right": "書籤",
		"surface.tabs": "分頁與網址",
		"surface.top": "瀏覽器控制項",
		"tab.allowMedia": "允許媒體：",
		"tab.attention": "需要注意",
		"tab.cameraInUse": "正在使用相機",
		"tab.close": "關閉",
		"tab.closeCount": "關閉 {count} 個分頁",
		"tab.closeTab": "關閉分頁",
		"tab.crashed": "已崩潰",
		"tab.dragPreview": "正在移動分頁",
		"tab.indexOf": "第 {index} 個，共 {total} 個",
		"tab.loading": "載入中",
		"tab.mediaBlocked": "已封鎖媒體",
		"tab.microphoneInUse": "正在使用麥克風",
		"tab.mute": "靜音",
		"tab.muted": "已靜音",
		"tab.newTab": "新分頁",
		"tab.newTabAria": "開啟新分頁",
		"tab.openCount": "{count} 個開啟的分頁",
		"tab.openHeading": "開啟的分頁",
		"tab.pin": "釘選",
		"tab.pinTab": "釘選分頁",
		"tab.pinned": "已釘選",
		"tab.pinnedCount": "已釘選分頁（{count}）",
		"tab.pip": "子母畫面",
		"tab.playing": "播放中",
		"tab.reordered": "已將「{title}」移至第 {index} 個，共 {total} 個",
		"tab.screenSharing": "正在分享螢幕",
		"tab.unmute": "取消靜音",
		"tab.unpin": "取消釘選",
		"tab.unpinTab": "取消釘選分頁",
		"tab.untitled": "未命名分頁",
		"widget.dropHere": "將元件拖放到這裡",
		"widget.row": "橫列",
		"widget.column": "直欄",
		"widget.center": "置中",
		"widget.expanded": "延展",
		"widget.padding": "內距",
		"widget.addressLauncher": "網址啟動器",
		"widget.downloadStatus": "下載狀態",
		"widget.privateIndicator": "隱私瀏覽",
		"widget.tabs": "分頁",
		"widget.trust": "網站信任狀態",
		"widget.droppableAria": "{zone} 面板元件，可放置",
		"widget.fenneviaControl": "Fennevia 控制項",
		"widget.flexibleSpace": "彈性空間",
		"widget.separator": "分隔線",
		"widget.showBookmarks": "顯示書籤面板",
		"widget.showBookmarksTooltip": "顯示 Fennevia 書籤面板",
		"widget.showDownloads": "開啟 Firefox 下載",
		"widget.showDownloadsTooltip": "開啟 Firefox 下載面板",
		"widget.showTranslate": "翻譯此頁面",
		"widget.showTranslateTooltip": "開啟 Firefox 內建翻譯",
		"widget.space": "空白",
		"widget.toolbarItem": "工具列項目",
		"widget.toolbarShortcuts": "工具列捷徑",
		"widget.unavailableSuffix": "{label}（無法使用）",
		"window.close": "關閉",
		"window.closeAria": "關閉視窗",
		"window.controls": "視窗控制項",
		"window.maximize": "最大化",
		"window.maximizeAria": "最大化視窗",
		"window.minimize": "最小化",
		"window.minimizeAria": "最小化視窗",
		"window.restore": "還原",
		"window.restoreAria": "還原視窗"
	}
});
function dr(e, t) {
	return t ? e.replace(/\{([A-Za-z][A-Za-z0-9]*)\}/gu, (e, n) => {
		let r = t[n];
		return r === void 0 ? e : String(r);
	}) : e;
}
function fr(e, t, n) {
	return dr((ur[e] ?? ur.en)[t] ?? ur.en[t] ?? t, n);
}
//#endregion
//#region src/firefox/locale.ts
var pr = "intl:app-locales-changed", mr = Object.freeze([
	"frame",
	"overlay",
	"top",
	"left",
	"right",
	"bottom"
]), hr = Object.freeze({
	bottom: "chrome.host.bottom",
	frame: "chrome.host.frame",
	left: "chrome.host.left",
	overlay: "chrome.host.overlay",
	right: "chrome.host.right",
	top: "chrome.host.top"
}), gr = (e) => typeof e == "object" && !!e, _r = (e) => typeof e == "function", vr = (e) => {
	let t = e.Services;
	if (!gr(t)) return null;
	let n = t.locale;
	return gr(n) ? n : null;
}, yr = (e) => {
	let t = e.Services;
	if (!gr(t)) return null;
	let n = t.obs;
	return !gr(n) || !_r(n.addObserver) || !_r(n.removeObserver) ? null : n;
}, br = Object.freeze([Object.freeze({
	isAvailable: (e) => e !== null,
	name: "locale.app-locale",
	read: (e) => vr(e),
	requirement: "optional",
	symbol: "window.Services.locale.appLocaleAsBCP47"
}), Object.freeze({
	isAvailable: (e) => e !== null,
	name: "locale.app-locales-observer",
	read: (e) => yr(e),
	requirement: "optional",
	symbol: "window.Services.obs.addObserver.removeObserver"
})]), xr = (e) => Object.freeze(br.map((t) => {
	let n = !1, r;
	try {
		n = t.isAvailable(t.read(e));
	} catch (e) {
		r = e;
	}
	return Object.freeze({
		...r === void 0 ? {} : { cause: r },
		snapshot: Object.freeze({
			available: n,
			name: t.name,
			requirement: t.requirement,
			symbol: t.symbol
		})
	});
})), Sr = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, Cr = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: Sr(e),
	phase: n,
	symbol: r
}), wr = (e) => {
	let t = vr(e);
	if (!t) return "";
	try {
		let e = t.appLocaleAsBCP47;
		return typeof e == "string" ? e : "";
	} catch {
		return "";
	}
}, Tr = (e) => Object.freeze({ id: sr(wr(e)) }), Er = (e, t) => fr(e, hr[t]);
function Dr({ boundary: e, onError: t, window: n }) {
	if (e.assertOwnsWindow(n), !gr(n)) throw Cr(e, "FENNEVIA_FIREFOX_LOCALE_OPTIONS_INVALID", "firefox-locale-create", "window");
	let r = typeof t == "function" ? t : () => {}, i = n, a = !1, o = new Set(), s = !1, c = Object.freeze({ observe() {
		u();
	} }), l = () => {
		if (a || !i) throw Cr(e, "FENNEVIA_FIREFOX_LOCALE_DISPOSED", "firefox-locale-access", "window");
		return i;
	}, u = () => {
		let t;
		try {
			t = Tr(l());
		} catch (e) {
			r(e);
			return;
		}
		for (let n of Array.from(o)) try {
			n(t);
		} catch (t) {
			r(Cr(e, "FENNEVIA_FIREFOX_LOCALE_SUBSCRIBER_FAILED", "firefox-locale-notify", "locale.subscribe", t));
		}
	}, d = () => {
		if (!s || !i) {
			s = !1;
			return;
		}
		let e = yr(i);
		if (e) try {
			Reflect.apply(e.removeObserver, e, [c, pr]);
		} catch {}
		s = !1;
	}, f = yr(n);
	if (f) try {
		Reflect.apply(f.addObserver, f, [c, pr]), s = !0;
	} catch (t) {
		r(Cr(e, "FENNEVIA_FIREFOX_LOCALE_SUBSCRIBE_FAILED", "firefox-locale-subscribe", "window.Services.obs.addObserver", t));
	}
	let p = Object.freeze({
		snapshot() {
			return cr(Tr(l()));
		},
		subscribe(t) {
			if (typeof t != "function") throw Cr(e, "FENNEVIA_FIREFOX_LOCALE_LISTENER_INVALID", "firefox-locale-subscribe", "locale.subscribe");
			return l(), o.add(t), () => o.delete(t);
		}
	});
	return Object.freeze({
		assertRequiredCapabilities() {
			let t = xr(l()), n = t.find((e) => e.snapshot.requirement === "required" && !e.snapshot.available);
			if (n) throw Cr(e, "FENNEVIA_FIREFOX_LOCALE_CAPABILITY_MISSING", "firefox-locale-capability", n.snapshot.symbol, n.cause);
			return Object.freeze(t.map((e) => e.snapshot));
		},
		dispose() {
			return !a && (a = !0, d(), i = null, o.clear(), !0);
		},
		locale: p,
		snapshot() {
			return Object.freeze({ disposed: a });
		}
	});
}
//#endregion
//#region src/app/navigation-state.ts
var Or = 2048, kr = 4096, Ar = (e) => {
	let t = Error(e);
	return t.name = "FenneviaNavigationStateError", Object.defineProperties(t, {
		fenneviaCode: {
			enumerable: !1,
			value: e
		},
		fenneviaPhase: {
			enumerable: !1,
			value: "navigation-state"
		}
	}), t;
};
function jr(e) {
	if (!e || typeof e != "object") throw Ar("FENNEVIA_NAVIGATION_POINTER_GESTURE_INVALID");
	let t = e;
	if (typeof t.altKey != "boolean" || typeof t.ctrlKey != "boolean" || typeof t.metaKey != "boolean" || typeof t.shiftKey != "boolean" || !Number.isInteger(t.button) || t.button < 0 || t.button > 2) throw Ar("FENNEVIA_NAVIGATION_POINTER_GESTURE_INVALID");
	return Object.freeze({
		altKey: t.altKey,
		button: t.button,
		ctrlKey: t.ctrlKey,
		metaKey: t.metaKey,
		shiftKey: t.shiftKey
	});
}
//#endregion
//#region src/firefox/navigation/support.ts
var Mr = Object.freeze({
	back: Object.freeze({
		id: "Browser:Back",
		method: "back"
	}),
	forward: Object.freeze({
		id: "Browser:Forward",
		method: "forward"
	}),
	newTab: Object.freeze({
		id: "cmd_newNavigatorTabNoEvent",
		method: "openTab"
	}),
	reload: Object.freeze({
		id: "Browser:Reload",
		method: "reload"
	}),
	stop: Object.freeze({
		id: "Browser:Stop",
		method: "stop"
	})
}), Nr = Object.freeze(["TabSelect", "TabAttrModified"]), Pr = new Set([
	"busy",
	"label",
	"selected"
]), Fr = "Browser:OpenLocation", Ir = Object.freeze({
	selectAll: !0,
	source: "ctrl-l",
	type: "address-popup-open"
}), Lr = Object.freeze({ status: "accepted" }), Rr = Object.freeze({
	reason: "empty",
	status: "rejected"
}), zr = Object.freeze({
	reason: "too-long",
	status: "rejected"
}), Br = Object.freeze({
	reason: "unsafe-scheme",
	status: "rejected"
}), Vr = /^\s*(?:data|javascript|vbscript)\s*:/iu, Hr = new Set([
	"about:blank",
	"about:home",
	"about:newtab",
	"about:privatebrowsing"
]), Ur = Object.freeze({
	associated: "associated",
	"cert-error-page": "certificate-error",
	chrome: "internal",
	extension: "extension",
	file: "local",
	"https-only-error-page": "https-only-error",
	"net-error-page": "network-error",
	"not-secure": "not-secure",
	secure: "secure",
	"secure-cert-user-overridden": "secure-certificate-override",
	"secure-etsi": "secure-qualified-certificate",
	"secure-ev": "secure-verified-organization"
}), Wr = (e) => `document.commands[${e.replaceAll(":", "-")}]`, W = (e) => typeof e == "object" && !!e, G = (e) => typeof e == "function", Gr = (e) => W(e) && G(e.addEventListener) && G(e.removeEventListener), Kr = (e) => e.gBrowser, qr = (e, t) => {
	let n = Kr(e);
	return W(n) ? n[t] : void 0;
}, Jr = (e, t) => {
	let n = qr(e, "selectedBrowser");
	return W(n) ? n[t] : void 0;
}, Yr = (e, t) => {
	let n = e.BrowserCommands;
	return W(n) ? n[t] : void 0;
}, Xr = (e, t) => {
	let n = e.gURLBar;
	return W(n) ? n[t] : void 0;
}, Zr = (e, t) => e[t], Qr = (e) => {
	let t = e.document;
	return W(t) ? t.documentElement : void 0;
}, $r = (e, t) => {
	let n = e.document;
	if (!(!W(n) || !G(n.getElementById))) return Reflect.apply(n.getElementById, n, [t]);
}, ei = (e) => W(e) && G(e.hasAttribute), ti = (e) => Gr(e) && typeof e.value == "string" && G(e.getAttribute) && G(e.handleCommand), ni = (e) => W(e) && G(e.getConnectionSecurityInformation), ri = (e) => W(e) && G(e.onContentBlockingEvent), ii = (e) => W(e) && G(e.canHandle), ai = (e) => W(e) && typeof e.canGoBack == "boolean" && typeof e.canGoForward == "boolean", oi = (e) => W(e) && (typeof e.displaySpec == "string" || typeof e.spec == "string"), si = Object.freeze([
	Object.freeze({
		isAvailable: ai,
		name: "firefox.navigation-selected-browser",
		read: (e) => qr(e, "selectedBrowser"),
		symbol: "window.gBrowser.selectedBrowser.canGoBack"
	}),
	Object.freeze({
		isAvailable: oi,
		name: "firefox.navigation-current-uri",
		read: (e) => Jr(e, "currentURI"),
		symbol: "window.gBrowser.selectedBrowser.currentURI.displaySpec"
	}),
	Object.freeze({
		isAvailable: G,
		name: "firefox.navigation-selected-browser-focus",
		read: (e) => Jr(e, "focus"),
		symbol: "window.gBrowser.selectedBrowser.focus"
	}),
	Object.freeze({
		isAvailable: (e) => W(e) && G(e.getAttribute),
		name: "firefox.navigation-selected-tab",
		read: (e) => qr(e, "selectedTab"),
		symbol: "window.gBrowser.selectedTab.getAttribute"
	}),
	Object.freeze({
		isAvailable: Gr,
		name: "firefox.navigation-tab-events",
		read: (e) => qr(e, "tabContainer"),
		symbol: "window.gBrowser.tabContainer"
	}),
	...[["add-progress-listener", "addTabsProgressListener"], ["remove-progress-listener", "removeTabsProgressListener"]].map(([e, t]) => Object.freeze({
		isAvailable: G,
		name: `firefox.navigation-${e}`,
		read: (e) => qr(e, t),
		symbol: `window.gBrowser.${t}`
	})),
	Object.freeze({
		isAvailable: G,
		name: "firefox.navigation-mutation-observer",
		read: (e) => e.MutationObserver,
		symbol: "window.MutationObserver"
	}),
	Object.freeze({
		isAvailable: (e) => typeof e == "string",
		name: "firefox.navigation-urlbar-value",
		read: (e) => Xr(e, "value"),
		symbol: "window.gURLBar.value"
	}),
	Object.freeze({
		isAvailable: G,
		name: "firefox.navigation-urlbar-submission",
		read: (e) => Xr(e, "handleCommand"),
		symbol: "window.gURLBar.handleCommand"
	}),
	Object.freeze({
		isAvailable: G,
		name: "firefox.navigation-urlbar-proxy-state",
		read: (e) => Xr(e, "getAttribute"),
		symbol: "window.gURLBar.getAttribute"
	}),
	Object.freeze({
		isAvailable: ni,
		name: "firefox.navigation-connection-security",
		read: (e) => Zr(e, "gIdentityHandler"),
		symbol: "window.gIdentityHandler.getConnectionSecurityInformation"
	}),
	Object.freeze({
		isAvailable: ri,
		name: "firefox.navigation-tracking-protection",
		read: (e) => Zr(e, "gProtectionsHandler"),
		symbol: "window.gProtectionsHandler.onContentBlockingEvent"
	}),
	Object.freeze({
		isAvailable: ii,
		name: "firefox.navigation-tracking-protection-availability",
		read: (e) => Zr(e, "ContentBlockingAllowList"),
		symbol: "window.ContentBlockingAllowList.canHandle"
	}),
	Object.freeze({
		isAvailable: (e) => ei(e) && Gr(e),
		name: "firefox.navigation-open-location-command",
		read: (e) => $r(e, Fr),
		symbol: Wr(Fr)
	}),
	Object.freeze({
		isAvailable: (e) => W(e) && G(e.hasAttribute),
		name: "firefox.navigation-shell-health-gate",
		read: Qr,
		symbol: "document.documentElement.hasAttribute"
	}),
	...Object.values(Mr).flatMap(({ id: e, method: t }) => [Object.freeze({
		isAvailable: ei,
		name: `firefox.navigation-command-${t}`,
		read: (t) => $r(t, e),
		symbol: Wr(e)
	}), Object.freeze({
		isAvailable: G,
		name: `firefox.navigation-action-${t}`,
		read: (e) => Yr(e, t),
		symbol: `window.BrowserCommands.${t}`
	})]),
	Object.freeze({
		isAvailable: G,
		name: "firefox.navigation-action-home",
		read: (e) => Yr(e, "home"),
		symbol: "window.BrowserCommands.home"
	}),
	Object.freeze({
		isAvailable: G,
		name: "firefox.navigation-action-reloadOrDuplicate",
		read: (e) => Yr(e, "reloadOrDuplicate"),
		symbol: "window.BrowserCommands.reloadOrDuplicate"
	})
]), ci = (e) => Object.freeze(si.map((t) => {
	let n = !1, r;
	try {
		n = t.isAvailable(t.read(e));
	} catch (e) {
		r = e;
	}
	return Object.freeze({
		...r === void 0 ? {} : { cause: r },
		snapshot: Object.freeze({
			available: n,
			name: t.name,
			requirement: "required",
			symbol: t.symbol
		})
	});
})), li = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, K = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: li(e),
	phase: n,
	symbol: r
}), ui = (e, t) => e.addressValue === t.addressValue && e.canGoBack === t.canGoBack && e.canGoForward === t.canGoForward && e.connectionSecurity === t.connectionSecurity && e.displayUri === t.displayUri && e.loading === t.loading && e.title === t.title && e.trackingProtection === t.trackingProtection, di = (e) => {
	if (!W(e) || !W(e.detail)) return !0;
	let t = e.detail.changed;
	return !Array.isArray(t) || t.some((e) => typeof e != "string") ? !0 : t.some((e) => Pr.has(e));
};
//#endregion
//#region src/firefox/navigation/controller.ts
function fi({ boundary: e, onError: t, window: n }) {
	if (e.assertOwnsWindow(n), !W(n) || typeof t != "function") throw K(e, "FENNEVIA_FIREFOX_NAVIGATION_OPTIONS_INVALID", "firefox-navigation-create", "window");
	let r = n, i = !1, a = null, o = 0, s = Object.freeze({
		addressValue: "",
		canGoBack: !1,
		canGoForward: !1,
		connectionSecurity: "unavailable",
		displayUri: "",
		loading: !1,
		title: "",
		trackingProtection: "unavailable"
	}), c = null, l = !1, u = [], d = new Set(), f = new Set(), p = () => {
		if (i || !r) throw K(e, "FENNEVIA_FIREFOX_NAVIGATION_DISPOSED", "firefox-navigation-access", "window.gBrowser.selectedBrowser");
		if (a) throw a;
		return e.assertOwnsWindow(r), r;
	}, m = () => {
		let t = p().gBrowser;
		if (!W(t)) throw K(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-capability", "window.gBrowser");
		return t;
	}, h = () => {
		let t = m().selectedBrowser;
		if (!ai(t)) throw K(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-snapshot", "window.gBrowser.selectedBrowser.canGoBack");
		return t;
	}, g = () => {
		let t = m().selectedTab;
		if (!W(t) || !G(t.getAttribute)) throw K(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-snapshot", "window.gBrowser.selectedTab.getAttribute");
		return t;
	}, v = (t) => {
		let n = $r(p(), t);
		if (!ei(n)) throw K(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-command", Wr(t));
		return n;
	}, y = () => {
		let t = p().gURLBar;
		if (!ti(t)) throw K(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-capability", "window.gURLBar.handleCommand");
		return t;
	}, x = () => {
		let t = p().gIdentityHandler;
		if (!ni(t)) throw K(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-snapshot", "window.gIdentityHandler.getConnectionSecurityInformation");
		return t;
	}, S = () => {
		let t = p().gProtectionsHandler;
		if (!ri(t)) throw K(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-snapshot", "window.gProtectionsHandler.onContentBlockingEvent");
		return t;
	}, C = () => {
		let t = p().ContentBlockingAllowList;
		if (!ii(t)) throw K(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-snapshot", "window.ContentBlockingAllowList.canHandle");
		return t;
	}, w = () => {
		let t = ci(p()), n = t.find((e) => !e.snapshot.available);
		if (n) throw K(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-capability", n.snapshot.symbol, n.cause);
		return Object.freeze(t.map((e) => e.snapshot));
	}, T = (e) => {
		let t = v(e);
		return !Reflect.apply(t.hasAttribute, t, ["disabled"]);
	}, E = (t) => {
		let n = t.currentURI;
		if (!oi(n)) throw K(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-snapshot", "window.gBrowser.selectedBrowser.currentURI.displaySpec");
		let r = typeof n.displaySpec == "string" ? n.displaySpec : n.spec;
		return String(r ?? "").slice(0, Or);
	}, D = (e) => {
		if (Hr.has(e)) return "";
		let t = y();
		return (Reflect.apply(t.getAttribute, t, ["pageproxystate"]) === "valid" ? t.value : e).slice(0, kr);
	}, O = () => {
		let e = x(), t = Reflect.apply(e.getConnectionSecurityInformation, e, []);
		return typeof t == "string" ? Ur[t] ?? "unavailable" : "unavailable";
	}, k = (e) => {
		let t = C();
		if (Reflect.apply(t.canHandle, t, [e]) !== !0) return "unavailable";
		let n = S();
		return typeof n.hasException != "boolean" || typeof n.anyBlocking != "boolean" || typeof n.anyDetected != "boolean" ? "unavailable" : n.hasException ? "exception" : n.anyBlocking ? "blocking" : n.anyDetected ? "detected" : "no-trackers-detected";
	}, A = () => {
		let e = h(), t = g(), n = E(e);
		return Object.freeze({
			addressValue: D(n),
			canGoBack: T(Mr.back.id),
			canGoForward: T(Mr.forward.id),
			connectionSecurity: O(),
			displayUri: n,
			loading: T(Mr.stop.id),
			title: String(Reflect.apply(t.getAttribute, t, ["label"]) ?? "").slice(0, 256),
			trackingProtection: k(e)
		});
	}, ee = () => {
		let n = Object.freeze({
			revision: o,
			snapshot: s,
			type: "snapshot"
		});
		for (let r of Array.from(d)) try {
			r(n);
		} catch (n) {
			t(K(e, "FENNEVIA_FIREFOX_NAVIGATION_SUBSCRIBER_FAILED", "firefox-navigation-notify", "navigation.subscribe", n));
		}
	}, j = (e) => {
		let t = A();
		return ui(s, t) && o > 0 ? !1 : (s = t, o += 1, e && ee(), !0);
	}, M = (n, r) => {
		a = _(n) ? n : K(e, "FENNEVIA_FIREFOX_NAVIGATION_EVENT_FAILED", "firefox-navigation-event", r, n), t(a);
	}, te = (e) => {
		if (!(i || a)) try {
			j(!0);
		} catch (t) {
			M(t, e);
		}
	}, N = (e, t, n) => {
		if (!(i || a)) try {
			e === m().selectedBrowser && W(t) && t.isTopLevel === !0 && j(!0);
		} catch (e) {
			M(e, n);
		}
	}, ne = Object.freeze({
		onLocationChange(e, t) {
			N(e, t, "window.gBrowser.onLocationChange");
		},
		onStateChange(e, t) {
			N(e, t, "window.gBrowser.onStateChange");
		},
		onSecurityChange(e, t) {
			N(e, t, "window.gBrowser.onSecurityChange");
		},
		onContentBlockingEvent(e, t) {
			N(e, t, "window.gBrowser.onContentBlockingEvent");
		}
	}), re = (e) => ({
		altKey: e.altKey,
		button: e.button,
		ctrlKey: e.ctrlKey,
		metaKey: e.metaKey,
		preventDefault() {},
		shiftKey: e.shiftKey
	}), P = (t, n) => {
		let r = p().BrowserCommands, i = W(r) ? r[t] : void 0;
		if (!G(i)) throw K(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-action", `window.BrowserCommands.${t}`);
		try {
			return Reflect.apply(i, r, n === void 0 ? [] : [re(n)]), !0;
		} catch (n) {
			throw K(e, "FENNEVIA_FIREFOX_NAVIGATION_ACTION_FAILED", "firefox-navigation-action", `window.BrowserCommands.${t}`, n);
		}
	}, ie = (e, t = !0, n) => {
		let r = Mr[e];
		h();
		let i = v(r.id);
		return t && Reflect.apply(i.hasAttribute, i, ["disabled"]) ? !1 : P(r.method, n);
	}, F = (t) => {
		if (typeof t != "string") return Rr;
		if (t.length > 4096) return zr;
		if (t.trim().length === 0) return Rr;
		if (Vr.test(t)) return Br;
		h();
		let n = y();
		try {
			return n.value = t, Reflect.apply(n.handleCommand, n, []), Lr;
		} catch (t) {
			throw K(e, "FENNEVIA_FIREFOX_ADDRESS_SUBMISSION_FAILED", "firefox-address-submit", "window.gURLBar.handleCommand", t);
		}
	}, I = () => {
		let e = Qr(p());
		return W(e) && G(e.hasAttribute) && !!Reflect.apply(e.hasAttribute, e, ["data-fennevia-healthy"]);
	}, L = (e) => {
		if (!W(e) || !W(e.sourceEvent)) return !1;
		let t = e.sourceEvent.target;
		return W(t) && t.id === "focusURLBar";
	}, ae = (e) => {
		if (!(i || a)) try {
			if (!I() || !L(e) || f.size === 0) return;
			j(!0);
			let t = !1;
			for (let e of Array.from(f)) t = e(Ir) === !0 || t;
			if (!t || !W(e)) return;
			G(e.preventDefault) && Reflect.apply(e.preventDefault, e, []), G(e.stopPropagation) && Reflect.apply(e.stopPropagation, e, []);
		} catch (e) {
			M(e, Wr(Fr));
		}
	}, oe = Object.freeze({
		back: (e) => ie("back", !0, e === void 0 ? void 0 : jr(e)),
		focusContent() {
			let t = h(), n = t.focus;
			if (!G(n)) throw K(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-focus", "window.gBrowser.selectedBrowser.focus");
			try {
				return Reflect.apply(n, t, []), !0;
			} catch (t) {
				throw K(e, "FENNEVIA_FIREFOX_NAVIGATION_FOCUS_FAILED", "firefox-navigation-focus", "window.gBrowser.selectedBrowser.focus", t);
			}
		},
		forward: (e) => ie("forward", !0, e === void 0 ? void 0 : jr(e)),
		home(e) {
			return h(), P("home", e === void 0 ? void 0 : jr(e));
		},
		newTab: () => ie("newTab", !1),
		reload(e) {
			return e === void 0 ? ie("reload") : (h(), P("reloadOrDuplicate", jr(e)));
		},
		reloadOrStop() {
			let e = T(Mr.stop.id) ? "stop" : "reload";
			return ie(e), e;
		},
		snapshot() {
			return p(), s;
		},
		stop: () => ie("stop"),
		submitAddress: F,
		subscribe(t) {
			if (p(), typeof t != "function") throw K(e, "FENNEVIA_FIREFOX_NAVIGATION_LISTENER_INVALID", "firefox-navigation-subscribe", "navigation.subscribe");
			return d.add(t), b(() => {
				d.delete(t);
			});
		},
		subscribeAddressPopupOpen(t) {
			if (p(), typeof t != "function") throw K(e, "FENNEVIA_FIREFOX_ADDRESS_POPUP_LISTENER_INVALID", "firefox-address-popup-subscribe", "navigation.subscribeAddressPopupOpen");
			return f.add(t), b(() => {
				f.delete(t);
			});
		}
	});
	try {
		e.assertRequiredCapabilities(), w(), j(!1);
		let t = m().tabContainer;
		for (let n of Nr) u.push(e.subscribe(t, n, (e) => {
			if (!(i || a)) try {
				if (n === "TabAttrModified" && (W(e) && e.target !== m().selectedTab || !di(e))) return;
				j(!0);
			} catch (e) {
				M(e, `window.gBrowser.tabContainer.${n}`);
			}
		}));
		u.push(e.subscribe(v(Fr), "command", ae));
		let n = m();
		Reflect.apply(n.addTabsProgressListener, n, [ne]), l = !0;
		let r = p().MutationObserver;
		c = new r(() => {
			te("document.command.disabled");
		});
		for (let { id: e } of Object.values(Mr)) c.observe(v(e), {
			attributeFilter: ["disabled"],
			attributes: !0
		});
	} catch (n) {
		i = !0;
		let a;
		try {
			c?.disconnect();
		} catch (e) {
			a ??= e;
		}
		if (c = null, l && r) try {
			let e = W(r.gBrowser) ? r.gBrowser : null;
			e && G(e.removeTabsProgressListener) && Reflect.apply(e.removeTabsProgressListener, e, [ne]);
		} catch (e) {
			a ??= e;
		}
		l = !1;
		for (let e of u.reverse()) try {
			e();
		} catch (e) {
			a ??= e;
		}
		throw r = null, a !== void 0 && t(K(e, "FENNEVIA_FIREFOX_NAVIGATION_DISPOSE_FAILED", "firefox-navigation-dispose", "window.gBrowser.removeTabsProgressListener", a)), n;
	}
	return Object.freeze({
		assertRequiredCapabilities: w,
		dispose() {
			if (i) return !1;
			i = !0;
			let t;
			try {
				c?.disconnect();
			} catch (e) {
				t ??= e;
			}
			if (c = null, l && r) try {
				let e = W(r.gBrowser) ? r.gBrowser : null;
				if (!e || !G(e.removeTabsProgressListener)) throw TypeError("FENNEVIA_FIREFOX_NAVIGATION_PROGRESS_DISPOSER_INVALID");
				Reflect.apply(e.removeTabsProgressListener, e, [ne]);
			} catch (e) {
				t ??= e;
			}
			l = !1;
			for (let e of u.reverse()) try {
				e();
			} catch (e) {
				t ??= e;
			}
			if (u.length = 0, d.clear(), f.clear(), r = null, t !== void 0) throw K(e, "FENNEVIA_FIREFOX_NAVIGATION_DISPOSE_FAILED", "firefox-navigation-dispose", "window.gBrowser.removeTabsProgressListener", t);
			return !0;
		},
		navigation: oe,
		snapshot() {
			return Object.freeze({
				addressPopupSubscriberCount: f.size,
				disposed: i,
				failed: a !== null,
				revision: o,
				subscriberCount: d.size
			});
		}
	});
}
//#endregion
//#region src/app/tab-state.ts
var pi = Object.freeze([
	"playing",
	"muted",
	"blocked"
]), mi = Object.freeze([
	"camera",
	"microphone",
	"screen"
]), hi = Object.freeze([
	"blue",
	"cyan",
	"gray",
	"green",
	"orange",
	"pink",
	"purple",
	"red",
	"violet",
	"yellow"
]);
new Set(pi);
var gi = new Set(hi), _i = new Set(mi), vi = Object.freeze([
	"blocked",
	"cancelled",
	"consumed",
	"detached",
	"unchanged"
]);
new Set(vi);
function yi(e) {
	return typeof e == "string" && gi.has(e);
}
function bi(e) {
	return typeof e == "string" && _i.has(e);
}
//#endregion
//#region src/firefox/tabs/support.ts
var xi = Object.freeze([
	"TabOpen",
	"TabClose",
	"TabSelect",
	"TabMove",
	"TabPinned",
	"TabUnpinned",
	"TabRemotenessChange",
	"TabAttrModified"
]), Si = Object.freeze([
	"oop-browser-crashed",
	"oop-browser-buildid-mismatch",
	"TabMultiSelect"
]), Ci = new Set([
	"activemedia-blocked",
	"attention",
	"busy",
	"crashed",
	"image",
	"label",
	"muted",
	"multiselected",
	"pictureinpicture",
	"selected",
	"sharing",
	"soundplaying",
	"usercontextid"
]), wi = "resource://gre/modules/ContextualIdentityService.sys.mjs", Ti = /[\s"'<>\\]/u, Ei = /^data:image\/(?:avif|gif|jpeg|png|vnd\.microsoft\.icon|webp|x-icon);base64,[a-z0-9+/]+={0,2}$/iu, Di = Object.freeze({
	toolbar: "gray",
	turquoise: "cyan"
}), Oi = (e) => typeof e == "object" && !!e || typeof e == "function", q = (e) => typeof e == "object" && !!e, ki = (e) => typeof e == "function", Ai = (e) => e.gBrowser, ji = (e, t) => {
	let n = Ai(e);
	return q(n) ? n[t] : void 0;
}, Mi = (e, t) => {
	let n = e.document;
	if (!(!q(n) || !ki(n.getElementById))) return Reflect.apply(n.getElementById, n, [t]);
}, Ni = (e) => q(e) && ki(e.openPopup) && ki(e.moveTo) && ki(e.addEventListener) && ki(e.removeEventListener), Pi = Object.freeze([
	Object.freeze({
		isAvailable: Array.isArray,
		name: "firefox.open-tabs",
		read: (e) => ji(e, "openTabs"),
		symbol: "window.gBrowser.openTabs"
	}),
	Object.freeze({
		isAvailable: Oi,
		name: "firefox.selected-tab",
		read: (e) => ji(e, "selectedTab"),
		symbol: "window.gBrowser.selectedTab"
	}),
	Object.freeze({
		isAvailable: (e) => q(e) && ki(e.addEventListener) && ki(e.removeEventListener),
		name: "firefox.tab-crash-events",
		read: Ai,
		symbol: "window.gBrowser.addEventListener.removeEventListener"
	}),
	...[
		["add-tab", "addTrustedTab"],
		["remove-tab", "removeTab"],
		["pin-tab", "pinTab"],
		["unpin-tab", "unpinTab"],
		["move-tab", "moveTabTo"],
		["adopt-tab", "adoptTab"],
		["detach-tab", "replaceTabWithWindow"],
		["translate-tab-context-menu", "translateTabContextMenu"],
		["add-to-multi-selected-tabs", "addToMultiSelectedTabs"],
		["remove-from-multi-selected-tabs", "removeFromMultiSelectedTabs"],
		["add-range-to-multi-selected-tabs", "addRangeToMultiSelectedTabs"],
		["clear-multi-selected-tabs", "clearMultiSelectedTabs"],
		["lock-clear-multi-selection-once", "lockClearMultiSelectionOnce"],
		["unlock-clear-multi-selection", "unlockClearMultiSelection"],
		["remove-multi-selected-tabs", "removeMultiSelectedTabs"],
		["toggle-mute-audio-on-multi-selected-tabs", "toggleMuteAudioOnMultiSelectedTabs"],
		["pin-multi-selected-tabs", "pinMultiSelectedTabs"],
		["unpin-multi-selected-tabs", "unpinMultiSelectedTabs"],
		["detach-tabs", "replaceTabsWithWindow"]
	].map(([e, t]) => Object.freeze({
		isAvailable: ki,
		name: `firefox.${e}`,
		read: (e) => ji(e, t),
		symbol: `window.gBrowser.${t}`
	})),
	Object.freeze({
		isAvailable: Array.isArray,
		name: "firefox.selected-tabs",
		read: (e) => ji(e, "selectedTabs"),
		symbol: "window.gBrowser.selectedTabs"
	}),
	Object.freeze({
		isAvailable: Oi,
		name: "firefox.last-multi-selected-tab",
		read: (e) => ji(e, "lastMultiSelectedTab"),
		symbol: "window.gBrowser.lastMultiSelectedTab"
	}),
	Object.freeze({
		isAvailable: (e) => typeof e == "string" && e.length > 0 && e.length <= 2048,
		name: "firefox.new-tab-url",
		read: (e) => e.BROWSER_NEW_TAB_URL,
		symbol: "window.BROWSER_NEW_TAB_URL"
	}),
	Object.freeze({
		isAvailable: Ni,
		name: "firefox.tab-context-menu",
		read: (e) => Mi(e, "tabContextMenu"),
		symbol: "document.tabContextMenu.openPopup.moveTo"
	})
]), Fi = (e) => Object.freeze(Pi.map((t) => {
	let n = !1, r;
	try {
		n = t.isAvailable(t.read(e));
	} catch (e) {
		r = e;
	}
	return Object.freeze({
		...r === void 0 ? {} : { cause: r },
		snapshot: Object.freeze({
			available: n,
			name: t.name,
			requirement: "required",
			symbol: t.symbol
		})
	});
})), Ii = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, J = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: Ii(e),
	phase: n,
	symbol: r
}), Li = (e, t) => {
	if (!q(t) || typeof t.getAttribute != "function" || typeof t.hasAttribute != "function") throw J(e, "FENNEVIA_FIREFOX_TAB_SHAPE_INVALID", "firefox-tabs-snapshot", "MozTabbrowserTab.getAttribute");
	return t;
}, Ri = (e) => {
	if (typeof e == "string" && e.length !== 0 && (e.length <= 2048 && (e.startsWith("chrome://") || e.startsWith("resource://") || e.startsWith("moz-remote-image:")) && !Ti.test(e) || e.length <= 262144 && Ei.test(e))) return e;
}, zi = (e, t) => e.length === t.length && e.every((e, n) => {
	let r = t[n];
	return r !== void 0 && e.id === r.id && e.title === r.title && e.selected === r.selected && e.multiselected === r.multiselected && e.pinned === r.pinned && e.loading === r.loading && e.faviconUrl === r.faviconUrl && e.audio === r.audio && e.attention === r.attention && e.crashed === r.crashed && e.pictureInPicture === r.pictureInPicture && e.sharing === r.sharing && e.container?.color === r.container?.color && e.container?.label === r.container?.label;
}), Bi = (e) => {
	if (!q(e) || !q(e.detail)) return !0;
	let t = e.detail.changed;
	return !Array.isArray(t) || t.some((e) => typeof e != "string") ? !0 : t.some((e) => Ci.has(e));
}, Vi = (e) => {
	if (typeof e != "string" || e.length === 0) return;
	let t = Di[e] ?? e;
	return yi(t) ? t : void 0;
}, Hi = (e) => bi(e) ? e : void 0, Ui = (e, t) => !q(e) || e.target === void 0 || e.target === t || q(e.target) && e.target.id === "tabContextMenu", Wi = /^tab-transfer-[A-Za-z0-9-]{8,128}$/u, Gi = (e) => {
	let t = Error(e);
	return t.name = "FenneviaTabDragCoordinatorError", Object.defineProperties(t, {
		fenneviaCode: {
			enumerable: !1,
			value: e
		},
		fenneviaPhase: {
			enumerable: !1,
			value: "firefox-tab-drag"
		}
	}), t;
};
function Ki({ createToken: e }) {
	if (typeof e != "function") throw Gi("FENNEVIA_TAB_DRAG_TOKEN_FACTORY_INVALID");
	let t = null, n = null, r = (e, r) => {
		t = null, n = Object.freeze({
			id: e.id,
			outcome: r
		});
	}, i = () => {
		if (!t) return null;
		let e;
		try {
			e = t.isActive() === !0;
		} catch {
			e = !1;
		}
		return e ? t : (r(t, "cancelled"), null);
	}, a = ({ contextId: e, windowKind: t }) => {
		let n = i();
		return !n || n.sourceWindowKind !== t || typeof e != "string" || e.length === 0 ? null : n;
	};
	return Object.freeze({
		begin(r) {
			if (!r || typeof r != "object" || typeof r.sourceContextId != "string" || r.sourceContextId.length === 0 || r.sourceWindowKind !== "normal" && r.sourceWindowKind !== "private" || typeof r.pinned != "boolean" || typeof r.isActive != "function" || !r.tab || typeof r.tab != "object" || r.movingTabs !== void 0 && (!Array.isArray(r.movingTabs) || r.movingTabs.length === 0 || r.movingTabs.length > 1e3 || r.movingTabs.some((e) => !e || typeof e != "object"))) throw Gi("FENNEVIA_TAB_DRAG_SOURCE_INVALID");
			if (i()) throw Gi("FENNEVIA_TAB_DRAG_ALREADY_ACTIVE");
			let a = e();
			if (typeof a != "string" || !Wi.test(a)) throw Gi("FENNEVIA_TAB_DRAG_TOKEN_INVALID");
			n = null;
			let o = Object.freeze(Array.isArray(r.movingTabs) && r.movingTabs.length > 0 ? r.movingTabs.slice() : [r.tab]);
			return t = Object.freeze({
				id: a,
				...r,
				movingTabs: o
			}), a;
		},
		cancel(e, t) {
			let n = i();
			return !n || n.id !== e || n.sourceContextId !== t ? !1 : (r(n, "cancelled"), !0);
		},
		cancelContext(e) {
			let n = t;
			return !n || n.sourceContextId !== e ? !1 : (r(n, "cancelled"), !0);
		},
		consume(e) {
			let n = t;
			return !n || n.id !== e ? !1 : (r(n, "consumed"), !0);
		},
		inspect(e) {
			let t = a(e);
			return t ? Object.freeze({
				count: t.movingTabs.length,
				id: t.id,
				pinned: t.pinned,
				source: t.sourceContextId === e.contextId ? "same-window" : "other-window"
			}) : null;
		},
		resolve: a,
		resolveForEnd(e, t) {
			let r = i();
			return r?.id === e && r.sourceContextId === t ? Object.freeze({
				status: "active",
				transfer: r
			}) : n?.id === e ? Object.freeze({ status: n.outcome }) : Object.freeze({ status: "missing" });
		},
		snapshot() {
			return Object.freeze({
				active: t !== null,
				activeId: t?.id ?? null,
				completedId: n?.id ?? null,
				completedOutcome: n?.outcome ?? null,
				sourceContextId: t?.sourceContextId ?? null
			});
		}
	});
}
//#endregion
//#region src/firefox/tabs/controller.ts
var qi = "tabContextMenu";
function Ji({ beginNativePopupHandoff: e, boundary: t, endNativePopupHandoff: n, dragCoordinator: r, isTabDetachAllowed: i, moduleLoader: a, onError: o, window: s }) {
	if (t.assertOwnsWindow(s), !q(s) || typeof e != "function" || typeof n != "function" || !r || typeof r.begin != "function" || typeof r.cancel != "function" || typeof r.cancelContext != "function" || typeof r.consume != "function" || typeof r.inspect != "function" || typeof r.resolve != "function" || typeof r.resolveForEnd != "function" || typeof i != "function" || typeof o != "function") throw J(t, "FENNEVIA_FIREFOX_TABS_OPTIONS_INVALID", "firefox-tabs-create", "window");
	let c = s, l = !1, u = null, d = 0, f = Object.freeze([]), p = new Set(), m = new Set(), h = [], g = t.createHandleRegistry("tab"), v = null, y = null, x = !1, S = t.snapshot(), C = S.contextId, w = S.windowKind;
	if (typeof a == "function") try {
		let e = a(wi), t = q(e) ? e.ContextualIdentityService : void 0;
		q(t) && ki(t.getPublicIdentityFromId) && (v = t);
	} catch {
		v = null;
	}
	let T = () => {
		if (l || !c) throw J(t, "FENNEVIA_FIREFOX_TABS_DISPOSED", "firefox-tabs-access", "window.gBrowser.openTabs");
		if (u) throw u;
		return t.assertOwnsWindow(c), c;
	}, E = () => {
		let e = T().gBrowser;
		if (!q(e)) throw J(t, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-capability", "window.gBrowser");
		return e;
	}, D = () => {
		let e = Fi(T()), n = e.find((e) => !e.snapshot.available);
		if (n) throw J(t, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-capability", n.snapshot.symbol, n.cause);
		return Object.freeze(e.map((e) => e.snapshot));
	}, O = () => {
		let e = E().openTabs;
		if (!Array.isArray(e)) throw J(t, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-snapshot", "window.gBrowser.openTabs");
		let n = e.map((e) => Li(t, e));
		if (new Set(n).size !== n.length) throw J(t, "FENNEVIA_FIREFOX_TAB_ORDER_INVALID", "firefox-tabs-snapshot", "window.gBrowser.openTabs");
		return n;
	}, k = (e, t) => Reflect.apply(e.getAttribute, e, [t]), A = (e, t) => !!Reflect.apply(e.hasAttribute, e, [t]), ee = (e) => {
		if (A(e, "activemedia-blocked")) return "blocked";
		if (A(e, "muted")) return "muted";
		if (A(e, "soundplaying")) return "playing";
	}, j = (e) => {
		let t;
		try {
			t = e.userContextId;
		} catch {
			t = void 0;
		}
		for (let n of [t, k(e, "usercontextid")]) {
			let e = Number(n);
			if (Number.isSafeInteger(e) && e > 0) return e;
		}
	}, M = (e) => {
		let t = e.classList;
		if (!q(t)) return;
		let n = t.contains;
		if (ki(n)) try {
			return hi.find((e) => !!Reflect.apply(n, t, [`identity-color-${e}`]));
		} catch {
			return;
		}
	}, te = (e) => {
		let t = j(e);
		if (t === void 0) return;
		let n;
		if (v) try {
			n = Reflect.apply(v.getPublicIdentityFromId, v, [t]);
		} catch {
			n = void 0;
		}
		let r = (q(n) ? Vi(n.color) : void 0) ?? M(e);
		if (!r) return;
		let i = "";
		if (q(n) && typeof n.name == "string" && (i = n.name), i.trim().length === 0 && v && ki(v.getUserContextLabel)) try {
			let e = Reflect.apply(v.getUserContextLabel, v, [t]);
			typeof e == "string" && (i = e);
		} catch {
			i = "";
		}
		let a = i.trim();
		return Object.freeze({
			color: r,
			label: (a.length === 0 ? "Container" : a).slice(0, 80)
		});
	}, N = (e, t) => {
		let n = String(k(e, "label") ?? "").slice(0, 256), r = Ri(k(e, "image")), i = ee(e), a = te(e), o = Hi(k(e, "sharing"));
		return Object.freeze({
			...A(e, "attention") ? { attention: !0 } : {},
			...i === void 0 ? {} : { audio: i },
			...a === void 0 ? {} : { container: a },
			...A(e, "crashed") ? { crashed: !0 } : {},
			...r === void 0 ? {} : { faviconUrl: r },
			...A(e, "pictureinpicture") ? { pictureInPicture: !0 } : {},
			...A(e, "multiselected") ? { multiselected: !0 } : {},
			id: g.register(e),
			loading: A(e, "busy"),
			pinned: A(e, "pinned"),
			selected: t === e,
			...o === void 0 ? {} : { sharing: o },
			title: n
		});
	}, ne = (e) => {
		for (let n of Array.from(m)) try {
			n(e);
		} catch (e) {
			o(J(t, "FENNEVIA_FIREFOX_TABS_SUBSCRIBER_FAILED", "firefox-tabs-notify", "tabs.subscribe", e));
		}
	}, re = () => {
		ne(Object.freeze({
			revision: d,
			tabs: f,
			type: "snapshot"
		}));
	}, P = (e) => {
		let t = E(), n = O().map((e) => N(e, t.selectedTab)), r = new Set(n.map((e) => e.id));
		for (let e of Array.from(p)) r.has(e) || (g.release(e), p.delete(e));
		for (let e of r) p.add(e);
		let i = Object.freeze(n);
		return !zi(f, i) && (f = i, d += 1, e && re(), !0);
	}, ie = (e, n) => {
		u = _(e) ? e : J(t, "FENNEVIA_FIREFOX_TABS_EVENT_FAILED", "firefox-tabs-event", `window.gBrowser.tabContainer.${n}`, e), o(u);
	}, F = (e) => {
		T();
		let n = g.resolve(e);
		if (!O().includes(n)) throw g.release(e), p.delete(e), J(t, "FENNEVIA_FIREFOX_TAB_STALE", "firefox-tabs-action", "tab.opaque-id");
		return n;
	}, I = (e, n) => {
		let r = E(), i = r[e];
		if (typeof i != "function") throw J(t, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-action", `window.gBrowser.${e}`);
		return Reflect.apply(i, r, n);
	}, L = (e) => A(e, "multiselected"), ae = () => {
		let e = E().selectedTabs;
		if (!Array.isArray(e)) throw J(t, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-action", "window.gBrowser.selectedTabs");
		let n = [];
		for (let t of e) q(t) && typeof t.hasAttribute == "function" && typeof t.getAttribute == "function" && n.push(t);
		return n;
	}, oe = (e) => {
		if (!L(e)) return [e];
		let t = A(e, "pinned"), n = new Set(ae()), r = O().filter((e) => n.has(e) && A(e, "pinned") === t);
		return r.includes(e) ? r : [e];
	}, se = (e, t) => {
		if (e.length === 0) return [];
		let n = new Set(e), r = O(), i = r.filter((e) => !n.has(e)), a = Math.max(0, t - r.slice(0, t).filter((e) => n.has(e)).length), o = A(e[0], "pinned"), s = i.filter((e) => A(e, "pinned")).length, c = o ? Math.min(Math.max(a, 0), s) : Math.min(Math.max(a, s), i.length), l = [
			...i.slice(0, c),
			...e,
			...i.slice(c)
		];
		for (let e = 0; e < l.length; e += 1) {
			let t = l[e], n = O();
			t && n[e] !== t && I("moveTabTo", [t, {
				isUserTriggered: !0,
				tabIndex: e
			}]);
		}
		return l;
	}, ce = () => {
		let e = E();
		try {
			let n = Li(t, e.lastMultiSelectedTab);
			if (O().includes(n)) return n;
		} catch {}
		return Li(t, e.selectedTab);
	}, le = (e, t) => {
		let n = (e.movingTabs ?? [e.tab]).filter((n) => !q(n) || A(n, "pinned") !== e.pinned ? !1 : !t || t.includes(n));
		if (t) {
			let r = t.filter((e) => n.includes(e));
			return r.includes(e.tab) ? r : [];
		}
		return n.length > 0 ? n : [e.tab];
	}, ue = (e) => {
		if (e === void 0) return Object.freeze({
			relatedToCurrent: !1,
			selected: !0
		});
		if (!q(e) || Object.keys(e).some((e) => e !== "relatedToCurrent" && e !== "selected") || e.relatedToCurrent !== void 0 && typeof e.relatedToCurrent != "boolean" || e.selected !== void 0 && typeof e.selected != "boolean") throw J(t, "FENNEVIA_FIREFOX_TAB_OPEN_OPTIONS_INVALID", "firefox-tabs-action", "tabs.open.options");
		return Object.freeze({
			relatedToCurrent: e.relatedToCurrent ?? !1,
			selected: e.selected ?? !0
		});
	}, de = (e) => {
		if (!q(e) || Object.keys(e).some((e) => e !== "screenX" && e !== "screenY") || typeof e.screenX != "number" || typeof e.screenY != "number" || !Number.isFinite(e.screenX) || !Number.isFinite(e.screenY) || Math.abs(e.screenX) > 1e5 || Math.abs(e.screenY) > 1e5) throw J(t, "FENNEVIA_FIREFOX_TAB_CONTEXT_MENU_POINT_INVALID", "firefox-tabs-action", "tabs.openContextMenu.point");
		return Object.freeze({
			screenX: e.screenX,
			screenY: e.screenY
		});
	}, fe = (e) => {
		if (!q(e) || Object.keys(e).some((e) => e !== "cancelled" && e !== "screenX" && e !== "screenY") || typeof e.cancelled != "boolean" || typeof e.screenX != "number" || typeof e.screenY != "number" || !Number.isFinite(e.screenX) || !Number.isFinite(e.screenY) || Math.abs(e.screenX) > 1e5 || Math.abs(e.screenY) > 1e5) throw J(t, "FENNEVIA_FIREFOX_TAB_DRAG_END_OPTIONS_INVALID", "firefox-tabs-drag", "tabs.endDrag.options");
		return Object.freeze({
			cancelled: e.cancelled,
			screenX: e.screenX,
			screenY: e.screenY
		});
	}, pe = (e, n) => {
		if (!Number.isSafeInteger(e) || e < 0 || e > n) throw J(t, "FENNEVIA_FIREFOX_TAB_DRAG_DROP_INDEX_INVALID", "firefox-tabs-drag", "tabs.dropDrag.index");
		return e;
	}, me = () => {
		if (T(), !y || !Ni(y)) throw J(t, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-action", "document.tabContextMenu.openPopup.moveTo");
		return y;
	}, he = () => {
		if (x) return;
		let n;
		try {
			n = e(qi) === !0;
		} catch (e) {
			throw J(t, "FENNEVIA_FIREFOX_TAB_CONTEXT_MENU_HANDOFF_FAILED", "firefox-tabs-context-menu-handoff", "nativeUi.beginPopupHandoff", e);
		}
		if (!n) throw J(t, "FENNEVIA_FIREFOX_TAB_CONTEXT_MENU_HANDOFF_REJECTED", "firefox-tabs-context-menu-handoff", "nativeUi.beginPopupHandoff");
		x = !0;
	}, ge = () => {
		if (!x) return null;
		x = !1;
		try {
			return n(qi), null;
		} catch (e) {
			return J(t, "FENNEVIA_FIREFOX_TAB_CONTEXT_MENU_HANDOFF_RELEASE_FAILED", "firefox-tabs-context-menu-handoff", "nativeUi.endPopupHandoff", e);
		}
	}, _e = Object.freeze({
		activateKeepingMultiSelect(e) {
			let n = F(e), r = E();
			I("lockClearMultiSelectionOnce", []);
			try {
				if (r.selectedTab !== n && (!Reflect.set(r, "selectedTab", n) || r.selectedTab !== n)) throw J(t, "FENNEVIA_FIREFOX_TAB_SELECT_REJECTED", "firefox-tabs-action", "window.gBrowser.selectedTab");
			} finally {
				try {
					I("unlockClearMultiSelection", []);
				} catch {}
			}
			P(!0);
		},
		beginDrag(e) {
			let n = F(e);
			try {
				return r.begin({
					isActive() {
						if (l || !c) return !1;
						try {
							return O().includes(n);
						} catch {
							return !1;
						}
					},
					movingTabs: oe(n),
					pinned: A(n, "pinned"),
					sourceContextId: C,
					sourceWindowKind: w,
					tab: n
				});
			} catch (e) {
				throw J(t, "FENNEVIA_FIREFOX_TAB_DRAG_BEGIN_REJECTED", "firefox-tabs-drag", "tabs.beginDrag", e);
			}
		},
		close(e) {
			let t = F(e);
			L(t) ? I("removeMultiSelectedTabs", []) : I("removeTab", [t, {
				animate: !0,
				isUserTriggered: !0
			}]), P(!0);
		},
		dropDrag(e) {
			let n = O(), i = pe(e, n.length), a = r.resolve({
				contextId: C,
				windowKind: w
			});
			if (!a) throw J(t, "FENNEVIA_FIREFOX_TAB_DRAG_UNAVAILABLE", "firefox-tabs-drag", "tabs.dropDrag.transfer");
			let o = n.filter((e) => A(e, "pinned")).length;
			if (a.sourceContextId === C) {
				if (!n.includes(a.tab)) throw r.cancel(a.id, C), J(t, "FENNEVIA_FIREFOX_TAB_STALE", "firefox-tabs-drag", "tabs.dropDrag.source-tab");
				let e = Math.max(n.length - 1, 0), s = a.pinned ? Math.min(Math.max(i, 0), Math.max(o - 1, 0)) : Math.min(Math.max(i, o), e), c = le(a, n);
				if (c.length === 0) throw r.cancel(a.id, C), J(t, "FENNEVIA_FIREFOX_TAB_STALE", "firefox-tabs-drag", "tabs.dropDrag.source-tab");
				let l = s > n.indexOf(a.tab) ? s + 1 : s, u = se(c, l), d = O(), f = d.indexOf(a.tab);
				if (f < 0 || d.length !== u.length || u.some((e, t) => d[t] !== e)) throw J(t, "FENNEVIA_FIREFOX_TAB_MOVE_REJECTED", "firefox-tabs-drag", "window.gBrowser.moveTabTo");
				let p = g.register(a.tab);
				return r.consume(a.id), P(!0), Object.freeze({
					index: f,
					kind: "moved",
					tabId: p
				});
			}
			let s = a.pinned ? Math.min(Math.max(i, 0), o) : Math.min(Math.max(i, o), n.length), c = le(a, null), l = s, u, d = s, f, p = (e, n, r) => {
				let i;
				try {
					i = I("adoptTab", [e, {
						selectTab: r,
						tabIndex: n
					}]);
				} catch (e) {
					throw J(t, "FENNEVIA_FIREFOX_TAB_ADOPT_REJECTED", "firefox-tabs-drag", "window.gBrowser.adoptTab", e);
				}
				return Li(t, i);
			};
			for (let e of c) {
				if (A(e, "selected") && u === void 0) {
					u = e, d = l;
					continue;
				}
				let t = p(e, l, !1);
				e === a.tab && (f = t), l += 1;
			}
			if (u) {
				let e = p(u, d, !0);
				u === a.tab && (f = e);
			}
			let m = f ?? p(a.tab, s, !0), h = O().indexOf(m);
			if (h < 0) throw J(t, "FENNEVIA_FIREFOX_TAB_ADOPT_REJECTED", "firefox-tabs-drag", "window.gBrowser.adoptTab");
			let _ = g.register(m);
			return r.consume(a.id), P(!0), Object.freeze({
				index: h,
				kind: "adopted",
				tabId: _
			});
		},
		endDrag(e, n) {
			if (T(), typeof e != "string" || e.length === 0 || e.length > 160) throw J(t, "FENNEVIA_FIREFOX_TAB_DRAG_ID_INVALID", "firefox-tabs-drag", "tabs.endDrag.id");
			let a = fe(n), o = r.resolveForEnd(e, C);
			if (o.status === "consumed") return "consumed";
			if (o.status === "cancelled") return "cancelled";
			if (o.status === "missing" || o.status !== "active") return "unchanged";
			if (a.cancelled) return r.cancel(e, C), "cancelled";
			let s;
			try {
				s = i() === !0;
			} catch (n) {
				throw r.cancel(e, C), J(t, "FENNEVIA_FIREFOX_TAB_DETACH_POLICY_FAILED", "firefox-tabs-drag", "browser.tabs.allowTabDetach", n);
			}
			if (!s) return r.cancel(e, C), "blocked";
			let c = O(), l = le(o.transfer, c);
			if (l.length === 0 || !c.includes(o.transfer.tab)) return r.cancel(e, C), "unchanged";
			if (l.length >= c.length) return r.consume(e), "unchanged";
			let u = l.length > 1 ? "replaceTabsWithWindow" : "replaceTabWithWindow", d;
			try {
				d = I(u, [o.transfer.tab, {
					screenX: a.screenX,
					screenY: a.screenY,
					suppressanimation: 1
				}]);
			} catch (e) {
				throw J(t, "FENNEVIA_FIREFOX_TAB_DETACH_REJECTED", "firefox-tabs-drag", `window.gBrowser.${u}`, e);
			} finally {
				r.consume(e);
			}
			return d == null ? "unchanged" : "detached";
		},
		inspectDrag() {
			return T(), r.inspect({
				contextId: C,
				windowKind: w
			});
		},
		move(e, n) {
			let r = F(e);
			if (!Number.isSafeInteger(n) || n < 0 || n > 1e4) throw J(t, "FENNEVIA_FIREFOX_TAB_MOVE_INDEX_INVALID", "firefox-tabs-action", "tabs.move.index");
			L(r) ? se(oe(r), n) : I("moveTabTo", [r, {
				isUserTriggered: !0,
				tabIndex: n
			}]), P(!0);
		},
		open(e) {
			let n = ue(e), r = T().BROWSER_NEW_TAB_URL;
			if (typeof r != "string" || r.length === 0) throw J(t, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-action", "window.BROWSER_NEW_TAB_URL");
			let i = { inBackground: !n.selected };
			n.relatedToCurrent && (i.relatedToCurrent = !0);
			let a = Li(t, I("addTrustedTab", [r, i]));
			if (!O().includes(a)) throw J(t, "FENNEVIA_FIREFOX_TAB_OPEN_REJECTED", "firefox-tabs-action", "window.gBrowser.addTrustedTab");
			let o = g.register(a);
			if (P(!0), n.selected && E().selectedTab !== a) throw J(t, "FENNEVIA_FIREFOX_TAB_SELECT_REJECTED", "firefox-tabs-action", "window.gBrowser.selectedTab");
			return o;
		},
		openContextMenu(e, n) {
			let r = F(e), i = de(n), a = me(), s = a.openPopup, c = a.moveTo;
			if (!ki(s) || !ki(c)) throw J(t, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-action", "document.tabContextMenu.openPopup.moveTo");
			try {
				I("translateTabContextMenu", []);
			} catch (e) {
				throw _(e) ? e : J(t, "FENNEVIA_FIREFOX_TAB_CONTEXT_MENU_TRANSLATION_FAILED", "firefox-tabs-action", "window.gBrowser.translateTabContextMenu", e);
			}
			he();
			try {
				Reflect.apply(s, a, [
					r,
					"after_start",
					0,
					0,
					!0
				]);
			} catch (e) {
				let n = ge();
				throw n && o(n), J(t, "FENNEVIA_FIREFOX_TAB_CONTEXT_MENU_REJECTED", "firefox-tabs-action", "document.tabContextMenu.openPopup", e);
			}
			try {
				Reflect.apply(c, a, [i.screenX, i.screenY]);
			} catch (e) {
				o(J(t, "FENNEVIA_FIREFOX_TAB_CONTEXT_MENU_POSITION_FAILED", "firefox-tabs-action", "document.tabContextMenu.moveTo", e));
			}
		},
		pin(e) {
			let n = F(e);
			if (L(n)) {
				I("pinMultiSelectedTabs", []), P(!0);
				return;
			}
			if (!A(n, "pinned")) {
				if (I("pinTab", [n]), !A(n, "pinned")) throw J(t, "FENNEVIA_FIREFOX_TAB_PIN_REJECTED", "firefox-tabs-action", "window.gBrowser.pinTab");
				P(!0);
			}
		},
		select(e) {
			let n = F(e), r = E();
			if (r.selectedTab !== n) {
				if (!Reflect.set(r, "selectedTab", n) || r.selectedTab !== n) throw J(t, "FENNEVIA_FIREFOX_TAB_SELECT_REJECTED", "firefox-tabs-action", "window.gBrowser.selectedTab");
				P(!0);
			}
		},
		clearMultiSelect() {
			I("clearMultiSelectedTabs", []), P(!0);
		},
		selectRange(e) {
			let n = F(e), r = E(), i = ce();
			if (r.selectedTab !== i && (!Reflect.set(r, "selectedTab", i) || r.selectedTab !== i)) throw J(t, "FENNEVIA_FIREFOX_TAB_SELECT_REJECTED", "firefox-tabs-action", "window.gBrowser.selectedTab");
			I("clearMultiSelectedTabs", []), I("addRangeToMultiSelectedTabs", [i, n]), P(!0);
		},
		snapshot() {
			return T(), f;
		},
		subscribe(e) {
			if (T(), typeof e != "function") throw J(t, "FENNEVIA_FIREFOX_TABS_LISTENER_INVALID", "firefox-tabs-subscribe", "tabs.subscribe");
			return m.add(e), b(() => {
				m.delete(e);
			});
		},
		toggleMultiSelect(e) {
			let t = F(e), n = E();
			L(t) ? I("removeFromMultiSelectedTabs", [t]) : n.selectedTab !== t && (I("addToMultiSelectedTabs", [t]), Reflect.set(n, "lastMultiSelectedTab", t)), P(!0);
		},
		toggleMute(e) {
			let n = F(e);
			if (L(n)) {
				I("toggleMuteAudioOnMultiSelectedTabs", [n]), P(!0);
				return;
			}
			let r = n.toggleMuteAudio;
			if (!ki(r)) throw J(t, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-action", "MozTabbrowserTab.toggleMuteAudio");
			Reflect.apply(r, n, []), P(!0);
		},
		unpin(e) {
			let n = F(e);
			if (L(n)) {
				I("unpinMultiSelectedTabs", []), P(!0);
				return;
			}
			if (A(n, "pinned")) {
				if (I("unpinTab", [n]), A(n, "pinned")) throw J(t, "FENNEVIA_FIREFOX_TAB_UNPIN_REJECTED", "firefox-tabs-action", "window.gBrowser.unpinTab");
				P(!0);
			}
		}
	});
	try {
		t.assertRequiredCapabilities(), D(), P(!1);
		let e = E(), n = e.tabContainer;
		for (let e of xi) h.push(t.subscribe(n, e, (t) => {
			if (!(l || u)) try {
				if (e === "TabAttrModified" && !Bi(t)) return;
				P(!0);
			} catch (t) {
				ie(t, e);
			}
		}));
		for (let n of Si) h.push(t.subscribe(e, n, () => {
			if (!(l || u)) try {
				P(!0);
			} catch (e) {
				ie(e, n);
			}
		}));
		let r = Mi(T(), "tabContextMenu");
		if (!Ni(r)) throw J(t, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-capability", "document.tabContextMenu.openPopup.moveTo");
		y = r, h.push(t.subscribe(r, "popupshown", (e) => {
			l || u || !Ui(e, r) || ne(Object.freeze({
				open: !0,
				type: "context-menu"
			}));
		})), h.push(t.subscribe(r, "popuphidden", (e) => {
			if (!Ui(e, r)) return;
			let t = ge();
			t && o(t), !l && ne(Object.freeze({
				open: !1,
				type: "context-menu"
			}));
		}));
	} catch (e) {
		l = !0, c = null;
		let n;
		try {
			r.cancelContext(C);
		} catch (e) {
			n ??= e;
		}
		for (let e of h.reverse()) try {
			e();
		} catch (e) {
			n ??= e;
		}
		try {
			g.dispose();
		} catch (e) {
			n ??= e;
		}
		throw n !== void 0 && o(J(t, "FENNEVIA_FIREFOX_TABS_DISPOSE_FAILED", "firefox-tabs-dispose", "window.gBrowser.tabContainer", n)), e;
	}
	return Object.freeze({
		assertRequiredCapabilities: D,
		dispose() {
			if (l) return !1;
			l = !0;
			let e;
			try {
				r.cancelContext(C);
			} catch (t) {
				e ??= t;
			}
			c = null;
			let n = y?.hidePopup;
			if (y && ki(n)) try {
				Reflect.apply(n, y, []);
			} catch (t) {
				e ??= t;
			}
			let i = ge();
			i && (e ??= i), y = null, v = null;
			for (let t of h.reverse()) try {
				t();
			} catch (t) {
				e ??= t;
			}
			h.length = 0, m.clear(), p.clear(), f = Object.freeze([]);
			try {
				g.dispose();
			} catch (t) {
				e ??= t;
			}
			if (e !== void 0) throw J(t, "FENNEVIA_FIREFOX_TABS_DISPOSE_FAILED", "firefox-tabs-dispose", "window.gBrowser.tabContainer", e);
			return !0;
		},
		snapshot() {
			return Object.freeze({
				disposed: l,
				failed: u !== null,
				revision: d,
				subscriberCount: m.size,
				tabCount: f.length
			});
		},
		tabs: _e
	});
}
//#endregion
//#region src/firefox/toolbar-widgets/native-support.ts
var Yi = "nav-bar", Xi = "unified-extensions-area", Zi = "fennevia.customize.layout", Qi = "fennevia.customize.style", $i = "fennevia.customize.panels", ea = "fennevia.customize.", ta = "after_start", na = Object.freeze({ capture: !0 }), ra = /^rgba?\([0-9\s.,%]{1,48}\)$/u, ia = /url\(\s*"((?:[^"\\]|\\.){1,512})"\s*\)/u, aa = /url\(\s*'((?:[^'\\]|\\.){1,512})'\s*\)/u, oa = /url\(\s*((?:[^"')\\]|\\.){1,512})\s*\)/u, sa = "moz-extension://", ca = "-browser-action", la = /["'\\<>\s]/u, ua = /#([A-Za-z_][\w-]*)/gu, da = /^(?:branding|browser|toolkit|preview)\/(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.ftl$/u, fa = /^(?:[A-Za-z][\w-]*\.)?(?:label|tooltiptext\d*)$/u, pa = /%[0-9$]*[Ssd]/u, ma = Object.freeze([
	"back-button",
	"forward-button",
	"stop-reload-button",
	"home-button",
	"urlbar-container",
	"search-container",
	"downloads-button",
	"unified-extensions-button",
	"PanelUI-menu-button",
	"personal-bookmarks",
	"menubar-items",
	"tabbrowser-tabs"
]), ha = new Set(ma), ga = new Map([
	["zoom-controls", Object.freeze([
		Object.freeze({
			fallbackLabel: "Zoom out",
			icon: "zoom-out",
			nodeId: "zoom-out-button"
		}),
		Object.freeze({
			displayLabel: !0,
			fallbackLabel: "Reset zoom",
			icon: "zoom",
			nodeId: "zoom-reset-button"
		}),
		Object.freeze({
			fallbackLabel: "Zoom in",
			icon: "zoom-in",
			nodeId: "zoom-in-button"
		})
	])],
	["edit-controls", Object.freeze([
		Object.freeze({
			fallbackLabel: "Cut",
			icon: "cut",
			nodeId: "cut-button"
		}),
		Object.freeze({
			fallbackLabel: "Copy",
			icon: "copy",
			nodeId: "copy-button"
		}),
		Object.freeze({
			fallbackLabel: "Paste",
			icon: "paste",
			nodeId: "paste-button"
		})
	])],
	["profiler-button", Object.freeze([Object.freeze({
		fallbackLabel: "Profiler",
		icon: "developer",
		nodeId: "profiler-button-button"
	}), Object.freeze({
		fallbackLabel: "Open the profiler panel",
		icon: "arrow-down",
		nodeId: "profiler-button-dropmarker"
	})])]
]), _a = new Map([
	["bookmarks-menu-button", "bookmark"],
	["developer-button", "developer"],
	["edit-controls", "edit"],
	["firefox-view-button", "firefox-view"],
	["fullscreen-button", "fullscreen"],
	["fxa-toolbar-menu-button", "account"],
	["history-panelmenu", "history"],
	["ipprotection-button", "shield"],
	["library-button", "library"],
	["new-window-button", "new-window"],
	["print-button", "print"],
	["profiler-button", "developer"],
	["privatebrowsing-button", "private"],
	["reset-pbm-toolbar-button", "private"],
	["screenshot-button", "screenshot"],
	["sidebar-button", "sidebar"],
	["zoom-controls", "zoom"]
]), va = Object.freeze([
	"browser/browser.ftl",
	"browser/sidebar.ftl",
	"browser/appmenu.ftl",
	"browser/screenshots.ftl"
]), ya = new Map([
	["bookmarks-menu-button", "bookmarks-menu-button"],
	["characterencoding-button", "repair-text-encoding-button"],
	["email-link-button", "toolbar-button-email-link"],
	["firefox-view-button", "toolbar-button-firefox-view-2"],
	["fullscreen-button", "appmenuitem-fullscreen"],
	["import-button", "browser-import-button2"],
	["library-button", "navbar-library"],
	["logins-button", "toolbar-button-logins"],
	["new-window-button", "appmenuitem-new-window"],
	["open-file-button", "toolbar-button-open-file"],
	["preferences-button", "toolbar-settings-button"],
	["print-button", "navbar-print"],
	["privatebrowsing-button", "toolbar-button-new-private-window"],
	["reset-pbm-toolbar-button", "reset-pbm-toolbar-button2"],
	["save-page-button", "toolbar-button-save-page"],
	["screenshot-button", "screenshot-toolbar-button"],
	["send-tab-button", "toolbar-button-send-tab"],
	["share-tab-button", "toolbar-button-share-tab"],
	["sidebar-button", "show-sidebars"],
	["sync-button", "toolbar-button-synced-tabs"],
	["tab-groups-button", "toolbar-button-tab-groups"]
]), ba = new Map([
	["bookmarks-menu-button", "chrome://browser/skin/bookmark-star-on-tray.svg"],
	["characterencoding-button", "chrome://browser/skin/characterEncoding.svg"],
	["copy-button", "chrome://global/skin/icons/edit-copy.svg"],
	["cut-button", "chrome://browser/skin/edit-cut.svg"],
	["developer-button", "chrome://global/skin/icons/developer.svg"],
	["email-link-button", "chrome://browser/skin/mail.svg"],
	["find-button", "chrome://global/skin/icons/search-glass.svg"],
	["firefox-view-button", "chrome://browser/skin/firefox-view.svg"],
	["fullscreen-button", "chrome://browser/skin/fullscreen.svg"],
	["ipprotection-button", "chrome://browser/content/ipprotection/assets/states/ipprotection-off.svg"],
	["library-button", "chrome://browser/skin/library.svg"],
	["logins-button", "chrome://browser/skin/login.svg"],
	["new-window-button", "chrome://browser/skin/window.svg"],
	["open-file-button", "chrome://browser/skin/open.svg"],
	["panic-button", "chrome://browser/skin/forget.svg"],
	["paste-button", "chrome://browser/skin/edit-paste.svg"],
	["preferences-button", "chrome://global/skin/icons/settings.svg"],
	["print-button", "chrome://global/skin/icons/print.svg"],
	["profiler-button-button", "chrome://devtools/skin/images/tool-profiler.svg"],
	["profiler-button-dropmarker", "chrome://global/skin/icons/arrow-down.svg"],
	["privatebrowsing-button", "chrome://browser/skin/privateBrowsing.svg"],
	["reset-pbm-toolbar-button", "chrome://browser/skin/flame.svg"],
	["save-page-button", "chrome://browser/skin/save.svg"],
	["screenshot-button", "chrome://browser/skin/screenshot.svg"],
	["share-tab-button", "chrome://browser/skin/share.svg"],
	["sidebar-button", "chrome://browser/skin/sidebar-collapsed.svg"],
	["sync-button", "chrome://browser/skin/synced-tabs.svg"],
	["tab-groups-button", "chrome://browser/skin/tabbrowser/tab-groups.svg"],
	["zoom-in-button", "chrome://global/skin/icons/plus.svg"],
	["zoom-out-button", "chrome://global/skin/icons/minus.svg"]
]), xa = (e, t) => e === "send-tab-button" ? Number.parseInt(t.split(".", 1)[0] ?? "", 10) >= 154 ? "chrome://browser/skin/send-tab.svg" : "chrome://browser/skin/send-tab-20.svg" : ba.get(e) ?? "", Sa = new Map([
	["show-bookmarks", Object.freeze({
		icon: "bookmark",
		label: "Show bookmarks panel",
		tooltip: "Reveal the Fennevia bookmarks panel"
	})],
	["show-downloads", Object.freeze({
		icon: "download",
		label: "Open Firefox downloads",
		tooltip: "Open the Firefox downloads panel"
	})],
	["show-translate", Object.freeze({
		icon: "translate",
		label: "Translate this page",
		tooltip: "Open Firefox built-in translations"
	})]
]), Y = (e) => typeof e == "object" && !!e, X = (e) => typeof e == "function", Ca = (e) => Y(e) && X(e.getAttribute), wa = (e) => Y(e) && X(e.hidePopup) && X(e.moveToAnchor), Ta = (e) => wa(e) && X(e.openPopup), Ea = (e, t) => typeof e == "string" ? e.slice(0, t) : "", Da = (e) => {
	let t = e.trim();
	return ra.test(t) ? t : "";
}, Oa = (e) => {
	let t = e.CustomizableUI;
	return !Y(t) || !X(t.getWidgetIdsInArea) || !X(t.getWidget) || !X(t.addListener) || !X(t.removeListener) ? null : t;
}, ka = (e) => {
	let t = e.Services;
	if (!Y(t)) return null;
	let n = t.prefs;
	return !Y(n) || !X(n.addObserver) || !X(n.clearUserPref) || !X(n.getStringPref) || !X(n.removeObserver) || !X(n.setStringPref) ? null : n;
}, Aa = (e, t) => {
	try {
		let n = Reflect.apply(e.getStringPref, e, [t, ""]);
		return typeof n == "string" && n.length <= 16384 ? n : "";
	} catch {
		return "";
	}
}, ja = (e) => {
	try {
		let t = e.AREA_ADDONS;
		return typeof t == "string" && t !== "" ? t : Xi;
	} catch {
		return Xi;
	}
}, Ma = (e, t) => {
	if (X(e.isWebExtensionWidget)) try {
		return Reflect.apply(e.isWebExtensionWidget, e, [t]) === !0;
	} catch {}
	return t.endsWith(ca);
}, Na = (e) => {
	let t = e.PanelUI;
	return !Y(t) || !X(t.showSubView) ? null : t.showSubView;
}, Pa = Object.freeze([
	Object.freeze({
		isAvailable: (e) => e !== null,
		name: "toolbar-widgets.customizable-ui",
		read: (e) => Oa(e),
		requirement: "optional",
		symbol: "window.CustomizableUI.getWidgetIdsInArea.getWidget.addListener.removeListener"
	}),
	Object.freeze({
		isAvailable: (e) => e !== null,
		name: "toolbar-widgets.panel-ui-sub-view",
		read: (e) => Na(e),
		requirement: "optional",
		symbol: "window.PanelUI.showSubView"
	}),
	Object.freeze({
		isAvailable: (e) => e !== null,
		name: "toolbar-widgets.prefs",
		read: (e) => ka(e),
		requirement: "optional",
		symbol: "window.Services.prefs.getStringPref.setStringPref.clearUserPref.addObserver.removeObserver"
	}),
	Object.freeze({
		isAvailable: (e) => Y(e) && X(e.addEventListener) && X(e.removeEventListener) && X(e.getElementById),
		name: "toolbar-widgets.document-events",
		read: (e) => e.document,
		requirement: "required",
		symbol: "document.addEventListener.removeEventListener.getElementById"
	})
]), Fa = (e) => Object.freeze(Pa.map((t) => {
	let n = !1, r;
	try {
		n = t.isAvailable(t.read(e));
	} catch (e) {
		r = e;
	}
	return Object.freeze({
		...r === void 0 ? {} : { cause: r },
		snapshot: Object.freeze({
			available: n,
			name: t.name,
			requirement: t.requirement,
			symbol: t.symbol
		})
	});
})), Ia = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, Z = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: Ia(e),
	phase: n,
	symbol: r
}), La = (e) => {
	if (e.startsWith("customizableui-special-")) {
		let t = /^customizableui-special-(spring|spacer|separator)/u.exec(e);
		return t ? t[1] : null;
	}
	return e === "spring" || e === "spacer" || e === "separator" ? e : e === "vertical-spacer" ? "spacer" : null;
}, Ra = (e, t) => {
	if (!e) return "";
	try {
		let n = e[t];
		return typeof n == "string" ? n : "";
	} catch {
		return "";
	}
}, za = (e, t) => {
	let n = e.document;
	if (!(!Y(n) || !X(n.getElementById))) return Reflect.apply(n.getElementById, n, [t]);
}, Ba = (e, t) => {
	if (X(e.querySelector)) try {
		return Reflect.apply(e.querySelector, e, [t]);
	} catch {
		return;
	}
}, Va = (e, t) => {
	try {
		let n = Reflect.apply(e.getAttribute, e, [t]);
		return typeof n == "string" ? n : "";
	} catch {
		return "";
	}
}, Ha = (e) => {
	if (e === "" || e === "none") return "";
	let t = ia.exec(e);
	if (t) return t[1].replace(/\\(.)/gu, "$1");
	let n = aa.exec(e);
	if (n) return n[1].replace(/\\(.)/gu, "$1");
	let r = oa.exec(e);
	return r ? r[1].replace(/\\(.)/gu, "$1") : "";
}, Ua = (e, t) => e === "" || e.length > 512 || la.test(e) ? !1 : t === "extension" ? e.startsWith(sa) : e.startsWith("chrome://") || e.startsWith("resource://"), Wa = (e) => {
	if (Ca(e)) return e;
	if (Array.isArray(e)) {
		let t = e[0];
		return Ca(t) ? t : null;
	}
	if (!Y(e)) return null;
	let t = e[0];
	if (Ca(t)) return t;
	if (X(e.item)) try {
		let t = Reflect.apply(e.item, e, [0]);
		return Ca(t) ? t : null;
	} catch {
		return null;
	}
	return null;
}, Ga = (e) => {
	if (!Y(e)) return "";
	try {
		let t = e.listStyleImage;
		if (typeof t == "string" && t !== "") {
			let e = Ha(t);
			if (e) return e;
		}
	} catch {}
	if (X(e.getPropertyValue)) try {
		let t = Reflect.apply(e.getPropertyValue, e, ["list-style-image"]);
		if (typeof t == "string") return Ha(t);
	} catch {
		return "";
	}
	return "";
}, Ka = (e) => {
	try {
		let t = e.style, n = Ga(t);
		if (n) return n;
	} catch {}
	return "";
}, qa = (e) => {
	if (typeof e != "string" || e === "") return [];
	let t = [];
	ua.lastIndex = 0;
	for (let n of e.matchAll(ua)) {
		let e = n[1];
		e && t.push(e);
	}
	return t;
}, Ja = (e, t, n = []) => {
	if (!Y(e)) return;
	let r;
	try {
		r = e.selectorText;
	} catch {
		r = void 0;
	}
	let i = qa(r), a = i.length > 0 ? i : n, o = Ka(e);
	if (o && Ua(o, "builtin")) for (let e of a) t.set(e, o);
	let s;
	try {
		s = e.cssRules;
	} catch {
		s = void 0;
	}
	if (Y(s) && typeof s.length == "number") {
		let e = s.length;
		for (let n = 0; n < e; n += 1) Ja(s[n], t, a);
	}
}, Ya = (e, t) => {
	if (Array.isArray(e) || Y(e)) return e[t];
}, Xa = (e, t) => {
	if (Array.isArray(e)) {
		for (let n of e) if (Y(n) && n.name === t && typeof n.value == "string") return n.value;
		return "";
	}
	if (!Y(e)) return "";
	if (typeof e.length == "number" && e.length > 0) {
		let n = e.length;
		for (let r = 0; r < n; r += 1) {
			let n = e[r];
			if (Y(n) && n.name === t && typeof n.value == "string") return n.value;
		}
	}
	let n = e[t];
	return typeof n == "string" ? n : "";
}, Za = (e, t) => {
	let n = Ya(e, 0);
	if (!Y(n)) return "";
	let r = Xa(n.attributes, "label") || Xa(n.attributes, "tooltiptext"), i = typeof n.value == "string" ? n.value : "", a = r || i;
	return !a || a === t ? "" : Ea(a, 200);
}, Qa = (e, t) => {
	if (X(e.formatMessagesSync)) try {
		let n = Za(Reflect.apply(e.formatMessagesSync, e, [[{ id: t }]]), t);
		if (n) return n;
	} catch {}
	if (!X(e.formatValueSync)) return "";
	try {
		let n = Reflect.apply(e.formatValueSync, e, [t]);
		return typeof n != "string" || n === "" || n === t ? "" : Ea(n, 200);
	} catch {
		return "";
	}
}, $a = (e) => e.length > 0 && e.length <= 128 && !e.includes("..") && da.test(e), eo = (e) => {
	let t = [], n = new Set(), r = (e) => {
		let r = e.trim();
		n.has(r) || !$a(r) || t.length >= 48 || (n.add(r), t.push(r));
	};
	for (let e of va) r(e);
	if (!X(e.querySelectorAll)) return t;
	try {
		let t = Reflect.apply(e.querySelectorAll, e, ["link[rel=\"localization\"]"]), n = Array.isArray(t) || Y(t) && typeof t.length == "number" ? t.length : 0;
		for (let e = 0; e < n; e += 1) {
			let n = Ya(t, e);
			Ca(n) && r(Va(n, "href"));
		}
	} catch {}
	return t;
}, to = (e, t = "") => t && (e === t || e.startsWith(`${t}.`)) ? !0 : fa.test(e), no = (e, t, n = "") => !e || to(e, n) || pa.test(e) ? "" : Ea(e, t), ro = (e) => e.isConnected === !0, io = (e) => {
	let t = Ba(e, ".unified-extensions-item-action-button");
	return Ca(t) ? t : null;
}, ao = (e) => {
	let t = "", n = e.style;
	if (Y(n) && X(n.getPropertyValue)) try {
		let e = Reflect.apply(n.getPropertyValue, n, ["--webextension-toolbar-image"]);
		typeof e == "string" && (t = e);
	} catch {
		t = "";
	}
	t ||= Va(e, "style");
	let r = Ha(t);
	return Ua(r, "extension") ? r : "";
}, oo = (e) => {
	let t = Ea(Va(e, "badge"), 8), n = "", r = "", i = Va(e, "badgeStyle"), a = /background-color:\s*([^;]{1,64})/u.exec(i);
	a && (n = Da(a[1]));
	let o = /(?:^|;)\s*color:\s*([^;]{1,64})/u.exec(i);
	return o && (r = Da(o[1])), Object.freeze({
		background: n,
		text: t,
		textColor: r
	});
}, so = (e) => {
	let t = Ba(e, ".unified-extensions-item-name");
	if (Y(t) && typeof t.textContent == "string") {
		let e = t.textContent.trim();
		if (e) return Ea(e, 200);
	}
	return "";
}, co = (e) => e.disabled === !0 || Va(e, "disabled") === "true", lo = "fxa-toolbar-menu-button", uo = "PanelUI-fxa", fo = "alltabs-button", po = "alltabs-button", mo = "library-button", ho = "appMenu-libraryView";
function go({ boundary: e, getWindowOrNull: t, isDisposed: n, onActionDelta: r, popupListeners: i, registry: a, requireProjectHost: o, requireWindow: s }) {
	let c = null, l = "", u = null, d = "", f = null, p = (e) => {
		let t = Object.freeze({
			open: e,
			type: "widget-popup"
		});
		for (let e of Array.from(i)) e(t);
	}, m = (e) => {
		let n = u;
		if (!n) return;
		u = null;
		let r = t();
		if (r && X(r.clearTimeout)) try {
			Reflect.apply(r.clearTimeout, r, [n.timeoutHandle]);
		} catch {}
		n.resolve(e);
	}, h = (e) => {
		let n = f;
		if (!n) return;
		f = null;
		let r = t();
		if (n.timeoutHandle !== void 0 && r && X(r.clearTimeout)) try {
			Reflect.apply(r.clearTimeout, r, [n.timeoutHandle]);
		} catch {}
		n.resolve(e);
	}, g = (e, t) => {
		c = e, l = t, p(!0);
	}, v = () => {
		c && (c = null, l = "", p(!1));
	}, y = (e) => Y(e) ? Y(e.originalTarget) ? e.originalTarget : Y(e.target) ? e.target : null : null, b = (e, t) => {
		if (t === e) return !0;
		if (!X(e.contains)) return !1;
		try {
			return Reflect.apply(e.contains, e, [t]) === !0;
		} catch {
			return !1;
		}
	}, x = (e) => {
		if (n()) return;
		let t = y(e);
		if (!t || !wa(t)) return;
		let r = typeof t.id == "string" ? t.id : "";
		if (u && r === "customizationui-widget-panel") {
			let e = d;
			m(!0), d = "", g(t, e);
			return;
		}
		if (f) {
			let e = t.anchorNode;
			if (b(f.anchor, e)) {
				let { handle: e, host: n, reanchor: r } = f;
				if (r) try {
					Reflect.apply(t.moveToAnchor, t, [
						n,
						ta,
						0,
						0
					]);
				} catch {}
				g(t, e), h(!0);
			}
		}
	}, S = (e) => {
		if (n()) return;
		let t = y(e);
		if (!t) return;
		if (c && t === c) {
			v();
			return;
		}
		let r = typeof t.id == "string" ? t.id : "";
		u && r === "customizationui-widget-panel" && (m(!1), d = "");
	}, C = (e) => {
		let t = s();
		return m(!1), new Promise((n) => {
			let r = {
				resolve: n,
				timeoutHandle: void 0
			};
			u = r, d = e;
			let i = () => {
				u === r && (u = null, d = "", n(!1));
			}, a = t.setTimeout;
			X(a) ? r.timeoutHandle = Reflect.apply(a, t, [i, 800]) : queueMicrotask(i);
		});
	}, w = (e, t, n, r = !0) => {
		let i = s();
		return h(!1), new Promise((a) => {
			let o = {
				anchor: n,
				handle: e,
				host: t,
				reanchor: r,
				resolve: a,
				timeoutHandle: void 0
			};
			f = o;
			let s = () => {
				f === o && (f = null, a(!1));
			}, c = i.setTimeout;
			X(c) ? o.timeoutHandle = Reflect.apply(c, i, [s, 800]) : queueMicrotask(s);
		});
	}, T = () => {
		let e = c;
		if (e) try {
			Reflect.apply(e.hidePopup, e, []);
		} catch {
			v();
		}
	}, E = (e) => {
		try {
			e.open === !0 && (e.open = !1);
		} catch {}
	}, D = (e, t) => {
		if (Y(e) && X(e.stopPropagation) && (e.type === "click" || e.type === "keypress" || e.type === "mousedown")) return e;
		let n = s(), r = n.MouseEvent;
		if (X(r)) try {
			let e = Reflect.construct(r, ["click", Object.freeze({
				bubbles: !0,
				button: 0,
				cancelable: !0,
				view: n
			})]);
			if (Y(e) && X(e.stopPropagation)) return e;
		} catch {}
		return Object.freeze({
			button: 0,
			stopPropagation() {},
			target: t,
			type: "click",
			view: n
		});
	}, O = async (t, n, r, i, a = "window.PanelUI.showSubView") => {
		let o = s(), c = Na(o);
		if (!c || !Y(o.PanelUI)) throw Z(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_CAPABILITY_MISSING", "firefox-toolbar-widgets-action", a);
		let l = C(t);
		try {
			let e = Reflect.apply(c, o.PanelUI, [
				r,
				n,
				i
			]);
			Promise.resolve(e).catch(() => {});
		} catch (t) {
			throw m(!1), d = "", Z(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_ACTION_FAILED", "firefox-toolbar-widgets-action", a, t);
		}
		return await l;
	}, k = (e) => {
		if (Va(e, "type") !== "menu") return null;
		let t = Ba(e, "menupopup");
		return Ta(t) ? t : null;
	}, A = async (t, n, r, i) => {
		let a = w(t, n, n, !1);
		try {
			Reflect.apply(r.openPopup, r, [n, Object.freeze({
				position: ta,
				triggerEvent: i
			})]);
		} catch (t) {
			throw h(!1), Z(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_ACTION_FAILED", "firefox-toolbar-widgets-action", "XULPopupElement.openPopup", t);
		}
		return await a;
	}, ee = async (t, n, r, i) => {
		let a = s(), o = a.gSync, c = a.PanelUI, l = Na(a);
		if (!Y(o) || !X(o.toggleAccountPanel) || !Y(c) || !l) throw Z(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_CAPABILITY_MISSING", "firefox-toolbar-widgets-action", "window.gSync.toggleAccountPanel.PanelUI.showSubView");
		let u = (...e) => {
			let t = [...e];
			return t[0] === uo && t[1] === r && (t[1] = n), Reflect.apply(l, c, t);
		};
		try {
			c.showSubView = u;
		} catch (t) {
			throw Z(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_ACTION_FAILED", "firefox-toolbar-widgets-action", "window.PanelUI.showSubView.route-account-anchor", t);
		}
		let f = C(t);
		try {
			let e = Reflect.apply(o.toggleAccountPanel, o, [r, i]);
			await Promise.resolve(e);
		} catch (t) {
			throw m(!1), d = "", _(t) ? t : Z(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_ACTION_FAILED", "firefox-toolbar-widgets-action", "window.gSync.toggleAccountPanel", t);
		} finally {
			c.showSubView === u && (c.showSubView = l);
		}
		return await f;
	}, j = async (t, n, r) => {
		let i = s().gTabsPanel;
		if (!Y(i) || !X(i.init) || !X(i.showAllTabsPanel)) throw Z(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_CAPABILITY_MISSING", "firefox-toolbar-widgets-action", "window.gTabsPanel.init.showAllTabsPanel");
		let a;
		try {
			Reflect.apply(i.init, i, []), a = i.allTabsButton, i.allTabsButton = n;
		} catch (t) {
			throw Z(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_ACTION_FAILED", "firefox-toolbar-widgets-action", "window.gTabsPanel.init.allTabsButton", t);
		}
		let o = C(t);
		try {
			Reflect.apply(i.showAllTabsPanel, i, [r, po]);
		} catch (t) {
			throw m(!1), d = "", Z(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_ACTION_FAILED", "firefox-toolbar-widgets-action", "window.gTabsPanel.showAllTabsPanel", t);
		} finally {
			i.allTabsButton = a;
		}
		return await o;
	}, M = (t) => {
		if (X(t.doCommand)) try {
			Reflect.apply(t.doCommand, t, []);
			return;
		} catch {}
		let n = s().CustomEvent;
		if (!X(n) || !X(t.dispatchEvent)) throw Z(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_CAPABILITY_MISSING", "firefox-toolbar-widgets-action", "toolbar-widgets.node-command");
		let r = Reflect.construct(n, ["command", Object.freeze({
			bubbles: !0,
			cancelable: !0
		})]);
		Reflect.apply(t.dispatchEvent, t, [r]);
	}, te = (e) => {
		let t = Oa(s()), n = typeof e.id == "string" ? e.id : "";
		if (!t || !n) return "";
		try {
			let r = Reflect.apply(t.getWidget, t, [n]);
			if (Y(r) && typeof r.viewId == "string") return r.viewId;
			let i = e.parentElement, a = Y(i) && typeof i.id == "string" ? i.id : "";
			if (a && n === `${a}-dropmarker`) {
				let e = Reflect.apply(t.getWidget, t, [a]);
				if (Y(e) && e.type === "button-and-view" && typeof e.viewId == "string") return e.viewId;
			}
		} catch {
			return "";
		}
		return "";
	};
	return Object.freeze({
		dispose() {
			let e = c;
			if (m(!1), d = "", h(!1), c = null, l = "", e) try {
				Reflect.apply(e.hidePopup, e, []);
			} catch {}
		},
		invoke: async (t, n, i) => {
			if (typeof t != "string" || t === "") throw Z(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_HANDLE_INVALID", "firefox-toolbar-widgets-action", "toolbar-widgets.handle");
			let s = o(n), u = a.resolve(t);
			if (!ro(u)) throw Z(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_HANDLE_STALE", "firefox-toolbar-widgets-action", "toolbar-widgets.native-node");
			let d = D(i, s);
			r(1);
			try {
				if (c && l === t) return T(), !0;
				T(), E(s);
				let n = typeof u.id == "string" ? u.id : "";
				if (n === lo) return await ee(t, s, u, d);
				if (n === mo) return await O(t, s, ho, d);
				if (n === fo) return await j(t, s, d);
				let r = te(u);
				if (r) return await O(t, s, r, d);
				let i = k(u);
				if (i) return await A(t, s, i, d);
				let a = w(t, s, u);
				try {
					M(u);
				} catch (t) {
					throw h(!1), _(t) ? t : Z(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_ACTION_FAILED", "firefox-toolbar-widgets-action", "toolbar-widgets.node-command", t);
				}
				return await a;
			} finally {
				r(-1);
			}
		},
		onPopupHidden: S,
		onPopupShown: x
	});
}
//#endregion
//#region src/firefox/customize-layout/contracts.ts
var _o = Object.freeze(["row", "column"]), vo = Object.freeze([
	"center",
	"expanded",
	"padding"
]), yo = Object.freeze([
	"separator",
	"spacer",
	"spring"
]), bo = Object.freeze({
	adoptedMaxEntries: 64,
	containerMaxDepth: 3,
	directMaxEntries: 48,
	instanceMax: 1e6,
	serializedMaxLength: 16384,
	totalMaxNodes: 128,
	widgetIdMaxLength: 128
}), xo = /^[A-Za-z0-9_.-]{1,128}$/u, So = /^layout-([1-9][0-9]{0,5})$/u, Co = new Set(_o), wo = new Set(vo), To = new Set(yo), Eo = new Set([
	"id",
	"kind",
	"source"
]), Do = new Set([
	"instanceId",
	"style",
	"target",
	"type"
]), Oo = new Set([
	"children",
	"direction",
	"instanceId",
	"type"
]), ko = new Set([
	"children",
	"instanceId",
	"kind",
	"type"
]), Ao = new Set([
	"adopted",
	"allowMultiplePlacements",
	"nextInstance",
	"version",
	"zones"
]), jo = new Set(Ye);
function Q(e) {
	let t = Error(e);
	return t.name = "FenneviaComposableLayoutError", Object.defineProperties(t, {
		fenneviaCode: {
			enumerable: !1,
			value: e
		},
		fenneviaPhase: {
			enumerable: !1,
			value: "customize-layout"
		}
	}), t;
}
function Mo(e) {
	return typeof e == "object" && !!e;
}
function No(e, t) {
	return Object.keys(e).every((e) => t.has(e));
}
function Po(e) {
	return typeof e == "string" && Co.has(e);
}
function Fo(e) {
	return typeof e == "string" && To.has(e);
}
function Io(e) {
	return typeof e == "string" && wo.has(e);
}
function Lo(e) {
	return typeof e == "string" && xo.test(e);
}
function Ro(e) {
	if (typeof e != "string") return !1;
	let t = So.exec(e);
	if (!t) return !1;
	let n = Number(t[1]);
	return Number.isSafeInteger(n) && n > 0 && n <= bo.instanceMax;
}
function zo(e) {
	let t = So.exec(e);
	return t ? Number(t[1]) : 0;
}
function Bo(e) {
	if (!Mo(e) || !No(e, Eo)) throw Q("FENNEVIA_COMPOSABLE_LAYOUT_TARGET_INVALID");
	if (e.source === "firefox" && Lo(e.id) && e.kind === void 0) return Object.freeze({
		id: e.id,
		source: "firefox"
	});
	if (e.source === "project" && typeof e.id == "string" && Qe.has(e.id) && e.kind === void 0) return Object.freeze({
		id: e.id,
		source: "project"
	});
	if (e.source === "special" && Fo(e.kind) && e.id === void 0) return Object.freeze({
		kind: e.kind,
		source: "special"
	});
	throw Q("FENNEVIA_COMPOSABLE_LAYOUT_TARGET_INVALID");
}
function Vo(e) {
	return e.source === "special" ? null : `${e.source}:${e.id}`;
}
function Ho(e, t) {
	if (t !== void 0) {
		if (e.source !== "project" || !Nt(e.id, t)) throw Q("FENNEVIA_COMPOSABLE_LAYOUT_STYLE_INVALID");
		return t === Mt(e.id) ? void 0 : t;
	}
}
function Uo(e) {
	return e.source === "project" && e.id === "customize-shell";
}
function Wo(e) {
	return e.source === "project" && ct.has(e.id);
}
function Go(e) {
	if (!Array.isArray(e) || e.length > bo.containerMaxDepth + 1 || e.some((e) => !Number.isSafeInteger(e) || e < 0)) throw Q("FENNEVIA_COMPOSABLE_LAYOUT_PATH_INVALID");
	return e;
}
function Ko(e, t, n, r = bo.directMaxEntries) {
	if (!Array.isArray(e) || e.length > r) throw Q("FENNEVIA_COMPOSABLE_LAYOUT_NODES_INVALID");
	let i = [];
	for (let r of e) {
		if (!Mo(r)) throw Q("FENNEVIA_COMPOSABLE_LAYOUT_NODE_INVALID");
		if (n.totalNodes += 1, n.totalNodes > bo.totalMaxNodes) throw Q("FENNEVIA_COMPOSABLE_LAYOUT_TOO_LARGE");
		if (!Ro(r.instanceId) || n.instanceIds.has(r.instanceId)) throw Q("FENNEVIA_COMPOSABLE_LAYOUT_INSTANCE_INVALID");
		if (n.instanceIds.add(r.instanceId), n.maxInstance = Math.max(n.maxInstance, zo(r.instanceId)), r.type === "item" && No(r, Do)) {
			let e = Bo(r.target), t = Ho(e, r.style), a = Vo(e);
			a && n.targetCounts.set(a, (n.targetCounts.get(a) ?? 0) + 1), Uo(e) && (n.customizeCount += 1), i.push(Object.freeze({
				instanceId: r.instanceId,
				...t ? { style: t } : {},
				target: e,
				type: "item"
			}));
			continue;
		}
		if (r.type === "container" && No(r, Oo) && Po(r.direction)) {
			let e = t + 1;
			if (e > bo.containerMaxDepth) throw Q("FENNEVIA_COMPOSABLE_LAYOUT_DEPTH_INVALID");
			i.push(Object.freeze({
				children: Ko(r.children, e, n),
				direction: r.direction,
				instanceId: r.instanceId,
				type: "container"
			}));
			continue;
		}
		if (r.type === "wrapper" && No(r, ko) && Io(r.kind)) {
			let e = t + 1;
			if (e > bo.containerMaxDepth) throw Q("FENNEVIA_COMPOSABLE_LAYOUT_DEPTH_INVALID");
			i.push(Object.freeze({
				children: Ko(r.children, e, n, 1),
				instanceId: r.instanceId,
				kind: r.kind,
				type: "wrapper"
			}));
			continue;
		}
		throw Q("FENNEVIA_COMPOSABLE_LAYOUT_NODE_INVALID");
	}
	return Object.freeze(i);
}
function qo(e, t) {
	for (let [n, r] of t) {
		if (r <= 1) continue;
		let [t, i] = n.split(":", 2);
		if (!e || t === "project" && ct.has(i)) throw Q("FENNEVIA_COMPOSABLE_LAYOUT_DUPLICATE_INVALID");
	}
}
function Jo(e) {
	if (!Mo(e) || !No(e, Ao) || e.version !== 2 || typeof e.allowMultiplePlacements != "boolean" || !Number.isSafeInteger(e.nextInstance) || e.nextInstance < 1 || e.nextInstance > bo.instanceMax || !Array.isArray(e.adopted) || e.adopted.length > bo.adoptedMaxEntries || e.adopted.some((e) => !Lo(e)) || new Set(e.adopted).size !== e.adopted.length || !Mo(e.zones) || !No(e.zones, jo) || Ye.some((t) => !Array.isArray(e.zones?.[t]))) throw Q("FENNEVIA_COMPOSABLE_LAYOUT_INVALID");
	let t = {
		customizeCount: 0,
		instanceIds: new Set(),
		maxInstance: 0,
		targetCounts: new Map(),
		totalNodes: 0
	}, n = [];
	for (let r of Ye) n.push([r, Ko(e.zones[r], 0, t)]);
	if (t.customizeCount < 1) throw Q("FENNEVIA_COMPOSABLE_LAYOUT_CUSTOMIZE_REQUIRED");
	if (qo(e.allowMultiplePlacements, t.targetCounts), e.nextInstance <= t.maxInstance) throw Q("FENNEVIA_COMPOSABLE_LAYOUT_INSTANCE_INVALID");
	return Object.freeze({
		adopted: Object.freeze([...e.adopted]),
		allowMultiplePlacements: e.allowMultiplePlacements,
		nextInstance: e.nextInstance,
		version: 2,
		zones: Object.freeze(Object.fromEntries(n))
	});
}
function Yo(e, t) {
	let n = `layout-${t.value++}`;
	if (e.type === "item") {
		let t = Bo(e.target), r = Ho(t, e.style);
		return Object.freeze({
			instanceId: n,
			...r ? { style: r } : {},
			target: t,
			type: "item"
		});
	}
	if (e.type === "container" && Po(e.direction) && Array.isArray(e.children)) return Object.freeze({
		children: Object.freeze(e.children.map((e) => Yo(e, t))),
		direction: e.direction,
		instanceId: n,
		type: "container"
	});
	if (e.type === "wrapper" && Io(e.kind) && Array.isArray(e.children)) return Object.freeze({
		children: Object.freeze(e.children.map((e) => Yo(e, t))),
		instanceId: n,
		kind: e.kind,
		type: "wrapper"
	});
	throw Q("FENNEVIA_COMPOSABLE_LAYOUT_NODE_INVALID");
}
function Xo(e, t = {}) {
	let n = { value: 1 }, r = [];
	for (let t of Ye) {
		let i = e[t] ?? [];
		r.push([t, Object.freeze(i.map((e) => Yo(e, n)))]);
	}
	return Jo({
		adopted: t.adopted ?? [],
		allowMultiplePlacements: t.allowMultiplePlacements ?? !1,
		nextInstance: n.value,
		version: 2,
		zones: Object.fromEntries(r)
	});
}
function Zo(e) {
	if (typeof e != "string" || e === "" || e.length > bo.serializedMaxLength) return null;
	try {
		return Jo(JSON.parse(e));
	} catch {
		return null;
	}
}
function Qo(e) {
	let t = JSON.stringify(Jo(e));
	if (t.length > bo.serializedMaxLength) throw Q("FENNEVIA_COMPOSABLE_LAYOUT_TOO_LARGE");
	return t;
}
function $o(e) {
	return e.type === "item" ? {
		instanceId: e.instanceId,
		...e.style ? { style: e.style } : {},
		target: e.target,
		type: "item"
	} : e.type === "container" ? {
		children: e.children.map($o),
		direction: e.direction,
		instanceId: e.instanceId,
		type: "container"
	} : {
		children: e.children.map($o),
		instanceId: e.instanceId,
		kind: e.kind,
		type: "wrapper"
	};
}
function es(e) {
	return {
		adopted: [...e.adopted],
		allowMultiplePlacements: e.allowMultiplePlacements,
		nextInstance: e.nextInstance,
		version: 2,
		zones: Object.fromEntries(Ye.map((t) => [t, e.zones[t].map($o)]))
	};
}
function ts(e) {
	if (typeof e != "string" || !Ye.includes(e)) throw Q("FENNEVIA_COMPOSABLE_LAYOUT_ZONE_INVALID");
	return e;
}
function ns(e, t, n) {
	Go(n);
	let r = e.zones[ts(t)], i = bo.directMaxEntries;
	for (let e of n) {
		if (e >= r.length) throw Q("FENNEVIA_COMPOSABLE_LAYOUT_PATH_INVALID");
		let t = r[e];
		if (t.type === "item") throw Q("FENNEVIA_COMPOSABLE_LAYOUT_PARENT_INVALID");
		r = t.children, i = t.type === "wrapper" ? 1 : bo.directMaxEntries;
	}
	return Object.freeze({
		children: r,
		maxEntries: i
	});
}
function rs(e, t, n) {
	return ns(e, t, n).children;
}
function is(e, t, n = !1) {
	if (!Number.isSafeInteger(e) || e < 0 || e > (n ? t : t - 1)) throw Q("FENNEVIA_COMPOSABLE_LAYOUT_INDEX_INVALID");
	return e;
}
function as(e, t) {
	let n = Go(t.path);
	if (n.length === 0) throw Q("FENNEVIA_COMPOSABLE_LAYOUT_PATH_INVALID");
	let r = rs(e, ts(t.zone), n.slice(0, -1));
	return r[is(n.at(-1), r.length)];
}
function os(e, t) {
	return Ko([as(es(Jo(e)), t)], 0, {
		customizeCount: 0,
		instanceIds: new Set(),
		maxInstance: 0,
		targetCounts: new Map(),
		totalNodes: 0
	})[0];
}
function ss(e) {
	return Jo(e);
}
function cs(e, t) {
	if (e.nextInstance > bo.instanceMax) throw Q("FENNEVIA_COMPOSABLE_LAYOUT_TOO_LARGE");
	return {
		instanceId: `layout-${e.nextInstance++}`,
		target: Bo(t),
		type: "item"
	};
}
function ls(e, t) {
	if (e.nextInstance > bo.instanceMax || !Po(t)) throw Q("FENNEVIA_COMPOSABLE_LAYOUT_NODE_INVALID");
	return {
		children: [],
		direction: t,
		instanceId: `layout-${e.nextInstance++}`,
		type: "container"
	};
}
function us(e, t) {
	if (e.nextInstance > bo.instanceMax || !Io(t)) throw Q("FENNEVIA_COMPOSABLE_LAYOUT_NODE_INVALID");
	return {
		children: [],
		instanceId: `layout-${e.nextInstance++}`,
		kind: t,
		type: "wrapper"
	};
}
function ds(e) {
	if (e.children.length >= e.maxEntries) throw Q("FENNEVIA_COMPOSABLE_LAYOUT_CONTAINER_FULL");
}
function fs(e, t, n) {
	let r = es(Jo(e)), i = ns(r, ts(n.zone), n.parentPath), { children: a } = i;
	return is(n.index, a.length, !0), ds(i), a.splice(n.index, 0, cs(r, Bo(t))), ss(r);
}
function ps(e, t, n) {
	let r = es(Jo(e)), i = ns(r, ts(n.zone), n.parentPath), { children: a } = i;
	return is(n.index, a.length, !0), ds(i), a.splice(n.index, 0, ls(r, t)), ss(r);
}
function ms(e, t, n) {
	let r = es(Jo(e)), i = ns(r, ts(n.zone), n.parentPath), { children: a } = i;
	return is(n.index, a.length, !0), ds(i), a.splice(n.index, 0, us(r, t)), ss(r);
}
function hs(e, t) {
	let n = es(Jo(e)), r = Go(t.path);
	if (r.length === 0) throw Q("FENNEVIA_COMPOSABLE_LAYOUT_PATH_INVALID");
	let i = rs(n, ts(t.zone), r.slice(0, -1));
	return i.splice(is(r.at(-1), i.length), 1), ss(n);
}
function gs(e, t) {
	return e.length <= t.length && e.every((e, n) => e === t[n]);
}
function _s(e, t) {
	let n = t.slice(0, -1);
	if (gs(n, e) && e.length > n.length) {
		let r = n.length;
		if (e[r] > t.at(-1)) {
			let t = [...e];
			return --t[r], t;
		}
	}
	return e;
}
function vs(e, t, n) {
	let r = Jo(e), i = Go(t.path), a = Go(n.parentPath);
	if (i.length === 0) throw Q("FENNEVIA_COMPOSABLE_LAYOUT_PATH_INVALID");
	if (t.zone === n.zone && gs(i, a)) throw Q("FENNEVIA_COMPOSABLE_LAYOUT_CYCLE_INVALID");
	let o = es(r);
	as(o, t), rs(o, ts(n.zone), a);
	let s = i.slice(0, -1), c = rs(o, ts(t.zone), s), l = is(i.at(-1), c.length), [u] = c.splice(l, 1), d = t.zone === n.zone ? _s(a, i) : a, f = ns(o, ts(n.zone), d), { children: p } = f, m = n.index;
	return t.zone === n.zone && s.length === a.length && s.every((e, t) => e === a[t]) && l < m && --m, is(m, p.length, !0), ds(f), p.splice(m, 0, u), ss(o);
}
function ys(e, t) {
	if (typeof t != "boolean") throw Q("FENNEVIA_COMPOSABLE_LAYOUT_MULTIPLE_INVALID");
	return Jo({
		...e,
		allowMultiplePlacements: t
	});
}
function bs(e, t, n) {
	if (!Po(n)) throw Q("FENNEVIA_COMPOSABLE_LAYOUT_NODE_INVALID");
	let r = es(Jo(e)), i = as(r, t);
	if (i.type !== "container") throw Q("FENNEVIA_COMPOSABLE_LAYOUT_PARENT_INVALID");
	return i.direction = n, ss(r);
}
function xs(e, t, n) {
	let r = es(Jo(e)), i = as(r, t);
	if (i.type !== "item" || i.target.source !== "project" || !Nt(i.target.id, n)) throw Q("FENNEVIA_COMPOSABLE_LAYOUT_STYLE_INVALID");
	return n === Mt(i.target.id) ? delete i.style : i.style = n, ss(r);
}
function Ss(e, t) {
	for (let n of e) t(n), n.type !== "item" && Ss(n.children, t);
}
function Cs(e, t) {
	let n = Bo(t), r = Vo(n), i = 0;
	for (let t of Ye) Ss(e.zones[t], (e) => {
		e.type === "item" && (r === null ? e.target.source === "special" && n.source === "special" && e.target.kind === n.kind : Vo(e.target) === r) && (i += 1);
	});
	return i;
}
function ws(e, t) {
	let n = Bo(t), r = Vo(n), i = (e, t, a) => {
		for (let [o, s] of e.entries()) {
			let e = [...a, o];
			if (s.type === "item" && (r === null ? s.target.source === "special" && n.source === "special" && s.target.kind === n.kind : Vo(s.target) === r)) return Object.freeze({
				path: Object.freeze(e),
				zone: t
			});
			if (s.type !== "item") {
				let n = i(s.children, t, e);
				if (n) return n;
			}
		}
		return null;
	};
	for (let t of Ye) {
		let n = i(e.zones[t], t, []);
		if (n) return n;
	}
	return null;
}
function Ts(e, t) {
	if (!Lo(t)) throw Q("FENNEVIA_COMPOSABLE_LAYOUT_TARGET_INVALID");
	if (e.adopted.includes(t)) return e;
	if (e.adopted.length >= bo.adoptedMaxEntries) throw Q("FENNEVIA_COMPOSABLE_LAYOUT_TOO_LARGE");
	return Jo({
		...e,
		adopted: [...e.adopted, t]
	});
}
function Es(e, t) {
	return e.adopted.includes(t) ? Jo({
		...e,
		adopted: e.adopted.filter((e) => e !== t)
	}) : e;
}
function Ds(e, t) {
	return Cs(e, {
		id: t,
		source: "firefox"
	}) > 0;
}
function Os(e) {
	return Wo(Bo(e));
}
function ks(e, t) {
	let n = Jo(e);
	for (let e of Ye) {
		if (!t[e]) continue;
		let r = !1;
		if (Ss(n.zones[e], (e) => {
			e.type === "item" && e.target.source === "project" && e.target.id === "customize-shell" && (r = !0);
		}), r) return !0;
	}
	return !1;
}
//#endregion
//#region src/firefox/customize-layout/migration.ts
var $ = (e) => Object.freeze({
	target: Object.freeze({
		id: e,
		source: "project"
	}),
	type: "item"
}), As = (e, t) => Object.freeze({
	children: Object.freeze([t]),
	kind: e,
	type: "wrapper"
}), js = (e) => e.type === "widget" ? Object.freeze({
	id: e.id,
	source: "firefox"
}) : e.type === "fennevia" ? Object.freeze({
	id: e.id,
	source: "project"
}) : Object.freeze({
	kind: e.kind,
	source: "special"
}), Ms = (e) => Object.freeze(e.map((e) => Object.freeze({
	target: js(e),
	type: "item"
})));
function Ns(e = "tabs-left") {
	let t = e === "tabs-left" ? "left" : "right", n = t === "left" ? "right" : "left", r = {
		left: Object.freeze([]),
		right: Object.freeze([])
	};
	return r[t] = Object.freeze([$("new-tab"), As("expanded", $("tabs"))]), r[n] = Object.freeze([As("expanded", $("bookmarks"))]), Xo({
		bottom: [As("expanded", As("center", $("downloads-status")))],
		left: r.left,
		right: r.right,
		top: [
			$("back"),
			$("forward"),
			$("reload-stop"),
			$("home"),
			$("trust"),
			As("expanded", $("address-launcher")),
			$("show-downloads"),
			$("extensions"),
			$("settings"),
			$("customize-shell"),
			$("application-menu"),
			$("private-indicator"),
			$("minimize-window"),
			$("toggle-maximize-window"),
			$("close-window")
		]
	});
}
function Ps(e, t) {
	let n = t === "tabs-left" ? "left" : "right", r = n === "left" ? "right" : "left", i = {
		left: Ms(e.zones.left),
		right: Ms(e.zones.right)
	};
	return i[n] = Object.freeze([
		$("trust"),
		$("address-launcher"),
		As("expanded", $("tabs")),
		...i[n]
	]), i[r] = Object.freeze([As("expanded", $("bookmarks")), ...i[r]]), Xo({
		bottom: [$("downloads-status"), ...Ms(e.zones.bottom)],
		left: i.left,
		right: i.right,
		top: [
			$("back"),
			$("forward"),
			$("reload-stop"),
			$("home"),
			...Ms(e.zones.top),
			$("extensions"),
			$("settings"),
			$("customize-shell"),
			$("application-menu"),
			$("private-indicator"),
			$("minimize-window"),
			$("toggle-maximize-window"),
			$("close-window")
		]
	}, { adopted: e.adopted });
}
//#endregion
//#region src/firefox/toolbar-widgets/controller.ts
function Fs(e) {
	return !(e instanceof Error) || e.name !== "FenneviaComposableLayoutError" ? !1 : Reflect.get(e, "fenneviaPhase") === "customize-layout" && typeof Reflect.get(e, "fenneviaCode") == "string";
}
var Is = new Map([
	["address-launcher", {
		icon: "search",
		label: "Address launcher",
		tooltip: "Open address and search"
	}],
	["application-menu", {
		icon: "menu",
		label: "Firefox menu",
		tooltip: "Open the Firefox application menu"
	}],
	["back", {
		icon: "back",
		label: "Back",
		tooltip: "Go back"
	}],
	["bookmarks", {
		icon: "bookmark",
		label: "Bookmarks",
		tooltip: "Browse bookmarks"
	}],
	["close-window", {
		icon: "close",
		label: "Close window",
		tooltip: "Close this window"
	}],
	["customize-shell", {
		icon: "customize",
		label: "Customize Fennevia",
		tooltip: "Customize panels and widgets"
	}],
	["downloads-status", {
		icon: "download",
		label: "Download status",
		tooltip: "Show download progress and status"
	}],
	["extensions", {
		icon: "extension",
		label: "Extensions",
		tooltip: "Open Unified Extensions"
	}],
	["forward", {
		icon: "forward",
		label: "Forward",
		tooltip: "Go forward"
	}],
	["home", {
		icon: "home",
		label: "Home",
		tooltip: "Open the home page"
	}],
	["minimize-window", {
		icon: "minimize",
		label: "Minimize window",
		tooltip: "Minimize this window"
	}],
	["new-tab", {
		icon: "plus",
		label: "New tab",
		tooltip: "Open a new tab"
	}],
	["private-indicator", {
		icon: "private",
		label: "Private browsing",
		tooltip: "Private browsing window"
	}],
	["reload-stop", {
		icon: "reload",
		label: "Reload or stop",
		tooltip: "Reload or stop loading"
	}],
	["settings", {
		icon: "settings",
		label: "Settings",
		tooltip: "Open Firefox settings"
	}],
	["show-bookmarks", {
		icon: "bookmark",
		label: "Show bookmarks panel",
		tooltip: "Reveal the Fennevia bookmarks panel"
	}],
	["show-downloads", {
		icon: "download",
		label: "Open Firefox downloads",
		tooltip: "Open the Firefox downloads panel"
	}],
	["show-translate", {
		icon: "translate",
		label: "Translate this page",
		tooltip: "Open Firefox built-in translations"
	}],
	["tabs", {
		icon: "tab",
		label: "Tabs",
		tooltip: "Browse open tabs"
	}],
	["toggle-maximize-window", {
		icon: "maximize",
		label: "Maximize or restore window",
		tooltip: "Maximize or restore this window"
	}],
	["trust", {
		icon: "shield",
		label: "Site trust",
		tooltip: "Open site information and protections"
	}]
]);
function Ls({ boundary: e, frame: t, window: n }) {
	if (e.assertOwnsWindow(n), !Y(n) || !Y(t) || typeof t.contains != "function") throw Z(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_OPTIONS_INVALID", "firefox-toolbar-widgets-create", "window");
	let r = (e) => Reflect.apply(t.contains, t, [e]) === !0, i = n, a = !1, o = 0, s = 0, c = !1, l = !1, u = !1, d = "", f = on(), p = null, m = null, h = null, g = qt(), v = 0, y = new Map(), b = new Map(), x = null, S = null, C, w = new Set(), T = [], E = new Set(), D = new Set(), O = e.createHandleRegistry("toolbar-widget"), k = () => {
		if (a || !i) throw Z(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_DISPOSED", "firefox-toolbar-widgets-access", "window");
		return i;
	}, A = () => {
		let t = Fa(k()), n = t.find((e) => e.snapshot.requirement === "required" && !e.snapshot.available);
		if (n) throw Z(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_CAPABILITY_MISSING", "firefox-toolbar-widgets-capability", n.snapshot.symbol, n.cause);
		return Object.freeze(t.map((e) => e.snapshot));
	}, ee = go({
		boundary: e,
		getWindowOrNull: () => i,
		isDisposed: () => a,
		onActionDelta(e) {
			o += e;
		},
		popupListeners: D,
		registry: O,
		requireProjectHost: (t) => {
			let n = k();
			if (!Y(t) || !X(t.getBoundingClientRect) || t.ownerDocument !== n.document || r(t) !== !0) throw Z(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_HOST_INVALID", "firefox-toolbar-widgets-action", "toolbar-widgets.host");
			return t;
		},
		requireWindow: k
	}), { invoke: j, onPopupHidden: M, onPopupShown: te } = ee, N = e.snapshot().windowKind === "private", ne = (e, t) => {
		try {
			let n = Reflect.apply(e.getWidget, e, [t]);
			return Y(n) ? n : null;
		} catch {
			return null;
		}
	}, re = (e) => {
		let t = i;
		if (!t) return null;
		let n = t.gNavToolbox;
		if (!Y(n)) return null;
		let r = n.palette;
		if (!Y(r) || !X(r.getElementsByAttribute)) return null;
		try {
			return Wa(Reflect.apply(r.getElementsByAttribute, r, ["id", e]));
		} catch {
			return null;
		}
	}, P = (e) => {
		let t = i;
		if (!t) return null;
		let n = za(t, e);
		return Ca(n) ? n : re(e);
	}, ie = () => {
		if (C !== void 0) return C;
		C = null;
		let e = i;
		if (!e || !X(e.Localization)) return null;
		let t = e.document, n = Y(t) ? eo(t) : [...va];
		try {
			let t = Reflect.construct(e.Localization, [n, !0]);
			return !Y(t) || !X(t.formatMessagesSync) && !X(t.formatValueSync) ? null : (C = t, t);
		} catch {
			return null;
		}
	}, F = (e) => {
		if (!e) return "";
		let t = ie();
		if (t) {
			let n = Qa(t, e);
			if (n) return n;
		}
		let n = i;
		if (!n) return "";
		let r = n.document;
		if (!Y(r)) return "";
		let a = r.l10n;
		return Y(a) ? Qa(a, e) : "";
	}, I = (e, t, n) => {
		if (!X(e.getLocalizedProperty)) return "";
		try {
			let r = Reflect.apply(e.getLocalizedProperty, e, [t, n]);
			return typeof r != "string" || r === "" ? "" : no(r, 200, t);
		} catch {
			return "";
		}
	}, L = (e, t, n, r, i) => {
		let a = r ? no(Va(r, "label") || Ra(r, "label"), 200, t) : "", o = r ? no(Va(r, "title") || Ra(r, "title"), 200, t) : "", s = r ? no(Va(r, "tooltiptext") || Ra(r, "tooltiptext"), 200, t) : "", c = no(Ra(n, "label"), 200, t), l = no(Ra(n, "tooltiptext"), 200, t), u = r ? F(Va(r, "data-l10n-id")) : "", d = F(ya.get(t) ?? "");
		return a || o || c || u || I(e, t, "label") || d || s || l || I(e, t, "tooltiptext") || (i ? "Extension" : "Toolbar item");
	}, ae = (e, t, n, r) => {
		let i = n ? no(Va(n, "tooltiptext") || Ra(n, "tooltiptext"), 300, e) : "", a = n ? no(Va(n, "title") || Ra(n, "title"), 300, e) : "", o = no(Ra(t, "tooltiptext"), 300, e);
		return i || a || o || r;
	}, oe = () => {
		let e = new Map(), t = i;
		if (!t) return e;
		let n = t.document;
		if (!Y(n)) return e;
		let r = n.styleSheets;
		if (!Y(r) || typeof r.length != "number") return e;
		let a = r.length;
		for (let t = 0; t < a; t += 1) {
			let n;
			try {
				n = r[t];
			} catch {
				continue;
			}
			if (!Y(n)) continue;
			let i;
			try {
				i = n.cssRules;
			} catch {
				continue;
			}
			if (!Y(i) || typeof i.length != "number") continue;
			let a = i.length;
			for (let t = 0; t < a; t += 1) Ja(i[t], e);
		}
		return e;
	}, se = (e) => (S ||= oe(), S.get(e) ?? ""), ce = (e) => {
		let t = i;
		if (!t || !X(t.getComputedStyle)) return "";
		let n = [e], r = Ba(e, "toolbarbutton");
		Ca(r) && n.unshift(r);
		for (let e of n) try {
			let n = Ga(Reflect.apply(t.getComputedStyle, t, [e]));
			if (Ua(n, "builtin")) return n;
		} catch {}
		return "";
	}, le = (t, n) => {
		if (n) {
			let e = ce(n);
			if (e) return e;
		}
		let r = se(t);
		if (r) return r;
		let i = xa(t, e.snapshot().firefoxVersion);
		return Ua(i, "builtin") ? i : "";
	}, ue = (e) => Object.freeze({
		badgeBackground: "",
		badgeText: "",
		badgeTextColor: "",
		disabled: !1,
		fenneviaAction: "",
		handle: "",
		icon: "",
		iconUrl: "",
		kind: e,
		label: "",
		missing: !1,
		parts: Object.freeze([]),
		tooltip: ""
	}), de = (e) => {
		let t = Sa.get(e);
		return Object.freeze({
			badgeBackground: "",
			badgeText: "",
			badgeTextColor: "",
			disabled: !1,
			fenneviaAction: e,
			handle: "",
			icon: t?.icon ?? "generic",
			iconUrl: "",
			kind: "fennevia",
			label: t?.label ?? "Fennevia control",
			missing: !1,
			parts: Object.freeze([]),
			tooltip: t?.tooltip ?? t?.label ?? ""
		});
	}, fe = (e) => {
		let t = Is.get(e);
		return Object.freeze({
			badgeBackground: "",
			badgeText: "",
			badgeTextColor: "",
			disabled: !1,
			fenneviaAction: "",
			handle: "",
			icon: t?.icon ?? "generic",
			iconUrl: "",
			kind: "project",
			label: t?.label ?? "Fennevia widget",
			missing: !1,
			parts: Object.freeze([]),
			tooltip: t?.tooltip ?? t?.label ?? ""
		});
	}, pe = (e, t) => {
		let n = ne(e, t), r = n?.webExtension === !0 || Ma(e, t), i = P(t), a = L(e, t, n, i, r), o = "";
		if (r && i) {
			let e = io(i);
			o = e ? ao(e) : "";
		} else r || (o = le(t, i));
		return Object.freeze({
			badgeBackground: "",
			badgeText: "",
			badgeTextColor: "",
			disabled: !0,
			fenneviaAction: "",
			handle: "",
			icon: r ? "extension" : _a.get(t) ?? "generic",
			iconUrl: o,
			kind: r ? "extension-action" : "built-in",
			label: a,
			missing: !0,
			parts: Object.freeze([]),
			tooltip: ae(t, n, i, a)
		});
	}, me = (e, t, n) => {
		let r = ga.get(t);
		if (!r) return Object.freeze([]);
		let i = [];
		for (let e of r) {
			let t = Ba(n, `#${e.nodeId}`);
			if (!Ca(t) || !ro(t)) return null;
			i.push(Object.freeze({
				node: t,
				specification: e
			}));
		}
		return Object.freeze(i.map(({ node: t, specification: r }) => {
			let i = no(Va(t, "label") || Ra(t, "label"), 200, r.nodeId), a = L(e, r.nodeId, null, t, !1) || r.fallbackLabel;
			return Object.freeze({
				disabled: co(n) || co(t),
				handle: O.register(t),
				icon: r.icon,
				iconUrl: le(r.nodeId, t),
				kind: "built-in",
				label: a,
				tooltip: ae(r.nodeId, null, t, a),
				valueText: r.displayLabel ? i : ""
			});
		}));
	}, he = (e, t) => {
		let n = za(k(), t);
		if (!Ca(n) || !ro(n)) return Object.freeze({
			node: null,
			widget: pe(e, t)
		});
		let r = ne(e, t), i = r?.webExtension === !0 || Ma(e, t), a = i ? Object.freeze([]) : me(e, t, n);
		if (a === null) return Object.freeze({
			node: n,
			widget: pe(e, t)
		});
		let o = O.register(n);
		if (i) {
			let i = io(n), a = i ? oo(i) : Object.freeze({
				background: "",
				text: "",
				textColor: ""
			}), s = so(n) || L(e, t, r, n, !0);
			return Object.freeze({
				node: n,
				widget: Object.freeze({
					badgeBackground: a.background,
					badgeText: a.text,
					badgeTextColor: a.textColor,
					disabled: co(i || n),
					fenneviaAction: "",
					handle: o,
					icon: "extension",
					iconUrl: i ? ao(i) : "",
					kind: "extension-action",
					label: s,
					missing: !1,
					parts: Object.freeze([]),
					tooltip: ae(t, r, n, s)
				})
			});
		}
		let s = L(e, t, r, n, !1);
		return Object.freeze({
			node: n,
			widget: Object.freeze({
				badgeBackground: "",
				badgeText: "",
				badgeTextColor: "",
				disabled: co(n),
				fenneviaAction: "",
				handle: o,
				icon: _a.get(t) ?? "generic",
				iconUrl: le(t, n),
				kind: "built-in",
				label: s,
				missing: !1,
				parts: a,
				tooltip: ae(t, r, n, s)
			})
		});
	}, ge = () => {
		if (p) return p;
		let e = (h ?? Wt()).sidePanelLayout;
		return m ? Ps(m, e) : Ns(e);
	}, _e = (e, t, n, r) => {
		if (t.type === "container") return Object.freeze({
			children: Object.freeze(t.children.map((t) => _e(e, t, n, r))),
			direction: t.direction,
			instanceId: t.instanceId,
			type: "container"
		});
		if (t.type === "wrapper") return Object.freeze({
			children: Object.freeze(t.children.map((t) => _e(e, t, n, r))),
			instanceId: t.instanceId,
			kind: t.kind,
			type: "wrapper"
		});
		let i, a = "";
		t.target.source === "project" ? (a = t.target.id, i = Object.freeze({
			node: null,
			widget: fe(t.target.id)
		})) : i = t.target.source === "special" ? Object.freeze({
			node: null,
			widget: ue(t.target.kind)
		}) : he(e, t.target.id), n.push(i.node), i.widget.handle !== "" && r.add(i.widget.handle);
		for (let e of i.widget.parts) r.add(e.handle);
		return Object.freeze({
			instanceId: t.instanceId,
			projectId: a,
			style: a === "" ? "" : t.style ?? Mt(a),
			type: "item",
			widget: i.widget
		});
	}, R = (e) => {
		let t = [], n = (e) => {
			for (let r of e) r.type === "item" ? r.projectId === "" ? t.push(r.widget) : (r.projectId === "show-bookmarks" || r.projectId === "show-downloads" || r.projectId === "show-translate") && t.push(de(r.projectId)) : n(r.children);
		};
		return n(e), Object.freeze(t);
	}, z = (e) => {
		let t = y.get(e);
		if (t) return t;
		let n = `palette-${++v}`;
		return y.set(e, n), n;
	}, ve = (e) => {
		let t;
		try {
			t = e.areas;
		} catch {
			t = void 0;
		}
		let n = Array.isArray(t) ? t : [Yi], r = [], i = new Set();
		for (let t of n) {
			if (typeof t != "string") continue;
			let n;
			try {
				n = Reflect.apply(e.getWidgetIdsInArea, e, [t]);
			} catch {
				continue;
			}
			if (Array.isArray(n)) for (let e of n) typeof e == "string" && !i.has(e) && (i.add(e), r.push(e));
		}
		return r;
	}, ye = (e) => {
		if (!X(e.getUnusedWidgets)) return [];
		let t = i?.gNavToolbox, n = Y(t) ? t.palette : void 0;
		if (!Y(n)) return [];
		try {
			let t = Reflect.apply(e.getUnusedWidgets, e, [n]);
			if (!Array.isArray(t)) return [];
			let r = [];
			for (let e of t) Y(e) && typeof e.id == "string" && r.push(e.id);
			return r;
		} catch {
			return [];
		}
	}, be = (e, t) => {
		if (ha.has(t) || La(t) !== null || !gn(t)) return null;
		let n = ne(e, t);
		if (N && n?.showInPrivateBrowsing === !1) return null;
		let r = n?.webExtension === !0 || Ma(e, t), i = P(t), a = Ca(i) && ro(i) ? i : null, o, s;
		if (r) {
			let r = a ? io(a) : i ? io(i) : null;
			s = r ? ao(r) : "", o = (a ? so(a) : "") || L(e, t, n, i, !0);
		} else o = L(e, t, n, i, !1), s = le(t, i);
		let c = z(`w:${t}`);
		return b.set(c, Object.freeze({
			id: t,
			source: "firefox"
		})), Object.freeze({
			featureGroup: "",
			icon: r ? "extension" : _a.get(t) ?? "generic",
			iconUrl: s,
			kind: r ? "extension-action" : "built-in",
			label: o,
			token: c
		});
	}, xe = (e, t) => {
		b.clear();
		let n = [], r = new Set(), i = (e) => {
			for (let t of e) t.type === "item" ? t.target.source === "firefox" && r.add(t.target.id) : i(t.children);
		};
		for (let e of Ye) i(t.zones[e]);
		let a = [...it, ...Ze.filter((e) => !at.has(e))].filter((e) => {
			let n = Object.freeze({
				id: e,
				source: "project"
			});
			return !(Cs(t, n) > 0 && (!t.allowMultiplePlacements || Os(n)));
		}), o = new Set(a.filter((e) => tt.has(e)).map((e) => ot[e]));
		for (let e of a) {
			let t = Object.freeze({
				id: e,
				source: "project"
			}), r = Is.get(e), i = z(`p:${e}`), a = ot[e] ?? "", s = tt.has(e), c = rt.has(e) && a !== "" && o.has(a);
			b.set(i, t), n.push(Object.freeze({
				featureGroup: s || c ? a : "",
				icon: r?.icon ?? "generic",
				iconUrl: "",
				kind: s ? "feature" : c ? "feature-companion" : "project",
				label: r?.label ?? "Fennevia widget",
				token: i
			}));
		}
		let s = [...ve(e), ...ye(e)], c = new Set();
		for (let i of s) {
			if (c.has(i) || r.has(i) && !t.allowMultiplePlacements || n.length >= 256) continue;
			c.add(i);
			let a = be(e, i);
			a && n.push(a);
		}
		for (let [e, t] of [
			["separator", "Separator"],
			["spacer", "Space"],
			["spring", "Flexible space"]
		]) {
			let r = z(`s:${e}`);
			b.set(r, Object.freeze({
				kind: e,
				source: "special"
			})), n.push(Object.freeze({
				featureGroup: "",
				icon: "",
				iconUrl: "",
				kind: "special",
				label: t,
				token: r
			}));
		}
		for (let [e, t] of [["row", "Row"], ["column", "Column"]]) {
			let r = z(`c:${e}`);
			b.set(r, Object.freeze({
				direction: e,
				source: "container"
			})), n.push(Object.freeze({
				featureGroup: "",
				icon: e === "row" ? "row" : "column",
				iconUrl: "",
				kind: "container",
				label: t,
				token: r
			}));
		}
		for (let [e, t] of [
			["center", "Center"],
			["expanded", "Expanded"],
			["padding", "Padding"]
		]) {
			let r = z(`r:${e}`);
			b.set(r, Object.freeze({
				kind: e,
				source: "wrapper"
			})), n.push(Object.freeze({
				featureGroup: "",
				icon: e,
				iconUrl: "",
				kind: "wrapper",
				label: t,
				token: r
			}));
		}
		return Object.freeze(n);
	}, Se = (e) => {
		if (Y(x) && X(x.disconnect)) try {
			Reflect.apply(x.disconnect, x, []);
		} catch {}
		x = null;
		let t = i;
		if (!t) return;
		let n = t.MutationObserver;
		if (X(n)) try {
			let t = Reflect.construct(n, [() => {
				Te();
			}]);
			if (!X(t.observe)) return;
			for (let n of e) n && Reflect.apply(t.observe, t, [n, Object.freeze({
				attributeFilter: Object.freeze([
					"badge",
					"badgeStyle",
					"disabled",
					"label",
					"style",
					"tooltiptext"
				]),
				attributes: !0,
				subtree: !0
			})]);
			x = t;
		} catch {
			x = null;
		}
	}, Ce = () => {
		let e = k(), t = Oa(e);
		if (!t) return b.clear(), Se([]), Object.freeze({
			serialized: "unavailable",
			snapshot: on()
		});
		let n = ge(), r = [], i = [], a = [], o = new Set();
		for (let e of Ye) {
			let s = Object.freeze(n.zones[e].map((e) => _e(t, e, a, o)));
			i.push([e, s]), r.push([e, R(s)]);
		}
		for (let e of w) if (!o.has(e)) try {
			O.release(e);
		} catch {}
		w.clear();
		for (let e of o) w.add(e);
		Se(a);
		let s = ka(e), c = Object.freeze({
			allowMultiplePlacements: n.allowMultiplePlacements,
			available: !0,
			canEdit: s !== null,
			layout: Object.freeze(Object.fromEntries(i)),
			layoutCustomized: p !== null || m !== null,
			palette: xe(t, n),
			panels: Gt(h ?? Wt()),
			panelsCustomized: h !== null,
			style: $t(g),
			zones: Object.freeze(Object.fromEntries(r))
		});
		return Object.freeze({
			serialized: JSON.stringify(c),
			snapshot: c
		});
	}, we = () => {
		if (a) return;
		let e = Ce();
		if (e.serialized === d) return;
		d = e.serialized, f = e.snapshot, s += 1;
		let t = Object.freeze({
			revision: s,
			snapshot: f,
			type: "snapshot"
		});
		for (let e of Array.from(E)) e(t);
	}, Te = () => {
		if (a || c) return;
		c = !0;
		let e = () => {
			c = !1, !a && we();
		}, t = i, n = t?.setTimeout;
		if (t && X(n)) {
			Reflect.apply(n, t, [e, 0]);
			return;
		}
		queueMicrotask(e);
	}, B = Object.freeze({
		onAreaReset: () => Te(),
		onCustomizeEnd: () => Te(),
		onWidgetAdded: () => Te(),
		onWidgetCreated: () => Te(),
		onWidgetDestroyed: () => Te(),
		onWidgetInstanceRemoved: () => Te(),
		onWidgetMoved: () => Te(),
		onWidgetOverflow: () => Te(),
		onWidgetRemoved: () => Te(),
		onWidgetReset: () => Te(),
		onWidgetUndoMove: () => Te(),
		onWidgetUnderflow: () => Te()
	}), Ee = () => {
		if (!l) return;
		l = !1;
		let e = i;
		if (!e) return;
		let t = Oa(e);
		if (t) try {
			Reflect.apply(t.removeListener, t, [B]);
		} catch {}
	}, V = () => {
		let e = i;
		if (!e) return;
		let t = ka(e);
		if (!t) {
			p = null, m = null, h = null, g = qt();
			return;
		}
		let n = Aa(t, Zi);
		p = Zo(n), m = p ? null : Sn(n), h = kn(Aa(t, $i)), g = wn(Aa(t, "fennevia.customize.style")) ?? qt();
	}, De = Object.freeze({ observe: () => {
		a || (V(), Te());
	} }), Oe = () => {
		if (!u) return;
		u = !1;
		let e = i, t = e ? ka(e) : null;
		if (t) try {
			Reflect.apply(t.removeObserver, t, [ea, De]);
		} catch {}
	}, ke = () => {
		let t = ka(k());
		if (!t) throw Z(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_UNAVAILABLE", "firefox-toolbar-widgets-edit", "window.Services.prefs");
		return t;
	}, H = (e) => {
		let t = ke();
		Reflect.apply(t.setStringPref, t, [Zi, Qo(e)]), p = e, m = null;
	}, Ae = (e) => {
		let t = ke();
		Reflect.apply(t.setStringPref, t, [Qi, Tn(e)]), g = e;
	}, je = (e) => {
		let t = ke();
		Reflect.apply(t.setStringPref, t, [$i, An(e)]), h = e;
	}, Me = (t, n, r) => {
		let i = "";
		if (X(t.getPlacementOfWidget)) try {
			let e = Reflect.apply(t.getPlacementOfWidget, t, [r]);
			Y(e) && typeof e.area == "string" && (i = e.area);
		} catch {
			i = "";
		}
		if (i !== "" && i !== ja(t)) return n;
		if (!X(t.addWidgetToArea)) throw Z(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_UNAVAILABLE", "firefox-toolbar-widgets-edit", "window.CustomizableUI.addWidgetToArea");
		return Reflect.apply(t.addWidgetToArea, t, [r, Yi]), Ts(n, r);
	}, Ne = (e, t, n) => {
		if (!t.adopted.includes(n)) return t;
		if (Ma(e, n)) {
			if (X(e.addWidgetToArea)) try {
				Reflect.apply(e.addWidgetToArea, e, [n, ja(e)]);
			} catch {}
		} else if (X(e.removeWidgetFromArea)) try {
			Reflect.apply(e.removeWidgetFromArea, e, [n]);
		} catch {}
		return Es(t, n);
	}, Pe = () => {
		let t = Oa(k());
		if (!t) throw Z(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_UNAVAILABLE", "firefox-toolbar-widgets-edit", "window.CustomizableUI");
		return t;
	}, Fe = (e) => e.type === "item" ? e.target.source === "firefox" ? Object.freeze([e.target.id]) : Object.freeze([]) : Object.freeze(e.children.flatMap(Fe)), Ie = (e) => e.source !== "project" || e.id === "show-bookmarks" || e.id === "show-downloads" || e.id === "show-translate", Le = (e, t) => {
		let n = [], r = (e, i) => {
			for (let [a, o] of e.entries()) {
				let e = Object.freeze([...i, a]);
				o.type === "item" ? Ie(o.target) && n.push(Object.freeze({
					path: e,
					zone: t
				})) : r(o.children, e);
			}
		};
		return r(e.zones[t], []), Object.freeze(n);
	}, Re = (e, t, n) => {
		let r = Le(e, t), i = r[n];
		if (i) return Object.freeze({
			index: i.path.at(-1),
			parentPath: Object.freeze(i.path.slice(0, -1)),
			zone: t
		});
		let a = r.at(-1);
		if (a && n === r.length) return Object.freeze({
			index: a.path.at(-1) + 1,
			parentPath: Object.freeze(a.path.slice(0, -1)),
			zone: t
		});
		let o = e.zones[t];
		if (n === 0 && o.length === 1 && o[0]?.type === "container") return Object.freeze({
			index: o[0].children.length,
			parentPath: Object.freeze([0]),
			zone: t
		});
		if (n === r.length) return Object.freeze({
			index: o.length,
			parentPath: Object.freeze([]),
			zone: t
		});
		throw Error("FENNEVIA_COMPOSABLE_LAYOUT_INDEX_INVALID");
	}, ze = (e, t, n, r) => {
		let i = ws(t, n);
		if (i && n.source !== "special" && (!t.allowMultiplePlacements || Os(n))) return vs(t, i, r);
		let a = t;
		return n.source === "firefox" && !Ds(a, n.id) && (a = Me(e, a, n.id)), fs(a, n, r);
	}, Be = (e, t, n) => {
		let r = os(t, n), i = hs(t, n);
		for (let t of new Set(Fe(r))) Ds(i, t) || (i = Ne(e, i, t));
		return i;
	}, Ve = (e) => Object.freeze({
		bottom: e.bottomPanelEnabled,
		left: e.leftPanelEnabled,
		right: e.rightPanelEnabled,
		top: !0
	}), He = (e) => {
		let t = h ?? Wt();
		if (!ks(e, Ve(t))) throw Error("FENNEVIA_COMPOSABLE_LAYOUT_CUSTOMIZE_INACCESSIBLE");
		H(e);
	}, Ue = Object.freeze({
		edit: async (t) => {
			k();
			let n;
			try {
				n = ln(t);
			} catch (t) {
				throw Z(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_INVALID", "firefox-toolbar-widgets-edit", "toolbar-widgets.edit", t);
			}
			o += 1;
			try {
				if (n.type === "set-style") return Ae($t({
					...g,
					...n.style
				})), we(), !0;
				if (n.type === "reset-style") {
					let e = ke();
					try {
						Reflect.apply(e.clearUserPref, e, [Qi]);
					} catch {}
					return g = qt(), we(), !0;
				}
				if (n.type === "set-panels") {
					let t = Gt({
						...h ?? Wt(),
						...n.panels
					});
					if (Pe(), !ks(ge(), Ve(t))) throw Z(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_INVALID", "firefox-toolbar-widgets-edit", "toolbar-widgets.customize-access");
					return je(t), we(), !0;
				}
				if (n.type === "reset-panels") {
					let e = ke();
					try {
						Reflect.apply(e.clearUserPref, e, [$i]);
					} catch {}
					return h = null, we(), !0;
				}
				let t = Pe();
				if (ke(), n.revision !== s) throw Z(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_STALE", "firefox-toolbar-widgets-edit", "toolbar-widgets.edit-revision");
				let r = ge();
				try {
					switch (n.type) {
						case "add": {
							let i = b.get(n.token);
							if (!i) throw Z(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_INVALID", "firefox-toolbar-widgets-edit", "toolbar-widgets.palette-token");
							let a = Re(r, n.zone, n.index);
							He(i.source === "container" ? ps(r, i.direction, a) : i.source === "wrapper" ? ms(r, i.kind, a) : ze(t, r, i, a));
							break;
						}
						case "add-node": {
							let e = b.get(n.token);
							if (!e) throw Error("FENNEVIA_COMPOSABLE_LAYOUT_PALETTE_INVALID");
							let i = {
								index: n.index,
								parentPath: n.parentPath,
								zone: n.zone
							};
							He(e.source === "container" ? ps(r, e.direction, i) : e.source === "wrapper" ? ms(r, e.kind, i) : ze(t, r, e, i));
							break;
						}
						case "add-container":
							He(ps(r, n.direction, {
								index: n.index,
								parentPath: n.parentPath,
								zone: n.zone
							}));
							break;
						case "move": {
							let e = Le(r, n.fromZone)[n.fromIndex];
							if (!e) throw Error("FENNEVIA_COMPOSABLE_LAYOUT_INDEX_INVALID");
							He(vs(r, e, Re(r, n.toZone, n.toIndex)));
							break;
						}
						case "move-node":
							He(vs(r, n.from, n.to));
							break;
						case "remove": {
							let e = Le(r, n.zone)[n.index];
							if (!e) throw Error("FENNEVIA_COMPOSABLE_LAYOUT_INDEX_INVALID");
							He(Be(t, r, e));
							break;
						}
						case "remove-node":
							He(Be(t, r, n.location));
							break;
						case "set-multiple-placements":
							He(ys(r, n.allow));
							break;
						case "set-container-direction":
							He(bs(r, n.location, n.direction));
							break;
						case "set-node-style":
							He(xs(r, n.location, n.style));
							break;
						case "clean-layout": {
							let e = r;
							for (let n of [...r.adopted]) e = Ne(t, e, n);
							He(Xo({ top: [{
								target: {
									id: "customize-shell",
									source: "project"
								},
								type: "item"
							}] }, {
								adopted: e.adopted,
								allowMultiplePlacements: r.allowMultiplePlacements
							}));
							break;
						}
						case "reset-layout": {
							let e = r;
							for (let n of [...r.adopted]) e = Ne(t, e, n);
							let n = ke();
							try {
								Reflect.apply(n.clearUserPref, n, [Zi]);
							} catch {}
							p = null, m = null;
							break;
						}
					}
				} catch (t) {
					throw _(t) ? t : Fs(t) ? Z(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_INVALID", "firefox-toolbar-widgets-edit", "toolbar-widgets.composable-layout", t) : Z(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_FAILED", "firefox-toolbar-widgets-edit", "toolbar-widgets.edit", t);
				}
				return we(), !0;
			} finally {
				--o;
			}
		},
		invoke: j,
		snapshot() {
			k();
			let e = Ce();
			return d = e.serialized, f = e.snapshot, f;
		},
		subscribe(t) {
			if (k(), typeof t != "function") throw Z(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_LISTENER_INVALID", "firefox-toolbar-widgets-subscribe", "toolbar-widgets.subscribe");
			E.add(t);
			let n = !0;
			return Object.freeze(() => n ? (n = !1, E.delete(t), !0) : !1);
		},
		subscribePopup(t) {
			if (k(), typeof t != "function") throw Z(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_LISTENER_INVALID", "firefox-toolbar-widgets-subscribe", "toolbar-widgets.subscribe");
			D.add(t);
			let n = !0;
			return Object.freeze(() => n ? (n = !1, D.delete(t), !0) : !1);
		}
	});
	try {
		A();
		let t = k().document;
		T.push(e.subscribe(t, "popupshown", te, na), e.subscribe(t, "popuphidden", M, na));
		let n = Oa(k());
		n && (Reflect.apply(n.addListener, n, [B]), l = !0);
		let r = ka(k());
		r && (Reflect.apply(r.addObserver, r, [ea, De]), u = !0), V();
		let i = Ce();
		d = i.serialized, f = i.snapshot;
	} catch (e) {
		a = !0, Oe(), C = null, i = null;
		for (let e of T.reverse()) try {
			e();
		} catch {}
		throw T.length = 0, e;
	}
	return Object.freeze({
		assertRequiredCapabilities: A,
		dispose() {
			if (a) return !1;
			if (a = !0, ee.dispose(), Ee(), Oe(), Y(x) && X(x.disconnect)) try {
				Reflect.apply(x.disconnect, x, []);
			} catch {}
			x = null, E.clear(), D.clear(), w.clear(), y.clear(), b.clear(), S = null, C = null, O.dispose(), i = null;
			for (let e of T.reverse()) try {
				e();
			} catch {}
			return T.length = 0, !0;
		},
		refresh() {
			return !a && (we(), !0);
		},
		snapshot() {
			return Object.freeze({
				disposed: a,
				pendingActionCount: o,
				revision: s,
				widgetCount: Ye.reduce((e, t) => e + f.zones[t].length, 0)
			});
		},
		toolbarWidgets: Ue
	});
}
//#endregion
//#region src/app/urlbar-coverage-state.ts
var Rs = Object.freeze([
	"autoplay",
	"camera",
	"canvas",
	"install",
	"local-network",
	"location",
	"loopback-network",
	"microphone",
	"midi",
	"notifications",
	"persistent-storage",
	"popups",
	"screen",
	"serial",
	"xr"
]), zs = Object.freeze([
	"location",
	"media",
	"serial",
	"xr"
]), Bs = Object.freeze([
	"remote-control",
	"search-mode",
	"persisted-search",
	"recommendation",
	"container",
	"reader-view",
	"picture-in-picture",
	"taskbar-tabs",
	"translations",
	"zoom",
	"split-view",
	"bookmark",
	"extension-actions",
	"other-page-actions",
	"more-page-actions"
]);
new Set(Rs), new Set(zs), new Set(Bs);
//#endregion
//#region src/firefox/urlbar-coverage/support.ts
var Vs = Object.freeze([
	"blocked-permissions-container",
	"identity-permission-box",
	"page-action-buttons"
]), Hs = Object.freeze({
	"autoplay-media": "autoplay",
	camera: "camera",
	canvas: "canvas",
	install: "install",
	"local-network": "local-network",
	geo: "location",
	"loopback-network": "loopback-network",
	microphone: "microphone",
	midi: "midi",
	"desktop-notification": "notifications",
	"persistent-storage": "persistent-storage",
	popup: "popups",
	screen: "screen",
	serial: "serial",
	xr: "xr"
}), Us = Object.freeze([
	Object.freeze({
		id: "geo-sharing-icon",
		kind: "location"
	}),
	Object.freeze({
		id: "webrtc-sharing-icon",
		kind: "media"
	}),
	Object.freeze({
		id: "serial-sharing-icon",
		kind: "serial"
	}),
	Object.freeze({
		id: "xr-sharing-icon",
		kind: "xr"
	})
]), Ws = Object.freeze([
	Object.freeze({
		id: "contextual-feature-recommendation",
		kind: "recommendation"
	}),
	Object.freeze({
		id: "userContext-icons",
		kind: "container"
	}),
	Object.freeze({
		id: "reader-mode-button",
		kind: "reader-view"
	}),
	Object.freeze({
		id: "picture-in-picture-button",
		kind: "picture-in-picture"
	}),
	Object.freeze({
		id: "taskbar-tabs-button",
		kind: "taskbar-tabs"
	}),
	Object.freeze({
		id: "translations-button",
		kind: "translations"
	}),
	Object.freeze({
		id: "urlbar-zoom-button",
		kind: "zoom"
	}),
	Object.freeze({
		id: "split-view-button",
		kind: "split-view"
	}),
	Object.freeze({
		id: "star-button-box",
		kind: "bookmark"
	})
]), Gs = new Set([
	"contextual-feature-recommendation",
	"pageActionButton",
	"picture-in-picture-button",
	"reader-mode-button",
	"split-view-button",
	"star-button-box",
	"taskbar-tabs-button",
	"translations-button",
	"urlbar-zoom-button",
	"userContext-icons"
]), Ks = (e) => typeof e == "object" && !!e, qs = (e) => typeof e == "function", Js = (e) => Ks(e) && qs(e.getAttribute) && qs(e.hasAttribute), Ys = (e) => Ks(e) && qs(e.getElementById), Xs = (e) => Ys(e.document) ? e.document : null, Zs = (e, t) => {
	let n = Xs(e);
	return n ? Reflect.apply(n.getElementById, n, [t]) : void 0;
}, Qs = (e) => Xs(e)?.documentElement, $s = Object.freeze([
	Object.freeze({
		isAvailable: qs,
		name: "firefox.urlbar-coverage-native-access",
		read: (e) => e.openLocation,
		symbol: "window.openLocation"
	}),
	Object.freeze({
		isAvailable: qs,
		name: "firefox.urlbar-coverage-mutation-observer",
		read: (e) => e.MutationObserver,
		symbol: "window.MutationObserver"
	}),
	Object.freeze({
		isAvailable: Js,
		name: "firefox.urlbar-coverage-urlbar-state",
		read: (e) => e.gURLBar,
		symbol: "window.gURLBar.hasAttribute"
	}),
	Object.freeze({
		isAvailable: Js,
		name: "firefox.urlbar-coverage-window-state",
		read: Qs,
		symbol: "document.documentElement.hasAttribute"
	}),
	...Vs.map((e) => Object.freeze({
		isAvailable: Js,
		name: `firefox.urlbar-coverage-${e}`,
		read: (t) => Zs(t, e),
		symbol: `document.elements[${e}]`
	}))
]), ec = (e, t) => Object.freeze([...$s.map((t) => {
	let n = !1, r;
	try {
		n = t.isAvailable(t.read(e));
	} catch (e) {
		r = e;
	}
	return Object.freeze({
		...r === void 0 ? {} : { cause: r },
		snapshot: Object.freeze({
			available: n,
			name: t.name,
			requirement: "required",
			symbol: t.symbol
		})
	});
}), Object.freeze({ snapshot: Object.freeze({
	available: qs(t),
	name: "firefox.urlbar-coverage-native-ui-handoff",
	requirement: "required",
	symbol: "nativeUi.revealForUrlbar"
}) })]), tc = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, nc = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: tc(e),
	phase: n,
	symbol: r
}), rc = (e, t) => {
	let n = Reflect.apply(e.getAttribute, e, [t]);
	return typeof n == "string" ? n : null;
}, ic = (e, t) => !!Reflect.apply(e.hasAttribute, e, [t]), ac = (e) => {
	if (e.hidden === !0) return !1;
	let t = rc(e, "hidden");
	return t !== null && t !== "false" ? !1 : rc(e, "collapsed") !== "true";
}, oc = (e) => {
	let t = e.children;
	return Object.freeze(!t || typeof t != "object" && !Array.isArray(t) ? [] : Array.from(t));
}, sc = (e, t) => {
	let n = e.classList;
	return Ks(n) && qs(n.contains) && !!Reflect.apply(n.contains, n, [t]);
}, cc = (e, t) => e.permissions.available === t.permissions.available && e.permissions.hasPermissions === t.permissions.hasPermissions && e.permissions.blocked.length === t.permissions.blocked.length && e.permissions.blocked.every((e, n) => e === t.permissions.blocked[n]) && e.permissions.sharing.length === t.permissions.sharing.length && e.permissions.sharing.every((e, n) => e === t.permissions.sharing[n]) && e.items.length === t.items.length && e.items.every((e, n) => e === t.items[n]);
//#endregion
//#region src/firefox/urlbar-coverage/controller.ts
function lc({ boundary: e, onError: t, requestNativeUiReveal: n, window: r }) {
	if (e.assertOwnsWindow(r), !Ks(r) || typeof t != "function" || typeof n != "function") throw nc(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_OPTIONS_INVALID", "firefox-urlbar-coverage-create", "window");
	let i = r, a = !1, o = null, s = 0, c = null, l = Object.freeze({
		items: Object.freeze([]),
		permissions: Object.freeze({
			available: !1,
			blocked: Object.freeze([]),
			hasPermissions: !1,
			sharing: Object.freeze([])
		})
	}), u = new Set(), d = () => {
		if (a || !i) throw nc(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_DISPOSED", "firefox-urlbar-coverage-access", "window.gURLBar");
		if (o) throw o;
		return e.assertOwnsWindow(i), i;
	}, f = (t) => {
		let n = Zs(d(), t);
		if (!Js(n)) throw nc(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_CAPABILITY_MISSING", "firefox-urlbar-coverage-snapshot", `document.elements[${t}]`);
		return n;
	}, p = () => {
		let t = d().gURLBar;
		if (!Js(t)) throw nc(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_CAPABILITY_MISSING", "firefox-urlbar-coverage-snapshot", "window.gURLBar.hasAttribute");
		return t;
	}, m = () => {
		let t = Qs(d());
		if (!Js(t)) throw nc(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_CAPABILITY_MISSING", "firefox-urlbar-coverage-snapshot", "document.documentElement.hasAttribute");
		return t;
	}, h = () => {
		let t = ec(d(), n), r = t.find((e) => !e.snapshot.available);
		if (r) throw nc(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_CAPABILITY_MISSING", "firefox-urlbar-coverage-capability", r.snapshot.symbol, r.cause);
		return Object.freeze(t.map((e) => e.snapshot));
	}, g = () => {
		let e = p(), t = f("identity-permission-box"), n = Object.freeze(Us.flatMap(({ id: e, kind: t }) => {
			let n = Zs(d(), e);
			return Js(n) && ic(n, "sharing") ? [t] : [];
		}));
		if (!(rc(e, "pageproxystate") === "valid" || ic(e, "persistsearchterms") || n.length > 0)) return Object.freeze({
			available: !1,
			blocked: Object.freeze([]),
			hasPermissions: !1,
			sharing: Object.freeze([])
		});
		let r = Object.freeze(oc(f("blocked-permissions-container")).flatMap((e) => {
			if (!Js(e) || !ic(e, "showing")) return [];
			let t = rc(e, "data-permission-id"), n = t ? Hs[t] : void 0;
			return n ? [n] : [];
		}));
		return Object.freeze({
			available: !0,
			blocked: r,
			hasPermissions: ic(t, "hasPermissions"),
			sharing: n
		});
	}, v = () => {
		let e = d(), t = p(), n = new Set();
		ic(m(), "remotecontrol") && n.add("remote-control"), ic(t, "searchmode") && n.add("search-mode"), ic(t, "persistsearchterms") && n.add("persisted-search");
		for (let { id: t, kind: r } of Ws) {
			let i = Zs(e, t);
			Js(i) && ac(i) && n.add(r);
		}
		let r = Zs(e, "pageActionButton");
		Js(r) && ic(r, "multiple-children") && n.add("more-page-actions");
		for (let e of oc(f("page-action-buttons"))) {
			if (!Js(e) || !ac(e) || !sc(e, "urlbar-page-action")) continue;
			let t = typeof e.id == "string" ? e.id : "";
			Gs.has(t) || (sc(e, "urlbar-addon-page-action") ? n.add("extension-actions") : ic(e, "actionid") && n.add("other-page-actions"));
		}
		return Object.freeze(Bs.filter((e) => n.has(e)));
	}, y = () => Object.freeze({
		items: v(),
		permissions: g()
	}), x = () => {
		let n = Object.freeze({
			revision: s,
			snapshot: l,
			type: "snapshot"
		});
		for (let r of Array.from(u)) try {
			r(n);
		} catch (n) {
			t(nc(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_SUBSCRIBER_FAILED", "firefox-urlbar-coverage-notify", "urlbarCoverage.subscribe", n));
		}
	}, S = (e) => {
		let t = y();
		return cc(l, t) && s > 0 ? !1 : (l = t, s += 1, e && x(), !0);
	}, C = (n) => {
		o = _(n) ? n : nc(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_EVENT_FAILED", "firefox-urlbar-coverage-event", "window.MutationObserver", n), t(o);
	}, w = Object.freeze({
		openNativeUrlbar() {
			let t = d(), r = t.openLocation;
			if (!qs(r)) throw nc(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_CAPABILITY_MISSING", "firefox-urlbar-native-access", "window.openLocation");
			try {
				if (n() !== !0) throw nc(e, "FENNEVIA_FIREFOX_URLBAR_NATIVE_UI_HANDOFF_REJECTED", "firefox-urlbar-native-access", "nativeUi.revealForUrlbar");
				return Reflect.apply(r, t, []), !0;
			} catch (t) {
				throw _(t) ? t : nc(e, "FENNEVIA_FIREFOX_URLBAR_NATIVE_ACCESS_FAILED", "firefox-urlbar-native-access", "window.openLocation", t);
			}
		},
		snapshot() {
			return d(), l;
		},
		subscribe(t) {
			if (d(), typeof t != "function") throw nc(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_LISTENER_INVALID", "firefox-urlbar-coverage-subscribe", "urlbarCoverage.subscribe");
			return u.add(t), b(() => {
				u.delete(t);
			});
		}
	});
	try {
		e.assertRequiredCapabilities(), h(), S(!1);
		let t = d().MutationObserver;
		c = new t(() => {
			if (!(a || o)) try {
				S(!0);
			} catch (e) {
				C(e);
			}
		}), c.observe(m(), {
			attributeFilter: ["remotecontrol"],
			attributes: !0
		}), c.observe(p(), {
			attributeFilter: [
				"pageproxystate",
				"persistsearchterms",
				"searchmode"
			],
			attributes: !0
		}), c.observe(f("identity-permission-box"), {
			attributeFilter: [
				"collapsed",
				"hasPermissions",
				"hasSharingIcon",
				"hidden",
				"paused",
				"sharing",
				"showing"
			],
			attributes: !0,
			subtree: !0
		}), c.observe(f("page-action-buttons"), {
			attributeFilter: [
				"actionid",
				"class",
				"collapsed",
				"disabled",
				"hidden",
				"multiple-children"
			],
			attributes: !0,
			childList: !0,
			subtree: !0
		});
	} catch (n) {
		a = !0;
		try {
			c?.disconnect();
		} catch (n) {
			t(nc(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_DISPOSE_FAILED", "firefox-urlbar-coverage-dispose", "window.MutationObserver.disconnect", n));
		}
		throw c = null, i = null, n;
	}
	return Object.freeze({
		assertRequiredCapabilities: h,
		dispose() {
			if (a) return !1;
			a = !0;
			let t;
			try {
				c?.disconnect();
			} catch (e) {
				t = e;
			}
			if (c = null, u.clear(), i = null, t !== void 0) throw nc(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_DISPOSE_FAILED", "firefox-urlbar-coverage-dispose", "window.MutationObserver.disconnect", t);
			return !0;
		},
		snapshot() {
			return Object.freeze({
				disposed: a,
				failed: o !== null,
				revision: s,
				subscriberCount: u.size
			});
		},
		urlbarCoverage: w
	});
}
//#endregion
//#region src/app/urlbar-suggestions-state.ts
var uc = 1024, dc = 2048, fc = Object.freeze([
	"tab-switch",
	"search",
	"url",
	"keyword",
	"omnibox",
	"remote-tab",
	"tip",
	"dynamic",
	"restrict",
	"ai-chat",
	"unknown"
]), pc = Object.freeze([
	"bookmarks",
	"history",
	"search",
	"tabs",
	"other-local",
	"other-network",
	"addon",
	"actions",
	"unknown"
]), mc = Object.freeze(["direct", "native"]), hc = Object.freeze([
	"idle",
	"querying",
	"results",
	"empty",
	"failed"
]);
new Set(fc), new Set(pc), new Set(mc), new Set(hc);
function gc(e) {
	let t = Error(e);
	return t.name = "FenneviaUrlbarSuggestionsStateError", Object.defineProperties(t, {
		fenneviaCode: {
			enumerable: !1,
			value: e
		},
		fenneviaPhase: {
			enumerable: !1,
			value: "urlbar-suggestions-state"
		}
	}), t;
}
function _c(e) {
	if (!e || typeof e != "object" || e.kind !== "keyboard" && e.kind !== "pointer" || e.button !== 0 && e.button !== 1 || typeof e.altKey != "boolean" || typeof e.ctrlKey != "boolean" || typeof e.metaKey != "boolean" || typeof e.shiftKey != "boolean" || e.kind === "keyboard" && e.button !== 0) throw gc("FENNEVIA_URLBAR_SUGGESTIONS_GESTURE_INVALID");
	return Object.freeze({
		altKey: e.altKey,
		button: e.button,
		ctrlKey: e.ctrlKey,
		kind: e.kind,
		metaKey: e.metaKey,
		shiftKey: e.shiftKey
	});
}
//#endregion
//#region src/firefox/urlbar-suggestions/support.ts
var vc = Object.freeze({
	TAB_SWITCH: 1,
	SEARCH: 2,
	URL: 3,
	KEYWORD: 4,
	OMNIBOX: 5,
	REMOTE_TAB: 6,
	TIP: 7,
	DYNAMIC: 8,
	RESTRICT: 9,
	AI_CHAT: 10
}), yc = Object.freeze({
	BOOKMARKS: 1,
	HISTORY: 2,
	SEARCH: 3,
	TABS: 4,
	OTHER_LOCAL: 5,
	OTHER_NETWORK: 6,
	ADDON: 7,
	ACTIONS: 8
}), bc = Object.freeze({
	[vc.TAB_SWITCH]: "tab-switch",
	[vc.SEARCH]: "search",
	[vc.URL]: "url",
	[vc.KEYWORD]: "keyword",
	[vc.OMNIBOX]: "omnibox",
	[vc.REMOTE_TAB]: "remote-tab",
	[vc.TIP]: "tip",
	[vc.DYNAMIC]: "dynamic",
	[vc.RESTRICT]: "restrict",
	[vc.AI_CHAT]: "ai-chat"
}), xc = Object.freeze({
	[yc.BOOKMARKS]: "bookmarks",
	[yc.HISTORY]: "history",
	[yc.SEARCH]: "search",
	[yc.TABS]: "tabs",
	[yc.OTHER_LOCAL]: "other-local",
	[yc.OTHER_NETWORK]: "other-network",
	[yc.ADDON]: "addon",
	[yc.ACTIONS]: "actions"
}), Sc = new Set([
	vc.TAB_SWITCH,
	vc.SEARCH,
	vc.URL,
	vc.KEYWORD,
	vc.OMNIBOX,
	vc.REMOTE_TAB
]), Cc = (e) => typeof e == "object" && !!e || typeof e == "function", wc = (e) => typeof e == "function", Tc = (e) => typeof e == "function", Ec = (e) => Cc(e) && wc(e.close) && wc(e.telemetryTypeFromElement), Dc = (e) => Cc(e) && typeof e.value == "string" && Cc(e.controller) && Ec(e.view) && wc(e.startQuery) && wc(e.pickResult) && wc(e.handleRevert), Oc = (e) => {
	let t = e.parentController;
	return Cc(t) ? t : e;
}, kc = (e) => Cc(e) && wc(e.startQuery) && wc(e.cancelQuery), Ac = (e) => {
	let t = e.gURLBar, n = e.gBrowser;
	if (!Dc(t) || !Cc(n)) return null;
	let r = t.controller, i = Oc(r), a = i.manager, o = n.selectedBrowser;
	return !kc(a) || !Cc(o) ? null : Object.freeze({
		input: t,
		manager: a,
		nativeController: r,
		parentController: i,
		selectedBrowser: o
	});
}, jc = Object.freeze([
	Object.freeze({
		isAvailable: Dc,
		name: "firefox.urlbar-suggestions-input",
		read: (e) => e.gURLBar,
		symbol: "window.gURLBar.startQuery"
	}),
	Object.freeze({
		isAvailable: (e) => Cc(e) ? kc(Oc(e).manager) : !1,
		name: "firefox.urlbar-suggestions-manager",
		read: (e) => Cc(e.gURLBar) ? e.gURLBar.controller : void 0,
		symbol: "window.gURLBar.controller.parentController.manager.startQuery"
	}),
	Object.freeze({
		isAvailable: Cc,
		name: "firefox.urlbar-suggestions-selected-browser",
		read: (e) => Cc(e.gBrowser) ? e.gBrowser.selectedBrowser : void 0,
		symbol: "window.gBrowser.selectedBrowser"
	}),
	Object.freeze({
		isAvailable: Tc,
		name: "firefox.urlbar-suggestions-keyboard-event",
		read: (e) => e.KeyboardEvent,
		symbol: "window.KeyboardEvent"
	}),
	Object.freeze({
		isAvailable: Tc,
		name: "firefox.urlbar-suggestions-mouse-event",
		read: (e) => e.MouseEvent,
		symbol: "window.MouseEvent"
	})
]), Mc = (e) => Object.freeze(jc.map((t) => {
	let n = !1, r;
	try {
		n = t.isAvailable(t.read(e));
	} catch (e) {
		r = e;
	}
	return Object.freeze({
		...r === void 0 ? {} : { cause: r },
		snapshot: Object.freeze({
			available: n,
			name: t.name,
			requirement: "required",
			symbol: t.symbol
		})
	});
})), Nc = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, Pc = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: Nc(e),
	phase: n,
	symbol: r
}), Fc = (e, t) => {
	if (typeof e != "string") return "";
	let n = "";
	for (let r of e.slice(0, t)) {
		let e = r.charCodeAt(0);
		n += e <= 8 || e === 11 || e === 12 || e >= 14 && e <= 31 || e === 127 ? " " : r;
	}
	return n;
}, Ic = (e) => Cc(e.payload) ? e.payload : Object.create(null), Lc = (e, t, n = !1) => {
	if (!wc(e.getDisplayableValueAndHighlights)) return "";
	try {
		let r = Reflect.apply(e.getDisplayableValueAndHighlights, e, [t, ...n ? [{ isURL: !0 }] : []]);
		return Cc(r) ? Fc(r.value, 2048) : "";
	} catch {
		return "";
	}
}, Rc = (e, t) => {
	for (let n of e) {
		let e = Fc(n, t);
		if (e.length > 0) return e;
	}
	return "";
}, zc = (e) => {
	let t;
	try {
		t = e.icon;
	} catch {
		return null;
	}
	if (typeof t != "string" || t.length === 0 || t.length > 2048) return null;
	let n = Fc(t, dc);
	return n === t && (/^(?:chrome|resource|moz-extension|page-icon|moz-page-thumb):/iu.test(n) || /^data:image\/(?:png|gif|jpeg|webp);base64,[a-z0-9+/=]+$/iu.test(n)) ? n : null;
}, Bc = (e) => Number.isInteger(e) ? bc[e] ?? "unknown" : "unknown", Vc = (e) => Number.isInteger(e) ? xc[e] ?? "unknown" : "unknown", Hc = (e) => Number.isInteger(e.type) && Sc.has(e.type) ? "direct" : "native", Uc = (e, t) => {
	let n = Ic(e), r = Lc(e, "title"), i = Lc(e, "url", !0), a = Rc([
		n.text,
		r,
		n.title,
		n.suggestion,
		n.query,
		n.input,
		i,
		n.url
	], 512), o = Rc([
		n.description,
		n.subtitle,
		n.device,
		n.engine,
		n.content,
		i === a ? "" : i
	], uc);
	return Object.freeze({
		description: o,
		execution: Hc(e),
		heuristic: e.heuristic === !0,
		icon: zc(e),
		source: Vc(e.source),
		title: a,
		token: t,
		type: Bc(e.type)
	});
};
//#endregion
//#region src/firefox/urlbar-suggestions/controller.ts
function Wc({ boundary: e, onError: t, window: n }) {
	if (e.assertOwnsWindow(n), !Cc(n) || typeof t != "function") throw Pc(e, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_OPTIONS_INVALID", "firefox-urlbar-suggestions-create", "window.gURLBar");
	let r = n, i = !1, a = 0, o = 0, s = !1, c = null, l = Object.freeze({
		available: !0,
		phase: "idle",
		queryRevision: 0,
		results: Object.freeze([])
	}), u = new Set(), d = e.createHandleRegistry("urlbar-result"), f = new Map(), p = () => {
		if (i || !r) throw Pc(e, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_DISPOSED", "firefox-urlbar-suggestions-access", "window.gURLBar");
		return e.assertOwnsWindow(r), r;
	}, m = () => {
		let t = Mc(p()), n = t.find((e) => !e.snapshot.available);
		if (n) throw Pc(e, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_CAPABILITY_MISSING", "firefox-urlbar-suggestions-capability", n.snapshot.symbol, n.cause);
		return Object.freeze(t.map((e) => e.snapshot));
	}, h = () => {
		let t = Ac(p());
		if (!t) throw Pc(e, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_CAPABILITY_MISSING", "firefox-urlbar-suggestions-access", "window.gURLBar.controller.parentController.manager");
		return t;
	}, g = () => {
		let n = Object.freeze({
			revision: a,
			snapshot: l,
			type: "snapshot"
		});
		for (let r of Array.from(u)) try {
			r(n);
		} catch (n) {
			t(Pc(e, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_SUBSCRIBER_FAILED", "firefox-urlbar-suggestions-notify", "urlbarSuggestions.subscribe", n));
		}
	}, _ = (e, t = Object.freeze([])) => {
		l = Object.freeze({
			available: !0,
			phase: e,
			queryRevision: o,
			results: Object.freeze([...t])
		}), a += 1, g();
	}, v = () => {
		for (let e of f.keys()) try {
			d.release(e);
		} catch {}
		f.clear();
	}, y = (n) => {
		if (!n) return !1;
		c === n && (c = null);
		try {
			Reflect.apply(n.manager.cancelQuery, n.manager, [n.context]);
		} catch (n) {
			t(Pc(e, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_CANCEL_FAILED", "firefox-urlbar-suggestions-cancel", "UrlbarProvidersManager.cancelQuery", n));
		}
		return !0;
	}, x = (n, r, i, a, o) => {
		n && c !== n || (y(n ?? c), v(), _("failed"), t(Pc(e, r, i, a, o)));
	}, S = (e, t, n) => {
		let r = c;
		if (i || !r || r.context !== e || r.revision !== n || o !== n) return;
		let a = Array.isArray(e.results) ? e.results.slice(0, 20) : [], s = [], l = new Set();
		v();
		for (let e of a) {
			if (!Cc(e) || l.has(e)) continue;
			l.add(e);
			let r = e, i = d.register(r), a;
			try {
				a = Uc(r, i);
			} catch (e) {
				throw d.release(i), e;
			}
			f.set(i, Object.freeze({
				execution: a.execution,
				input: t.input,
				manager: t.manager,
				queryRevision: n,
				result: r
			})), s.push(a);
		}
		s.length > 0 ? _("results", s) : _("querying");
	}, C = (e, t, n) => {
		let r = Object.freeze({
			get isOpen() {
				return !1;
			},
			get selectedElement() {
				return null;
			},
			get selectedResult() {
				return null;
			},
			get visibleResults() {
				return Array.isArray(t.results) ? t.results : [];
			}
		});
		return new Proxy(e.parentController, { get(i, a) {
			if (a === "receiveResults") return (r) => {
				if (r === t) try {
					S(t, e, n);
				} catch (e) {
					x(c, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_RESULT_FAILED", "firefox-urlbar-suggestions-result", "UrlbarParentController.receiveResults", e);
				}
			};
			if (a === "view") return r;
			let o = Reflect.get(i, a, i);
			return wc(o) ? o.bind(i) : o;
		} });
	}, w = (n) => {
		try {
			Reflect.apply(n.manager.cancelQuery, n.manager, [n.context]);
		} catch (n) {
			t(Pc(e, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_CANCEL_FAILED", "firefox-urlbar-suggestions-finish", "UrlbarProvidersManager.cancelQuery", n));
		}
		if (c !== n) return;
		c = null;
		let r = n.retryZeroPrefixOnEmpty && o === n.revision && l.phase === "querying";
		if (n.retryZeroPrefixOnEmpty && (s = !0), r) {
			try {
				D("", !1);
			} catch (e) {
				x(null, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_QUERY_FAILED", "firefox-urlbar-suggestions-query", "window.gURLBar.startQuery", e);
			}
			return;
		}
		o === n.revision && l.phase === "querying" && _("empty");
	}, T = (t, n, r, i = !1) => {
		if (!Cc(t)) throw Pc(e, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_CONTEXT_INVALID", "firefox-urlbar-suggestions-query", "UrlbarQueryContext");
		y(c);
		let a = Object.freeze({
			context: t,
			input: n.input,
			manager: n.manager,
			retryZeroPrefixOnEmpty: i,
			revision: r
		});
		c = a;
		let o = C(n, t, r), s;
		try {
			s = Reflect.apply(n.manager.startQuery, n.manager, [t, o]);
		} catch (e) {
			x(a, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_QUERY_FAILED", "firefox-urlbar-suggestions-query", "UrlbarProvidersManager.startQuery", e);
			return;
		}
		Promise.resolve(s).then(() => w(a), (e) => x(a, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_QUERY_FAILED", "firefox-urlbar-suggestions-query", "UrlbarProvidersManager.startQuery", e));
	}, E = (t, n, r) => {
		let i = new Proxy(t.nativeController, { get(e, t) {
			if (t === "cancelQuery") return () => y(c);
			if (t === "startQuery") return (e) => n(e);
			let r = Reflect.get(e, t, e);
			return wc(r) ? r.bind(e) : r;
		} }), a, o = !1, s;
		try {
			if (t.input.controller = i, t.input.controller !== i) throw Pc(e, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_PROXY_REJECTED", "firefox-urlbar-suggestions-proxy", "window.gURLBar.controller");
			s = r();
		} catch (e) {
			a = e, o = !0;
		}
		let l, u = !1;
		try {
			if (t.input.controller = t.nativeController, t.input.controller !== t.nativeController) throw Pc(e, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_PROXY_RESTORE_FAILED", "firefox-urlbar-suggestions-proxy", "window.gURLBar.controller");
		} catch (e) {
			l = e, u = !0;
		}
		if (u) throw l;
		if (o) throw a;
		return s;
	};
	function D(t, n = !0) {
		let r = h();
		y(c), v(), o += 1;
		let i = o;
		_("querying"), r.input.value = t, typeof r.input.selectionStart == "number" && (r.input.selectionStart = t.length), typeof r.input.selectionEnd == "number" && (r.input.selectionEnd = t.length);
		let a = !1;
		try {
			if (E(r, (e) => {
				a = !0, T(e, r, i, n && !s && t.length === 0);
			}, () => Reflect.apply(r.input.startQuery, r.input, [Object.freeze({
				allowAutofill: t.length > 0,
				searchString: t
			})])), !a) throw Pc(e, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_CONTEXT_MISSING", "firefox-urlbar-suggestions-query", "window.gURLBar.startQuery");
			return !0;
		} catch (e) {
			return x(c, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_QUERY_FAILED", "firefox-urlbar-suggestions-query", "window.gURLBar.startQuery", e), !1;
		}
	}
	let O = (n) => {
		let r = c !== null || f.size > 0 || l.phase !== "idle", i = c?.input;
		if (y(c), v(), n && r) try {
			let e = i ?? h().input;
			Reflect.apply(e.handleRevert, e, []);
		} catch (n) {
			t(Pc(e, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_REVERT_FAILED", "firefox-urlbar-suggestions-cancel", "window.gURLBar.handleRevert", n));
		}
		return (l.phase !== "idle" || l.results.length > 0) && _("idle"), r;
	}, k = (t) => {
		let n = p(), r = {
			altKey: t.altKey,
			bubbles: !0,
			button: t.button,
			cancelable: !0,
			ctrlKey: t.ctrlKey,
			metaKey: t.metaKey,
			shiftKey: t.shiftKey,
			view: n
		};
		if (t.kind === "pointer") {
			let t = n.MouseEvent;
			if (!t) throw Pc(e, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_CAPABILITY_MISSING", "firefox-urlbar-suggestions-execute", "window.MouseEvent");
			return new t("click", r);
		}
		let i = n.KeyboardEvent;
		if (!i) throw Pc(e, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_CAPABILITY_MISSING", "firefox-urlbar-suggestions-execute", "window.KeyboardEvent");
		return new i("keydown", {
			...r,
			code: "Enter",
			key: "Enter"
		});
	}, A = Object.freeze({
		cancel: () => O(!0),
		execute: (e, t) => {
			let n, r;
			try {
				n = _c(t), r = d.resolve(e);
			} catch {
				return Object.freeze({ status: "rejected" });
			}
			let i = f.get(e);
			if (!i || i.result !== r || i.queryRevision !== o) return Object.freeze({ status: "rejected" });
			if (i.execution === "native") return Object.freeze({ status: "native-required" });
			let a;
			try {
				a = h();
			} catch (e) {
				return x(c, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_EXECUTE_FAILED", "firefox-urlbar-suggestions-execute", "window.gURLBar.pickResult", e), Object.freeze({ status: "native-required" });
			}
			if (a.input !== i.input || a.manager !== i.manager) return Object.freeze({ status: "rejected" });
			y(c);
			let s = !1, l = a.input.searchMode;
			try {
				let e = k(n);
				if (E(a, (e) => {
					s = !0, v(), o += 1, _("querying"), T(e, a, o);
				}, () => Reflect.apply(a.input.pickResult, a.input, [
					r,
					e,
					null,
					a.selectedBrowser
				])), !s && a.input.searchMode !== l) {
					let e = typeof a.input.value == "string" ? a.input.value.slice(0, kr) : "";
					v(), o += 1, _("querying"), E(a, (e) => {
						s = !0, T(e, a, o);
					}, () => Reflect.apply(a.input.startQuery, a.input, [Object.freeze({
						allowAutofill: e.length > 0,
						searchString: e
					})]));
				}
			} catch (e) {
				return x(c, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_EXECUTE_FAILED", "firefox-urlbar-suggestions-execute", "window.gURLBar.pickResult", e), Object.freeze({ status: "native-required" });
			}
			return s ? Object.freeze({ status: "continued" }) : (v(), _("idle"), Object.freeze({ status: "committed" }));
		},
		prepareNativeHandoff: () => O(!1),
		query(t) {
			if (p(), typeof t != "string" || t.length > 4096) throw Pc(e, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_QUERY_INVALID", "firefox-urlbar-suggestions-query", "window.gURLBar.value");
			return D(t);
		},
		snapshot() {
			return p(), l;
		},
		subscribe(t) {
			if (p(), typeof t != "function") throw Pc(e, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_LISTENER_INVALID", "firefox-urlbar-suggestions-subscribe", "urlbarSuggestions.subscribe");
			return u.add(t), b(() => u.delete(t));
		}
	});
	try {
		e.assertRequiredCapabilities(), m(), h();
	} catch (e) {
		throw i = !0, f.clear(), d.dispose(), r = null, e;
	}
	return Object.freeze({
		assertRequiredCapabilities: m,
		dispose() {
			return !i && (u.clear(), O(!0), d.dispose(), i = !0, r = null, !0);
		},
		snapshot() {
			return Object.freeze({
				activeQuery: c !== null,
				disposed: i,
				queryRevision: o,
				resultCount: d.snapshot().activeHandleCount,
				revision: a,
				subscriberCount: u.size
			});
		},
		urlbarSuggestions: A
	});
}
//#endregion
//#region src/app/window-controls-state.ts
var Gc = Object.freeze([
	"close",
	"minimize",
	"toggle-maximize"
]), Kc = new Set(Gc);
function qc(e) {
	return typeof e == "string" && Kc.has(e);
}
//#endregion
//#region src/firefox/window-controls.ts
var Jc = (e) => typeof e == "object" && !!e, Yc = (e) => typeof e == "function", Xc = (e, t) => {
	let n = e.document;
	if (!(!Jc(n) || !Yc(n.getElementById))) return Reflect.apply(n.getElementById, n, [t]);
}, Zc = (e) => Object.freeze(e), Qc = Object.freeze([
	Zc({
		isAvailable: Yc,
		name: "window-controls.minimize",
		read: (e) => e.minimize,
		symbol: "window.minimize"
	}),
	Zc({
		isAvailable: Yc,
		name: "window-controls.maximize",
		read: (e) => e.maximize,
		symbol: "window.maximize"
	}),
	Zc({
		isAvailable: Yc,
		name: "window-controls.restore",
		read: (e) => e.restore,
		symbol: "window.restore"
	}),
	Zc({
		isAvailable: (e) => typeof e == "number",
		name: "window-controls.window-state",
		read: (e) => e.windowState,
		symbol: "window.windowState"
	}),
	Zc({
		isAvailable: (e) => typeof e == "number",
		name: "window-controls.state-maximized",
		read: (e) => e.STATE_MAXIMIZED,
		symbol: "window.STATE_MAXIMIZED"
	}),
	Zc({
		isAvailable: Yc,
		name: "window-controls.sizemode-events",
		read: (e) => e.addEventListener,
		symbol: "window.addEventListener"
	}),
	Zc({
		isAvailable: (e) => Jc(e) && Yc(e.doCommand),
		name: "window-controls.close-command",
		read: (e) => Xc(e, "cmd_closeWindow"),
		symbol: "document.cmd_closeWindow.doCommand"
	})
]), $c = (e) => Object.freeze(Qc.map((t) => {
	let n = !1, r;
	try {
		n = t.isAvailable(t.read(e));
	} catch (e) {
		r = e;
	}
	return Object.freeze({
		...r === void 0 ? {} : { cause: r },
		snapshot: Object.freeze({
			available: n,
			name: t.name,
			requirement: "required",
			symbol: t.symbol
		})
	});
})), el = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, tl = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: el(e),
	phase: n,
	symbol: r
}), nl = (e) => {
	let t = e.windowState === e.STATE_MAXIMIZED || typeof e.STATE_FULLSCREEN == "number" && e.windowState === e.STATE_FULLSCREEN;
	return Object.freeze({ maximized: t });
};
function rl({ boundary: e, onError: t, window: n }) {
	if (e.assertOwnsWindow(n), !Jc(n) || typeof t != "function") throw tl(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_OPTIONS_INVALID", "firefox-window-controls-create", "window");
	let r = n, i = !1, a = new Set(), o, s = () => {
		if (i || !r) throw tl(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_DISPOSED", "firefox-window-controls-access", "window");
		return r;
	}, c = () => {
		let t = $c(s()), n = t.find((e) => !e.snapshot.available);
		if (n) throw tl(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_CAPABILITY_MISSING", "firefox-window-controls-capability", n.snapshot.symbol, n.cause);
		return Object.freeze(t.map((e) => e.snapshot));
	}, l = () => {
		let n;
		try {
			n = nl(s());
		} catch (e) {
			t(e);
			return;
		}
		for (let r of Array.from(a)) try {
			r(n);
		} catch (n) {
			t(tl(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_SUBSCRIBER_FAILED", "firefox-window-controls-notify", "windowControls.subscribe", n));
		}
	}, u = (t) => {
		if (!qc(t)) throw tl(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_ACTION_INVALID", "firefox-window-controls-action", "windowControls.action");
		c();
		let n = s();
		try {
			if (t === "minimize") return Reflect.apply(n.minimize, n, []), !0;
			if (t === "toggle-maximize") return nl(n).maximized ? Reflect.apply(n.restore, n, []) : Reflect.apply(n.maximize, n, []), !0;
			let r = Xc(n, "cmd_closeWindow");
			if (!Jc(r) || !Yc(r.doCommand)) throw tl(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_CAPABILITY_MISSING", "firefox-window-controls-action", "document.cmd_closeWindow.doCommand");
			return Reflect.apply(r.doCommand, r, []), !0;
		} catch (n) {
			throw n instanceof g ? n : tl(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_ACTION_FAILED", "firefox-window-controls-action", t === "close" ? "document.cmd_closeWindow.doCommand" : `window.${t}`, n);
		}
	};
	try {
		o = x({
			listener() {
				l();
			},
			target: n,
			type: "sizemodechange"
		});
	} catch (t) {
		throw tl(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_SUBSCRIBE_FAILED", "firefox-window-controls-subscribe", "window.addEventListener", t);
	}
	let d = Object.freeze({
		invoke: u,
		snapshot() {
			return nl(s());
		},
		subscribe(t) {
			if (typeof t != "function") throw tl(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_LISTENER_INVALID", "firefox-window-controls-subscribe", "windowControls.subscribe");
			return s(), a.add(t), () => a.delete(t);
		}
	});
	return Object.freeze({
		assertRequiredCapabilities: c,
		dispose() {
			return !i && (i = !0, r = null, a.clear(), o?.(), o = void 0, !0);
		},
		snapshot() {
			return Object.freeze({ disposed: i });
		},
		windowControls: d
	});
}
//#endregion
export { g as FirefoxBridgeError, Fn as addCustomizeLayoutEntry, yn as copyCustomizeLayout, _n as copyCustomizeLayoutEntry, xn as createCustomizeLayout, bn as createEmptyCustomizeLayout, L as createFirefoxBookmarksBridge, T as createFirefoxBridgeBoundary, Ve as createFirefoxBrowserToolsBridge, $n as createFirefoxDownloadsBridge, Dr as createFirefoxLocaleBridge, fi as createFirefoxNavigationBridge, Ki as createFirefoxTabDragCoordinator, Ji as createFirefoxTabsBridge, Ls as createFirefoxToolbarWidgetsBridge, lc as createFirefoxUrlbarCoverageBridge, Wc as createFirefoxUrlbarSuggestionsBridge, rl as createFirefoxWindowControlsBridge, b as createIdempotentDisposer, S as createOpaqueHandleRegistry, lr as createStaticLocaleBridge, fn as customizeLayoutBounds, Vn as customizeLayoutContainsWidget, un as customizeSpecialKinds, tr as defaultFenneviaLocale, jn as findCustomizeLayoutEntry, Ln as getCustomizeLayoutEntry, Er as getShellChromeHostLabel, hn as isCustomizeSpecialKind, gn as isCustomizeWidgetId, _ as isFirefoxBridgeError, Rn as moveCustomizeLayoutEntry, Sn as parseCustomizeLayout, kn as parseCustomizePanels, wn as parseCustomizeStyle, In as removeCustomizeLayoutEntry, Cn as serializeCustomizeLayout, An as serializeCustomizePanels, Tn as serializeCustomizeStyle, mr as shellChromeHostNames, x as subscribeFirefoxEvent, v as toFirefoxBridgeDiagnostic, zn as withCustomizeAdopted, Bn as withoutCustomizeAdopted };
