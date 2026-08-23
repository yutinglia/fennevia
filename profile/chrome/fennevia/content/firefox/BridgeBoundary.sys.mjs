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
}), P = (e, t, n, r) => {
	if (typeof t != "string" || !A.test(t)) throw N(e, "FENNEVIA_FIREFOX_BOOKMARK_GUID_INVALID", n, r);
	return t;
}, ne = (e) => {
	let t = "", n = 0;
	for (let r of e) {
		if (n >= 160) break;
		t += r, n += 1;
	}
	return t;
}, F = (e) => typeof e == "string" && e.length <= 262144 && E.test(e) ? e : void 0, I = (e, t, n, r, i) => {
	if (!j(t) || typeof t.guid != "string" || typeof t.parentGuid != "string" || typeof t.index != "number" || !Number.isSafeInteger(t.index) || t.index < 0 || typeof t.type != "number" || typeof t.title != "string" || (P(e, t.guid, r, "PlacesUtils.bookmarks.fetch.result.guid"), P(e, t.parentGuid, r, "PlacesUtils.bookmarks.fetch.result.parentGuid"), i !== void 0 && t.guid !== i || ![
		n.TYPE_BOOKMARK,
		n.TYPE_FOLDER,
		n.TYPE_SEPARATOR
	].includes(t.type) || t.type === n.TYPE_FOLDER && (!Number.isSafeInteger(t.childCount) || t.childCount < 0))) throw N(e, "FENNEVIA_FIREFOX_BOOKMARK_RECORD_INVALID", r, "PlacesUtils.bookmarks.fetch.result");
	return t;
}, L = (e, t, n) => {
	if (t.type === n.TYPE_BOOKMARK) return "bookmark";
	if (t.type === n.TYPE_FOLDER) return "folder";
	if (t.type === n.TYPE_SEPARATOR) return "separator";
	throw N(e, "FENNEVIA_FIREFOX_BOOKMARK_TYPE_INVALID", "firefox-bookmarks-snapshot", "PlacesUtils.bookmarks.TYPE_BOOKMARK");
}, R = (e) => {
	if (!j(e) || typeof e.href != "string") return null;
	if (typeof e.protocol == "string") return e.protocol.toLowerCase();
	let t = e.href.indexOf(":");
	return t > 0 ? `${e.href.slice(0, t).toLowerCase()}:` : null;
};
//#endregion
//#region src/firefox/bookmarks/controller.ts
function re({ boundary: e, moduleLoader: t, onError: n, window: r }) {
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
		let n = P(e, t, "firefox-bookmarks-handle", "PlacesUtils.bookmarks.guid"), r = x.get(n);
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
	}, te = (e) => (S(), v.resolve(e).guid), re = async (e) => {
		if (e.type !== c.bookmarks.TYPE_BOOKMARK) return;
		let t = S(), n = c.favicons, r = t.Services, i = j(r) ? r.io : void 0, a = j(i) ? i.newURI : void 0, o = n?.getFaviconForPage, s = j(e.url) ? e.url.href : void 0;
		if (!(!n || !M(o) || !j(i) || !M(a) || typeof s != "string")) try {
			let e = Reflect.apply(a, i, [s]), r = typeof t.devicePixelRatio == "number" && Number.isFinite(t.devicePixelRatio) ? t.devicePixelRatio : 1, c = Math.min(64, Math.max(16, Math.round(16 * r))), l = await Reflect.apply(o, n, [e, c]);
			S();
			let u = j(l) ? l.dataURI : void 0;
			return F(j(u) ? u.spec : void 0);
		} catch (e) {
			if (_(e)) throw e;
			return;
		}
	}, ie = async (t, n = t.title) => {
		let r = L(e, t, c.bookmarks), i = await re(t);
		return Object.freeze({
			...i === void 0 ? {} : { faviconUrl: i },
			hasChildren: r === "folder" && Number.isSafeInteger(t.childCount) && t.childCount > 0,
			id: T(t.guid),
			kind: r,
			title: ne(n)
		});
	}, ae = async (t, n) => {
		S();
		let r;
		try {
			r = await Reflect.apply(c.bookmarks.fetch, c.bookmarks, [t]);
		} catch (t) {
			throw N(e, "FENNEVIA_FIREFOX_BOOKMARK_QUERY_FAILED", n, "PlacesUtils.bookmarks.fetch", t);
		}
		return S(), r === null ? null : I(e, r, c.bookmarks, n, "guid" in t ? t.guid : void 0);
	}, oe = (t, r) => {
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
	}, se = (t) => {
		p = _(t) ? t : N(e, "FENNEVIA_FIREFOX_BOOKMARKS_OBSERVER_FAILED", "firefox-bookmarks-observer", "PlacesUtils.observers.addListener", t), n(p);
	}, ce = (t) => {
		if (!(f || p)) try {
			if (!Array.isArray(t)) throw N(e, "FENNEVIA_FIREFOX_BOOKMARKS_EVENT_INVALID", "firefox-bookmarks-observer", "PlacesEventCallback.events");
			if (t.length > 128) {
				oe(Object.freeze([]), "all");
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
				P(e, a.parentGuid, "firefox-bookmarks-observer", "PlacesEvent.parentGuid");
				let t = x.get(a.parentGuid);
				if (t && n.add(t), a.type === "bookmark-moved") {
					let t = P(e, a.oldParentGuid, "firefox-bookmarks-observer", "PlacesBookmarkMoved.oldParentGuid"), r = x.get(t);
					r && n.add(r);
				}
				a.type === "bookmark-removed" && r.push(P(e, a.guid, "firefox-bookmarks-observer", "PlacesBookmarkRemoved.guid"));
			}
			let a = Array.from(n);
			i || a.length > 16 ? oe(Object.freeze([]), "all") : a.length > 0 && oe(Object.freeze(a), "parents");
			for (let e of r) E(e);
		} catch (e) {
			se(e);
		}
	}, le = b(() => {
		m && (m = !1, Reflect.apply(c.observers.removeListener, c.observers, [k, ce]));
	}), ue = Object.freeze({
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
			let o = await ae({ guid: r }, "firefox-bookmarks-query-parent");
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
				let n = await ae({
					index: e,
					parentGuid: r
				}, "firefox-bookmarks-query-child");
				if (!n || n.parentGuid !== r || n.index !== e) return Object.freeze({
					parentId: t,
					status: "stale"
				});
				d.push(n);
			}
			let f = await Promise.all(d.map((e) => ie(e)));
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
			let i = await ae({ guid: r }, "firefox-bookmarks-open-fetch");
			if (!i) return E(r), Object.freeze({
				reason: "stale",
				status: "rejected"
			});
			if (i.type !== c.bookmarks.TYPE_BOOKMARK) return Object.freeze({
				reason: "not-bookmark",
				status: "rejected"
			});
			let a = R(i.url);
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
				let t = await ae({ guid: r }, "firefox-bookmarks-query-roots");
				if (!t || t.type !== c.bookmarks.TYPE_FOLDER) throw N(e, "FENNEVIA_FIREFOX_BOOKMARK_ROOT_INVALID", "firefox-bookmarks-query-roots", "PlacesUtils.bookmarks.userContentRoots");
				let i;
				try {
					i = Reflect.apply(c.bookmarks.getLocalizedTitle, c.bookmarks, [t]);
				} catch (t) {
					throw N(e, "FENNEVIA_FIREFOX_BOOKMARK_ROOT_TITLE_FAILED", "firefox-bookmarks-query-roots", "PlacesUtils.bookmarks.getLocalizedTitle", t);
				}
				if (typeof i != "string") throw N(e, "FENNEVIA_FIREFOX_BOOKMARK_ROOT_TITLE_INVALID", "firefox-bookmarks-query-roots", "PlacesUtils.bookmarks.getLocalizedTitle");
				n.push(await ie(t, i));
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
		e.assertRequiredCapabilities(), w(), Reflect.apply(c.observers.addListener, c.observers, [k, ce]), m = !0;
	} catch (t) {
		f = !0, d = null;
		let r;
		try {
			le();
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
		bookmarks: ue,
		dispose() {
			if (f) return !1;
			f = !0, d = null;
			let t;
			try {
				le();
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
var ie = Object.freeze([
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
]), ae = Object.freeze([
	"site-information",
	"protections",
	"site-permissions",
	"downloads",
	"extensions",
	"translate",
	"application-menu"
]), oe = new Set(ie), se = new Set(ae);
function ce(e) {
	return typeof e == "string" && oe.has(e);
}
function le(e) {
	return typeof e == "string" && se.has(e);
}
//#endregion
//#region src/firefox/browser-tools/support.ts
var ue = Object.freeze({ capture: !0 }), de = Object.freeze([
	"appMenu-popup",
	"downloadsPanel",
	"identity-popup",
	"permission-popup",
	"protections-popup",
	"trustpanel-popup",
	"unified-extensions-panel",
	"full-page-translations-panel"
]), fe = new Set(de), pe = Object.freeze({
	"application-menu": Object.freeze(["appMenu-popup"]),
	downloads: Object.freeze(["downloadsPanel"]),
	extensions: Object.freeze(["unified-extensions-panel"]),
	translate: Object.freeze(["full-page-translations-panel"]),
	protections: Object.freeze(["trustpanel-popup", "protections-popup"]),
	"site-information": Object.freeze(["trustpanel-popup", "identity-popup"]),
	"site-permissions": Object.freeze(["permission-popup"])
}), me = "bottomcenter topright", he = Object.freeze({
	"application-menu": me,
	downloads: "after_start",
	extensions: "after_end",
	translate: "after_end",
	protections: "end_before",
	"site-information": "end_before",
	"site-permissions": "after_end"
}), ge = (e) => e === me, z = (e) => typeof e == "object" && !!e, B = (e) => typeof e == "function", _e = (e) => {
	let t = e.PanelMultiView;
	if (typeof t == "function") {
		let e = t;
		return B(e.openPopup) ? e : null;
	}
	return z(t) && B(t.openPopup) ? t : null;
}, ve = (e) => z(e) && B(e.addEventListener) && B(e.removeEventListener), ye = (e) => z(e) && B(e.click) && B(e.focus), V = (e) => z(e) && B(e.hidePopup) && B(e.moveToAnchor) && B(e.openPopup), H = (e) => typeof e == "number" && Number.isFinite(e) ? e : void 0, be = (e) => {
	try {
		let t = Reflect.apply(e.getBoundingClientRect, e, []);
		if (!z(t)) return null;
		let n = H(t.left) ?? H(t.x), r = H(t.top) ?? H(t.y), i = H(t.width), a = H(t.height);
		return n === void 0 || r === void 0 || i === void 0 || a === void 0 ? null : Object.freeze({
			height: Math.max(1, Math.round(a)),
			width: Math.max(1, Math.round(i)),
			x: Math.round(n),
			y: Math.round(r)
		});
	} catch {
		return null;
	}
}, xe = (e) => {
	let t = H(e.mozInnerScreenX) ?? 0, n = H(e.mozInnerScreenY) ?? 0;
	return Object.freeze({
		x: Math.round(t),
		y: Math.round(n)
	});
}, U = (e, t) => {
	let n = e.document;
	if (!(!z(n) || !B(n.getElementById))) return Reflect.apply(n.getElementById, n, [t]);
}, Se = (e) => z(e) ? e.panel : void 0, W = (e) => Object.freeze(e), Ce = Object.freeze([
	W({
		isAvailable: (e) => ye(e) && B(e.checkVisibility),
		name: "browser-tools.trust-anchor",
		read: (e) => U(e, "trust-icon-container"),
		symbol: "document.trust-icon-container.click.focus.checkVisibility"
	}),
	W({
		isAvailable: ye,
		name: "browser-tools.identity-anchor",
		read: (e) => U(e, "identity-icon-box"),
		symbol: "document.identity-icon-box.click.focus"
	}),
	W({
		isAvailable: ye,
		name: "browser-tools.protections-anchor",
		read: (e) => U(e, "tracking-protection-icon-container"),
		symbol: "document.tracking-protection-icon-container.click.focus"
	}),
	W({
		isAvailable: ye,
		name: "browser-tools.permissions-anchor",
		read: (e) => U(e, "identity-permission-box"),
		symbol: "document.identity-permission-box.click.focus"
	}),
	W({
		isAvailable: B,
		name: "browser-tools.unified-extensions",
		read: (e) => z(e.gUnifiedExtensions) ? e.gUnifiedExtensions.togglePanel : void 0,
		symbol: "window.gUnifiedExtensions.togglePanel"
	}),
	W({
		isAvailable: B,
		name: "browser-tools.full-page-translations",
		read: (e) => z(e.FullPageTranslationsPanel) ? e.FullPageTranslationsPanel.open : void 0,
		requirement: "optional",
		symbol: "window.FullPageTranslationsPanel.open"
	}),
	W({
		isAvailable: B,
		name: "browser-tools.application-menu",
		read: (e) => z(e.PanelUI) ? e.PanelUI.show : void 0,
		symbol: "window.PanelUI.show"
	}),
	W({
		isAvailable: B,
		name: "browser-tools.application-menu-ready",
		read: (e) => z(e.PanelUI) ? e.PanelUI.ensureReady : void 0,
		symbol: "window.PanelUI.ensureReady"
	}),
	W({
		isAvailable: B,
		name: "browser-tools.settings",
		read: (e) => e.openPreferences,
		symbol: "window.openPreferences"
	}),
	W({
		isAvailable: B,
		name: "browser-tools.customize",
		read: (e) => z(e.gCustomizeMode) ? e.gCustomizeMode.enter : void 0,
		symbol: "window.gCustomizeMode.enter"
	}),
	W({
		isAvailable: (e) => z(e) && B(e.focus),
		name: "browser-tools.native-toolbar-focus",
		read: (e) => U(e, "back-button"),
		symbol: "document.back-button.focus"
	}),
	W({
		isAvailable: ye,
		name: "browser-tools.extensions-anchor",
		read: (e) => U(e, "unified-extensions-button"),
		symbol: "document.unified-extensions-button.click.focus"
	}),
	W({
		isAvailable: ye,
		name: "browser-tools.application-menu-anchor",
		read: (e) => U(e, "PanelUI-menu-button"),
		symbol: "document.PanelUI-menu-button.click.focus"
	}),
	W({
		isAvailable: B,
		name: "browser-tools.trust-panel",
		read: (e) => z(e.gTrustPanelHandler) ? e.gTrustPanelHandler.showPopup : void 0,
		symbol: "window.gTrustPanelHandler.showPopup"
	}),
	W({
		isAvailable: B,
		name: "browser-tools.permission-set-anchor",
		read: (e) => z(e.gPermissionPanel) ? e.gPermissionPanel.setAnchor : void 0,
		symbol: "window.gPermissionPanel.setAnchor"
	}),
	W({
		isAvailable: B,
		name: "browser-tools.permission-open-popup",
		read: (e) => z(e.gPermissionPanel) ? e.gPermissionPanel.openPopup : void 0,
		symbol: "window.gPermissionPanel.openPopup"
	}),
	W({
		isAvailable: B,
		name: "browser-tools.downloads-initialize",
		read: (e) => z(e.DownloadsPanel) ? e.DownloadsPanel.initialize : void 0,
		symbol: "window.DownloadsPanel.initialize"
	}),
	W({
		isAvailable: V,
		name: "browser-tools.downloads-panel",
		read: (e) => {
			let t = U(e, "downloadsPanel");
			return V(t) ? t : Se(e.DownloadsPanel);
		},
		symbol: "document.downloadsPanel.openPopup.moveToAnchor.hidePopup"
	}),
	W({
		isAvailable: V,
		name: "browser-tools.application-menu-panel",
		read: (e) => {
			let t = U(e, "appMenu-popup");
			return V(t) ? t : Se(e.PanelUI);
		},
		symbol: "document.appMenu-popup.openPopup.moveToAnchor.hidePopup"
	}),
	W({
		isAvailable: V,
		name: "browser-tools.extensions-panel",
		read: (e) => {
			let t = U(e, "unified-extensions-panel");
			return V(t) ? t : Se(e.gUnifiedExtensions);
		},
		symbol: "document.unified-extensions-panel.openPopup.moveToAnchor.hidePopup"
	}),
	W({
		isAvailable: ve,
		name: "browser-tools.document-events",
		read: (e) => e.document,
		symbol: "document.addEventListener.removeEventListener"
	})
]), we = (e) => Object.freeze(Ce.map((t) => {
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
})), Te = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, G = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: Te(e),
	phase: n,
	symbol: r
}), Ee = (e) => {
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
}, De = (e) => {
	let t = e.state;
	if (t === "open" || t === "showing") return !0;
	let n = e.getAttribute;
	if (!B(n)) return !1;
	let r = Reflect.apply(n, e, ["state"]);
	return r === "open" || r === "showing";
}, Oe = (e) => z(e) ? z(e.originalTarget) ? e.originalTarget : z(e.target) ? e.target : null : null, ke = 1e4;
function Ae({ beginNativePopupHandoff: e, boundary: t, endNativePopupHandoff: n, frame: r, requestNativeUiReveal: i, window: a }) {
	if (t.assertOwnsWindow(a), !z(a) || !z(r) || typeof r.contains != "function" || typeof i != "function" || typeof e != "function" || typeof n != "function") throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_OPTIONS_INVALID", "firefox-browser-tools-create", "window");
	let o = (e) => Reflect.apply(r.contains, r, [e]) === !0, s = a, c = !1, l = 0, u = null, d = new Set(), f = [], p = new Set(), m = new Set(), h = () => {
		if (c || !s) throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_DISPOSED", "firefox-browser-tools-access", "window");
		return s;
	}, g = () => {
		let e = we(h()), n = e.find((e) => e.snapshot.requirement === "required" && !e.snapshot.available);
		if (n) throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-capability", n.snapshot.symbol, n.cause);
		return Object.freeze(e.map((e) => e.snapshot));
	}, v = () => {
		let e;
		try {
			e = i() === !0;
		} catch (e) {
			throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_REVEAL_FAILED", "firefox-browser-tools-reveal", "nativeUi.revealForToolbar", e);
		}
		if (!e) throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_REVEAL_REJECTED", "firefox-browser-tools-reveal", "nativeUi.revealForToolbar");
	}, y = async (e, n, r, i = []) => {
		let a = e[n];
		if (!B(a)) throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", r);
		try {
			await Reflect.apply(a, e, i);
		} catch (e) {
			throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", r, e);
		}
	}, b = (e) => {
		let n = h();
		if (!z(e) || !B(e.getBoundingClientRect) || e.ownerDocument !== n.document || o(e) !== !0) throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_HOST_INVALID", "firefox-browser-tools-action", "browser-tools.host");
		return e;
	}, x = (e, t) => {
		if (z(e) && B(e.stopPropagation) && (e.type === "click" || e.type === "keypress")) return e;
		let n = h().MouseEvent;
		if (B(n)) try {
			let e = Reflect.construct(n, ["click", Object.freeze({
				bubbles: !0,
				button: 0
			})]);
			if (z(e) && B(e.stopPropagation)) return e;
		} catch {}
		return Object.freeze({
			button: 0,
			stopPropagation() {},
			target: t,
			type: "click"
		});
	}, S = (e) => {
		let t = h();
		for (let n of e) {
			let e = U(t, n);
			if (V(e) && De(e)) return e;
		}
		return null;
	}, C = (n) => {
		let r;
		try {
			r = e(n) === !0;
		} catch (e) {
			throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_HANDOFF_FAILED", "firefox-browser-tools-handoff", "nativeUi.beginPopupHandoff", e);
		}
		if (!r) throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_HANDOFF_REJECTED", "firefox-browser-tools-handoff", "nativeUi.beginPopupHandoff");
	}, w = (e) => {
		try {
			n(e);
		} catch {}
	}, T = (e, n) => {
		try {
			Reflect.apply(e.hidePopup, e, []);
		} catch (e) {
			throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", n, e);
		}
	}, E = (e, n, r, i) => {
		try {
			Reflect.apply(e.openPopup, e, [
				n,
				r,
				0,
				0
			]);
		} catch (e) {
			throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", i, e);
		}
	}, D = (e, n, r, i) => {
		try {
			Reflect.apply(e.moveToAnchor, e, [
				n,
				r,
				0,
				0
			]);
		} catch (e) {
			throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", i, e);
		}
	}, O = (e, t, n, r) => {
		if (ge(n)) {
			let n = be(t), r = xe(h()), i = e.moveTo;
			if (n && B(i)) try {
				let t = r.x + n.x, a = r.y + n.y + n.height, o = e.getOuterScreenRect;
				if (B(o)) {
					let i = Reflect.apply(o, e, []);
					if (z(i)) {
						let e = H(i.width);
						e !== void 0 && (t = r.x + n.x + n.width - Math.round(e));
					}
				}
				Reflect.apply(i, e, [t, a]);
				return;
			} catch {}
		}
		D(e, t, n, r);
	}, k = (e) => {
		let t = h();
		for (let n of de) {
			if (e.has(n)) continue;
			let r = U(t, n);
			V(r) && De(r) && T(r, `document.${n}.hidePopup`);
		}
	}, A = (e, t) => {
		let n = e.closest;
		if (B(n)) try {
			if (Reflect.apply(n, e, ["[data-fennevia-address-popup]"]) != null) return "after_end";
			if (Reflect.apply(n, e, ["[data-fennevia-edge=\"left\"]"]) != null) return "end_before";
		} catch {}
		return he[t];
	}, ee = (e) => {
		let t = h();
		for (let n of pe[e]) {
			let e = U(t, n);
			if (V(e)) return e;
		}
		return S(pe[e]);
	}, j = (e) => {
		let n = ee(e);
		if (!n) throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", `document.${pe[e][0]}.openPopup.moveToAnchor.hidePopup`);
		return n;
	}, M = async (e, n, r, i) => {
		let a = h(), o = _e(a), s = be(n), c = xe(a), l, u = () => De(e), d = async (e) => {
			try {
				await e();
			} catch (e) {
				return l = e, u();
			}
			return u();
		}, f = () => {
			if (ge(r)) try {
				O(e, n, r, `${i}.moveTo`);
			} catch {}
		}, p = o && B(o.openPopup) ? o.openPopup : void 0, m = async (t, n) => !o || !p ? !1 : d(() => Reflect.apply(p, o, [
			e,
			t,
			n
		])), g = () => m(n, Object.freeze({ position: r })), v = () => m(n, r), y = () => s ? m(null, Object.freeze({
			x: s.x,
			y: s.y + s.height
		})) : Promise.resolve(!1), b = () => d(() => {
			E(e, n, r, `${i}.openPopup`);
		}), x = () => {
			let t = e.openPopupAtScreenRect;
			return !s || !B(t) ? Promise.resolve(!1) : d(() => Reflect.apply(t, e, [
				r,
				c.x + s.x,
				c.y + s.y,
				s.width,
				s.height,
				!1,
				!1
			]));
		}, S = () => {
			let t = e.openPopupAtScreen;
			return !s || !B(t) ? Promise.resolve(!1) : d(() => Reflect.apply(t, e, [
				c.x + s.x,
				c.y + s.y + s.height,
				!1
			]));
		}, C = (() => {
			let t = e.querySelector;
			if (!B(t)) return !1;
			try {
				return Reflect.apply(t, e, ["panelmultiview"]) != null;
			} catch {
				return !1;
			}
		})(), w = p && (C || ge(r)) ? ge(r) ? [
			async () => {
				let t = e.openPopupAtScreenRect, i = e.openPopup;
				if (!s || !p || !B(t) || !B(i)) return !1;
				let a = () => Reflect.apply(t, e, [
					r,
					c.x + s.x,
					c.y + s.y,
					s.width,
					s.height,
					!1,
					!1
				]);
				try {
					e.openPopup = a;
				} catch {
					return !1;
				}
				try {
					return await m(n, Object.freeze({ position: r }));
				} finally {
					try {
						e.openPopup = i;
					} catch {}
				}
			},
			y,
			g,
			v
		] : [
			g,
			v,
			y
		] : ge(r) ? [
			y,
			x,
			g,
			v,
			b,
			S
		] : [
			g,
			v,
			y,
			b,
			x,
			S
		];
		for (let e of w) {
			if (await e()) {
				f();
				return;
			}
			await Promise.resolve();
		}
		if (u()) {
			f();
			return;
		}
		throw _(l) ? l : G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", `${i}.openPopup`, l);
	}, te = async (e, t, n) => {
		let r = j(e), i = typeof r.id == "string" && r.id ? r.id : pe[e][0];
		return De(r) ? (D(r, t, n, `document.${i}.moveToAnchor`), r) : (await M(r, t, n, `document.${i}`), r);
	}, N = async () => {
		let e = h(), t = e.promiseDocumentFlushed;
		if (B(t)) try {
			await Reflect.apply(t, e, [() => void 0]);
			return;
		} catch {}
		await Promise.resolve();
	}, P = (e, t = 800) => {
		let n = h(), r = U(n, e);
		return V(r) && De(r) ? Promise.resolve(!0) : new Promise((r) => {
			let i = !1, a = (e) => {
				i || (i = !0, r(e));
			}, o = {
				panelId: e,
				resolve: a,
				timeoutHandle: void 0
			}, s = n.setTimeout;
			B(s) ? o.timeoutHandle = Reflect.apply(s, n, [() => {
				m.delete(o);
				let t = U(n, e);
				a(V(t) && De(t));
			}, t]) : queueMicrotask(() => {
				m.delete(o);
				let t = U(n, e);
				a(V(t) && De(t));
			}), m.add(o);
		});
	}, ne = (e, t) => {
		let n = s;
		for (let r of Array.from(m)) if (r.panelId === e) {
			if (m.delete(r), n && B(n.clearTimeout)) try {
				Reflect.apply(n.clearTimeout, n, [r.timeoutHandle]);
			} catch {}
			r.resolve(t);
		}
	}, F = async (e, t) => {
		let n = b(t), r = pe[e][0], i = A(n, e);
		k(new Set(pe[e])), await N();
		for (let t of pe[e]) C(t);
		return u = Object.freeze({
			host: n,
			panelId: r,
			position: i
		}), u;
	}, I = () => {
		let e = s;
		if (!e || !z(e.gPermissionPanel)) return;
		let t = e.gPermissionPanel.setAnchor;
		if (B(t)) try {
			Reflect.apply(t, e.gPermissionPanel, [null, "bottomleft topleft"]);
		} catch {}
	}, L = (e) => {
		let t = Object.freeze({
			open: e,
			type: "native-popup"
		});
		for (let e of Array.from(p)) e(t);
	}, R = (e) => {
		if (c) return;
		let t = Oe(e), n = typeof t?.id == "string" ? t.id : typeof t?.getAttribute == "function" ? t.getAttribute("id") : void 0;
		if (typeof n != "string" || !fe.has(n)) return;
		let r = z(e) ? e.type : void 0;
		if (r === "popupshown") {
			ne(n, !0);
			for (let e of de) e !== n && w(e);
			if (u && V(t)) try {
				O(t, u.host, u.position, `document.${n}.moveToAnchor`);
			} catch {}
			L(!0);
			return;
		}
		if (r === "popuphidden") {
			if (d.has(n)) return;
			u = null, n === "permission-popup" && I(), w(n), L(!1);
		}
	}, re = async (e, n, r) => {
		let i = h(), a = await F(e, n);
		for (let t of pe[e]) d.add(t);
		try {
			switch (e) {
				case "site-information":
				case "protections": {
					if (!z(i.gTrustPanelHandler)) throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.gTrustPanelHandler.showPopup");
					try {
						await y(i.gTrustPanelHandler, "showPopup", "window.gTrustPanelHandler.showPopup");
					} catch {}
					let n = S(pe[e]);
					return n ? (D(n, a.host, a.position, `document.${n.id ?? a.panelId}.moveToAnchor`), !0) : (await te(e, a.host, a.position), !0);
				}
				case "site-permissions": {
					if (!z(i.gPermissionPanel)) throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.gPermissionPanel.setAnchor");
					let n = i.gPermissionPanel.setAnchor;
					if (!B(n)) throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.gPermissionPanel.setAnchor");
					try {
						Reflect.apply(n, i.gPermissionPanel, [a.host, a.position]);
					} catch (e) {
						throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", "window.gPermissionPanel.setAnchor", e);
					}
					try {
						await y(i.gPermissionPanel, "openPopup", "window.gPermissionPanel.openPopup", [Object.freeze({})]);
					} catch {}
					let r = S(pe[e]);
					return r ? (D(r, a.host, a.position, "document.permission-popup.moveToAnchor"), !0) : (await te(e, a.host, a.position), !0);
				}
				case "downloads":
					if (!z(i.DownloadsPanel)) throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.DownloadsPanel.initialize");
					return await y(i.DownloadsPanel, "initialize", "window.DownloadsPanel.initialize"), await te(e, a.host, a.position), !0;
				case "extensions": {
					let n = j(e);
					if (De(n)) {
						T(n, "document.unified-extensions-panel.hidePopup"), u = null;
						for (let t of pe[e]) w(t);
						return L(!1), !0;
					}
					if (!z(i.gUnifiedExtensions)) throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.gUnifiedExtensions.togglePanel");
					let r = _e(i), o = r && B(r.openPopup) ? r.openPopup : void 0;
					if (r && o) try {
						r.openPopup = (e, ...t) => {
							if (!(z(e) && e.id === "unified-extensions-panel")) return Reflect.apply(o, r, [e, ...t]);
						};
					} catch {}
					try {
						await y(i.gUnifiedExtensions, "togglePanel", "window.gUnifiedExtensions.togglePanel");
					} catch {} finally {
						if (r && o) try {
							r.openPopup = o;
						} catch {}
					}
					return await te(e, a.host, a.position), !0;
				}
				case "translate": {
					let n = i.FullPageTranslationsPanel;
					if (!z(n) || !B(n.open)) throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.FullPageTranslationsPanel.open");
					let o = _e(i), s = o?.openPopup, c = null;
					if (o && B(s)) {
						c = (e, ...t) => {
							if (z(e) && e.id === "full-page-translations-panel") {
								let n = z(t[1]) ? Object.freeze({
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
							o.openPopup = c;
						} catch {
							c = null;
						}
					}
					let l = !1;
					try {
						await y(n, "open", "window.FullPageTranslationsPanel.open", [x(r, a.host)]), l = await P(a.panelId, ke);
					} finally {
						if (o && s && c && o.openPopup === c) try {
							o.openPopup = s;
						} catch {}
					}
					if (!l) throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", "document.full-page-translations-panel.popupshown");
					let u = ee(e);
					if (!u || !De(u)) throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", "document.full-page-translations-panel.openPopup");
					return u.anchorNode !== a.host && O(u, a.host, a.position, "document.full-page-translations-panel.moveToAnchor"), !0;
				}
				case "application-menu": {
					let n = j(e);
					if (De(n)) {
						T(n, "document.appMenu-popup.hidePopup"), u = null;
						for (let t of pe[e]) w(t);
						return L(!1), !0;
					}
					if (!z(i.PanelUI)) throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.PanelUI.ensureReady");
					await y(i.PanelUI, "ensureReady", "window.PanelUI.ensureReady");
					let r = i.PanelUI._ensureShortcutsShown;
					if (B(r)) try {
						Reflect.apply(r, i.PanelUI, []);
					} catch {}
					try {
						await te(e, a.host, a.position);
					} catch {}
					let o = ee(e);
					if (o && De(o)) return !0;
					if (C("appMenu-popup"), !B(i.PanelUI.show)) throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.PanelUI.show");
					let s = P("appMenu-popup");
					try {
						let e = Reflect.apply(i.PanelUI.show, i.PanelUI, []);
						Promise.resolve(e).catch(() => {});
					} catch (e) {
						throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", "window.PanelUI.show", e);
					}
					await s;
					let c = ee(e);
					return c && De(c) ? (O(c, a.host, a.position, "document.appMenu-popup.moveTo"), !0) : (await te(e, a.host, a.position), !0);
				}
			}
			throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_INVALID", "firefox-browser-tools-action", "browser-tools.action");
		} finally {
			for (let t of pe[e]) d.delete(t);
		}
	}, ie = Object.freeze({
		invoke: async (e, n, r) => {
			if (!ce(e)) throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_INVALID", "firefox-browser-tools-action", "browser-tools.action");
			let i = h();
			l += 1;
			try {
				if (le(e)) return await re(e, n, r);
				switch (e) {
					case "settings": return await y(i, "openPreferences", "window.openPreferences"), !0;
					case "customize":
						if (!z(i.gCustomizeMode)) throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "window.gCustomizeMode.enter");
						return await y(i.gCustomizeMode, "enter", "window.gCustomizeMode.enter"), !0;
					case "native-toolbar": {
						v();
						let e = U(i, "back-button");
						if (!z(e) || !B(e.focus)) throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-action", "document.back-button.focus");
						try {
							Reflect.apply(e.focus, e, [Object.freeze({ preventScroll: !0 })]);
						} catch (e) {
							throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_FAILED", "firefox-browser-tools-action", "document.back-button.focus", e);
						}
						return !0;
					}
				}
				throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_ACTION_INVALID", "firefox-browser-tools-action", "browser-tools.action");
			} finally {
				--l;
			}
		},
		snapshot() {
			return Ee(we(h()));
		},
		subscribe(e) {
			if (h(), typeof e != "function") throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_LISTENER_INVALID", "firefox-browser-tools-subscribe", "browser-tools.subscribe");
			p.add(e);
			let n = !0;
			return Object.freeze(() => n ? (n = !1, p.delete(e), !0) : !1);
		}
	});
	try {
		t.assertRequiredCapabilities(), g();
		let e = h().document;
		if (!ve(e)) throw G(t, "FENNEVIA_FIREFOX_BROWSER_TOOLS_CAPABILITY_MISSING", "firefox-browser-tools-capability", "document.addEventListener.removeEventListener");
		f.push(t.subscribe(e, "popupshown", R, ue), t.subscribe(e, "popuphidden", R, ue));
	} catch (e) {
		c = !0, s = null;
		for (let e of f.reverse()) try {
			e();
		} catch {}
		throw e;
	}
	return Object.freeze({
		assertRequiredCapabilities: g,
		browserTools: ie,
		dispose() {
			if (c) return !1;
			c = !0;
			let e = s;
			u = null, p.clear();
			for (let e of Array.from(m)) m.delete(e), e.resolve(!1);
			if (e) {
				for (let t of de) {
					let n = U(e, t);
					if (V(n) && De(n)) try {
						Reflect.apply(n.hidePopup, n, []);
					} catch {}
					w(t);
				}
				I();
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
var je = Object.freeze({
	defaultProgrammaticRevealMs: 1200,
	hideDelayMs: 300,
	maximumProgrammaticRevealMs: 1e4,
	windowLeaveHideDelayMs: 800
}), Me = Object.freeze({
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
}), Ne = Object.freeze({
	hideDelayMs: je.hideDelayMs,
	programmaticRevealMs: je.defaultProgrammaticRevealMs,
	triggerThicknessCssPixels: 12,
	windowLeaveHideDelayMs: je.windowLeaveHideDelayMs
}), Pe = Object.freeze([
	"built-in",
	"extension-action",
	"fennevia",
	"separator",
	"spacer",
	"spring"
]), Fe = Object.freeze([
	"top",
	"left",
	"right",
	"bottom"
]), Ie = Object.freeze([
	"show-bookmarks",
	"show-downloads",
	"show-translate"
]), Le = Object.freeze([
	"built-in",
	"extension-action",
	"fennevia",
	"special"
]), Re = Object.freeze([
	"auto",
	"light",
	"dark"
]), ze = Object.freeze([
	"compact",
	"cozy",
	"comfortable"
]), Be = Object.freeze(["tabs-left", "tabs-right"]), Ve = Object.freeze([
	"loading",
	"downloads",
	"off"
]), He = Object.freeze({
	autoHideDelay: Me.hideDelayMs,
	blur: Object.freeze({
		max: 32,
		min: 0
	}),
	edgeTriggerSize: Me.triggerThicknessCssPixels,
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
	temporaryRevealDuration: Me.programmaticRevealMs,
	windowLeaveHideDelay: Me.windowLeaveHideDelayMs
}), Ue = /^#[0-9A-Fa-f]{6}$/u, We = Object.freeze([
	"accent",
	"border",
	"chromeBackground",
	"surface",
	"text"
]), Ge = /^[a-z][a-z0-9-]{0,63}$/u;
new Set(Pe);
var Ke = new Set(Fe), qe = new Set(Ie);
new Set(Le);
var Je = new Set(Re), Ye = new Set(ze), Xe = new Set(Be), Ze = new Set(Ve), Qe = Object.freeze([
	"separator",
	"spacer",
	"spring"
]);
new Set(Qe);
//#endregion
//#region src/app/toolbar-widgets/errors.ts
var $e = (e) => {
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
};
//#endregion
//#region src/app/toolbar-widgets/validation.ts
function et(e) {
	return typeof e == "string" && Ke.has(e);
}
function tt(e) {
	return typeof e == "string" && qe.has(e);
}
function nt(e) {
	return typeof e == "string" && Je.has(e);
}
function rt(e) {
	return typeof e == "string" && Ye.has(e);
}
function it(e) {
	return typeof e == "string" && Xe.has(e);
}
function at(e) {
	return typeof e == "string" && Ze.has(e);
}
function ot() {
	return Object.freeze({
		allowCompactWindow: !1,
		bottomDownloadsEnabled: !0,
		bottomProgressLight: "downloads",
		sidePanelLayout: "tabs-left",
		topProgressLight: "loading"
	});
}
function st(e) {
	if (!e || typeof e != "object" || typeof e.allowCompactWindow != "boolean" || typeof e.bottomDownloadsEnabled != "boolean" || !at(e.bottomProgressLight) || !it(e.sidePanelLayout) || !at(e.topProgressLight)) throw $e("FENNEVIA_TOOLBAR_WIDGETS_STATE_PANELS_INVALID");
	return Object.freeze({
		allowCompactWindow: e.allowCompactWindow,
		bottomDownloadsEnabled: e.bottomDownloadsEnabled,
		bottomProgressLight: e.bottomProgressLight,
		sidePanelLayout: e.sidePanelLayout,
		topProgressLight: e.topProgressLight
	});
}
function ct(e) {
	if (!e || typeof e != "object") throw $e("FENNEVIA_TOOLBAR_WIDGETS_STATE_PANELS_INVALID");
	let t = Object.keys(e), n = st({
		...ot(),
		...e
	});
	if (t.length === 0 || t.some((e) => !Object.hasOwn(n, e))) throw $e("FENNEVIA_TOOLBAR_WIDGETS_STATE_PANELS_INVALID");
	let r = {};
	for (let i of t) {
		let t = i;
		if (e[t] !== n[t]) throw $e("FENNEVIA_TOOLBAR_WIDGETS_STATE_PANELS_INVALID");
		Object.assign(r, { [t]: n[t] });
	}
	return Object.freeze(r);
}
function lt() {
	return Object.freeze({
		accent: "",
		autoHideDelay: Ne.hideDelayMs,
		blur: 18,
		border: "",
		chromeBackground: "",
		density: "cozy",
		edgeTriggerSize: Ne.triggerThicknessCssPixels,
		fontSize: 12,
		motion: 180,
		radius: 4,
		saturation: 145,
		shadow: 50,
		shortcutHintDuration: 600,
		surface: "",
		surfaceOpacity: 94,
		temporaryRevealDuration: Ne.programmaticRevealMs,
		text: "",
		theme: "auto",
		windowLeaveHideDelay: Ne.windowLeaveHideDelayMs
	});
}
var ut = (e, t) => typeof e == "number" && Number.isSafeInteger(e) && e >= t.min && e <= t.max, dt = new Set(We);
function ft(e) {
	return typeof e == "string" && dt.has(e);
}
function pt(e) {
	return typeof e == "string" ? e === "" ? "" : Ue.test(e) ? e.toLowerCase() : null : null;
}
var mt = (e) => pt(e);
function ht(e) {
	if (!e || typeof e != "object") throw $e("FENNEVIA_TOOLBAR_WIDGETS_STATE_STYLE_INVALID");
	let t = mt(e.accent), n = mt(e.border), r = mt(e.chromeBackground), i = mt(e.surface), a = mt(e.text);
	if (t === null || n === null || r === null || i === null || a === null || !ut(e.autoHideDelay, He.autoHideDelay) || !ut(e.blur, He.blur) || !rt(e.density) || !ut(e.edgeTriggerSize, He.edgeTriggerSize) || !ut(e.fontSize, He.fontSize) || !ut(e.motion, He.motion) || !ut(e.radius, He.radius) || !ut(e.saturation, He.saturation) || !ut(e.shadow, He.shadow) || !ut(e.shortcutHintDuration, He.shortcutHintDuration) || !ut(e.surfaceOpacity, He.surfaceOpacity) || !ut(e.temporaryRevealDuration, He.temporaryRevealDuration) || !nt(e.theme) || !ut(e.windowLeaveHideDelay, He.windowLeaveHideDelay)) throw $e("FENNEVIA_TOOLBAR_WIDGETS_STATE_STYLE_INVALID");
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
function gt(e) {
	if (!e || typeof e != "object") throw $e("FENNEVIA_TOOLBAR_WIDGETS_STATE_STYLE_INVALID");
	let t = Object.keys(e), n = {};
	for (let r of t) {
		if (ft(r)) {
			let t = mt(e[r]);
			if (t === null) throw $e("FENNEVIA_TOOLBAR_WIDGETS_STATE_STYLE_INVALID");
			Object.assign(n, { [r]: t });
			continue;
		}
		Object.assign(n, { [r]: e[r] });
	}
	let r = ht({
		...lt(),
		...n
	});
	if (t.length === 0 || t.some((e) => !Object.hasOwn(r, e)) || t.some((e) => n[e] !== r[e])) throw $e("FENNEVIA_TOOLBAR_WIDGETS_STATE_STYLE_INVALID");
	let i = {};
	for (let e of t) {
		let t = e;
		Object.assign(i, { [t]: r[t] });
	}
	return Object.freeze(i);
}
function _t() {
	return Object.freeze({
		bottom: Object.freeze([]),
		left: Object.freeze([]),
		right: Object.freeze([]),
		top: Object.freeze([])
	});
}
function vt() {
	return Object.freeze({
		available: !1,
		canEdit: !1,
		layoutCustomized: !1,
		palette: Object.freeze([]),
		panels: ot(),
		panelsCustomized: !1,
		style: lt(),
		zones: _t()
	});
}
var yt = (e) => typeof e == "number" && Number.isSafeInteger(e) && e >= 0 && e <= 48, bt = (e) => typeof e == "number" && Number.isSafeInteger(e) && e >= 0;
function xt(e) {
	if (!e || typeof e != "object") throw $e("FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID");
	switch (e.type) {
		case "add":
			if (typeof e.token != "string" || !Ge.test(e.token) || !et(e.zone) || !yt(e.index) || !bt(e.revision)) throw $e("FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID");
			return Object.freeze({
				index: e.index,
				revision: e.revision,
				token: e.token,
				type: "add",
				zone: e.zone
			});
		case "move":
			if (!et(e.fromZone) || !et(e.toZone) || !yt(e.fromIndex) || !yt(e.toIndex) || !bt(e.revision)) throw $e("FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID");
			return Object.freeze({
				fromIndex: e.fromIndex,
				fromZone: e.fromZone,
				revision: e.revision,
				toIndex: e.toIndex,
				toZone: e.toZone,
				type: "move"
			});
		case "remove":
			if (!et(e.zone) || !yt(e.index) || !bt(e.revision)) throw $e("FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID");
			return Object.freeze({
				index: e.index,
				revision: e.revision,
				type: "remove",
				zone: e.zone
			});
		case "reset-layout":
			if (!bt(e.revision)) throw $e("FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID");
			return Object.freeze({
				revision: e.revision,
				type: "reset-layout"
			});
		case "set-style": return Object.freeze({
			style: gt(e.style),
			type: "set-style"
		});
		case "reset-style": return Object.freeze({ type: "reset-style" });
		case "set-panels": return Object.freeze({
			panels: ct(e.panels),
			type: "set-panels"
		});
		case "reset-panels": return Object.freeze({ type: "reset-panels" });
		default: throw $e("FENNEVIA_TOOLBAR_WIDGETS_STATE_EDIT_INVALID");
	}
}
//#endregion
//#region src/firefox/customize-model.ts
var St = Object.freeze([
	"separator",
	"spacer",
	"spring"
]), Ct = new Set(St), wt = Object.freeze({
	adoptedMaxEntries: 64,
	serializedMaxLength: 16384,
	widgetIdMaxLength: 128,
	zoneMaxEntries: 48
}), Tt = /^[A-Za-z0-9_.-]{1,128}$/u;
function Et(e) {
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
function Dt(e) {
	return typeof e == "string" && Ct.has(e);
}
function Ot(e) {
	return typeof e == "string" && Tt.test(e);
}
function kt(e) {
	if (!e || typeof e != "object") throw Et("FENNEVIA_CUSTOMIZE_MODEL_ENTRY_INVALID");
	let t = e;
	if (t.type === "widget" && Ot(t.id)) return Object.freeze({
		id: t.id,
		type: "widget"
	});
	if (t.type === "special" && Dt(t.kind)) return Object.freeze({
		kind: t.kind,
		type: "special"
	});
	if (t.type === "fennevia" && tt(t.id)) return Object.freeze({
		id: t.id,
		type: "fennevia"
	});
	throw Et("FENNEVIA_CUSTOMIZE_MODEL_ENTRY_INVALID");
}
function At(e) {
	if (!e || typeof e != "object") throw Et("FENNEVIA_CUSTOMIZE_MODEL_LAYOUT_INVALID");
	let t = e, n = [];
	for (let e of Fe) {
		let r = t[e];
		if (!Array.isArray(r) || r.length > wt.zoneMaxEntries) throw Et("FENNEVIA_CUSTOMIZE_MODEL_LAYOUT_INVALID");
		n.push([e, Object.freeze(r.map(kt))]);
	}
	return Object.freeze(Object.fromEntries(n));
}
function jt(e) {
	if (!e || typeof e != "object") throw Et("FENNEVIA_CUSTOMIZE_MODEL_LAYOUT_INVALID");
	let t = e;
	if (t.version !== 1 || !Array.isArray(t.adopted) || t.adopted.length > wt.adoptedMaxEntries || t.adopted.some((e) => !Ot(e))) throw Et("FENNEVIA_CUSTOMIZE_MODEL_LAYOUT_INVALID");
	return Object.freeze({
		adopted: Object.freeze([...t.adopted]),
		version: 1,
		zones: At(t.zones)
	});
}
function Mt() {
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
function Nt(e, t = []) {
	return jt({
		adopted: t,
		version: 1,
		zones: {
			...Mt().zones,
			...e
		}
	});
}
function Pt(e) {
	if (typeof e != "string" || e === "" || e.length > wt.serializedMaxLength) return null;
	try {
		return jt(JSON.parse(e));
	} catch {
		return null;
	}
}
function Ft(e) {
	let t = JSON.stringify(jt(e));
	if (t.length > wt.serializedMaxLength) throw Et("FENNEVIA_CUSTOMIZE_MODEL_LAYOUT_TOO_LARGE");
	return t;
}
function It(e) {
	if (typeof e != "string" || e === "" || e.length > wt.serializedMaxLength) return null;
	try {
		let t = JSON.parse(e);
		return !t || typeof t != "object" || t.version !== 1 ? null : ht({
			...lt(),
			...t,
			version: void 0
		});
	} catch {
		return null;
	}
}
function Lt(e) {
	return JSON.stringify({
		...ht(e),
		version: 1
	});
}
var Rt = new Set([
	"allowCompactWindow",
	"bottomDownloadsEnabled",
	"bottomProgressLight",
	"sidePanelLayout",
	"topProgressLight",
	"version"
]);
function zt(e) {
	if (typeof e != "string" || e === "" || e.length > wt.serializedMaxLength) return null;
	try {
		let t = JSON.parse(e);
		return !t || typeof t != "object" || t.version !== 1 || Object.keys(t).some((e) => !Rt.has(e)) ? null : st({
			...ot(),
			...t,
			version: void 0
		});
	} catch {
		return null;
	}
}
function Bt(e) {
	return JSON.stringify({
		...st(e),
		version: 1
	});
}
function Vt(e, t) {
	if (t.type === "special") return null;
	for (let n of Fe) {
		let r = e.zones[n];
		for (let [e, i] of r.entries()) if (i.type === t.type && i.id === t.id) return Object.freeze({
			index: e,
			zone: n
		});
	}
	return null;
}
var Ht = (e) => {
	if (!et(e)) throw Et("FENNEVIA_CUSTOMIZE_MODEL_ZONE_INVALID");
	return e;
}, Ut = (e, t) => {
	if (!Number.isSafeInteger(e) || e < 0) throw Et("FENNEVIA_CUSTOMIZE_MODEL_INDEX_INVALID");
	return Math.min(e, t);
}, Wt = (e, t, n) => Object.freeze({
	adopted: e.adopted,
	version: 1,
	zones: Object.freeze({
		...e.zones,
		[t]: Object.freeze([...n])
	})
});
function Gt(e, t, n, r) {
	let i = kt(t), a = Ht(n), o = Vt(e, i), s = e;
	o && (s = Kt(e, o.zone, o.index));
	let c = [...s.zones[a]];
	if (c.length >= wt.zoneMaxEntries) throw Et("FENNEVIA_CUSTOMIZE_MODEL_ZONE_FULL");
	return c.splice(Ut(r, c.length), 0, i), Wt(s, a, c);
}
function Kt(e, t, n) {
	let r = Ht(t), i = [...e.zones[r]];
	if (!Number.isSafeInteger(n) || n < 0 || n >= i.length) throw Et("FENNEVIA_CUSTOMIZE_MODEL_INDEX_INVALID");
	return i.splice(n, 1), Wt(e, r, i);
}
function qt(e, t, n) {
	let r = Ht(t), i = e.zones[r];
	if (!Number.isSafeInteger(n) || n < 0 || n >= i.length) throw Et("FENNEVIA_CUSTOMIZE_MODEL_INDEX_INVALID");
	return i[n];
}
function Jt(e, t, n, r, i) {
	let a = qt(e, t, n), o = Kt(e, t, n), s = [...o.zones[Ht(r)]];
	if (s.length >= wt.zoneMaxEntries) throw Et("FENNEVIA_CUSTOMIZE_MODEL_ZONE_FULL");
	return s.splice(Ut(i, s.length), 0, a), Wt(o, r, s);
}
function Yt(e, t) {
	if (!Ot(t)) throw Et("FENNEVIA_CUSTOMIZE_MODEL_ENTRY_INVALID");
	if (e.adopted.includes(t)) return e;
	if (e.adopted.length >= wt.adoptedMaxEntries) throw Et("FENNEVIA_CUSTOMIZE_MODEL_LAYOUT_TOO_LARGE");
	return Object.freeze({
		adopted: Object.freeze([...e.adopted, t]),
		version: 1,
		zones: e.zones
	});
}
function Xt(e, t) {
	return e.adopted.includes(t) ? Object.freeze({
		adopted: Object.freeze(e.adopted.filter((e) => e !== t)),
		version: 1,
		zones: e.zones
	}) : e;
}
function Zt(e, t) {
	return Vt(e, {
		id: t,
		type: "widget"
	}) !== null;
}
//#endregion
//#region src/firefox/downloads/support.ts
var Qt = "resource://gre/modules/Downloads.sys.mjs", $t = (e) => typeof e == "object" && !!e, en = (e) => typeof e == "function", tn = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, nn = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: tn(e),
	phase: n,
	symbol: r
}), rn = (e) => typeof e == "number" && Number.isFinite(e) && Number.isSafeInteger(e) && e >= 0, an = (e, t) => {
	if (!$t(t) || typeof t.stopped != "boolean" || typeof t.succeeded != "boolean" || typeof t.canceled != "boolean" || typeof t.hasPartialData != "boolean" || typeof t.hasProgress != "boolean" || !Number.isInteger(t.progress) || t.progress < 0 || t.progress > 100 || !rn(t.currentBytes) || !rn(t.totalBytes)) throw nn(e, "FENNEVIA_FIREFOX_DOWNLOAD_RECORD_INVALID", "firefox-downloads-event", "Download");
	return t;
}, on = (e) => e.stopped ? e.succeeded ? "succeeded" : e.error ? "failed" : e.canceled ? e.hasPartialData ? "paused" : "canceled" : "queued" : "active", sn = (e) => e === "succeeded" || e === "failed" || e === "canceled", cn = (e) => Math.min(e, 999), ln = () => Object.freeze({
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
function un({ boundary: e, moduleLoader: t, onError: n, window: r }) {
	if (e.assertOwnsWindow(r), !$t(r) || typeof t != "function" || typeof n != "function") throw nn(e, "FENNEVIA_FIREFOX_DOWNLOADS_OPTIONS_INVALID", "firefox-downloads-create", "ChromeUtils.importESModule");
	let i;
	try {
		i = t(Qt);
	} catch (t) {
		throw nn(e, "FENNEVIA_FIREFOX_DOWNLOADS_MODULE_LOAD_FAILED", "firefox-downloads-module-load", "ChromeUtils.importESModule", t);
	}
	let a = $t(i) ? i.Downloads : void 0, o = a, s = e.snapshot().windowKind === "private" ? "private" : "public", c = s === "private" ? o?.PRIVATE : o?.PUBLIC, l = Object.freeze([
		Object.freeze({
			isAvailable: $t,
			name: "firefox.downloads",
			read: () => a,
			symbol: "Downloads"
		}),
		Object.freeze({
			isAvailable: en,
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
	]), u = r, d = null, f = !1, p = null, m = !0, h = 0, g = !1, v = !1, y = 0, x = 0, S = !1, C = ln(), w = "", T = new Set(), E = e.createHandleRegistry("download"), D = new Map(), O = new WeakSet(), k = [], A = () => {
		if (f || !u) throw nn(e, "FENNEVIA_FIREFOX_DOWNLOADS_DISPOSED", "firefox-downloads-access", "window");
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
			available: en(d.addView),
			name: "firefox.downloads-list-add-view",
			requirement: "required",
			symbol: "DownloadList.addView"
		}) }), Object.freeze({ snapshot: Object.freeze({
			available: en(d.removeView),
			name: "firefox.downloads-list-remove-view",
			requirement: "required",
			symbol: "DownloadList.removeView"
		}) })), Object.freeze(e);
	}, j = () => {
		A();
		let t = ee(), n = t.find((e) => !e.snapshot.available);
		if (n) throw nn(e, "FENNEVIA_FIREFOX_DOWNLOADS_CAPABILITY_MISSING", "firefox-downloads-capability", n.snapshot.symbol, n.cause);
		return Object.freeze(t.map((e) => e.snapshot));
	}, M = (t) => p || (p = _(t) ? t : nn(e, "FENNEVIA_FIREFOX_DOWNLOADS_EVENT_FAILED", "firefox-downloads-event", "DownloadList.view", t), n(p), p), te = (e) => {
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
	}, P = (t) => {
		let n = an(e, t), r = on(n);
		if (m && (O.add(n), sn(r))) return;
		let i = D.get(n);
		if (!(!i && sn(r) && O.has(n))) {
			if (i || (i = {
				currentBytes: 0,
				download: n,
				hasProgress: !1,
				id: E.register(n),
				order: ++x,
				progressPercent: null,
				state: r,
				totalBytes: 0
			}, D.set(n, i)), i.currentBytes = n.currentBytes, i.hasProgress = n.hasProgress, i.progressPercent = r === "succeeded" ? 100 : n.hasProgress ? n.progress : null, i.state = r, i.totalBytes = n.totalBytes, sn(r)) N(n);
			else {
				let e = k.indexOf(n);
				e !== -1 && k.splice(e, 1);
			}
		}
	}, ne = (e) => {
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
	}, F = () => {
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
		})), i = ne(e.active), a = Object.freeze({
			active: e.active.length,
			canceled: e.canceled.length,
			failed: e.failed.length,
			paused: e.paused.length,
			queued: e.queued.length,
			succeeded: e.succeeded.length
		}), o = Object.values(a).some((e) => e > 999);
		return Object.freeze({
			activeCount: cn(a.active),
			aggregatePercent: i.percent,
			canceledCount: cn(a.canceled),
			countOverflow: o,
			failedCount: cn(a.failed),
			items: Object.freeze(r),
			pausedCount: cn(a.paused),
			phase: v ? "ready" : "loading",
			progressMode: i.mode,
			queuedCount: cn(a.queued),
			revision: y + 1,
			succeededCount: cn(a.succeeded),
			truncated: n.length > 6 || o
		});
	}, I = () => {
		if (f || p || m || h > 0) {
			g = !0;
			return;
		}
		g = !1;
		let t = F(), n = JSON.stringify({
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
				M(nn(e, "FENNEVIA_FIREFOX_DOWNLOADS_SUBSCRIBER_FAILED", "firefox-downloads-notify", "downloads.subscribe", t));
				return;
			}
		}
	}, L = Object.freeze({
		onDownloadAdded(e) {
			if (!(f || p)) try {
				P(e), I();
			} catch (e) {
				M(e);
			}
		},
		onDownloadBatchEnded() {
			f || p || (h > 0 && --h, h === 0 && g && I());
		},
		onDownloadBatchStarting() {
			!f && !p && (h += 1);
		},
		onDownloadChanged(e) {
			if (!(f || p)) try {
				P(e), I();
			} catch (e) {
				M(e);
			}
		},
		onDownloadRemoved(t) {
			if (!(f || p)) try {
				let n = an(e, t);
				te(n), I();
			} catch (e) {
				M(e);
			}
		}
	}), R = b(() => {
		!S || !d || (S = !1, Reflect.apply(d.removeView, d, [L]));
	});
	e.assertRequiredCapabilities(), j();
	let re = (async () => {
		try {
			let t = await Reflect.apply(o.getList, o, [c]);
			if (f) return !0;
			if (!$t(t) || !en(t.addView) || !en(t.removeView)) throw nn(e, "FENNEVIA_FIREFOX_DOWNLOADS_CAPABILITY_MISSING", "firefox-downloads-capability", !$t(t) || !en(t.addView) ? "DownloadList.addView" : "DownloadList.removeView");
			if (d = t, S = !0, Reflect.apply(d.addView, d, [L]), f) return R(), !0;
			if (m = !1, h = 0, p) throw p;
			return v = !0, I(), !0;
		} catch (t) {
			if (f) return !0;
			throw p ?? M(_(t) ? t : nn(e, "FENNEVIA_FIREFOX_DOWNLOADS_INITIALIZATION_FAILED", "firefox-downloads-initialize", "Downloads.getList", t));
		}
	})();
	re.catch(() => void 0);
	let ie = Object.freeze({
		ready() {
			return A(), re;
		},
		snapshot() {
			return A(), C;
		},
		subscribe(t) {
			if (A(), typeof t != "function") throw nn(e, "FENNEVIA_FIREFOX_DOWNLOADS_LISTENER_INVALID", "firefox-downloads-subscribe", "downloads.subscribe");
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
				R();
			} catch (e) {
				t = e;
			}
			T.clear(), D.clear(), k.length = 0;
			try {
				E.dispose();
			} catch (e) {
				t ??= e;
			}
			if (d = null, t !== void 0) throw nn(e, "FENNEVIA_FIREFOX_DOWNLOADS_DISPOSE_FAILED", "firefox-downloads-dispose", "DownloadList.removeView", t);
			return !0;
		},
		downloads: ie,
		ready() {
			return A(), re;
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
var dn = Object.freeze(["en", "zh-Hant"]), fn = "en", pn = new Set(dn), mn = (e) => {
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
}, hn = (e) => e.trim().replaceAll("_", "-").toLowerCase(), gn = (e, t) => e === t || e.startsWith(`${t}-`);
function _n(e) {
	return typeof e == "string" && pn.has(e);
}
function vn(e) {
	return typeof e != "string" || e.trim().length === 0 ? "en" : gn(hn(e), "zh") ? "zh-Hant" : "en";
}
function yn(e) {
	if (!e || typeof e != "object" || !_n(e.id)) throw mn("FENNEVIA_LOCALE_STATE_SNAPSHOT_INVALID");
	return Object.freeze({ id: e.id });
}
function bn(e = "en") {
	if (!_n(e)) throw mn("FENNEVIA_LOCALE_STATE_SNAPSHOT_INVALID");
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
var xn = Object.freeze({
	en: {
		"address.close": "Close",
		"address.closeAria": "Close address and search",
		"address.empty": "Enter an address or search.",
		"address.enterHint": "Enter to open · Escape to cancel",
		"address.fieldLabel": "Enter an address or search",
		"address.firefoxControls": "Firefox controls",
		"address.loading": "The current page is loading.",
		"address.nativeAccess": "Open Firefox address bar",
		"address.nativeAccessDescription": "Use Firefox for extension actions and complete address-bar controls.",
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
		"address.urlbarItemsAria": "Applicable Firefox address-bar items",
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
		"bookmarks.location": "Location",
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
		"customize.autoHideDelay": "Hide after entering page",
		"customize.autoHideDelayHelp": "How long a panel remains visible after the pointer moves into page content or another area inside Firefox.",
		"customize.bottomDownloadsPanel": "Enable bottom Downloads panel",
		"customize.bottomProgressLight": "Bottom light",
		"customize.closeAria": "Close customize panel",
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
		"customize.density": "Density",
		"customize.density.comfortable": "Comfortable",
		"customize.density.compact": "Compact",
		"customize.density.cozy": "Cozy",
		"customize.editFailed": "That change could not be applied. The layout may have just changed; try again.",
		"customize.edgeTriggerSize": "Edge trigger size",
		"customize.edgeTriggerSizeHelp": "Width of the invisible edge target. Larger values are easier to hit but cover more of the page edge.",
		"customize.emptyPalette": "Every available widget is already placed. Drop a widget here to remove it from a panel.",
		"customize.followingFirefox": "Following your Firefox toolbar until you make a change. Drag widgets onto the four edge panels.",
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
		"customize.layoutCustomized": "Using your Fennevia layout. Drag widgets onto the four edge panels. Drop them here to remove. Reset to follow the Firefox toolbar again.",
		"customize.paletteAria": "Available widgets",
		"customize.panelAria": "Customize Fennevia shell",
		"customize.allowCompactWindow": "Allow smaller than Firefox minimum window size",
		"customize.allowCompactWindowHelp": "Firefox chrome normally refuses to shrink below its official minimum. Enable this to resize smaller while Fennevia is active. Caption buttons and some chrome may clip. The operating system still keeps its own floor.",
		"customize.panels": "Panels and progress lights",
		"customize.panelsHelp": "Swap the two side roles, disable the bottom Downloads panel, choose what each gutter light reports, or allow a smaller-than-Firefox window size.",
		"customize.progressLight.downloads": "Downloads",
		"customize.progressLight.loading": "Page loading",
		"customize.progressLight.off": "Off",
		"customize.resetLayout": "Reset layout",
		"customize.resetPanels": "Reset panels and lights",
		"customize.resetStyle": "Reset appearance and interaction",
		"customize.shortcutHintDuration": "Shortcut tips",
		"customize.shortcutHintDurationHelp": "How long keyboard shortcut tips stay visible when an edge panel opens. Set to 0 to hide them entirely.",
		"customize.shortcutHintOff": "Off",
		"customize.sidePanels": "Side panel roles",
		"customize.sidePanels.tabsLeft": "Tabs left · bookmarks right",
		"customize.sidePanels.tabsRight": "Bookmarks left · tabs right",
		"customize.style": "Appearance",
		"customize.tab.appearance": "Appearance",
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
		"permission.statusAria": "Firefox site status",
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
		"tab.pip": "Picture in picture",
		"tab.playing": "Playing",
		"tab.reordered": "Moved {title} to position {index} of {total}",
		"tab.screenSharing": "Sharing screen",
		"tab.unmute": "Unmute",
		"tab.unpin": "Unpin",
		"tab.unpinTab": "Unpin tab",
		"tab.untitled": "Untitled tab",
		"urlbar.bookmark": "Bookmark page",
		"urlbar.container": "Container tab",
		"urlbar.extension-actions": "Extension page actions",
		"urlbar.more-page-actions": "More page actions",
		"urlbar.other-page-actions": "Additional page actions",
		"urlbar.persisted-search": "Persisted search terms",
		"urlbar.picture-in-picture": "Picture-in-Picture",
		"urlbar.reader-view": "Reader View",
		"urlbar.recommendation": "Firefox recommendation",
		"urlbar.remote-control": "Browser under remote control",
		"urlbar.search-mode": "Search mode",
		"urlbar.split-view": "Split view",
		"urlbar.taskbar-tabs": "Taskbar tab controls",
		"urlbar.translations": "Translate page",
		"urlbar.zoom": "Reset page zoom",
		"widget.dropHere": "Drop widgets here",
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
		"address.nativeAccessDescription": "使用 Firefox 可開啟擴充功能動作與完整網址列控制。",
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
		"address.urlbarItemsAria": "適用的 Firefox 網址列項目",
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
		"bookmarks.location": "位置",
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
		"customize.autoHideDelay": "移入網頁後隱藏",
		"customize.autoHideDelayHelp": "指標從面板移入網頁內容或 Firefox 視窗內其他區域後，面板繼續顯示的時間。",
		"customize.bottomDownloadsPanel": "啟用底部下載面板",
		"customize.bottomProgressLight": "底部光條",
		"customize.closeAria": "關閉自訂面板",
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
		"customize.density": "密度",
		"customize.density.comfortable": "寬鬆",
		"customize.density.compact": "緊湊",
		"customize.density.cozy": "適中",
		"customize.editFailed": "無法套用該變更。版面可能剛改變，請再試一次。",
		"customize.edgeTriggerSize": "邊緣觸發區",
		"customize.edgeTriggerSizeHelp": "隱形邊緣目標的寬度。數值越大越容易觸發，但會覆蓋較多網頁邊緣。",
		"customize.emptyPalette": "所有可用元件都已放置。將元件拖到這裡可從面板移除。",
		"customize.followingFirefox": "在你做出變更之前會跟隨 Firefox 工具列。將元件拖到四個邊緣面板。",
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
		"customize.layoutCustomized": "正在使用你的 Fennevia 版面。將元件拖到四個邊緣面板。拖到這裡可移除。重設後會再次跟隨 Firefox 工具列。",
		"customize.paletteAria": "可用元件",
		"customize.panelAria": "自訂 Fennevia 介面",
		"customize.allowCompactWindow": "允許小於 Firefox 官方下限的視窗尺寸",
		"customize.allowCompactWindowHelp": "Firefox 通常不允許視窗小於官方 chrome 下限。開啟後，Fennevia 啟用期間可以縮得更小。標題列按鈕與部分介面可能被裁切。作業系統仍會保留自己的下限。",
		"customize.panels": "面板與進度光條",
		"customize.panelsHelp": "互換左右面板的用途、關閉底部下載面板、指定上下光條要顯示的狀態，或允許小於 Firefox 官方下限的視窗。",
		"customize.progressLight.downloads": "下載進度",
		"customize.progressLight.loading": "網頁載入",
		"customize.progressLight.off": "關閉",
		"customize.resetLayout": "重設版面",
		"customize.resetPanels": "重設面板與光條",
		"customize.resetStyle": "重設外觀與互動",
		"customize.shortcutHintDuration": "快速鍵提示",
		"customize.shortcutHintDurationHelp": "邊緣面板開啟時，鍵盤快速鍵提示要顯示多久。設為 0 可完全隱藏提示。",
		"customize.shortcutHintOff": "不顯示",
		"customize.sidePanels": "左右面板用途",
		"customize.sidePanels.tabsLeft": "左側分頁 · 右側書籤",
		"customize.sidePanels.tabsRight": "左側書籤 · 右側分頁",
		"customize.style": "外觀",
		"customize.tab.appearance": "外觀",
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
		"permission.statusAria": "Firefox 網站狀態",
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
		"tab.pip": "子母畫面",
		"tab.playing": "播放中",
		"tab.reordered": "已將「{title}」移至第 {index} 個，共 {total} 個",
		"tab.screenSharing": "正在分享螢幕",
		"tab.unmute": "取消靜音",
		"tab.unpin": "取消釘選",
		"tab.unpinTab": "取消釘選分頁",
		"tab.untitled": "未命名分頁",
		"urlbar.bookmark": "將此頁加入書籤",
		"urlbar.container": "容器分頁",
		"urlbar.extension-actions": "擴充功能頁面動作",
		"urlbar.more-page-actions": "更多頁面動作",
		"urlbar.other-page-actions": "其他頁面動作",
		"urlbar.persisted-search": "保留的搜尋詞",
		"urlbar.picture-in-picture": "子母畫面",
		"urlbar.reader-view": "閱讀模式",
		"urlbar.recommendation": "Firefox 建議",
		"urlbar.remote-control": "瀏覽器正被遠端控制",
		"urlbar.search-mode": "搜尋模式",
		"urlbar.split-view": "分割檢視",
		"urlbar.taskbar-tabs": "工作列分頁控制項",
		"urlbar.translations": "翻譯頁面",
		"urlbar.zoom": "重設頁面縮放",
		"widget.dropHere": "將元件拖放到這裡",
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
function Sn(e, t) {
	return t ? e.replace(/\{([A-Za-z][A-Za-z0-9]*)\}/gu, (e, n) => {
		let r = t[n];
		return r === void 0 ? e : String(r);
	}) : e;
}
function Cn(e, t, n) {
	return Sn((xn[e] ?? xn.en)[t] ?? xn.en[t] ?? t, n);
}
//#endregion
//#region src/firefox/locale.ts
var wn = "intl:app-locales-changed", Tn = Object.freeze([
	"frame",
	"overlay",
	"top",
	"left",
	"right",
	"bottom"
]), En = Object.freeze({
	bottom: "chrome.host.bottom",
	frame: "chrome.host.frame",
	left: "chrome.host.left",
	overlay: "chrome.host.overlay",
	right: "chrome.host.right",
	top: "chrome.host.top"
}), Dn = (e) => typeof e == "object" && !!e, On = (e) => typeof e == "function", kn = (e) => {
	let t = e.Services;
	if (!Dn(t)) return null;
	let n = t.locale;
	return Dn(n) ? n : null;
}, An = (e) => {
	let t = e.Services;
	if (!Dn(t)) return null;
	let n = t.obs;
	return !Dn(n) || !On(n.addObserver) || !On(n.removeObserver) ? null : n;
}, jn = Object.freeze([Object.freeze({
	isAvailable: (e) => e !== null,
	name: "locale.app-locale",
	read: (e) => kn(e),
	requirement: "optional",
	symbol: "window.Services.locale.appLocaleAsBCP47"
}), Object.freeze({
	isAvailable: (e) => e !== null,
	name: "locale.app-locales-observer",
	read: (e) => An(e),
	requirement: "optional",
	symbol: "window.Services.obs.addObserver.removeObserver"
})]), Mn = (e) => Object.freeze(jn.map((t) => {
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
})), Nn = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, Pn = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: Nn(e),
	phase: n,
	symbol: r
}), Fn = (e) => {
	let t = kn(e);
	if (!t) return "";
	try {
		let e = t.appLocaleAsBCP47;
		return typeof e == "string" ? e : "";
	} catch {
		return "";
	}
}, In = (e) => Object.freeze({ id: vn(Fn(e)) }), Ln = (e, t) => Cn(e, En[t]);
function Rn({ boundary: e, onError: t, window: n }) {
	if (e.assertOwnsWindow(n), !Dn(n)) throw Pn(e, "FENNEVIA_FIREFOX_LOCALE_OPTIONS_INVALID", "firefox-locale-create", "window");
	let r = typeof t == "function" ? t : () => {}, i = n, a = !1, o = new Set(), s = !1, c = Object.freeze({ observe() {
		u();
	} }), l = () => {
		if (a || !i) throw Pn(e, "FENNEVIA_FIREFOX_LOCALE_DISPOSED", "firefox-locale-access", "window");
		return i;
	}, u = () => {
		let t;
		try {
			t = In(l());
		} catch (e) {
			r(e);
			return;
		}
		for (let n of Array.from(o)) try {
			n(t);
		} catch (t) {
			r(Pn(e, "FENNEVIA_FIREFOX_LOCALE_SUBSCRIBER_FAILED", "firefox-locale-notify", "locale.subscribe", t));
		}
	}, d = () => {
		if (!s || !i) {
			s = !1;
			return;
		}
		let e = An(i);
		if (e) try {
			Reflect.apply(e.removeObserver, e, [c, wn]);
		} catch {}
		s = !1;
	}, f = An(n);
	if (f) try {
		Reflect.apply(f.addObserver, f, [c, wn]), s = !0;
	} catch (t) {
		r(Pn(e, "FENNEVIA_FIREFOX_LOCALE_SUBSCRIBE_FAILED", "firefox-locale-subscribe", "window.Services.obs.addObserver", t));
	}
	let p = Object.freeze({
		snapshot() {
			return yn(In(l()));
		},
		subscribe(t) {
			if (typeof t != "function") throw Pn(e, "FENNEVIA_FIREFOX_LOCALE_LISTENER_INVALID", "firefox-locale-subscribe", "locale.subscribe");
			return l(), o.add(t), () => o.delete(t);
		}
	});
	return Object.freeze({
		assertRequiredCapabilities() {
			let t = Mn(l()), n = t.find((e) => e.snapshot.requirement === "required" && !e.snapshot.available);
			if (n) throw Pn(e, "FENNEVIA_FIREFOX_LOCALE_CAPABILITY_MISSING", "firefox-locale-capability", n.snapshot.symbol, n.cause);
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
var zn = 2048, Bn = 4096, Vn = (e) => {
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
function Hn(e) {
	if (!e || typeof e != "object") throw Vn("FENNEVIA_NAVIGATION_POINTER_GESTURE_INVALID");
	let t = e;
	if (typeof t.altKey != "boolean" || typeof t.ctrlKey != "boolean" || typeof t.metaKey != "boolean" || typeof t.shiftKey != "boolean" || !Number.isInteger(t.button) || t.button < 0 || t.button > 2) throw Vn("FENNEVIA_NAVIGATION_POINTER_GESTURE_INVALID");
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
var Un = Object.freeze({
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
}), Wn = Object.freeze(["TabSelect", "TabAttrModified"]), Gn = new Set([
	"busy",
	"label",
	"selected"
]), Kn = "Browser:OpenLocation", qn = Object.freeze({
	selectAll: !0,
	source: "ctrl-l",
	type: "address-popup-open"
}), Jn = Object.freeze({ status: "accepted" }), Yn = Object.freeze({
	reason: "empty",
	status: "rejected"
}), Xn = Object.freeze({
	reason: "too-long",
	status: "rejected"
}), Zn = Object.freeze({
	reason: "unsafe-scheme",
	status: "rejected"
}), Qn = /^\s*(?:data|javascript|vbscript)\s*:/iu, $n = new Set([
	"about:blank",
	"about:home",
	"about:newtab",
	"about:privatebrowsing"
]), er = Object.freeze({
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
}), tr = (e) => `document.commands[${e.replaceAll(":", "-")}]`, K = (e) => typeof e == "object" && !!e, q = (e) => typeof e == "function", nr = (e) => K(e) && q(e.addEventListener) && q(e.removeEventListener), rr = (e) => e.gBrowser, ir = (e, t) => {
	let n = rr(e);
	return K(n) ? n[t] : void 0;
}, ar = (e, t) => {
	let n = ir(e, "selectedBrowser");
	return K(n) ? n[t] : void 0;
}, or = (e, t) => {
	let n = e.BrowserCommands;
	return K(n) ? n[t] : void 0;
}, sr = (e, t) => {
	let n = e.gURLBar;
	return K(n) ? n[t] : void 0;
}, cr = (e, t) => e[t], lr = (e) => {
	let t = e.document;
	return K(t) ? t.documentElement : void 0;
}, ur = (e, t) => {
	let n = e.document;
	if (!(!K(n) || !q(n.getElementById))) return Reflect.apply(n.getElementById, n, [t]);
}, dr = (e) => K(e) && q(e.hasAttribute), fr = (e) => nr(e) && typeof e.value == "string" && q(e.getAttribute) && q(e.handleCommand), pr = (e) => K(e) && q(e.getConnectionSecurityInformation), mr = (e) => K(e) && q(e.onContentBlockingEvent), hr = (e) => K(e) && q(e.canHandle), gr = (e) => K(e) && typeof e.canGoBack == "boolean" && typeof e.canGoForward == "boolean", _r = (e) => K(e) && (typeof e.displaySpec == "string" || typeof e.spec == "string"), vr = Object.freeze([
	Object.freeze({
		isAvailable: gr,
		name: "firefox.navigation-selected-browser",
		read: (e) => ir(e, "selectedBrowser"),
		symbol: "window.gBrowser.selectedBrowser.canGoBack"
	}),
	Object.freeze({
		isAvailable: _r,
		name: "firefox.navigation-current-uri",
		read: (e) => ar(e, "currentURI"),
		symbol: "window.gBrowser.selectedBrowser.currentURI.displaySpec"
	}),
	Object.freeze({
		isAvailable: q,
		name: "firefox.navigation-selected-browser-focus",
		read: (e) => ar(e, "focus"),
		symbol: "window.gBrowser.selectedBrowser.focus"
	}),
	Object.freeze({
		isAvailable: (e) => K(e) && q(e.getAttribute),
		name: "firefox.navigation-selected-tab",
		read: (e) => ir(e, "selectedTab"),
		symbol: "window.gBrowser.selectedTab.getAttribute"
	}),
	Object.freeze({
		isAvailable: nr,
		name: "firefox.navigation-tab-events",
		read: (e) => ir(e, "tabContainer"),
		symbol: "window.gBrowser.tabContainer"
	}),
	...[["add-progress-listener", "addTabsProgressListener"], ["remove-progress-listener", "removeTabsProgressListener"]].map(([e, t]) => Object.freeze({
		isAvailable: q,
		name: `firefox.navigation-${e}`,
		read: (e) => ir(e, t),
		symbol: `window.gBrowser.${t}`
	})),
	Object.freeze({
		isAvailable: q,
		name: "firefox.navigation-mutation-observer",
		read: (e) => e.MutationObserver,
		symbol: "window.MutationObserver"
	}),
	Object.freeze({
		isAvailable: (e) => typeof e == "string",
		name: "firefox.navigation-urlbar-value",
		read: (e) => sr(e, "value"),
		symbol: "window.gURLBar.value"
	}),
	Object.freeze({
		isAvailable: q,
		name: "firefox.navigation-urlbar-submission",
		read: (e) => sr(e, "handleCommand"),
		symbol: "window.gURLBar.handleCommand"
	}),
	Object.freeze({
		isAvailable: q,
		name: "firefox.navigation-urlbar-proxy-state",
		read: (e) => sr(e, "getAttribute"),
		symbol: "window.gURLBar.getAttribute"
	}),
	Object.freeze({
		isAvailable: pr,
		name: "firefox.navigation-connection-security",
		read: (e) => cr(e, "gIdentityHandler"),
		symbol: "window.gIdentityHandler.getConnectionSecurityInformation"
	}),
	Object.freeze({
		isAvailable: mr,
		name: "firefox.navigation-tracking-protection",
		read: (e) => cr(e, "gProtectionsHandler"),
		symbol: "window.gProtectionsHandler.onContentBlockingEvent"
	}),
	Object.freeze({
		isAvailable: hr,
		name: "firefox.navigation-tracking-protection-availability",
		read: (e) => cr(e, "ContentBlockingAllowList"),
		symbol: "window.ContentBlockingAllowList.canHandle"
	}),
	Object.freeze({
		isAvailable: (e) => dr(e) && nr(e),
		name: "firefox.navigation-open-location-command",
		read: (e) => ur(e, Kn),
		symbol: tr(Kn)
	}),
	Object.freeze({
		isAvailable: (e) => K(e) && q(e.hasAttribute),
		name: "firefox.navigation-shell-health-gate",
		read: lr,
		symbol: "document.documentElement.hasAttribute"
	}),
	...Object.values(Un).flatMap(({ id: e, method: t }) => [Object.freeze({
		isAvailable: dr,
		name: `firefox.navigation-command-${t}`,
		read: (t) => ur(t, e),
		symbol: tr(e)
	}), Object.freeze({
		isAvailable: q,
		name: `firefox.navigation-action-${t}`,
		read: (e) => or(e, t),
		symbol: `window.BrowserCommands.${t}`
	})]),
	Object.freeze({
		isAvailable: q,
		name: "firefox.navigation-action-home",
		read: (e) => or(e, "home"),
		symbol: "window.BrowserCommands.home"
	}),
	Object.freeze({
		isAvailable: q,
		name: "firefox.navigation-action-reloadOrDuplicate",
		read: (e) => or(e, "reloadOrDuplicate"),
		symbol: "window.BrowserCommands.reloadOrDuplicate"
	})
]), yr = (e) => Object.freeze(vr.map((t) => {
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
})), br = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, J = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: br(e),
	phase: n,
	symbol: r
}), xr = (e, t) => e.addressValue === t.addressValue && e.canGoBack === t.canGoBack && e.canGoForward === t.canGoForward && e.connectionSecurity === t.connectionSecurity && e.displayUri === t.displayUri && e.loading === t.loading && e.title === t.title && e.trackingProtection === t.trackingProtection, Sr = (e) => {
	if (!K(e) || !K(e.detail)) return !0;
	let t = e.detail.changed;
	return !Array.isArray(t) || t.some((e) => typeof e != "string") ? !0 : t.some((e) => Gn.has(e));
};
//#endregion
//#region src/firefox/navigation/controller.ts
function Cr({ boundary: e, onError: t, window: n }) {
	if (e.assertOwnsWindow(n), !K(n) || typeof t != "function") throw J(e, "FENNEVIA_FIREFOX_NAVIGATION_OPTIONS_INVALID", "firefox-navigation-create", "window");
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
		if (i || !r) throw J(e, "FENNEVIA_FIREFOX_NAVIGATION_DISPOSED", "firefox-navigation-access", "window.gBrowser.selectedBrowser");
		if (a) throw a;
		return e.assertOwnsWindow(r), r;
	}, m = () => {
		let t = p().gBrowser;
		if (!K(t)) throw J(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-capability", "window.gBrowser");
		return t;
	}, h = () => {
		let t = m().selectedBrowser;
		if (!gr(t)) throw J(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-snapshot", "window.gBrowser.selectedBrowser.canGoBack");
		return t;
	}, g = () => {
		let t = m().selectedTab;
		if (!K(t) || !q(t.getAttribute)) throw J(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-snapshot", "window.gBrowser.selectedTab.getAttribute");
		return t;
	}, v = (t) => {
		let n = ur(p(), t);
		if (!dr(n)) throw J(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-command", tr(t));
		return n;
	}, y = () => {
		let t = p().gURLBar;
		if (!fr(t)) throw J(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-capability", "window.gURLBar.handleCommand");
		return t;
	}, x = () => {
		let t = p().gIdentityHandler;
		if (!pr(t)) throw J(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-snapshot", "window.gIdentityHandler.getConnectionSecurityInformation");
		return t;
	}, S = () => {
		let t = p().gProtectionsHandler;
		if (!mr(t)) throw J(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-snapshot", "window.gProtectionsHandler.onContentBlockingEvent");
		return t;
	}, C = () => {
		let t = p().ContentBlockingAllowList;
		if (!hr(t)) throw J(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-snapshot", "window.ContentBlockingAllowList.canHandle");
		return t;
	}, w = () => {
		let t = yr(p()), n = t.find((e) => !e.snapshot.available);
		if (n) throw J(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-capability", n.snapshot.symbol, n.cause);
		return Object.freeze(t.map((e) => e.snapshot));
	}, T = (e) => {
		let t = v(e);
		return !Reflect.apply(t.hasAttribute, t, ["disabled"]);
	}, E = (t) => {
		let n = t.currentURI;
		if (!_r(n)) throw J(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-snapshot", "window.gBrowser.selectedBrowser.currentURI.displaySpec");
		let r = typeof n.displaySpec == "string" ? n.displaySpec : n.spec;
		return String(r ?? "").slice(0, zn);
	}, D = (e) => {
		if ($n.has(e)) return "";
		let t = y();
		return (Reflect.apply(t.getAttribute, t, ["pageproxystate"]) === "valid" ? t.value : e).slice(0, Bn);
	}, O = () => {
		let e = x(), t = Reflect.apply(e.getConnectionSecurityInformation, e, []);
		return typeof t == "string" ? er[t] ?? "unavailable" : "unavailable";
	}, k = (e) => {
		let t = C();
		if (Reflect.apply(t.canHandle, t, [e]) !== !0) return "unavailable";
		let n = S();
		return typeof n.hasException != "boolean" || typeof n.anyBlocking != "boolean" || typeof n.anyDetected != "boolean" ? "unavailable" : n.hasException ? "exception" : n.anyBlocking ? "blocking" : n.anyDetected ? "detected" : "no-trackers-detected";
	}, A = () => {
		let e = h(), t = g(), n = E(e);
		return Object.freeze({
			addressValue: D(n),
			canGoBack: T(Un.back.id),
			canGoForward: T(Un.forward.id),
			connectionSecurity: O(),
			displayUri: n,
			loading: T(Un.stop.id),
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
			t(J(e, "FENNEVIA_FIREFOX_NAVIGATION_SUBSCRIBER_FAILED", "firefox-navigation-notify", "navigation.subscribe", n));
		}
	}, j = (e) => {
		let t = A();
		return xr(s, t) && o > 0 ? !1 : (s = t, o += 1, e && ee(), !0);
	}, M = (n, r) => {
		a = _(n) ? n : J(e, "FENNEVIA_FIREFOX_NAVIGATION_EVENT_FAILED", "firefox-navigation-event", r, n), t(a);
	}, te = (e) => {
		if (!(i || a)) try {
			j(!0);
		} catch (t) {
			M(t, e);
		}
	}, N = (e, t, n) => {
		if (!(i || a)) try {
			e === m().selectedBrowser && K(t) && t.isTopLevel === !0 && j(!0);
		} catch (e) {
			M(e, n);
		}
	}, P = Object.freeze({
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
	}), ne = (e) => ({
		altKey: e.altKey,
		button: e.button,
		ctrlKey: e.ctrlKey,
		metaKey: e.metaKey,
		preventDefault() {},
		shiftKey: e.shiftKey
	}), F = (t, n) => {
		let r = p().BrowserCommands, i = K(r) ? r[t] : void 0;
		if (!q(i)) throw J(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-action", `window.BrowserCommands.${t}`);
		try {
			return Reflect.apply(i, r, n === void 0 ? [] : [ne(n)]), !0;
		} catch (n) {
			throw J(e, "FENNEVIA_FIREFOX_NAVIGATION_ACTION_FAILED", "firefox-navigation-action", `window.BrowserCommands.${t}`, n);
		}
	}, I = (e, t = !0, n) => {
		let r = Un[e];
		h();
		let i = v(r.id);
		return t && Reflect.apply(i.hasAttribute, i, ["disabled"]) ? !1 : F(r.method, n);
	}, L = (t) => {
		if (typeof t != "string") return Yn;
		if (t.length > 4096) return Xn;
		if (t.trim().length === 0) return Yn;
		if (Qn.test(t)) return Zn;
		h();
		let n = y();
		try {
			return n.value = t, Reflect.apply(n.handleCommand, n, []), Jn;
		} catch (t) {
			throw J(e, "FENNEVIA_FIREFOX_ADDRESS_SUBMISSION_FAILED", "firefox-address-submit", "window.gURLBar.handleCommand", t);
		}
	}, R = () => {
		let e = lr(p());
		return K(e) && q(e.hasAttribute) && !!Reflect.apply(e.hasAttribute, e, ["data-fennevia-healthy"]);
	}, re = (e) => {
		if (!K(e) || !K(e.sourceEvent)) return !1;
		let t = e.sourceEvent.target;
		return K(t) && t.id === "focusURLBar";
	}, ie = (e) => {
		if (!(i || a)) try {
			if (!R() || !re(e) || f.size === 0) return;
			j(!0);
			let t = !1;
			for (let e of Array.from(f)) t = e(qn) === !0 || t;
			if (!t || !K(e)) return;
			q(e.preventDefault) && Reflect.apply(e.preventDefault, e, []), q(e.stopPropagation) && Reflect.apply(e.stopPropagation, e, []);
		} catch (e) {
			M(e, tr(Kn));
		}
	}, ae = Object.freeze({
		back: (e) => I("back", !0, e === void 0 ? void 0 : Hn(e)),
		focusContent() {
			let t = h(), n = t.focus;
			if (!q(n)) throw J(e, "FENNEVIA_FIREFOX_NAVIGATION_CAPABILITY_MISSING", "firefox-navigation-focus", "window.gBrowser.selectedBrowser.focus");
			try {
				return Reflect.apply(n, t, []), !0;
			} catch (t) {
				throw J(e, "FENNEVIA_FIREFOX_NAVIGATION_FOCUS_FAILED", "firefox-navigation-focus", "window.gBrowser.selectedBrowser.focus", t);
			}
		},
		forward: (e) => I("forward", !0, e === void 0 ? void 0 : Hn(e)),
		home(e) {
			return h(), F("home", e === void 0 ? void 0 : Hn(e));
		},
		newTab: () => I("newTab", !1),
		reload(e) {
			return e === void 0 ? I("reload") : (h(), F("reloadOrDuplicate", Hn(e)));
		},
		reloadOrStop() {
			let e = T(Un.stop.id) ? "stop" : "reload";
			return I(e), e;
		},
		snapshot() {
			return p(), s;
		},
		stop: () => I("stop"),
		submitAddress: L,
		subscribe(t) {
			if (p(), typeof t != "function") throw J(e, "FENNEVIA_FIREFOX_NAVIGATION_LISTENER_INVALID", "firefox-navigation-subscribe", "navigation.subscribe");
			return d.add(t), b(() => {
				d.delete(t);
			});
		},
		subscribeAddressPopupOpen(t) {
			if (p(), typeof t != "function") throw J(e, "FENNEVIA_FIREFOX_ADDRESS_POPUP_LISTENER_INVALID", "firefox-address-popup-subscribe", "navigation.subscribeAddressPopupOpen");
			return f.add(t), b(() => {
				f.delete(t);
			});
		}
	});
	try {
		e.assertRequiredCapabilities(), w(), j(!1);
		let t = m().tabContainer;
		for (let n of Wn) u.push(e.subscribe(t, n, (e) => {
			if (!(i || a)) try {
				if (n === "TabAttrModified" && (K(e) && e.target !== m().selectedTab || !Sr(e))) return;
				j(!0);
			} catch (e) {
				M(e, `window.gBrowser.tabContainer.${n}`);
			}
		}));
		u.push(e.subscribe(v(Kn), "command", ie));
		let n = m();
		Reflect.apply(n.addTabsProgressListener, n, [P]), l = !0;
		let r = p().MutationObserver;
		c = new r(() => {
			te("document.command.disabled");
		});
		for (let { id: e } of Object.values(Un)) c.observe(v(e), {
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
			let e = K(r.gBrowser) ? r.gBrowser : null;
			e && q(e.removeTabsProgressListener) && Reflect.apply(e.removeTabsProgressListener, e, [P]);
		} catch (e) {
			a ??= e;
		}
		l = !1;
		for (let e of u.reverse()) try {
			e();
		} catch (e) {
			a ??= e;
		}
		throw r = null, a !== void 0 && t(J(e, "FENNEVIA_FIREFOX_NAVIGATION_DISPOSE_FAILED", "firefox-navigation-dispose", "window.gBrowser.removeTabsProgressListener", a)), n;
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
				let e = K(r.gBrowser) ? r.gBrowser : null;
				if (!e || !q(e.removeTabsProgressListener)) throw TypeError("FENNEVIA_FIREFOX_NAVIGATION_PROGRESS_DISPOSER_INVALID");
				Reflect.apply(e.removeTabsProgressListener, e, [P]);
			} catch (e) {
				t ??= e;
			}
			l = !1;
			for (let e of u.reverse()) try {
				e();
			} catch (e) {
				t ??= e;
			}
			if (u.length = 0, d.clear(), f.clear(), r = null, t !== void 0) throw J(e, "FENNEVIA_FIREFOX_NAVIGATION_DISPOSE_FAILED", "firefox-navigation-dispose", "window.gBrowser.removeTabsProgressListener", t);
			return !0;
		},
		navigation: ae,
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
var wr = Object.freeze([
	"playing",
	"muted",
	"blocked"
]), Tr = Object.freeze([
	"camera",
	"microphone",
	"screen"
]), Er = Object.freeze([
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
new Set(wr);
var Dr = new Set(Er), Or = new Set(Tr), kr = Object.freeze([
	"blocked",
	"cancelled",
	"consumed",
	"detached",
	"unchanged"
]);
new Set(kr);
function Ar(e) {
	return typeof e == "string" && Dr.has(e);
}
function jr(e) {
	return typeof e == "string" && Or.has(e);
}
//#endregion
//#region src/firefox/tabs/support.ts
var Mr = Object.freeze([
	"TabOpen",
	"TabClose",
	"TabSelect",
	"TabMove",
	"TabPinned",
	"TabUnpinned",
	"TabRemotenessChange",
	"TabAttrModified"
]), Nr = Object.freeze(["oop-browser-crashed", "oop-browser-buildid-mismatch"]), Pr = new Set([
	"activemedia-blocked",
	"attention",
	"busy",
	"crashed",
	"image",
	"label",
	"muted",
	"pictureinpicture",
	"selected",
	"sharing",
	"soundplaying",
	"usercontextid"
]), Fr = "resource://gre/modules/ContextualIdentityService.sys.mjs", Ir = /[\s"'<>\\]/u, Lr = /^data:image\/(?:avif|gif|jpeg|png|vnd\.microsoft\.icon|webp|x-icon);base64,[a-z0-9+/]+={0,2}$/iu, Rr = Object.freeze({
	toolbar: "gray",
	turquoise: "cyan"
}), zr = (e) => typeof e == "object" && !!e || typeof e == "function", Y = (e) => typeof e == "object" && !!e, Br = (e) => typeof e == "function", Vr = (e) => e.gBrowser, Hr = (e, t) => {
	let n = Vr(e);
	return Y(n) ? n[t] : void 0;
}, Ur = (e, t) => {
	let n = e.document;
	if (!(!Y(n) || !Br(n.getElementById))) return Reflect.apply(n.getElementById, n, [t]);
}, Wr = (e) => Y(e) && Br(e.openPopup) && Br(e.moveTo) && Br(e.addEventListener) && Br(e.removeEventListener), Gr = Object.freeze([
	Object.freeze({
		isAvailable: Array.isArray,
		name: "firefox.open-tabs",
		read: (e) => Hr(e, "openTabs"),
		symbol: "window.gBrowser.openTabs"
	}),
	Object.freeze({
		isAvailable: zr,
		name: "firefox.selected-tab",
		read: (e) => Hr(e, "selectedTab"),
		symbol: "window.gBrowser.selectedTab"
	}),
	Object.freeze({
		isAvailable: (e) => Y(e) && Br(e.addEventListener) && Br(e.removeEventListener),
		name: "firefox.tab-crash-events",
		read: Vr,
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
		["translate-tab-context-menu", "translateTabContextMenu"]
	].map(([e, t]) => Object.freeze({
		isAvailable: Br,
		name: `firefox.${e}`,
		read: (e) => Hr(e, t),
		symbol: `window.gBrowser.${t}`
	})),
	Object.freeze({
		isAvailable: (e) => typeof e == "string" && e.length > 0 && e.length <= 2048,
		name: "firefox.new-tab-url",
		read: (e) => e.BROWSER_NEW_TAB_URL,
		symbol: "window.BROWSER_NEW_TAB_URL"
	}),
	Object.freeze({
		isAvailable: Wr,
		name: "firefox.tab-context-menu",
		read: (e) => Ur(e, "tabContextMenu"),
		symbol: "document.tabContextMenu.openPopup.moveTo"
	})
]), Kr = (e) => Object.freeze(Gr.map((t) => {
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
})), qr = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, X = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: qr(e),
	phase: n,
	symbol: r
}), Jr = (e, t) => {
	if (!Y(t) || typeof t.getAttribute != "function" || typeof t.hasAttribute != "function") throw X(e, "FENNEVIA_FIREFOX_TAB_SHAPE_INVALID", "firefox-tabs-snapshot", "MozTabbrowserTab.getAttribute");
	return t;
}, Yr = (e) => {
	if (typeof e == "string" && e.length !== 0 && (e.length <= 2048 && (e.startsWith("chrome://") || e.startsWith("resource://") || e.startsWith("moz-remote-image:")) && !Ir.test(e) || e.length <= 262144 && Lr.test(e))) return e;
}, Xr = (e, t) => e.length === t.length && e.every((e, n) => {
	let r = t[n];
	return r !== void 0 && e.id === r.id && e.title === r.title && e.selected === r.selected && e.pinned === r.pinned && e.loading === r.loading && e.faviconUrl === r.faviconUrl && e.audio === r.audio && e.attention === r.attention && e.crashed === r.crashed && e.pictureInPicture === r.pictureInPicture && e.sharing === r.sharing && e.container?.color === r.container?.color && e.container?.label === r.container?.label;
}), Zr = (e) => {
	if (!Y(e) || !Y(e.detail)) return !0;
	let t = e.detail.changed;
	return !Array.isArray(t) || t.some((e) => typeof e != "string") ? !0 : t.some((e) => Pr.has(e));
}, Qr = (e) => {
	if (typeof e != "string" || e.length === 0) return;
	let t = Rr[e] ?? e;
	return Ar(t) ? t : void 0;
}, $r = (e) => jr(e) ? e : void 0, ei = (e, t) => !Y(e) || e.target === void 0 || e.target === t || Y(e.target) && e.target.id === "tabContextMenu", ti = /^tab-transfer-[A-Za-z0-9-]{8,128}$/u, ni = (e) => {
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
function ri({ createToken: e }) {
	if (typeof e != "function") throw ni("FENNEVIA_TAB_DRAG_TOKEN_FACTORY_INVALID");
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
			if (!r || typeof r != "object" || typeof r.sourceContextId != "string" || r.sourceContextId.length === 0 || r.sourceWindowKind !== "normal" && r.sourceWindowKind !== "private" || typeof r.pinned != "boolean" || typeof r.isActive != "function" || !r.tab || typeof r.tab != "object") throw ni("FENNEVIA_TAB_DRAG_SOURCE_INVALID");
			if (i()) throw ni("FENNEVIA_TAB_DRAG_ALREADY_ACTIVE");
			let a = e();
			if (typeof a != "string" || !ti.test(a)) throw ni("FENNEVIA_TAB_DRAG_TOKEN_INVALID");
			return n = null, t = Object.freeze({
				id: a,
				...r
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
var ii = "tabContextMenu";
function ai({ beginNativePopupHandoff: e, boundary: t, endNativePopupHandoff: n, dragCoordinator: r, isTabDetachAllowed: i, moduleLoader: a, onError: o, window: s }) {
	if (t.assertOwnsWindow(s), !Y(s) || typeof e != "function" || typeof n != "function" || !r || typeof r.begin != "function" || typeof r.cancel != "function" || typeof r.cancelContext != "function" || typeof r.consume != "function" || typeof r.inspect != "function" || typeof r.resolve != "function" || typeof r.resolveForEnd != "function" || typeof i != "function" || typeof o != "function") throw X(t, "FENNEVIA_FIREFOX_TABS_OPTIONS_INVALID", "firefox-tabs-create", "window");
	let c = s, l = !1, u = null, d = 0, f = Object.freeze([]), p = new Set(), m = new Set(), h = [], g = t.createHandleRegistry("tab"), v = null, y = null, x = !1, S = t.snapshot(), C = S.contextId, w = S.windowKind;
	if (typeof a == "function") try {
		let e = a(Fr), t = Y(e) ? e.ContextualIdentityService : void 0;
		Y(t) && Br(t.getPublicIdentityFromId) && (v = t);
	} catch {
		v = null;
	}
	let T = () => {
		if (l || !c) throw X(t, "FENNEVIA_FIREFOX_TABS_DISPOSED", "firefox-tabs-access", "window.gBrowser.openTabs");
		if (u) throw u;
		return t.assertOwnsWindow(c), c;
	}, E = () => {
		let e = T().gBrowser;
		if (!Y(e)) throw X(t, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-capability", "window.gBrowser");
		return e;
	}, D = () => {
		let e = Kr(T()), n = e.find((e) => !e.snapshot.available);
		if (n) throw X(t, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-capability", n.snapshot.symbol, n.cause);
		return Object.freeze(e.map((e) => e.snapshot));
	}, O = () => {
		let e = E().openTabs;
		if (!Array.isArray(e)) throw X(t, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-snapshot", "window.gBrowser.openTabs");
		let n = e.map((e) => Jr(t, e));
		if (new Set(n).size !== n.length) throw X(t, "FENNEVIA_FIREFOX_TAB_ORDER_INVALID", "firefox-tabs-snapshot", "window.gBrowser.openTabs");
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
		if (!Y(t)) return;
		let n = t.contains;
		if (Br(n)) try {
			return Er.find((e) => !!Reflect.apply(n, t, [`identity-color-${e}`]));
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
		let r = (Y(n) ? Qr(n.color) : void 0) ?? M(e);
		if (!r) return;
		let i = "";
		if (Y(n) && typeof n.name == "string" && (i = n.name), i.trim().length === 0 && v && Br(v.getUserContextLabel)) try {
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
		let n = String(k(e, "label") ?? "").slice(0, 256), r = Yr(k(e, "image")), i = ee(e), a = te(e), o = $r(k(e, "sharing"));
		return Object.freeze({
			...A(e, "attention") ? { attention: !0 } : {},
			...i === void 0 ? {} : { audio: i },
			...a === void 0 ? {} : { container: a },
			...A(e, "crashed") ? { crashed: !0 } : {},
			...r === void 0 ? {} : { faviconUrl: r },
			...A(e, "pictureinpicture") ? { pictureInPicture: !0 } : {},
			id: g.register(e),
			loading: A(e, "busy"),
			pinned: A(e, "pinned"),
			selected: t === e,
			...o === void 0 ? {} : { sharing: o },
			title: n
		});
	}, P = (e) => {
		for (let n of Array.from(m)) try {
			n(e);
		} catch (e) {
			o(X(t, "FENNEVIA_FIREFOX_TABS_SUBSCRIBER_FAILED", "firefox-tabs-notify", "tabs.subscribe", e));
		}
	}, ne = () => {
		P(Object.freeze({
			revision: d,
			tabs: f,
			type: "snapshot"
		}));
	}, F = (e) => {
		let t = E(), n = O().map((e) => N(e, t.selectedTab)), r = new Set(n.map((e) => e.id));
		for (let e of Array.from(p)) r.has(e) || (g.release(e), p.delete(e));
		for (let e of r) p.add(e);
		let i = Object.freeze(n);
		return !Xr(f, i) && (f = i, d += 1, e && ne(), !0);
	}, I = (e, n) => {
		u = _(e) ? e : X(t, "FENNEVIA_FIREFOX_TABS_EVENT_FAILED", "firefox-tabs-event", `window.gBrowser.tabContainer.${n}`, e), o(u);
	}, L = (e) => {
		T();
		let n = g.resolve(e);
		if (!O().includes(n)) throw g.release(e), p.delete(e), X(t, "FENNEVIA_FIREFOX_TAB_STALE", "firefox-tabs-action", "tab.opaque-id");
		return n;
	}, R = (e, n) => {
		let r = E(), i = r[e];
		if (typeof i != "function") throw X(t, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-action", `window.gBrowser.${e}`);
		return Reflect.apply(i, r, n);
	}, re = (e) => {
		if (e === void 0) return Object.freeze({ selected: !0 });
		if (!Y(e) || Object.keys(e).some((e) => e !== "selected") || e.selected !== void 0 && typeof e.selected != "boolean") throw X(t, "FENNEVIA_FIREFOX_TAB_OPEN_OPTIONS_INVALID", "firefox-tabs-action", "tabs.open.options");
		return Object.freeze({ selected: e.selected ?? !0 });
	}, ie = (e) => {
		if (!Y(e) || Object.keys(e).some((e) => e !== "screenX" && e !== "screenY") || typeof e.screenX != "number" || typeof e.screenY != "number" || !Number.isFinite(e.screenX) || !Number.isFinite(e.screenY) || Math.abs(e.screenX) > 1e5 || Math.abs(e.screenY) > 1e5) throw X(t, "FENNEVIA_FIREFOX_TAB_CONTEXT_MENU_POINT_INVALID", "firefox-tabs-action", "tabs.openContextMenu.point");
		return Object.freeze({
			screenX: e.screenX,
			screenY: e.screenY
		});
	}, ae = (e) => {
		if (!Y(e) || Object.keys(e).some((e) => e !== "cancelled" && e !== "screenX" && e !== "screenY") || typeof e.cancelled != "boolean" || typeof e.screenX != "number" || typeof e.screenY != "number" || !Number.isFinite(e.screenX) || !Number.isFinite(e.screenY) || Math.abs(e.screenX) > 1e5 || Math.abs(e.screenY) > 1e5) throw X(t, "FENNEVIA_FIREFOX_TAB_DRAG_END_OPTIONS_INVALID", "firefox-tabs-drag", "tabs.endDrag.options");
		return Object.freeze({
			cancelled: e.cancelled,
			screenX: e.screenX,
			screenY: e.screenY
		});
	}, oe = (e, n) => {
		if (!Number.isSafeInteger(e) || e < 0 || e > n) throw X(t, "FENNEVIA_FIREFOX_TAB_DRAG_DROP_INDEX_INVALID", "firefox-tabs-drag", "tabs.dropDrag.index");
		return e;
	}, se = () => {
		if (T(), !y || !Wr(y)) throw X(t, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-action", "document.tabContextMenu.openPopup.moveTo");
		return y;
	}, ce = () => {
		if (x) return;
		let n;
		try {
			n = e(ii) === !0;
		} catch (e) {
			throw X(t, "FENNEVIA_FIREFOX_TAB_CONTEXT_MENU_HANDOFF_FAILED", "firefox-tabs-context-menu-handoff", "nativeUi.beginPopupHandoff", e);
		}
		if (!n) throw X(t, "FENNEVIA_FIREFOX_TAB_CONTEXT_MENU_HANDOFF_REJECTED", "firefox-tabs-context-menu-handoff", "nativeUi.beginPopupHandoff");
		x = !0;
	}, le = () => {
		if (!x) return null;
		x = !1;
		try {
			return n(ii), null;
		} catch (e) {
			return X(t, "FENNEVIA_FIREFOX_TAB_CONTEXT_MENU_HANDOFF_RELEASE_FAILED", "firefox-tabs-context-menu-handoff", "nativeUi.endPopupHandoff", e);
		}
	}, ue = Object.freeze({
		beginDrag(e) {
			let n = L(e);
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
					pinned: A(n, "pinned"),
					sourceContextId: C,
					sourceWindowKind: w,
					tab: n
				});
			} catch (e) {
				throw X(t, "FENNEVIA_FIREFOX_TAB_DRAG_BEGIN_REJECTED", "firefox-tabs-drag", "tabs.beginDrag", e);
			}
		},
		close(e) {
			let t = L(e);
			R("removeTab", [t, {
				animate: !0,
				isUserTriggered: !0
			}]), F(!0);
		},
		dropDrag(e) {
			let n = O(), i = oe(e, n.length), a = r.resolve({
				contextId: C,
				windowKind: w
			});
			if (!a) throw X(t, "FENNEVIA_FIREFOX_TAB_DRAG_UNAVAILABLE", "firefox-tabs-drag", "tabs.dropDrag.transfer");
			let o = n.filter((e) => A(e, "pinned")).length;
			if (a.sourceContextId === C) {
				if (!n.includes(a.tab)) throw r.cancel(a.id, C), X(t, "FENNEVIA_FIREFOX_TAB_STALE", "firefox-tabs-drag", "tabs.dropDrag.source-tab");
				let e = Math.max(n.length - 1, 0), s = a.pinned ? Math.min(Math.max(i, 0), Math.max(o - 1, 0)) : Math.min(Math.max(i, o), e);
				R("moveTabTo", [a.tab, {
					isUserTriggered: !0,
					tabIndex: s
				}]);
				let c = O().indexOf(a.tab);
				if (c < 0) throw X(t, "FENNEVIA_FIREFOX_TAB_MOVE_REJECTED", "firefox-tabs-drag", "window.gBrowser.moveTabTo");
				let l = g.register(a.tab);
				return r.consume(a.id), F(!0), Object.freeze({
					index: c,
					kind: "moved",
					tabId: l
				});
			}
			let s = a.pinned ? Math.min(Math.max(i, 0), o) : Math.min(Math.max(i, o), n.length), c;
			try {
				c = R("adoptTab", [a.tab, {
					selectTab: !0,
					tabIndex: s
				}]);
			} catch (e) {
				throw X(t, "FENNEVIA_FIREFOX_TAB_ADOPT_REJECTED", "firefox-tabs-drag", "window.gBrowser.adoptTab", e);
			}
			let l = Jr(t, c), u = O().indexOf(l);
			if (u < 0) throw X(t, "FENNEVIA_FIREFOX_TAB_ADOPT_REJECTED", "firefox-tabs-drag", "window.gBrowser.adoptTab");
			let d = g.register(l);
			return r.consume(a.id), F(!0), Object.freeze({
				index: u,
				kind: "adopted",
				tabId: d
			});
		},
		endDrag(e, n) {
			if (T(), typeof e != "string" || e.length === 0 || e.length > 160) throw X(t, "FENNEVIA_FIREFOX_TAB_DRAG_ID_INVALID", "firefox-tabs-drag", "tabs.endDrag.id");
			let a = ae(n), o = r.resolveForEnd(e, C);
			if (o.status === "consumed") return "consumed";
			if (o.status === "cancelled") return "cancelled";
			if (o.status === "missing" || o.status !== "active") return "unchanged";
			if (a.cancelled) return r.cancel(e, C), "cancelled";
			let s;
			try {
				s = i() === !0;
			} catch (n) {
				throw r.cancel(e, C), X(t, "FENNEVIA_FIREFOX_TAB_DETACH_POLICY_FAILED", "firefox-tabs-drag", "browser.tabs.allowTabDetach", n);
			}
			if (!s) return r.cancel(e, C), "blocked";
			let c = O();
			if (!c.includes(o.transfer.tab)) return r.cancel(e, C), "unchanged";
			if (c.length === 1) return r.consume(e), "unchanged";
			let l;
			try {
				l = R("replaceTabWithWindow", [o.transfer.tab, {
					screenX: a.screenX,
					screenY: a.screenY,
					suppressanimation: 1
				}]);
			} catch (e) {
				throw X(t, "FENNEVIA_FIREFOX_TAB_DETACH_REJECTED", "firefox-tabs-drag", "window.gBrowser.replaceTabWithWindow", e);
			} finally {
				r.consume(e);
			}
			return l == null ? "unchanged" : "detached";
		},
		inspectDrag() {
			return T(), r.inspect({
				contextId: C,
				windowKind: w
			});
		},
		move(e, n) {
			let r = L(e);
			if (!Number.isSafeInteger(n) || n < 0 || n > 1e4) throw X(t, "FENNEVIA_FIREFOX_TAB_MOVE_INDEX_INVALID", "firefox-tabs-action", "tabs.move.index");
			R("moveTabTo", [r, {
				isUserTriggered: !0,
				tabIndex: n
			}]), F(!0);
		},
		open(e) {
			let n = re(e), r = T().BROWSER_NEW_TAB_URL;
			if (typeof r != "string" || r.length === 0) throw X(t, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-action", "window.BROWSER_NEW_TAB_URL");
			let i = Jr(t, R("addTrustedTab", [r, { inBackground: !n.selected }]));
			if (!O().includes(i)) throw X(t, "FENNEVIA_FIREFOX_TAB_OPEN_REJECTED", "firefox-tabs-action", "window.gBrowser.addTrustedTab");
			let a = g.register(i);
			if (F(!0), n.selected && E().selectedTab !== i) throw X(t, "FENNEVIA_FIREFOX_TAB_SELECT_REJECTED", "firefox-tabs-action", "window.gBrowser.selectedTab");
			return a;
		},
		openContextMenu(e, n) {
			let r = L(e), i = ie(n), a = se(), s = a.openPopup, c = a.moveTo;
			if (!Br(s) || !Br(c)) throw X(t, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-action", "document.tabContextMenu.openPopup.moveTo");
			try {
				R("translateTabContextMenu", []);
			} catch (e) {
				throw _(e) ? e : X(t, "FENNEVIA_FIREFOX_TAB_CONTEXT_MENU_TRANSLATION_FAILED", "firefox-tabs-action", "window.gBrowser.translateTabContextMenu", e);
			}
			ce();
			try {
				Reflect.apply(s, a, [
					r,
					"after_start",
					0,
					0,
					!0
				]);
			} catch (e) {
				let n = le();
				throw n && o(n), X(t, "FENNEVIA_FIREFOX_TAB_CONTEXT_MENU_REJECTED", "firefox-tabs-action", "document.tabContextMenu.openPopup", e);
			}
			try {
				Reflect.apply(c, a, [i.screenX, i.screenY]);
			} catch (e) {
				o(X(t, "FENNEVIA_FIREFOX_TAB_CONTEXT_MENU_POSITION_FAILED", "firefox-tabs-action", "document.tabContextMenu.moveTo", e));
			}
		},
		pin(e) {
			let n = L(e);
			if (!A(n, "pinned")) {
				if (R("pinTab", [n]), !A(n, "pinned")) throw X(t, "FENNEVIA_FIREFOX_TAB_PIN_REJECTED", "firefox-tabs-action", "window.gBrowser.pinTab");
				F(!0);
			}
		},
		select(e) {
			let n = L(e), r = E();
			if (r.selectedTab !== n) {
				if (!Reflect.set(r, "selectedTab", n) || r.selectedTab !== n) throw X(t, "FENNEVIA_FIREFOX_TAB_SELECT_REJECTED", "firefox-tabs-action", "window.gBrowser.selectedTab");
				F(!0);
			}
		},
		snapshot() {
			return T(), f;
		},
		subscribe(e) {
			if (T(), typeof e != "function") throw X(t, "FENNEVIA_FIREFOX_TABS_LISTENER_INVALID", "firefox-tabs-subscribe", "tabs.subscribe");
			return m.add(e), b(() => {
				m.delete(e);
			});
		},
		toggleMute(e) {
			let n = L(e), r = n.toggleMuteAudio;
			if (!Br(r)) throw X(t, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-action", "MozTabbrowserTab.toggleMuteAudio");
			Reflect.apply(r, n, []), F(!0);
		},
		unpin(e) {
			let n = L(e);
			if (A(n, "pinned")) {
				if (R("unpinTab", [n]), A(n, "pinned")) throw X(t, "FENNEVIA_FIREFOX_TAB_UNPIN_REJECTED", "firefox-tabs-action", "window.gBrowser.unpinTab");
				F(!0);
			}
		}
	});
	try {
		t.assertRequiredCapabilities(), D(), F(!1);
		let e = E(), n = e.tabContainer;
		for (let e of Mr) h.push(t.subscribe(n, e, (t) => {
			if (!(l || u)) try {
				if (e === "TabAttrModified" && !Zr(t)) return;
				F(!0);
			} catch (t) {
				I(t, e);
			}
		}));
		for (let n of Nr) h.push(t.subscribe(e, n, () => {
			if (!(l || u)) try {
				F(!0);
			} catch (e) {
				I(e, n);
			}
		}));
		let r = Ur(T(), "tabContextMenu");
		if (!Wr(r)) throw X(t, "FENNEVIA_FIREFOX_TABS_CAPABILITY_MISSING", "firefox-tabs-capability", "document.tabContextMenu.openPopup.moveTo");
		y = r, h.push(t.subscribe(r, "popupshown", (e) => {
			l || u || !ei(e, r) || P(Object.freeze({
				open: !0,
				type: "context-menu"
			}));
		})), h.push(t.subscribe(r, "popuphidden", (e) => {
			if (!ei(e, r)) return;
			let t = le();
			t && o(t), !l && P(Object.freeze({
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
		throw n !== void 0 && o(X(t, "FENNEVIA_FIREFOX_TABS_DISPOSE_FAILED", "firefox-tabs-dispose", "window.gBrowser.tabContainer", n)), e;
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
			if (y && Br(n)) try {
				Reflect.apply(n, y, []);
			} catch (t) {
				e ??= t;
			}
			let i = le();
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
			if (e !== void 0) throw X(t, "FENNEVIA_FIREFOX_TABS_DISPOSE_FAILED", "firefox-tabs-dispose", "window.gBrowser.tabContainer", e);
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
		tabs: ue
	});
}
//#endregion
//#region src/firefox/toolbar-widgets/native-support.ts
var oi = "nav-bar", si = "unified-extensions-area", ci = "fennevia.customize.layout", li = "fennevia.customize.style", ui = "fennevia.customize.panels", di = "fennevia.customize.", fi = "after_start", pi = Object.freeze({ capture: !0 }), mi = /^rgba?\([0-9\s.,%]{1,48}\)$/u, hi = /url\(\s*"((?:[^"\\]|\\.){1,512})"\s*\)/u, gi = /url\(\s*'((?:[^'\\]|\\.){1,512})'\s*\)/u, _i = /url\(\s*((?:[^"')\\]|\\.){1,512})\s*\)/u, vi = "moz-extension://", yi = "-browser-action", bi = /["'\\<>\s]/u, xi = /#([A-Za-z_][\w-]*)/gu, Si = /^(?:branding|browser|toolkit|preview)\/(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.ftl$/u, Ci = /^(?:[A-Za-z][\w-]*\.)?(?:label|tooltiptext\d*)$/u, wi = /%[0-9$]*[Ssd]/u, Ti = Object.freeze([
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
]), Ei = new Set(Ti), Di = new Map([
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
]), Oi = new Map([
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
]), ki = Object.freeze([
	"browser/browser.ftl",
	"browser/sidebar.ftl",
	"browser/appmenu.ftl",
	"browser/screenshots.ftl"
]), Ai = new Map([
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
]), ji = new Map([
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
]), Mi = (e, t) => e === "send-tab-button" ? Number.parseInt(t.split(".", 1)[0] ?? "", 10) >= 154 ? "chrome://browser/skin/send-tab.svg" : "chrome://browser/skin/send-tab-20.svg" : ji.get(e) ?? "", Ni = new Map([
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
]), Z = (e) => typeof e == "object" && !!e, Q = (e) => typeof e == "function", Pi = (e) => Z(e) && Q(e.getAttribute), Fi = (e) => Z(e) && Q(e.hidePopup) && Q(e.moveToAnchor), Ii = (e) => Fi(e) && Q(e.openPopup), Li = (e, t) => typeof e == "string" ? e.slice(0, t) : "", Ri = (e) => {
	let t = e.trim();
	return mi.test(t) ? t : "";
}, zi = (e) => {
	let t = e.CustomizableUI;
	return !Z(t) || !Q(t.getWidgetIdsInArea) || !Q(t.getWidget) || !Q(t.addListener) || !Q(t.removeListener) ? null : t;
}, Bi = (e) => {
	let t = e.Services;
	if (!Z(t)) return null;
	let n = t.prefs;
	return !Z(n) || !Q(n.addObserver) || !Q(n.clearUserPref) || !Q(n.getStringPref) || !Q(n.removeObserver) || !Q(n.setStringPref) ? null : n;
}, Vi = (e, t) => {
	try {
		let n = Reflect.apply(e.getStringPref, e, [t, ""]);
		return typeof n == "string" && n.length <= 16384 ? n : "";
	} catch {
		return "";
	}
}, Hi = (e) => {
	try {
		let t = e.AREA_ADDONS;
		return typeof t == "string" && t !== "" ? t : si;
	} catch {
		return si;
	}
}, Ui = (e, t) => {
	if (Q(e.isWebExtensionWidget)) try {
		return Reflect.apply(e.isWebExtensionWidget, e, [t]) === !0;
	} catch {}
	return t.endsWith(yi);
}, Wi = (e) => {
	let t = e.PanelUI;
	return !Z(t) || !Q(t.showSubView) ? null : t.showSubView;
}, Gi = Object.freeze([
	Object.freeze({
		isAvailable: (e) => e !== null,
		name: "toolbar-widgets.customizable-ui",
		read: (e) => zi(e),
		requirement: "optional",
		symbol: "window.CustomizableUI.getWidgetIdsInArea.getWidget.addListener.removeListener"
	}),
	Object.freeze({
		isAvailable: (e) => e !== null,
		name: "toolbar-widgets.panel-ui-sub-view",
		read: (e) => Wi(e),
		requirement: "optional",
		symbol: "window.PanelUI.showSubView"
	}),
	Object.freeze({
		isAvailable: (e) => e !== null,
		name: "toolbar-widgets.prefs",
		read: (e) => Bi(e),
		requirement: "optional",
		symbol: "window.Services.prefs.getStringPref.setStringPref.clearUserPref.addObserver.removeObserver"
	}),
	Object.freeze({
		isAvailable: (e) => Z(e) && Q(e.addEventListener) && Q(e.removeEventListener) && Q(e.getElementById),
		name: "toolbar-widgets.document-events",
		read: (e) => e.document,
		requirement: "required",
		symbol: "document.addEventListener.removeEventListener.getElementById"
	})
]), Ki = (e) => Object.freeze(Gi.map((t) => {
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
})), qi = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, $ = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: qi(e),
	phase: n,
	symbol: r
}), Ji = (e) => {
	if (e.startsWith("customizableui-special-")) {
		let t = /^customizableui-special-(spring|spacer|separator)/u.exec(e);
		return t ? t[1] : null;
	}
	return e === "spring" || e === "spacer" || e === "separator" ? e : e === "vertical-spacer" ? "spacer" : null;
}, Yi = (e, t) => {
	if (!e) return "";
	try {
		let n = e[t];
		return typeof n == "string" ? n : "";
	} catch {
		return "";
	}
}, Xi = (e, t) => {
	let n = e.document;
	if (!(!Z(n) || !Q(n.getElementById))) return Reflect.apply(n.getElementById, n, [t]);
}, Zi = (e, t) => {
	if (Q(e.querySelector)) try {
		return Reflect.apply(e.querySelector, e, [t]);
	} catch {
		return;
	}
}, Qi = (e, t) => {
	try {
		let n = Reflect.apply(e.getAttribute, e, [t]);
		return typeof n == "string" ? n : "";
	} catch {
		return "";
	}
}, $i = (e) => {
	if (e === "" || e === "none") return "";
	let t = hi.exec(e);
	if (t) return t[1].replace(/\\(.)/gu, "$1");
	let n = gi.exec(e);
	if (n) return n[1].replace(/\\(.)/gu, "$1");
	let r = _i.exec(e);
	return r ? r[1].replace(/\\(.)/gu, "$1") : "";
}, ea = (e, t) => e === "" || e.length > 512 || bi.test(e) ? !1 : t === "extension" ? e.startsWith(vi) : e.startsWith("chrome://") || e.startsWith("resource://"), ta = (e) => {
	if (Pi(e)) return e;
	if (Array.isArray(e)) {
		let t = e[0];
		return Pi(t) ? t : null;
	}
	if (!Z(e)) return null;
	let t = e[0];
	if (Pi(t)) return t;
	if (Q(e.item)) try {
		let t = Reflect.apply(e.item, e, [0]);
		return Pi(t) ? t : null;
	} catch {
		return null;
	}
	return null;
}, na = (e) => {
	if (!Z(e)) return "";
	try {
		let t = e.listStyleImage;
		if (typeof t == "string" && t !== "") {
			let e = $i(t);
			if (e) return e;
		}
	} catch {}
	if (Q(e.getPropertyValue)) try {
		let t = Reflect.apply(e.getPropertyValue, e, ["list-style-image"]);
		if (typeof t == "string") return $i(t);
	} catch {
		return "";
	}
	return "";
}, ra = (e) => {
	try {
		let t = e.style, n = na(t);
		if (n) return n;
	} catch {}
	return "";
}, ia = (e) => {
	if (typeof e != "string" || e === "") return [];
	let t = [];
	xi.lastIndex = 0;
	for (let n of e.matchAll(xi)) {
		let e = n[1];
		e && t.push(e);
	}
	return t;
}, aa = (e, t, n = []) => {
	if (!Z(e)) return;
	let r;
	try {
		r = e.selectorText;
	} catch {
		r = void 0;
	}
	let i = ia(r), a = i.length > 0 ? i : n, o = ra(e);
	if (o && ea(o, "builtin")) for (let e of a) t.set(e, o);
	let s;
	try {
		s = e.cssRules;
	} catch {
		s = void 0;
	}
	if (Z(s) && typeof s.length == "number") {
		let e = s.length;
		for (let n = 0; n < e; n += 1) aa(s[n], t, a);
	}
}, oa = (e, t) => {
	if (Array.isArray(e) || Z(e)) return e[t];
}, sa = (e, t) => {
	if (Array.isArray(e)) {
		for (let n of e) if (Z(n) && n.name === t && typeof n.value == "string") return n.value;
		return "";
	}
	if (!Z(e)) return "";
	if (typeof e.length == "number" && e.length > 0) {
		let n = e.length;
		for (let r = 0; r < n; r += 1) {
			let n = e[r];
			if (Z(n) && n.name === t && typeof n.value == "string") return n.value;
		}
	}
	let n = e[t];
	return typeof n == "string" ? n : "";
}, ca = (e, t) => {
	let n = oa(e, 0);
	if (!Z(n)) return "";
	let r = sa(n.attributes, "label") || sa(n.attributes, "tooltiptext"), i = typeof n.value == "string" ? n.value : "", a = r || i;
	return !a || a === t ? "" : Li(a, 200);
}, la = (e, t) => {
	if (Q(e.formatMessagesSync)) try {
		let n = ca(Reflect.apply(e.formatMessagesSync, e, [[{ id: t }]]), t);
		if (n) return n;
	} catch {}
	if (!Q(e.formatValueSync)) return "";
	try {
		let n = Reflect.apply(e.formatValueSync, e, [t]);
		return typeof n != "string" || n === "" || n === t ? "" : Li(n, 200);
	} catch {
		return "";
	}
}, ua = (e) => e.length > 0 && e.length <= 128 && !e.includes("..") && Si.test(e), da = (e) => {
	let t = [], n = new Set(), r = (e) => {
		let r = e.trim();
		n.has(r) || !ua(r) || t.length >= 48 || (n.add(r), t.push(r));
	};
	for (let e of ki) r(e);
	if (!Q(e.querySelectorAll)) return t;
	try {
		let t = Reflect.apply(e.querySelectorAll, e, ["link[rel=\"localization\"]"]), n = Array.isArray(t) || Z(t) && typeof t.length == "number" ? t.length : 0;
		for (let e = 0; e < n; e += 1) {
			let n = oa(t, e);
			Pi(n) && r(Qi(n, "href"));
		}
	} catch {}
	return t;
}, fa = (e, t = "") => t && (e === t || e.startsWith(`${t}.`)) ? !0 : Ci.test(e), pa = (e, t, n = "") => !e || fa(e, n) || wi.test(e) ? "" : Li(e, t), ma = (e) => e.isConnected === !0, ha = (e) => {
	let t = Zi(e, ".unified-extensions-item-action-button");
	return Pi(t) ? t : null;
}, ga = (e) => {
	let t = "", n = e.style;
	if (Z(n) && Q(n.getPropertyValue)) try {
		let e = Reflect.apply(n.getPropertyValue, n, ["--webextension-toolbar-image"]);
		typeof e == "string" && (t = e);
	} catch {
		t = "";
	}
	t ||= Qi(e, "style");
	let r = $i(t);
	return ea(r, "extension") ? r : "";
}, _a = (e) => {
	let t = Li(Qi(e, "badge"), 8), n = "", r = "", i = Qi(e, "badgeStyle"), a = /background-color:\s*([^;]{1,64})/u.exec(i);
	a && (n = Ri(a[1]));
	let o = /(?:^|;)\s*color:\s*([^;]{1,64})/u.exec(i);
	return o && (r = Ri(o[1])), Object.freeze({
		background: n,
		text: t,
		textColor: r
	});
}, va = (e) => {
	let t = Zi(e, ".unified-extensions-item-name");
	if (Z(t) && typeof t.textContent == "string") {
		let e = t.textContent.trim();
		if (e) return Li(e, 200);
	}
	return "";
}, ya = (e) => e.disabled === !0 || Qi(e, "disabled") === "true", ba = "fxa-toolbar-menu-button", xa = "PanelUI-fxa", Sa = "alltabs-button", Ca = "alltabs-button", wa = "library-button", Ta = "appMenu-libraryView";
function Ea({ boundary: e, getWindowOrNull: t, isDisposed: n, onActionDelta: r, popupListeners: i, registry: a, requireProjectHost: o, requireWindow: s }) {
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
		if (r && Q(r.clearTimeout)) try {
			Reflect.apply(r.clearTimeout, r, [n.timeoutHandle]);
		} catch {}
		n.resolve(e);
	}, h = (e) => {
		let n = f;
		if (!n) return;
		f = null;
		let r = t();
		if (n.timeoutHandle !== void 0 && r && Q(r.clearTimeout)) try {
			Reflect.apply(r.clearTimeout, r, [n.timeoutHandle]);
		} catch {}
		n.resolve(e);
	}, g = (e, t) => {
		c = e, l = t, p(!0);
	}, v = () => {
		c && (c = null, l = "", p(!1));
	}, y = (e) => Z(e) ? Z(e.originalTarget) ? e.originalTarget : Z(e.target) ? e.target : null : null, b = (e, t) => {
		if (t === e) return !0;
		if (!Q(e.contains)) return !1;
		try {
			return Reflect.apply(e.contains, e, [t]) === !0;
		} catch {
			return !1;
		}
	}, x = (e) => {
		if (n()) return;
		let t = y(e);
		if (!t || !Fi(t)) return;
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
						fi,
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
			Q(a) ? r.timeoutHandle = Reflect.apply(a, t, [i, 800]) : queueMicrotask(i);
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
			Q(c) ? o.timeoutHandle = Reflect.apply(c, i, [s, 800]) : queueMicrotask(s);
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
		if (Z(e) && Q(e.stopPropagation) && (e.type === "click" || e.type === "keypress" || e.type === "mousedown")) return e;
		let n = s(), r = n.MouseEvent;
		if (Q(r)) try {
			let e = Reflect.construct(r, ["click", Object.freeze({
				bubbles: !0,
				button: 0,
				cancelable: !0,
				view: n
			})]);
			if (Z(e) && Q(e.stopPropagation)) return e;
		} catch {}
		return Object.freeze({
			button: 0,
			stopPropagation() {},
			target: t,
			type: "click",
			view: n
		});
	}, O = async (t, n, r, i, a = "window.PanelUI.showSubView") => {
		let o = s(), c = Wi(o);
		if (!c || !Z(o.PanelUI)) throw $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_CAPABILITY_MISSING", "firefox-toolbar-widgets-action", a);
		let l = C(t);
		try {
			let e = Reflect.apply(c, o.PanelUI, [
				r,
				n,
				i
			]);
			Promise.resolve(e).catch(() => {});
		} catch (t) {
			throw m(!1), d = "", $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_ACTION_FAILED", "firefox-toolbar-widgets-action", a, t);
		}
		return await l;
	}, k = (e) => {
		if (Qi(e, "type") !== "menu") return null;
		let t = Zi(e, "menupopup");
		return Ii(t) ? t : null;
	}, A = async (t, n, r, i) => {
		let a = w(t, n, n, !1);
		try {
			Reflect.apply(r.openPopup, r, [n, Object.freeze({
				position: fi,
				triggerEvent: i
			})]);
		} catch (t) {
			throw h(!1), $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_ACTION_FAILED", "firefox-toolbar-widgets-action", "XULPopupElement.openPopup", t);
		}
		return await a;
	}, ee = async (t, n, r, i) => {
		let a = s(), o = a.gSync, c = a.PanelUI, l = Wi(a);
		if (!Z(o) || !Q(o.toggleAccountPanel) || !Z(c) || !l) throw $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_CAPABILITY_MISSING", "firefox-toolbar-widgets-action", "window.gSync.toggleAccountPanel.PanelUI.showSubView");
		let u = (...e) => {
			let t = [...e];
			return t[0] === xa && t[1] === r && (t[1] = n), Reflect.apply(l, c, t);
		};
		try {
			c.showSubView = u;
		} catch (t) {
			throw $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_ACTION_FAILED", "firefox-toolbar-widgets-action", "window.PanelUI.showSubView.route-account-anchor", t);
		}
		let f = C(t);
		try {
			let e = Reflect.apply(o.toggleAccountPanel, o, [r, i]);
			await Promise.resolve(e);
		} catch (t) {
			throw m(!1), d = "", _(t) ? t : $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_ACTION_FAILED", "firefox-toolbar-widgets-action", "window.gSync.toggleAccountPanel", t);
		} finally {
			c.showSubView === u && (c.showSubView = l);
		}
		return await f;
	}, j = async (t, n, r) => {
		let i = s().gTabsPanel;
		if (!Z(i) || !Q(i.init) || !Q(i.showAllTabsPanel)) throw $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_CAPABILITY_MISSING", "firefox-toolbar-widgets-action", "window.gTabsPanel.init.showAllTabsPanel");
		let a;
		try {
			Reflect.apply(i.init, i, []), a = i.allTabsButton, i.allTabsButton = n;
		} catch (t) {
			throw $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_ACTION_FAILED", "firefox-toolbar-widgets-action", "window.gTabsPanel.init.allTabsButton", t);
		}
		let o = C(t);
		try {
			Reflect.apply(i.showAllTabsPanel, i, [r, Ca]);
		} catch (t) {
			throw m(!1), d = "", $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_ACTION_FAILED", "firefox-toolbar-widgets-action", "window.gTabsPanel.showAllTabsPanel", t);
		} finally {
			i.allTabsButton = a;
		}
		return await o;
	}, M = (t) => {
		if (Q(t.doCommand)) try {
			Reflect.apply(t.doCommand, t, []);
			return;
		} catch {}
		let n = s().CustomEvent;
		if (!Q(n) || !Q(t.dispatchEvent)) throw $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_CAPABILITY_MISSING", "firefox-toolbar-widgets-action", "toolbar-widgets.node-command");
		let r = Reflect.construct(n, ["command", Object.freeze({
			bubbles: !0,
			cancelable: !0
		})]);
		Reflect.apply(t.dispatchEvent, t, [r]);
	}, te = (e) => {
		let t = zi(s()), n = typeof e.id == "string" ? e.id : "";
		if (!t || !n) return "";
		try {
			let r = Reflect.apply(t.getWidget, t, [n]);
			if (Z(r) && typeof r.viewId == "string") return r.viewId;
			let i = e.parentElement, a = Z(i) && typeof i.id == "string" ? i.id : "";
			if (a && n === `${a}-dropmarker`) {
				let e = Reflect.apply(t.getWidget, t, [a]);
				if (Z(e) && e.type === "button-and-view" && typeof e.viewId == "string") return e.viewId;
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
			if (typeof t != "string" || t === "") throw $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_HANDLE_INVALID", "firefox-toolbar-widgets-action", "toolbar-widgets.handle");
			let s = o(n), u = a.resolve(t);
			if (!ma(u)) throw $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_HANDLE_STALE", "firefox-toolbar-widgets-action", "toolbar-widgets.native-node");
			let d = D(i, s);
			r(1);
			try {
				if (c && l === t) return T(), !0;
				T(), E(s);
				let n = typeof u.id == "string" ? u.id : "";
				if (n === ba) return await ee(t, s, u, d);
				if (n === wa) return await O(t, s, Ta, d);
				if (n === Sa) return await j(t, s, d);
				let r = te(u);
				if (r) return await O(t, s, r, d);
				let i = k(u);
				if (i) return await A(t, s, i, d);
				let a = w(t, s, u);
				try {
					M(u);
				} catch (t) {
					throw h(!1), _(t) ? t : $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_ACTION_FAILED", "firefox-toolbar-widgets-action", "toolbar-widgets.node-command", t);
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
//#region src/firefox/toolbar-widgets/controller.ts
function Da({ boundary: e, frame: t, window: n }) {
	if (e.assertOwnsWindow(n), !Z(n) || !Z(t) || typeof t.contains != "function") throw $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_OPTIONS_INVALID", "firefox-toolbar-widgets-create", "window");
	let r = (e) => Reflect.apply(t.contains, t, [e]) === !0, i = n, a = !1, o = 0, s = 0, c = !1, l = !1, u = !1, d = "", f = vt(), p = null, m = null, h = lt(), g = 0, v = new Map(), y = new Map(), b = null, x = null, S, C = new Set(), w = [], T = new Set(), E = new Set(), D = e.createHandleRegistry("toolbar-widget"), O = () => {
		if (a || !i) throw $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_DISPOSED", "firefox-toolbar-widgets-access", "window");
		return i;
	}, k = () => {
		let t = Ki(O()), n = t.find((e) => e.snapshot.requirement === "required" && !e.snapshot.available);
		if (n) throw $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_CAPABILITY_MISSING", "firefox-toolbar-widgets-capability", n.snapshot.symbol, n.cause);
		return Object.freeze(t.map((e) => e.snapshot));
	}, A = Ea({
		boundary: e,
		getWindowOrNull: () => i,
		isDisposed: () => a,
		onActionDelta(e) {
			o += e;
		},
		popupListeners: E,
		registry: D,
		requireProjectHost: (t) => {
			let n = O();
			if (!Z(t) || !Q(t.getBoundingClientRect) || t.ownerDocument !== n.document || r(t) !== !0) throw $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_HOST_INVALID", "firefox-toolbar-widgets-action", "toolbar-widgets.host");
			return t;
		},
		requireWindow: O
	}), { invoke: ee, onPopupHidden: j, onPopupShown: M } = A, te = e.snapshot().windowKind === "private", N = (e, t) => {
		try {
			let n = Reflect.apply(e.getWidget, e, [t]);
			return Z(n) ? n : null;
		} catch {
			return null;
		}
	}, P = (e) => {
		let t = i;
		if (!t) return null;
		let n = t.gNavToolbox;
		if (!Z(n)) return null;
		let r = n.palette;
		if (!Z(r) || !Q(r.getElementsByAttribute)) return null;
		try {
			return ta(Reflect.apply(r.getElementsByAttribute, r, ["id", e]));
		} catch {
			return null;
		}
	}, ne = (e) => {
		let t = i;
		if (!t) return null;
		let n = Xi(t, e);
		return Pi(n) ? n : P(e);
	}, F = () => {
		if (S !== void 0) return S;
		S = null;
		let e = i;
		if (!e || !Q(e.Localization)) return null;
		let t = e.document, n = Z(t) ? da(t) : [...ki];
		try {
			let t = Reflect.construct(e.Localization, [n, !0]);
			return !Z(t) || !Q(t.formatMessagesSync) && !Q(t.formatValueSync) ? null : (S = t, t);
		} catch {
			return null;
		}
	}, I = (e) => {
		if (!e) return "";
		let t = F();
		if (t) {
			let n = la(t, e);
			if (n) return n;
		}
		let n = i;
		if (!n) return "";
		let r = n.document;
		if (!Z(r)) return "";
		let a = r.l10n;
		return Z(a) ? la(a, e) : "";
	}, L = (e, t, n) => {
		if (!Q(e.getLocalizedProperty)) return "";
		try {
			let r = Reflect.apply(e.getLocalizedProperty, e, [t, n]);
			return typeof r != "string" || r === "" ? "" : pa(r, 200, t);
		} catch {
			return "";
		}
	}, R = (e, t, n, r, i) => {
		let a = r ? pa(Qi(r, "label") || Yi(r, "label"), 200, t) : "", o = r ? pa(Qi(r, "title") || Yi(r, "title"), 200, t) : "", s = r ? pa(Qi(r, "tooltiptext") || Yi(r, "tooltiptext"), 200, t) : "", c = pa(Yi(n, "label"), 200, t), l = pa(Yi(n, "tooltiptext"), 200, t), u = r ? I(Qi(r, "data-l10n-id")) : "", d = I(Ai.get(t) ?? "");
		return a || o || c || u || L(e, t, "label") || d || s || l || L(e, t, "tooltiptext") || (i ? "Extension" : "Toolbar item");
	}, re = (e, t, n, r) => {
		let i = n ? pa(Qi(n, "tooltiptext") || Yi(n, "tooltiptext"), 300, e) : "", a = n ? pa(Qi(n, "title") || Yi(n, "title"), 300, e) : "", o = pa(Yi(t, "tooltiptext"), 300, e);
		return i || a || o || r;
	}, ie = () => {
		let e = new Map(), t = i;
		if (!t) return e;
		let n = t.document;
		if (!Z(n)) return e;
		let r = n.styleSheets;
		if (!Z(r) || typeof r.length != "number") return e;
		let a = r.length;
		for (let t = 0; t < a; t += 1) {
			let n;
			try {
				n = r[t];
			} catch {
				continue;
			}
			if (!Z(n)) continue;
			let i;
			try {
				i = n.cssRules;
			} catch {
				continue;
			}
			if (!Z(i) || typeof i.length != "number") continue;
			let a = i.length;
			for (let t = 0; t < a; t += 1) aa(i[t], e);
		}
		return e;
	}, ae = (e) => (x ||= ie(), x.get(e) ?? ""), oe = (e) => {
		let t = i;
		if (!t || !Q(t.getComputedStyle)) return "";
		let n = [e], r = Zi(e, "toolbarbutton");
		Pi(r) && n.unshift(r);
		for (let e of n) try {
			let n = na(Reflect.apply(t.getComputedStyle, t, [e]));
			if (ea(n, "builtin")) return n;
		} catch {}
		return "";
	}, se = (t, n) => {
		if (n) {
			let e = oe(n);
			if (e) return e;
		}
		let r = ae(t);
		if (r) return r;
		let i = Mi(t, e.snapshot().firefoxVersion);
		return ea(i, "builtin") ? i : "";
	}, ce = (e) => Object.freeze({
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
	}), le = (e) => {
		let t = Ni.get(e);
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
	}, ue = (e, t) => {
		let n = N(e, t), r = n?.webExtension === !0 || Ui(e, t), i = ne(t), a = R(e, t, n, i, r), o = "";
		if (r && i) {
			let e = ha(i);
			o = e ? ga(e) : "";
		} else r || (o = se(t, i));
		return Object.freeze({
			badgeBackground: "",
			badgeText: "",
			badgeTextColor: "",
			disabled: !0,
			fenneviaAction: "",
			handle: "",
			icon: r ? "extension" : Oi.get(t) ?? "generic",
			iconUrl: o,
			kind: r ? "extension-action" : "built-in",
			label: a,
			missing: !0,
			parts: Object.freeze([]),
			tooltip: re(t, n, i, a)
		});
	}, de = (e, t, n) => {
		let r = Di.get(t);
		if (!r) return Object.freeze([]);
		let i = [];
		for (let e of r) {
			let t = Zi(n, `#${e.nodeId}`);
			if (!Pi(t) || !ma(t)) return null;
			i.push(Object.freeze({
				node: t,
				specification: e
			}));
		}
		return Object.freeze(i.map(({ node: t, specification: r }) => {
			let i = pa(Qi(t, "label") || Yi(t, "label"), 200, r.nodeId), a = R(e, r.nodeId, null, t, !1) || r.fallbackLabel;
			return Object.freeze({
				disabled: ya(n) || ya(t),
				handle: D.register(t),
				icon: r.icon,
				iconUrl: se(r.nodeId, t),
				kind: "built-in",
				label: a,
				tooltip: re(r.nodeId, null, t, a),
				valueText: r.displayLabel ? i : ""
			});
		}));
	}, fe = (e, t) => {
		let n = Xi(O(), t);
		if (!Pi(n) || !ma(n)) return Object.freeze({
			node: null,
			widget: ue(e, t)
		});
		let r = N(e, t), i = r?.webExtension === !0 || Ui(e, t), a = i ? Object.freeze([]) : de(e, t, n);
		if (a === null) return Object.freeze({
			node: n,
			widget: ue(e, t)
		});
		let o = D.register(n);
		if (i) {
			let i = ha(n), a = i ? _a(i) : Object.freeze({
				background: "",
				text: "",
				textColor: ""
			}), s = va(n) || R(e, t, r, n, !0);
			return Object.freeze({
				node: n,
				widget: Object.freeze({
					badgeBackground: a.background,
					badgeText: a.text,
					badgeTextColor: a.textColor,
					disabled: ya(i || n),
					fenneviaAction: "",
					handle: o,
					icon: "extension",
					iconUrl: i ? ga(i) : "",
					kind: "extension-action",
					label: s,
					missing: !1,
					parts: Object.freeze([]),
					tooltip: re(t, r, n, s)
				})
			});
		}
		let s = R(e, t, r, n, !1);
		return Object.freeze({
			node: n,
			widget: Object.freeze({
				badgeBackground: "",
				badgeText: "",
				badgeTextColor: "",
				disabled: ya(n),
				fenneviaAction: "",
				handle: o,
				icon: Oi.get(t) ?? "generic",
				iconUrl: se(t, n),
				kind: "built-in",
				label: s,
				missing: !1,
				parts: a,
				tooltip: re(t, r, n, s)
			})
		});
	}, pe = (e, t) => t.type === "special" ? Object.freeze({
		node: null,
		widget: ce(t.kind)
	}) : t.type === "fennevia" ? Object.freeze({
		node: null,
		widget: le(t.id)
	}) : fe(e, t.id), me = (e) => {
		let t;
		try {
			t = Reflect.apply(e.getWidgetIdsInArea, e, [oi]);
		} catch {
			t = null;
		}
		let n = [];
		if (Array.isArray(t)) for (let e of t) {
			if (typeof e != "string" || Ei.has(e)) continue;
			let t = Ji(e);
			if (t) {
				n.push(Object.freeze({
					kind: t,
					type: "special"
				}));
				continue;
			}
			Ot(e) && n.push(Object.freeze({
				id: e,
				type: "widget"
			}));
		}
		return Nt({ top: n });
	}, he = (e) => {
		let t = v.get(e);
		if (t) return t;
		let n = `palette-${++g}`;
		return v.set(e, n), n;
	}, ge = (e) => {
		let t;
		try {
			t = e.areas;
		} catch {
			t = void 0;
		}
		let n = Array.isArray(t) ? t : [oi], r = [], i = new Set();
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
	}, z = (e) => {
		if (!Q(e.getUnusedWidgets)) return [];
		let t = i?.gNavToolbox, n = Z(t) ? t.palette : void 0;
		if (!Z(n)) return [];
		try {
			let t = Reflect.apply(e.getUnusedWidgets, e, [n]);
			if (!Array.isArray(t)) return [];
			let r = [];
			for (let e of t) Z(e) && typeof e.id == "string" && r.push(e.id);
			return r;
		} catch {
			return [];
		}
	}, B = (e, t) => {
		if (Ei.has(t) || Ji(t) !== null || !Ot(t)) return null;
		let n = N(e, t);
		if (te && n?.showInPrivateBrowsing === !1) return null;
		let r = n?.webExtension === !0 || Ui(e, t), i = ne(t), a = Pi(i) && ma(i) ? i : null, o, s;
		if (r) {
			let r = a ? ha(a) : i ? ha(i) : null;
			s = r ? ga(r) : "", o = (a ? va(a) : "") || R(e, t, n, i, !0);
		} else o = R(e, t, n, i, !1), s = se(t, i);
		let c = he(`w:${t}`);
		return y.set(c, Object.freeze({
			id: t,
			type: "widget"
		})), Object.freeze({
			icon: r ? "extension" : Oi.get(t) ?? "generic",
			iconUrl: s,
			kind: r ? "extension-action" : "built-in",
			label: o,
			token: c
		});
	}, _e = (e, t) => {
		y.clear();
		let n = [], r = new Set(), i = new Set();
		for (let e of Fe) for (let n of t.zones[e]) n.type === "widget" ? r.add(n.id) : n.type === "fennevia" && i.add(n.id);
		for (let e of Ie) {
			if (i.has(e)) continue;
			let t = Ni.get(e), r = he(`f:${e}`);
			y.set(r, Object.freeze({
				id: e,
				type: "fennevia"
			})), n.push(Object.freeze({
				icon: t?.icon ?? "generic",
				iconUrl: "",
				kind: "fennevia",
				label: t?.label ?? "Fennevia control",
				token: r
			}));
		}
		let a = [...ge(e), ...z(e)], o = new Set();
		for (let t of a) {
			if (o.has(t) || r.has(t) || n.length >= 256) continue;
			o.add(t);
			let i = B(e, t);
			i && n.push(i);
		}
		for (let [e, t] of [
			["separator", "Separator"],
			["spacer", "Space"],
			["spring", "Flexible space"]
		]) {
			let r = he(`s:${e}`);
			y.set(r, Object.freeze({
				kind: e,
				type: "special"
			})), n.push(Object.freeze({
				icon: "",
				iconUrl: "",
				kind: "special",
				label: t,
				token: r
			}));
		}
		return Object.freeze(n);
	}, ve = (e) => {
		if (Z(b) && Q(b.disconnect)) try {
			Reflect.apply(b.disconnect, b, []);
		} catch {}
		b = null;
		let t = i;
		if (!t) return;
		let n = t.MutationObserver;
		if (Q(n)) try {
			let t = Reflect.construct(n, [() => {
				H();
			}]);
			if (!Q(t.observe)) return;
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
			b = t;
		} catch {
			b = null;
		}
	}, ye = () => {
		let e = O(), t = zi(e);
		if (!t) return y.clear(), ve([]), Object.freeze({
			serialized: "unavailable",
			snapshot: vt()
		});
		let n = p ?? me(t), r = [], i = [], a = new Set();
		for (let e of Fe) {
			let o = [];
			for (let r of n.zones[e]) {
				let e = pe(t, r);
				o.push(e.widget), i.push(e.node), e.widget.handle !== "" && a.add(e.widget.handle);
				for (let t of e.widget.parts) a.add(t.handle);
			}
			r.push([e, Object.freeze(o)]);
		}
		for (let e of C) if (!a.has(e)) try {
			D.release(e);
		} catch {}
		C.clear();
		for (let e of a) C.add(e);
		ve(i);
		let o = Bi(e), s = Object.freeze({
			available: !0,
			canEdit: o !== null,
			layoutCustomized: p !== null,
			palette: _e(t, n),
			panels: st(m ?? ot()),
			panelsCustomized: m !== null,
			style: ht(h),
			zones: Object.freeze(Object.fromEntries(r))
		});
		return Object.freeze({
			serialized: JSON.stringify(s),
			snapshot: s
		});
	}, V = () => {
		if (a) return;
		let e = ye();
		if (e.serialized === d) return;
		d = e.serialized, f = e.snapshot, s += 1;
		let t = Object.freeze({
			revision: s,
			snapshot: f,
			type: "snapshot"
		});
		for (let e of Array.from(T)) e(t);
	}, H = () => {
		if (a || c) return;
		c = !0;
		let e = () => {
			c = !1, !a && V();
		}, t = i, n = t?.setTimeout;
		if (t && Q(n)) {
			Reflect.apply(n, t, [e, 0]);
			return;
		}
		queueMicrotask(e);
	}, be = Object.freeze({
		onAreaReset: () => H(),
		onCustomizeEnd: () => H(),
		onWidgetAdded: () => H(),
		onWidgetCreated: () => H(),
		onWidgetDestroyed: () => H(),
		onWidgetInstanceRemoved: () => H(),
		onWidgetMoved: () => H(),
		onWidgetOverflow: () => H(),
		onWidgetRemoved: () => H(),
		onWidgetReset: () => H(),
		onWidgetUndoMove: () => H(),
		onWidgetUnderflow: () => H()
	}), xe = () => {
		if (!l) return;
		l = !1;
		let e = i;
		if (!e) return;
		let t = zi(e);
		if (t) try {
			Reflect.apply(t.removeListener, t, [be]);
		} catch {}
	}, U = () => {
		let e = i;
		if (!e) return;
		let t = Bi(e);
		if (!t) {
			p = null, m = null, h = lt();
			return;
		}
		p = Pt(Vi(t, ci)), m = zt(Vi(t, ui)), h = It(Vi(t, "fennevia.customize.style")) ?? lt();
	}, Se = Object.freeze({ observe: () => {
		a || (U(), H());
	} }), W = () => {
		if (!u) return;
		u = !1;
		let e = i, t = e ? Bi(e) : null;
		if (t) try {
			Reflect.apply(t.removeObserver, t, [di, Se]);
		} catch {}
	}, Ce = () => {
		let t = Bi(O());
		if (!t) throw $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_UNAVAILABLE", "firefox-toolbar-widgets-edit", "window.Services.prefs");
		return t;
	}, we = (e) => {
		let t = Ce();
		Reflect.apply(t.setStringPref, t, [ci, Ft(e)]), p = e;
	}, Te = (e) => {
		let t = Ce();
		Reflect.apply(t.setStringPref, t, [li, Lt(e)]), h = e;
	}, G = (e) => {
		let t = Ce();
		Reflect.apply(t.setStringPref, t, [ui, Bt(e)]), m = e;
	}, Ee = (t, n, r) => {
		let i = "";
		if (Q(t.getPlacementOfWidget)) try {
			let e = Reflect.apply(t.getPlacementOfWidget, t, [r]);
			Z(e) && typeof e.area == "string" && (i = e.area);
		} catch {
			i = "";
		}
		if (i !== "" && i !== Hi(t)) return n;
		if (!Q(t.addWidgetToArea)) throw $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_UNAVAILABLE", "firefox-toolbar-widgets-edit", "window.CustomizableUI.addWidgetToArea");
		return Reflect.apply(t.addWidgetToArea, t, [r, oi]), Yt(n, r);
	}, De = (e, t, n) => {
		if (!t.adopted.includes(n)) return t;
		if (Ui(e, n)) {
			if (Q(e.addWidgetToArea)) try {
				Reflect.apply(e.addWidgetToArea, e, [n, Hi(e)]);
			} catch {}
		} else if (Q(e.removeWidgetFromArea)) try {
			Reflect.apply(e.removeWidgetFromArea, e, [n]);
		} catch {}
		return Xt(t, n);
	}, Oe = () => {
		let t = zi(O());
		if (!t) throw $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_UNAVAILABLE", "firefox-toolbar-widgets-edit", "window.CustomizableUI");
		return t;
	}, ke = Object.freeze({
		edit: async (t) => {
			O();
			let n;
			try {
				n = xt(t);
			} catch (t) {
				throw $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_INVALID", "firefox-toolbar-widgets-edit", "toolbar-widgets.edit", t);
			}
			o += 1;
			try {
				if (n.type === "set-style") return Te(ht({
					...h,
					...n.style
				})), V(), !0;
				if (n.type === "reset-style") {
					let e = Ce();
					try {
						Reflect.apply(e.clearUserPref, e, [li]);
					} catch {}
					return h = lt(), V(), !0;
				}
				if (n.type === "set-panels") return G(st({
					...m ?? ot(),
					...n.panels
				})), V(), !0;
				if (n.type === "reset-panels") {
					let e = Ce();
					try {
						Reflect.apply(e.clearUserPref, e, [ui]);
					} catch {}
					return m = null, V(), !0;
				}
				let t = Oe();
				if (Ce(), n.revision !== s) throw $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_STALE", "firefox-toolbar-widgets-edit", "toolbar-widgets.edit-revision");
				let r = p ?? me(t);
				try {
					switch (n.type) {
						case "add": {
							let i = y.get(n.token);
							if (!i) throw $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_INVALID", "firefox-toolbar-widgets-edit", "toolbar-widgets.palette-token");
							let a = r;
							i.type === "widget" && (a = Ee(t, a, i.id)), a = Gt(a, i, n.zone, n.index), we(a);
							break;
						}
						case "move":
							we(Jt(r, n.fromZone, n.fromIndex, n.toZone, n.toIndex));
							break;
						case "remove": {
							let e = qt(r, n.zone, n.index), i = Kt(r, n.zone, n.index);
							e.type === "widget" && !Zt(i, e.id) && (i = De(t, i, e.id)), we(i);
							break;
						}
						case "reset-layout": {
							let e = r;
							for (let n of [...r.adopted]) e = De(t, e, n);
							let n = Ce();
							try {
								Reflect.apply(n.clearUserPref, n, [ci]);
							} catch {}
							p = null;
							break;
						}
					}
				} catch (t) {
					throw _(t) ? t : $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_EDIT_FAILED", "firefox-toolbar-widgets-edit", "toolbar-widgets.edit", t);
				}
				return V(), !0;
			} finally {
				--o;
			}
		},
		invoke: ee,
		snapshot() {
			O();
			let e = ye();
			return d = e.serialized, f = e.snapshot, f;
		},
		subscribe(t) {
			if (O(), typeof t != "function") throw $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_LISTENER_INVALID", "firefox-toolbar-widgets-subscribe", "toolbar-widgets.subscribe");
			T.add(t);
			let n = !0;
			return Object.freeze(() => n ? (n = !1, T.delete(t), !0) : !1);
		},
		subscribePopup(t) {
			if (O(), typeof t != "function") throw $(e, "FENNEVIA_FIREFOX_TOOLBAR_WIDGETS_LISTENER_INVALID", "firefox-toolbar-widgets-subscribe", "toolbar-widgets.subscribe");
			E.add(t);
			let n = !0;
			return Object.freeze(() => n ? (n = !1, E.delete(t), !0) : !1);
		}
	});
	try {
		k();
		let t = O().document;
		w.push(e.subscribe(t, "popupshown", M, pi), e.subscribe(t, "popuphidden", j, pi));
		let n = zi(O());
		n && (Reflect.apply(n.addListener, n, [be]), l = !0);
		let r = Bi(O());
		r && (Reflect.apply(r.addObserver, r, [di, Se]), u = !0), U();
		let i = ye();
		d = i.serialized, f = i.snapshot;
	} catch (e) {
		a = !0, W(), S = null, i = null;
		for (let e of w.reverse()) try {
			e();
		} catch {}
		throw w.length = 0, e;
	}
	return Object.freeze({
		assertRequiredCapabilities: k,
		dispose() {
			if (a) return !1;
			if (a = !0, A.dispose(), xe(), W(), Z(b) && Q(b.disconnect)) try {
				Reflect.apply(b.disconnect, b, []);
			} catch {}
			b = null, T.clear(), E.clear(), C.clear(), v.clear(), y.clear(), x = null, S = null, D.dispose(), i = null;
			for (let e of w.reverse()) try {
				e();
			} catch {}
			return w.length = 0, !0;
		},
		refresh() {
			return !a && (V(), !0);
		},
		snapshot() {
			return Object.freeze({
				disposed: a,
				pendingActionCount: o,
				revision: s,
				widgetCount: Fe.reduce((e, t) => e + f.zones[t].length, 0)
			});
		},
		toolbarWidgets: ke
	});
}
//#endregion
//#region src/app/urlbar-coverage-state.ts
var Oa = Object.freeze([
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
]), ka = Object.freeze([
	"location",
	"media",
	"serial",
	"xr"
]), Aa = Object.freeze([
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
new Set(Oa), new Set(ka), new Set(Aa);
//#endregion
//#region src/firefox/urlbar-coverage/support.ts
var ja = Object.freeze([
	"blocked-permissions-container",
	"identity-permission-box",
	"page-action-buttons"
]), Ma = Object.freeze({
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
}), Na = Object.freeze([
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
]), Pa = Object.freeze([
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
]), Fa = new Set([
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
]), Ia = (e) => typeof e == "object" && !!e, La = (e) => typeof e == "function", Ra = (e) => Ia(e) && La(e.getAttribute) && La(e.hasAttribute), za = (e) => Ia(e) && La(e.getElementById), Ba = (e) => za(e.document) ? e.document : null, Va = (e, t) => {
	let n = Ba(e);
	return n ? Reflect.apply(n.getElementById, n, [t]) : void 0;
}, Ha = (e) => Ba(e)?.documentElement, Ua = Object.freeze([
	Object.freeze({
		isAvailable: La,
		name: "firefox.urlbar-coverage-native-access",
		read: (e) => e.openLocation,
		symbol: "window.openLocation"
	}),
	Object.freeze({
		isAvailable: La,
		name: "firefox.urlbar-coverage-mutation-observer",
		read: (e) => e.MutationObserver,
		symbol: "window.MutationObserver"
	}),
	Object.freeze({
		isAvailable: Ra,
		name: "firefox.urlbar-coverage-urlbar-state",
		read: (e) => e.gURLBar,
		symbol: "window.gURLBar.hasAttribute"
	}),
	Object.freeze({
		isAvailable: Ra,
		name: "firefox.urlbar-coverage-window-state",
		read: Ha,
		symbol: "document.documentElement.hasAttribute"
	}),
	...ja.map((e) => Object.freeze({
		isAvailable: Ra,
		name: `firefox.urlbar-coverage-${e}`,
		read: (t) => Va(t, e),
		symbol: `document.elements[${e}]`
	}))
]), Wa = (e, t) => Object.freeze([...Ua.map((t) => {
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
	available: La(t),
	name: "firefox.urlbar-coverage-native-ui-handoff",
	requirement: "required",
	symbol: "nativeUi.revealForUrlbar"
}) })]), Ga = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, Ka = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: Ga(e),
	phase: n,
	symbol: r
}), qa = (e, t) => {
	let n = Reflect.apply(e.getAttribute, e, [t]);
	return typeof n == "string" ? n : null;
}, Ja = (e, t) => !!Reflect.apply(e.hasAttribute, e, [t]), Ya = (e) => {
	if (e.hidden === !0) return !1;
	let t = qa(e, "hidden");
	return t !== null && t !== "false" ? !1 : qa(e, "collapsed") !== "true";
}, Xa = (e) => {
	let t = e.children;
	return Object.freeze(!t || typeof t != "object" && !Array.isArray(t) ? [] : Array.from(t));
}, Za = (e, t) => {
	let n = e.classList;
	return Ia(n) && La(n.contains) && !!Reflect.apply(n.contains, n, [t]);
}, Qa = (e, t) => e.permissions.available === t.permissions.available && e.permissions.hasPermissions === t.permissions.hasPermissions && e.permissions.blocked.length === t.permissions.blocked.length && e.permissions.blocked.every((e, n) => e === t.permissions.blocked[n]) && e.permissions.sharing.length === t.permissions.sharing.length && e.permissions.sharing.every((e, n) => e === t.permissions.sharing[n]) && e.items.length === t.items.length && e.items.every((e, n) => e === t.items[n]);
//#endregion
//#region src/firefox/urlbar-coverage/controller.ts
function $a({ boundary: e, onError: t, requestNativeUiReveal: n, window: r }) {
	if (e.assertOwnsWindow(r), !Ia(r) || typeof t != "function" || typeof n != "function") throw Ka(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_OPTIONS_INVALID", "firefox-urlbar-coverage-create", "window");
	let i = r, a = !1, o = null, s = 0, c = null, l = Object.freeze({
		items: Object.freeze([]),
		permissions: Object.freeze({
			available: !1,
			blocked: Object.freeze([]),
			hasPermissions: !1,
			sharing: Object.freeze([])
		})
	}), u = new Set(), d = () => {
		if (a || !i) throw Ka(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_DISPOSED", "firefox-urlbar-coverage-access", "window.gURLBar");
		if (o) throw o;
		return e.assertOwnsWindow(i), i;
	}, f = (t) => {
		let n = Va(d(), t);
		if (!Ra(n)) throw Ka(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_CAPABILITY_MISSING", "firefox-urlbar-coverage-snapshot", `document.elements[${t}]`);
		return n;
	}, p = () => {
		let t = d().gURLBar;
		if (!Ra(t)) throw Ka(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_CAPABILITY_MISSING", "firefox-urlbar-coverage-snapshot", "window.gURLBar.hasAttribute");
		return t;
	}, m = () => {
		let t = Ha(d());
		if (!Ra(t)) throw Ka(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_CAPABILITY_MISSING", "firefox-urlbar-coverage-snapshot", "document.documentElement.hasAttribute");
		return t;
	}, h = () => {
		let t = Wa(d(), n), r = t.find((e) => !e.snapshot.available);
		if (r) throw Ka(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_CAPABILITY_MISSING", "firefox-urlbar-coverage-capability", r.snapshot.symbol, r.cause);
		return Object.freeze(t.map((e) => e.snapshot));
	}, g = () => {
		let e = p(), t = f("identity-permission-box"), n = Object.freeze(Na.flatMap(({ id: e, kind: t }) => {
			let n = Va(d(), e);
			return Ra(n) && Ja(n, "sharing") ? [t] : [];
		}));
		if (!(qa(e, "pageproxystate") === "valid" || Ja(e, "persistsearchterms") || n.length > 0)) return Object.freeze({
			available: !1,
			blocked: Object.freeze([]),
			hasPermissions: !1,
			sharing: Object.freeze([])
		});
		let r = Object.freeze(Xa(f("blocked-permissions-container")).flatMap((e) => {
			if (!Ra(e) || !Ja(e, "showing")) return [];
			let t = qa(e, "data-permission-id"), n = t ? Ma[t] : void 0;
			return n ? [n] : [];
		}));
		return Object.freeze({
			available: !0,
			blocked: r,
			hasPermissions: Ja(t, "hasPermissions"),
			sharing: n
		});
	}, v = () => {
		let e = d(), t = p(), n = new Set();
		Ja(m(), "remotecontrol") && n.add("remote-control"), Ja(t, "searchmode") && n.add("search-mode"), Ja(t, "persistsearchterms") && n.add("persisted-search");
		for (let { id: t, kind: r } of Pa) {
			let i = Va(e, t);
			Ra(i) && Ya(i) && n.add(r);
		}
		let r = Va(e, "pageActionButton");
		Ra(r) && Ja(r, "multiple-children") && n.add("more-page-actions");
		for (let e of Xa(f("page-action-buttons"))) {
			if (!Ra(e) || !Ya(e) || !Za(e, "urlbar-page-action")) continue;
			let t = typeof e.id == "string" ? e.id : "";
			Fa.has(t) || (Za(e, "urlbar-addon-page-action") ? n.add("extension-actions") : Ja(e, "actionid") && n.add("other-page-actions"));
		}
		return Object.freeze(Aa.filter((e) => n.has(e)));
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
			t(Ka(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_SUBSCRIBER_FAILED", "firefox-urlbar-coverage-notify", "urlbarCoverage.subscribe", n));
		}
	}, S = (e) => {
		let t = y();
		return Qa(l, t) && s > 0 ? !1 : (l = t, s += 1, e && x(), !0);
	}, C = (n) => {
		o = _(n) ? n : Ka(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_EVENT_FAILED", "firefox-urlbar-coverage-event", "window.MutationObserver", n), t(o);
	}, w = Object.freeze({
		openNativeUrlbar() {
			let t = d(), r = t.openLocation;
			if (!La(r)) throw Ka(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_CAPABILITY_MISSING", "firefox-urlbar-native-access", "window.openLocation");
			try {
				if (n() !== !0) throw Ka(e, "FENNEVIA_FIREFOX_URLBAR_NATIVE_UI_HANDOFF_REJECTED", "firefox-urlbar-native-access", "nativeUi.revealForUrlbar");
				return Reflect.apply(r, t, []), !0;
			} catch (t) {
				throw _(t) ? t : Ka(e, "FENNEVIA_FIREFOX_URLBAR_NATIVE_ACCESS_FAILED", "firefox-urlbar-native-access", "window.openLocation", t);
			}
		},
		snapshot() {
			return d(), l;
		},
		subscribe(t) {
			if (d(), typeof t != "function") throw Ka(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_LISTENER_INVALID", "firefox-urlbar-coverage-subscribe", "urlbarCoverage.subscribe");
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
			t(Ka(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_DISPOSE_FAILED", "firefox-urlbar-coverage-dispose", "window.MutationObserver.disconnect", n));
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
			if (c = null, u.clear(), i = null, t !== void 0) throw Ka(e, "FENNEVIA_FIREFOX_URLBAR_COVERAGE_DISPOSE_FAILED", "firefox-urlbar-coverage-dispose", "window.MutationObserver.disconnect", t);
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
var eo = 1024, to = 2048, no = Object.freeze([
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
]), ro = Object.freeze([
	"bookmarks",
	"history",
	"search",
	"tabs",
	"other-local",
	"other-network",
	"addon",
	"actions",
	"unknown"
]), io = Object.freeze(["direct", "native"]), ao = Object.freeze([
	"idle",
	"querying",
	"results",
	"empty",
	"failed"
]);
new Set(no), new Set(ro), new Set(io), new Set(ao);
function oo(e) {
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
function so(e) {
	if (!e || typeof e != "object" || e.kind !== "keyboard" && e.kind !== "pointer" || e.button !== 0 && e.button !== 1 || typeof e.altKey != "boolean" || typeof e.ctrlKey != "boolean" || typeof e.metaKey != "boolean" || typeof e.shiftKey != "boolean" || e.kind === "keyboard" && e.button !== 0) throw oo("FENNEVIA_URLBAR_SUGGESTIONS_GESTURE_INVALID");
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
var co = Object.freeze({
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
}), lo = Object.freeze({
	BOOKMARKS: 1,
	HISTORY: 2,
	SEARCH: 3,
	TABS: 4,
	OTHER_LOCAL: 5,
	OTHER_NETWORK: 6,
	ADDON: 7,
	ACTIONS: 8
}), uo = Object.freeze({
	[co.TAB_SWITCH]: "tab-switch",
	[co.SEARCH]: "search",
	[co.URL]: "url",
	[co.KEYWORD]: "keyword",
	[co.OMNIBOX]: "omnibox",
	[co.REMOTE_TAB]: "remote-tab",
	[co.TIP]: "tip",
	[co.DYNAMIC]: "dynamic",
	[co.RESTRICT]: "restrict",
	[co.AI_CHAT]: "ai-chat"
}), fo = Object.freeze({
	[lo.BOOKMARKS]: "bookmarks",
	[lo.HISTORY]: "history",
	[lo.SEARCH]: "search",
	[lo.TABS]: "tabs",
	[lo.OTHER_LOCAL]: "other-local",
	[lo.OTHER_NETWORK]: "other-network",
	[lo.ADDON]: "addon",
	[lo.ACTIONS]: "actions"
}), po = new Set([
	co.TAB_SWITCH,
	co.SEARCH,
	co.URL,
	co.KEYWORD,
	co.OMNIBOX,
	co.REMOTE_TAB
]), mo = (e) => typeof e == "object" && !!e || typeof e == "function", ho = (e) => typeof e == "function", go = (e) => typeof e == "function", _o = (e) => mo(e) && ho(e.close) && ho(e.telemetryTypeFromElement), vo = (e) => mo(e) && typeof e.value == "string" && mo(e.controller) && _o(e.view) && ho(e.startQuery) && ho(e.pickResult) && ho(e.handleRevert), yo = (e) => {
	let t = e.parentController;
	return mo(t) ? t : e;
}, bo = (e) => mo(e) && ho(e.startQuery) && ho(e.cancelQuery), xo = (e) => {
	let t = e.gURLBar, n = e.gBrowser;
	if (!vo(t) || !mo(n)) return null;
	let r = t.controller, i = yo(r), a = i.manager, o = n.selectedBrowser;
	return !bo(a) || !mo(o) ? null : Object.freeze({
		input: t,
		manager: a,
		nativeController: r,
		parentController: i,
		selectedBrowser: o
	});
}, So = Object.freeze([
	Object.freeze({
		isAvailable: vo,
		name: "firefox.urlbar-suggestions-input",
		read: (e) => e.gURLBar,
		symbol: "window.gURLBar.startQuery"
	}),
	Object.freeze({
		isAvailable: (e) => mo(e) ? bo(yo(e).manager) : !1,
		name: "firefox.urlbar-suggestions-manager",
		read: (e) => mo(e.gURLBar) ? e.gURLBar.controller : void 0,
		symbol: "window.gURLBar.controller.parentController.manager.startQuery"
	}),
	Object.freeze({
		isAvailable: mo,
		name: "firefox.urlbar-suggestions-selected-browser",
		read: (e) => mo(e.gBrowser) ? e.gBrowser.selectedBrowser : void 0,
		symbol: "window.gBrowser.selectedBrowser"
	}),
	Object.freeze({
		isAvailable: go,
		name: "firefox.urlbar-suggestions-keyboard-event",
		read: (e) => e.KeyboardEvent,
		symbol: "window.KeyboardEvent"
	}),
	Object.freeze({
		isAvailable: go,
		name: "firefox.urlbar-suggestions-mouse-event",
		read: (e) => e.MouseEvent,
		symbol: "window.MouseEvent"
	})
]), Co = (e) => Object.freeze(So.map((t) => {
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
})), wo = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, To = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: wo(e),
	phase: n,
	symbol: r
}), Eo = (e, t) => {
	if (typeof e != "string") return "";
	let n = "";
	for (let r of e.slice(0, t)) {
		let e = r.charCodeAt(0);
		n += e <= 8 || e === 11 || e === 12 || e >= 14 && e <= 31 || e === 127 ? " " : r;
	}
	return n;
}, Do = (e) => mo(e.payload) ? e.payload : Object.create(null), Oo = (e, t, n = !1) => {
	if (!ho(e.getDisplayableValueAndHighlights)) return "";
	try {
		let r = Reflect.apply(e.getDisplayableValueAndHighlights, e, [t, ...n ? [{ isURL: !0 }] : []]);
		return mo(r) ? Eo(r.value, 2048) : "";
	} catch {
		return "";
	}
}, ko = (e, t) => {
	for (let n of e) {
		let e = Eo(n, t);
		if (e.length > 0) return e;
	}
	return "";
}, Ao = (e) => {
	let t;
	try {
		t = e.icon;
	} catch {
		return null;
	}
	if (typeof t != "string" || t.length === 0 || t.length > 2048) return null;
	let n = Eo(t, to);
	return n === t && (/^(?:chrome|resource|moz-extension|page-icon|moz-page-thumb):/iu.test(n) || /^data:image\/(?:png|gif|jpeg|webp);base64,[a-z0-9+/=]+$/iu.test(n)) ? n : null;
}, jo = (e) => Number.isInteger(e) ? uo[e] ?? "unknown" : "unknown", Mo = (e) => Number.isInteger(e) ? fo[e] ?? "unknown" : "unknown", No = (e) => Number.isInteger(e.type) && po.has(e.type) ? "direct" : "native", Po = (e, t) => {
	let n = Do(e), r = Oo(e, "title"), i = Oo(e, "url", !0), a = ko([
		n.text,
		r,
		n.title,
		n.suggestion,
		n.query,
		n.input,
		i,
		n.url
	], 512), o = ko([
		n.description,
		n.subtitle,
		n.device,
		n.engine,
		n.content,
		i === a ? "" : i
	], eo);
	return Object.freeze({
		description: o,
		execution: No(e),
		heuristic: e.heuristic === !0,
		icon: Ao(e),
		source: Mo(e.source),
		title: a,
		token: t,
		type: jo(e.type)
	});
};
//#endregion
//#region src/firefox/urlbar-suggestions/controller.ts
function Fo({ boundary: e, onError: t, window: n }) {
	if (e.assertOwnsWindow(n), !mo(n) || typeof t != "function") throw To(e, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_OPTIONS_INVALID", "firefox-urlbar-suggestions-create", "window.gURLBar");
	let r = n, i = !1, a = 0, o = 0, s = null, c = Object.freeze({
		available: !0,
		phase: "idle",
		queryRevision: 0,
		results: Object.freeze([])
	}), l = new Set(), u = e.createHandleRegistry("urlbar-result"), d = new Map(), f = () => {
		if (i || !r) throw To(e, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_DISPOSED", "firefox-urlbar-suggestions-access", "window.gURLBar");
		return e.assertOwnsWindow(r), r;
	}, p = () => {
		let t = Co(f()), n = t.find((e) => !e.snapshot.available);
		if (n) throw To(e, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_CAPABILITY_MISSING", "firefox-urlbar-suggestions-capability", n.snapshot.symbol, n.cause);
		return Object.freeze(t.map((e) => e.snapshot));
	}, m = () => {
		let t = xo(f());
		if (!t) throw To(e, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_CAPABILITY_MISSING", "firefox-urlbar-suggestions-access", "window.gURLBar.controller.parentController.manager");
		return t;
	}, h = () => {
		let n = Object.freeze({
			revision: a,
			snapshot: c,
			type: "snapshot"
		});
		for (let r of Array.from(l)) try {
			r(n);
		} catch (n) {
			t(To(e, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_SUBSCRIBER_FAILED", "firefox-urlbar-suggestions-notify", "urlbarSuggestions.subscribe", n));
		}
	}, g = (e, t = Object.freeze([])) => {
		c = Object.freeze({
			available: !0,
			phase: e,
			queryRevision: o,
			results: Object.freeze([...t])
		}), a += 1, h();
	}, _ = () => {
		for (let e of d.keys()) try {
			u.release(e);
		} catch {}
		d.clear();
	}, v = (n) => {
		if (!n) return !1;
		s === n && (s = null);
		try {
			Reflect.apply(n.manager.cancelQuery, n.manager, [n.context]);
		} catch (n) {
			t(To(e, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_CANCEL_FAILED", "firefox-urlbar-suggestions-cancel", "UrlbarProvidersManager.cancelQuery", n));
		}
		return !0;
	}, y = (n, r, i, a, o) => {
		n && s !== n || (v(n ?? s), _(), g("failed"), t(To(e, r, i, a, o)));
	}, x = (e, t, n) => {
		let r = s;
		if (i || !r || r.context !== e || r.revision !== n || o !== n) return;
		let a = Array.isArray(e.results) ? e.results.slice(0, 20) : [], c = [], l = new Set();
		_();
		for (let e of a) {
			if (!mo(e) || l.has(e)) continue;
			l.add(e);
			let r = e, i = u.register(r), a;
			try {
				a = Po(r, i);
			} catch (e) {
				throw u.release(i), e;
			}
			d.set(i, Object.freeze({
				execution: a.execution,
				input: t.input,
				manager: t.manager,
				queryRevision: n,
				result: r
			})), c.push(a);
		}
		c.length > 0 ? g("results", c) : g("querying");
	}, S = (e, t, n) => {
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
					x(t, e, n);
				} catch (e) {
					y(s, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_RESULT_FAILED", "firefox-urlbar-suggestions-result", "UrlbarParentController.receiveResults", e);
				}
			};
			if (a === "view") return r;
			let o = Reflect.get(i, a, i);
			return ho(o) ? o.bind(i) : o;
		} });
	}, C = (n) => {
		try {
			Reflect.apply(n.manager.cancelQuery, n.manager, [n.context]);
		} catch (n) {
			t(To(e, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_CANCEL_FAILED", "firefox-urlbar-suggestions-finish", "UrlbarProvidersManager.cancelQuery", n));
		}
		s === n && (s = null, o === n.revision && c.phase === "querying" && g("empty"));
	}, w = (t, n, r) => {
		if (!mo(t)) throw To(e, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_CONTEXT_INVALID", "firefox-urlbar-suggestions-query", "UrlbarQueryContext");
		v(s);
		let i = Object.freeze({
			context: t,
			input: n.input,
			manager: n.manager,
			revision: r
		});
		s = i;
		let a = S(n, t, r), o;
		try {
			o = Reflect.apply(n.manager.startQuery, n.manager, [t, a]);
		} catch (e) {
			y(i, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_QUERY_FAILED", "firefox-urlbar-suggestions-query", "UrlbarProvidersManager.startQuery", e);
			return;
		}
		Promise.resolve(o).then(() => C(i), (e) => y(i, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_QUERY_FAILED", "firefox-urlbar-suggestions-query", "UrlbarProvidersManager.startQuery", e));
	}, T = (t, n, r) => {
		let i = new Proxy(t.nativeController, { get(e, t) {
			if (t === "cancelQuery") return () => v(s);
			if (t === "startQuery") return (e) => n(e);
			let r = Reflect.get(e, t, e);
			return ho(r) ? r.bind(e) : r;
		} }), a, o = !1, c;
		try {
			if (t.input.controller = i, t.input.controller !== i) throw To(e, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_PROXY_REJECTED", "firefox-urlbar-suggestions-proxy", "window.gURLBar.controller");
			c = r();
		} catch (e) {
			a = e, o = !0;
		}
		let l, u = !1;
		try {
			if (t.input.controller = t.nativeController, t.input.controller !== t.nativeController) throw To(e, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_PROXY_RESTORE_FAILED", "firefox-urlbar-suggestions-proxy", "window.gURLBar.controller");
		} catch (e) {
			l = e, u = !0;
		}
		if (u) throw l;
		if (o) throw a;
		return c;
	}, E = (t) => {
		let n = m();
		v(s), _(), o += 1;
		let r = o;
		g("querying"), n.input.value = t, typeof n.input.selectionStart == "number" && (n.input.selectionStart = t.length), typeof n.input.selectionEnd == "number" && (n.input.selectionEnd = t.length);
		let i = !1;
		try {
			if (T(n, (e) => {
				i = !0, w(e, n, r);
			}, () => Reflect.apply(n.input.startQuery, n.input, [Object.freeze({
				allowAutofill: t.length > 0,
				searchString: t
			})])), !i) throw To(e, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_CONTEXT_MISSING", "firefox-urlbar-suggestions-query", "window.gURLBar.startQuery");
			return !0;
		} catch (e) {
			return y(s, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_QUERY_FAILED", "firefox-urlbar-suggestions-query", "window.gURLBar.startQuery", e), !1;
		}
	}, D = (n) => {
		let r = s !== null || d.size > 0 || c.phase !== "idle", i = s?.input;
		if (v(s), _(), n && r) try {
			let e = i ?? m().input;
			Reflect.apply(e.handleRevert, e, []);
		} catch (n) {
			t(To(e, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_REVERT_FAILED", "firefox-urlbar-suggestions-cancel", "window.gURLBar.handleRevert", n));
		}
		return (c.phase !== "idle" || c.results.length > 0) && g("idle"), r;
	}, O = (t) => {
		let n = f(), r = {
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
			if (!t) throw To(e, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_CAPABILITY_MISSING", "firefox-urlbar-suggestions-execute", "window.MouseEvent");
			return new t("click", r);
		}
		let i = n.KeyboardEvent;
		if (!i) throw To(e, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_CAPABILITY_MISSING", "firefox-urlbar-suggestions-execute", "window.KeyboardEvent");
		return new i("keydown", {
			...r,
			code: "Enter",
			key: "Enter"
		});
	}, k = Object.freeze({
		cancel: () => D(!0),
		execute: (e, t) => {
			let n, r;
			try {
				n = so(t), r = u.resolve(e);
			} catch {
				return Object.freeze({ status: "rejected" });
			}
			let i = d.get(e);
			if (!i || i.result !== r || i.queryRevision !== o) return Object.freeze({ status: "rejected" });
			if (i.execution === "native") return Object.freeze({ status: "native-required" });
			let a;
			try {
				a = m();
			} catch (e) {
				return y(s, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_EXECUTE_FAILED", "firefox-urlbar-suggestions-execute", "window.gURLBar.pickResult", e), Object.freeze({ status: "native-required" });
			}
			if (a.input !== i.input || a.manager !== i.manager) return Object.freeze({ status: "rejected" });
			v(s);
			let c = !1, l = a.input.searchMode;
			try {
				let e = O(n);
				if (T(a, (e) => {
					c = !0, _(), o += 1, g("querying"), w(e, a, o);
				}, () => Reflect.apply(a.input.pickResult, a.input, [
					r,
					e,
					null,
					a.selectedBrowser
				])), !c && a.input.searchMode !== l) {
					let e = typeof a.input.value == "string" ? a.input.value.slice(0, Bn) : "";
					_(), o += 1, g("querying"), T(a, (e) => {
						c = !0, w(e, a, o);
					}, () => Reflect.apply(a.input.startQuery, a.input, [Object.freeze({
						allowAutofill: e.length > 0,
						searchString: e
					})]));
				}
			} catch (e) {
				return y(s, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_EXECUTE_FAILED", "firefox-urlbar-suggestions-execute", "window.gURLBar.pickResult", e), Object.freeze({ status: "native-required" });
			}
			return c ? Object.freeze({ status: "continued" }) : (_(), g("idle"), Object.freeze({ status: "committed" }));
		},
		prepareNativeHandoff: () => D(!1),
		query(t) {
			if (f(), typeof t != "string" || t.length > 4096) throw To(e, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_QUERY_INVALID", "firefox-urlbar-suggestions-query", "window.gURLBar.value");
			return E(t);
		},
		snapshot() {
			return f(), c;
		},
		subscribe(t) {
			if (f(), typeof t != "function") throw To(e, "FENNEVIA_FIREFOX_URLBAR_SUGGESTIONS_LISTENER_INVALID", "firefox-urlbar-suggestions-subscribe", "urlbarSuggestions.subscribe");
			return l.add(t), b(() => l.delete(t));
		}
	});
	try {
		e.assertRequiredCapabilities(), p(), m();
	} catch (e) {
		throw i = !0, d.clear(), u.dispose(), r = null, e;
	}
	return Object.freeze({
		assertRequiredCapabilities: p,
		dispose() {
			return !i && (l.clear(), D(!0), u.dispose(), i = !0, r = null, !0);
		},
		snapshot() {
			return Object.freeze({
				activeQuery: s !== null,
				disposed: i,
				queryRevision: o,
				resultCount: u.snapshot().activeHandleCount,
				revision: a,
				subscriberCount: l.size
			});
		},
		urlbarSuggestions: k
	});
}
//#endregion
//#region src/app/window-controls-state.ts
var Io = Object.freeze([
	"close",
	"minimize",
	"toggle-maximize"
]), Lo = new Set(Io);
function Ro(e) {
	return typeof e == "string" && Lo.has(e);
}
//#endregion
//#region src/firefox/window-controls.ts
var zo = (e) => typeof e == "object" && !!e, Bo = (e) => typeof e == "function", Vo = (e, t) => {
	let n = e.document;
	if (!(!zo(n) || !Bo(n.getElementById))) return Reflect.apply(n.getElementById, n, [t]);
}, Ho = (e) => Object.freeze(e), Uo = Object.freeze([
	Ho({
		isAvailable: Bo,
		name: "window-controls.minimize",
		read: (e) => e.minimize,
		symbol: "window.minimize"
	}),
	Ho({
		isAvailable: Bo,
		name: "window-controls.maximize",
		read: (e) => e.maximize,
		symbol: "window.maximize"
	}),
	Ho({
		isAvailable: Bo,
		name: "window-controls.restore",
		read: (e) => e.restore,
		symbol: "window.restore"
	}),
	Ho({
		isAvailable: (e) => typeof e == "number",
		name: "window-controls.window-state",
		read: (e) => e.windowState,
		symbol: "window.windowState"
	}),
	Ho({
		isAvailable: (e) => typeof e == "number",
		name: "window-controls.state-maximized",
		read: (e) => e.STATE_MAXIMIZED,
		symbol: "window.STATE_MAXIMIZED"
	}),
	Ho({
		isAvailable: Bo,
		name: "window-controls.sizemode-events",
		read: (e) => e.addEventListener,
		symbol: "window.addEventListener"
	}),
	Ho({
		isAvailable: (e) => zo(e) && Bo(e.doCommand),
		name: "window-controls.close-command",
		read: (e) => Vo(e, "cmd_closeWindow"),
		symbol: "document.cmd_closeWindow.doCommand"
	})
]), Wo = (e) => Object.freeze(Uo.map((t) => {
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
})), Go = (e) => {
	let t = e.snapshot();
	return Object.freeze({
		buildId: t.buildId,
		firefoxVersion: t.firefoxVersion,
		windowKind: t.windowKind
	});
}, Ko = (e, t, n, r, i) => new g({
	cause: i,
	code: t,
	context: Go(e),
	phase: n,
	symbol: r
}), qo = (e) => {
	let t = e.windowState === e.STATE_MAXIMIZED || typeof e.STATE_FULLSCREEN == "number" && e.windowState === e.STATE_FULLSCREEN;
	return Object.freeze({ maximized: t });
};
function Jo({ boundary: e, onError: t, window: n }) {
	if (e.assertOwnsWindow(n), !zo(n) || typeof t != "function") throw Ko(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_OPTIONS_INVALID", "firefox-window-controls-create", "window");
	let r = n, i = !1, a = new Set(), o, s = () => {
		if (i || !r) throw Ko(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_DISPOSED", "firefox-window-controls-access", "window");
		return r;
	}, c = () => {
		let t = Wo(s()), n = t.find((e) => !e.snapshot.available);
		if (n) throw Ko(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_CAPABILITY_MISSING", "firefox-window-controls-capability", n.snapshot.symbol, n.cause);
		return Object.freeze(t.map((e) => e.snapshot));
	}, l = () => {
		let n;
		try {
			n = qo(s());
		} catch (e) {
			t(e);
			return;
		}
		for (let r of Array.from(a)) try {
			r(n);
		} catch (n) {
			t(Ko(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_SUBSCRIBER_FAILED", "firefox-window-controls-notify", "windowControls.subscribe", n));
		}
	}, u = (t) => {
		if (!Ro(t)) throw Ko(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_ACTION_INVALID", "firefox-window-controls-action", "windowControls.action");
		c();
		let n = s();
		try {
			if (t === "minimize") return Reflect.apply(n.minimize, n, []), !0;
			if (t === "toggle-maximize") return qo(n).maximized ? Reflect.apply(n.restore, n, []) : Reflect.apply(n.maximize, n, []), !0;
			let r = Vo(n, "cmd_closeWindow");
			if (!zo(r) || !Bo(r.doCommand)) throw Ko(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_CAPABILITY_MISSING", "firefox-window-controls-action", "document.cmd_closeWindow.doCommand");
			return Reflect.apply(r.doCommand, r, []), !0;
		} catch (n) {
			throw n instanceof g ? n : Ko(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_ACTION_FAILED", "firefox-window-controls-action", t === "close" ? "document.cmd_closeWindow.doCommand" : `window.${t}`, n);
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
		throw Ko(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_SUBSCRIBE_FAILED", "firefox-window-controls-subscribe", "window.addEventListener", t);
	}
	let d = Object.freeze({
		invoke: u,
		snapshot() {
			return qo(s());
		},
		subscribe(t) {
			if (typeof t != "function") throw Ko(e, "FENNEVIA_FIREFOX_WINDOW_CONTROLS_LISTENER_INVALID", "firefox-window-controls-subscribe", "windowControls.subscribe");
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
export { g as FirefoxBridgeError, Gt as addCustomizeLayoutEntry, jt as copyCustomizeLayout, kt as copyCustomizeLayoutEntry, Nt as createCustomizeLayout, Mt as createEmptyCustomizeLayout, re as createFirefoxBookmarksBridge, T as createFirefoxBridgeBoundary, Ae as createFirefoxBrowserToolsBridge, un as createFirefoxDownloadsBridge, Rn as createFirefoxLocaleBridge, Cr as createFirefoxNavigationBridge, ri as createFirefoxTabDragCoordinator, ai as createFirefoxTabsBridge, Da as createFirefoxToolbarWidgetsBridge, $a as createFirefoxUrlbarCoverageBridge, Fo as createFirefoxUrlbarSuggestionsBridge, Jo as createFirefoxWindowControlsBridge, b as createIdempotentDisposer, S as createOpaqueHandleRegistry, bn as createStaticLocaleBridge, wt as customizeLayoutBounds, Zt as customizeLayoutContainsWidget, St as customizeSpecialKinds, fn as defaultFenneviaLocale, Vt as findCustomizeLayoutEntry, qt as getCustomizeLayoutEntry, Ln as getShellChromeHostLabel, Dt as isCustomizeSpecialKind, Ot as isCustomizeWidgetId, _ as isFirefoxBridgeError, Jt as moveCustomizeLayoutEntry, Pt as parseCustomizeLayout, zt as parseCustomizePanels, It as parseCustomizeStyle, Kt as removeCustomizeLayoutEntry, Ft as serializeCustomizeLayout, Bt as serializeCustomizePanels, Lt as serializeCustomizeStyle, Tn as shellChromeHostNames, x as subscribeFirefoxEvent, v as toFirefoxBridgeDiagnostic, Yt as withCustomizeAdopted, Xt as withoutCustomizeAdopted };
